"""
Coach.AI-Erweiterung für den Crawler „fussball_de_api“ (https://github.com/Zetabytes/fussball_de_api, MIT).

Startet die Crawler-App und ergänzt Endpunkte unter /api/coachai/…, die Coach.AI für ein vollständiges
Datenbild braucht:

  GET /api/coachai/team/{team_id}/liga             Tabelle mit Team-IDs, Heim-/Auswärtstabelle,
                                                   Hinweis auf Punktabzüge, Torjägerliste, Staffel
  GET /api/coachai/team/{team_id}/saison?von=&bis= Alle Spiele der Mannschaft im Zeitraum (Liga, Pokal, Test)
  GET /api/coachai/staffel/{staffel}/spieltag/{n}  Paarungen eines Spieltags mit Datum/Anstoß
  GET /api/coachai/spiele/aufstellungen?ids=a,b    Aufstellungen und Torschützen ausgewählter Spiele
  GET /api/coachai/fupa/…                          FuPa: Kader, Spielerfotos, MVP-Wert, Tabelle (fupa_dienst.py)

Start (im Ordner des Crawlers, dessen venv aktiv ist):

  PYTHONPATH=<Pfad zu Coach.ai>/tools/fussballde-dienst uvicorn coachai_dienst:app --port 8000

Alle Abrufe laufen über den Zwischenspeicher des Crawlers (fetch_url) und nur auf Anfrage.
Vereinslogos werden nicht heruntergeladen (spart Zeit und Abrufe).
"""
from __future__ import annotations

import asyncio
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup
from fastapi import Depends, HTTPException, Query

from fussball_api import crawler
from fussball_api.cache import fetch_url
from fussball_api.config import settings
from fussball_api.main import app
from fussball_api.security import get_api_key

BASE = "https://www.fussball.de"
BERLIN = ZoneInfo("Europe/Berlin")
UTC = ZoneInfo("UTC")
ID_RE = re.compile(r"^[A-Za-z0-9-]{16,48}$")

# Logos nicht herunterladen: Coach.AI nutzt sie (noch) nicht, und jeder Download kostet einen Abruf.
crawler.download_and_rewrite_logo = lambda url: url  # type: ignore[assignment]

# Höflich bleiben: höchstens drei gleichzeitige Seitenabrufe aus dieser Erweiterung.
_sem = asyncio.Semaphore(3)


def _check_id(v: str) -> str:
    if not ID_RE.match(v):
        raise HTTPException(status_code=400, detail="Ungültige ID")
    return v


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[​-‍⁠﻿­]", "", s or "")).strip()


async def _get(url: str, ttl: int) -> str:
    async with _sem:
        res = await asyncio.to_thread(fetch_url, url, "GET", None, None, ttl)
    if res is None or res.status_code != 200:
        raise HTTPException(status_code=502, detail=f"fussball.de nicht erreichbar: {url}")
    return res.text or ""


def _team_id_from_href(href: Optional[str]) -> Optional[str]:
    m = re.search(r"team-id/([A-Za-z0-9]+)", href or "")
    return m.group(1) if m else None


def _int(s: str) -> Optional[int]:
    s = (s or "").strip()
    return int(s) if re.fullmatch(r"-?\d+", s) else None


def _parse_table(table_tag) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for tr in table_tag.select("tr"):
        club = tr.select_one("td.column-club")
        if not club:
            continue
        tds = tr.find_all("td")
        idx = tds.index(club)
        nums = [td.get_text(" ", strip=True) for td in tds[idx + 1 :]]
        # Spalten: Sp, G, U, V, Tore, Diff, Pkt
        if len(nums) < 7:
            continue
        goals = re.findall(r"\d+", nums[4])
        name_tag = club.select_one(".club-name")
        rows.append(
            {
                "place": _int(tr.select_one("td.column-rank").get_text(strip=True).rstrip(".")) if tr.select_one("td.column-rank") else None,
                "team": _clean(name_tag.get_text(" ", strip=True) if name_tag else club.get_text(" ", strip=True)),
                "team_id": _team_id_from_href((club.select_one("a") or {}).get("href") if club.select_one("a") else None),
                "games": _int(nums[0]),
                "won": _int(nums[1]),
                "draw": _int(nums[2]),
                "lost": _int(nums[3]),
                "goals_for": int(goals[0]) if len(goals) == 2 else None,
                "goals_against": int(goals[1]) if len(goals) == 2 else None,
                "points": _int(nums[6]),
                "marker": _clean(" ".join(s.get_text(" ", strip=True) for s in club.select(".club-name ~ *, .club-abbr"))) or None,
            }
        )
    return rows


def _deduction_note(soup: BeautifulSoup) -> Optional[str]:
    el = soup.find(string=lambda t: t and "Tabellenrechnung" in t)
    if not el:
        return None
    box = el.find_parent(["div", "section"])
    text = _clean(box.get_text(" ", strip=True)) if box else ""
    text = text.replace("Hinweis zur Tabellenrechnung", "").strip()
    return text or None


@app.get("/api/coachai/team/{team_id}/liga", dependencies=[Depends(get_api_key)], tags=["Coach.AI"])
async def coachai_liga(team_id: str):
    _check_id(team_id)
    html = await _get(f"{BASE}/ajax.team.table/-/team-id/{team_id}", settings.CACHE_TTL_TABLE)
    soup = BeautifulSoup(html, "lxml")
    m = re.search(r"staffel/([A-Za-z0-9]+(?:-[A-Z])?)", html)
    staffel = m.group(1) if m else None
    table_tag = soup.select_one("table")
    table = _parse_table(table_tag) if table_tag else []
    result: Dict[str, Any] = {
        "staffel_id": staffel,
        "staffel_name": None,
        "table": table,
        "deduction_note": _deduction_note(soup),
        "home_table": [],
        "away_table": [],
        "scorers": [],
    }
    if not staffel:
        return result

    async def home_away():
        h = await _get(f"{BASE}/ajax.actual.table.home.away/-/staffel/{staffel}", settings.CACHE_TTL_TABLE)
        s = BeautifulSoup(h, "lxml")
        tables = s.select("table")
        if len(tables) >= 2:
            result["home_table"] = _parse_table(tables[0])
            result["away_table"] = _parse_table(tables[1])
        if not result["deduction_note"]:
            result["deduction_note"] = _deduction_note(s)

    async def scorers():
        out: List[Dict[str, Any]] = []
        offset = 0
        for _ in range(10):  # höchstens 300 Spieler
            url = f"{BASE}/ajax.top.scorer.loadmore/-/max/30/mime-type/JSON/offset/{offset}/staffel/{staffel}"
            raw = await _get(url, settings.CACHE_TTL_TABLE)
            try:
                import json

                data = json.loads(raw)
            except ValueError:
                break
            s = BeautifulSoup(data.get("html", ""), "lxml")
            n = 0
            for tr in s.select("tr"):
                p = tr.select_one(".player-name")
                c = tr.select_one(".club-name")
                g = tr.select_one(".column-goals")
                if not (p and c and g):
                    continue
                n += 1
                club_a = tr.select_one("td.column-club a")
                out.append(
                    {
                        "rank": _int(tr.select_one(".column-rank").get_text(strip=True)) if tr.select_one(".column-rank") else None,
                        "name": _clean(p.get_text(" ", strip=True)),
                        "team": _clean(c.get_text(" ", strip=True)),
                        "team_id": _team_id_from_href(club_a.get("href") if club_a else None),
                        "goals": _int(g.get_text(strip=True)),
                    }
                )
            if data.get("final") or n == 0:
                break
            offset += 30
        result["scorers"] = out

    async def name():
        h = await _get(f"{BASE}/spieltagsuebersicht/x/-/staffel/{staffel}", settings.CACHE_TTL_TEAMS)
        t = BeautifulSoup(h, "lxml").title
        if t:
            result["staffel_name"] = _clean(t.get_text().split(":")[0])

    await asyncio.gather(home_away(), scorers(), name())
    return result


def _parse_score(text: str):
    """Ergebnis aus entschlüsseltem Text. Verlegte Spiele zeigen statt eines Ergebnisses ein Datum."""
    t = _clean(text or "")
    if re.search(r"\d{1,2}\.\d{1,2}\.\d{2,4}", t):
        return None, None, t  # z. B. „22.07.2026 18:30“ = verlegt
    m = re.search(r"(?<![\d.])(\d{1,2})\s*:\s*(\d{1,2})(?![\d.])", t)
    if m:
        return m.group(1), m.group(2), None
    rest = re.sub(r"[\s:]", "", t)
    return None, None, (t or None) if rest else None


@app.get("/api/coachai/team/{team_id}/saison", dependencies=[Depends(get_api_key)], tags=["Coach.AI"])
async def coachai_saison(team_id: str, von: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"), bis: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$")):
    """Spielplan einer Mannschaft. Liest nur die Spielplanseite selbst (ein Abruf je Zeitraum),
    keine Detailseiten je Spiel."""
    _check_id(team_id)
    url = f"{BASE}/ajax.team.matchplan/-/datum-bis/{bis}/datum-von/{von}/match-type/-1/max/100/mode/PAGE/show-venues/checked/team-id/{team_id}"
    html = await _get(url, settings.CACHE_TTL_GAMES)
    soup = BeautifulSoup(html, "lxml")
    games: List[Dict[str, Any]] = []
    head: Dict[str, Any] = {}
    for tr in soup.select("tr"):
        cls = tr.get("class") or []
        if "row-headline" in cls:
            text = _clean(tr.get_text(" ", strip=True))
            parts = [p for p in (x.strip() for x in text.split("|")) if p]
            # „Sonntag, 05.07.2026 - 15:00 Uhr | [Altersklasse |] Wettbewerb“
            head = {"datetime_utc": _parse_date_time(parts[0]) if parts else None, "competition": parts[-1] if len(parts) > 1 else None}
            continue
        if "row-venue" in cls:
            if games and games[-1].get("location") is None:
                games[-1]["location"] = _clean(tr.get_text(" ", strip=True)).replace("Rasenplatz, ", "") or None
            continue
        clubs = tr.select("td.column-club")
        if len(clubs) != 2 or not head:
            continue
        score = tr.select_one("td.column-score")
        score_text = await crawler._deobfuscate_all(score) if score else ""
        hs, as_, note = _parse_score(score_text)
        link = score.select_one("a") if score else None
        gm = re.search(r"/-/spiel/([A-Za-z0-9]+)", link.get("href", "")) if link else None
        name = lambda c: _clean((c.select_one(".club-name") or c).get_text(" ", strip=True))  # noqa: E731
        tid = lambda c: _team_id_from_href(c.select_one("a").get("href") if c.select_one("a") else None)  # noqa: E731
        games.append(
            {
                "id": gm.group(1) if gm else f"{head.get('datetime_utc')}_{name(clubs[0])}_{name(clubs[1])}",
                "datetime_utc": head.get("datetime_utc"),
                "competition": head.get("competition"),
                "home_team": name(clubs[0]),
                "home_team_id": tid(clubs[0]),
                "away_team": name(clubs[1]),
                "away_team_id": tid(clubs[1]),
                "home_score": hs,
                "away_score": as_,
                "status": note,
                "location": None,
            }
        )
    return games


def _parse_date_time(text: str) -> Optional[str]:
    d = re.search(r"(\d{2})\.(\d{2})\.(\d{2,4})", text)
    t = re.search(r"(\d{1,2}):(\d{2})", text)
    if not d:
        return None
    year = int(d.group(3))
    if year < 100:
        year += 2000
    hh, mm = (int(t.group(1)), int(t.group(2))) if t else (0, 0)
    local = datetime(year, int(d.group(2)), int(d.group(1)), hh, mm, tzinfo=BERLIN)
    return local.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ") if t else None


@app.get("/api/coachai/staffel/{staffel}/spieltag/{n}", dependencies=[Depends(get_api_key)], tags=["Coach.AI"])
async def coachai_spieltag(staffel: str, n: int):
    _check_id(staffel)
    if n < 1 or n > 60:
        raise HTTPException(status_code=400, detail="Ungültiger Spieltag")
    html = await _get(f"{BASE}/spieltag/x/-/spieltag/{n}/staffel/{staffel}", settings.CACHE_TTL_GAMES)
    soup = BeautifulSoup(html, "lxml")
    table = soup.select_one("#matches table") or soup.select_one("table")
    games: List[Dict[str, Any]] = []
    current_date = ""
    if table:
        for tr in table.select("tr"):
            if "row-headline" in (tr.get("class") or []):
                current_date = await crawler._deobfuscate_all(tr)
                continue
            clubs = tr.select("td.column-club")
            if len(clubs) != 2:
                continue
            # Ligen mit ungerader Mannschaftszahl: Zeile „spielfrei“ ohne Gegner überspringen.
            names = [c.select_one(".club-name") for c in clubs]
            if not all(names):
                continue
            date_cell = tr.select_one("td.column-date")
            date_text = await crawler._deobfuscate_all(date_cell) if date_cell else ""
            # Zeile enthält oft nur die Uhrzeit; das Datum steht in der Kopfzeile davor.
            combined = date_text if re.search(r"\d{2}\.\d{2}\.", date_text) else f"{current_date} {date_text}"
            score = tr.select_one("td.column-score")
            score_text = await crawler._deobfuscate_all(score) if score else ""
            game_a = score.select_one("a") if score else None
            gm = re.search(r"/-/spiel/([A-Za-z0-9]+)", game_a.get("href", "")) if game_a else None
            hs, as_, note = _parse_score(score_text)
            games.append(
                {
                    "game_id": gm.group(1) if gm else None,
                    "datetime_utc": _parse_date_time(combined),
                    "date_text": _clean(combined),
                    "home_team": _clean(names[0].get_text(" ", strip=True)),
                    "home_team_id": _team_id_from_href(clubs[0].select_one("a").get("href") if clubs[0].select_one("a") else None),
                    "away_team": _clean(names[1].get_text(" ", strip=True)),
                    "away_team_id": _team_id_from_href(clubs[1].select_one("a").get("href") if clubs[1].select_one("a") else None),
                    "home_score": hs,
                    "away_score": as_,
                    "note": note,  # z. B. „abgesagt“ oder neues Datum bei Verlegung
                }
            )
    return {"staffel_id": staffel, "matchday": n, "games": games}


@app.get("/api/coachai/spiele/aufstellungen", dependencies=[Depends(get_api_key)], tags=["Coach.AI"])
async def coachai_aufstellungen(ids: str = Query(..., max_length=900)):
    # Bis zu 17 Spiele: alle Ligaspiele einer Hinrunde (Torminuten für die Auswertung der Spielphasen).
    game_ids = [_check_id(i) for i in ids.split(",") if i][:17]

    async def one(gid: str):
        async with _sem:
            lineup = await crawler.get_game_lineup(gid)
        async with _sem:
            game = await crawler.get_game_by_id(gid)
        dump = lambda o: (o.model_dump(mode="json") if hasattr(o, "model_dump") else o.dict()) if o else None  # noqa: E731
        g = dump(game)
        return {
            "game_id": gid,
            "lineup": dump(lineup),
            "events": (g or {}).get("match_events") or [],
            "home_team": (g or {}).get("home_team"),
            "away_team": (g or {}).get("away_team"),
        }

    return await asyncio.gather(*(one(g) for g in game_ids))


# FuPa-Endpunkte (Kader, Spielerfotos, MVP-Wert) am selben Dienst anmelden.
import fupa_dienst  # noqa: E402,F401
