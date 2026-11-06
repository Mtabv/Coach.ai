"""
FuPa-Teil der Coach.AI-Erweiterung (inoffiziell).

Liest die öffentliche JSON-Schnittstelle, die auch die FuPa-Webseite nutzt (api.fupa.net/v1), und gibt nur die
Felder weiter, die Coach.AI laut Datenmodell von FuPa bezieht: Kader mit Position, Einsätzen, Toren, Vorlagen,
Kapitän, Spielerfotos (Adresse + Bildnachweis), MVP-Wert mit Stand, Körpergröße, Trainerteam und Tabelle.

  GET /api/coachai/fupa/team/{slug}                     Mannschaft (Wettbewerb, Saison)
  GET /api/coachai/fupa/finde-team?namen=a|b&saison=…   Mannschaft über den Vereinsnamen finden
  GET /api/coachai/fupa/tabelle?wettbewerb=…&saison=…   Tabelle des Wettbewerbs mit FuPa-Mannschaftskennungen
  GET /api/coachai/fupa/kader/{slug}                    Kader, Trainerteam, Kapitän
  GET /api/coachai/fupa/spieler?slugs=a,b&team=…        MVP-Wert (mit Stand), Größe, starker Fuß
  GET /api/coachai/fupa/foto?url=…                      Spielerfoto oder Wappen (für den PowerPoint-Export)

Alle Antworten werden 6 Stunden zwischengespeichert; höchstens drei gleichzeitige Abrufe.
"""
from __future__ import annotations

import asyncio
import re
import time
import unicodedata
from typing import Any, Dict, List, Optional

import httpx
from fastapi import Depends, HTTPException, Query

from fussball_api.main import app
from fussball_api.security import get_api_key

API = "https://api.fupa.net/v1"
TTL = 6 * 3600
SLUG_RE = re.compile(r"^[a-z0-9-]{2,120}$")
SEASON_RE = r"^\d{4}-\d{2}$"
PHOTO_SIZE = "200x200.jpeg"

_cache: Dict[str, tuple] = {}
_sem = asyncio.Semaphore(3)
_client: Optional[httpx.AsyncClient] = None


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=20, headers={"Accept": "application/json", "User-Agent": "CoachAI-Dienst/1.0"})
    return _client


async def _json(path: str) -> Optional[Any]:
    """GET auf api.fupa.net mit Zwischenspeicher. None bei 404 (z. B. geratene Kennung existiert nicht)."""
    hit = _cache.get(path)
    if hit and time.time() - hit[0] < TTL:
        return hit[1]
    async with _sem:
        try:
            res = await _http().get(f"{API}{path}")
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"FuPa nicht erreichbar: {e}") from e
    if res.status_code == 404:
        data = None
    elif res.status_code != 200:
        raise HTTPException(status_code=502, detail=f"FuPa antwortet mit HTTP {res.status_code}")
    else:
        data = res.json()
    _cache[path] = (time.time(), data)
    return data


def _slug(v: str) -> str:
    if not SLUG_RE.match(v or ""):
        raise HTTPException(status_code=400, detail="Ungültige FuPa-Kennung")
    return v


def _photo(img: Optional[dict]) -> Dict[str, Optional[str]]:
    if not img or not img.get("path") or img.get("svg"):
        return {"photo_url": None, "photo_source": None}
    return {"photo_url": f"{img['path']}{PHOTO_SIZE}", "photo_source": img.get("source") or None}


def _image(img: Optional[dict]) -> Optional[str]:
    """Wappen/Teambild als 200×200-PNG (FuPa rendert es in beliebiger Größe, auch SVG-Wappen)."""
    if not img or not img.get("path"):
        return None
    return f"{img['path']}200x200.png"


def _team(d: dict) -> Dict[str, Any]:
    comp = d.get("competition") or {}
    season = (comp.get("season") or {})
    return {
        "slug": d.get("slug"),
        "name": (d.get("name") or {}).get("full"),
        "club_slug": d.get("clubSlug") or (d.get("club") or {}).get("slug"),
        "level": d.get("level"),
        "age_group": (d.get("ageGroup") or {}).get("name"),
        "competition_slug": comp.get("slug"),
        "competition_name": comp.get("name"),
        "season_slug": season.get("slug"),
        "season_name": season.get("name"),
        "image_url": _image(d.get("image")),
    }


def slugify(name: str) -> str:
    s = name.lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        s = s.replace(a, b)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[/.'’]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


@app.get("/api/coachai/fupa/team/{slug}", dependencies=[Depends(get_api_key)], tags=["Coach.AI · FuPa"])
async def fupa_team(slug: str):
    d = await _json(f"/teams/{_slug(slug)}")
    if not d:
        raise HTTPException(status_code=404, detail="Mannschaft auf FuPa nicht gefunden")
    return _team(d)


@app.get("/api/coachai/fupa/finde-team", dependencies=[Depends(get_api_key)], tags=["Coach.AI · FuPa"])
async def fupa_finde_team(
    namen: str = Query(..., max_length=400, description="Namensvarianten des Vereins, getrennt durch |"),
    saison: str = Query(..., pattern=SEASON_RE),
    art: str = Query("m", pattern=r"^[a-z0-9-]{1,6}$"),
    nummer: int = Query(1, ge=1, le=9),
):
    """Leitet aus dem Vereinsnamen die FuPa-Kennung ab (z. B. „TSG Wilhelmshöhe“ → tsg-wilhelmshoehe) und prüft sie.
    Liefert null, wenn keine Variante existiert – es wird nichts geraten, was FuPa nicht bestätigt."""
    tried = set()
    for raw in namen.split("|")[:6]:
        club = slugify(raw)
        if not club or club in tried or not SLUG_RE.match(club):
            continue
        tried.add(club)
        d = await _json(f"/teams/{club}-{art}{nummer}-{saison}")
        if d:
            return _team(d)
    return None


@app.get("/api/coachai/fupa/tabelle", dependencies=[Depends(get_api_key)], tags=["Coach.AI · FuPa"])
async def fupa_tabelle(wettbewerb: str, saison: str = Query(..., pattern=SEASON_RE)):
    d = await _json(f"/standings?competition={_slug(wettbewerb)}&season={saison}")
    rows = []
    for r in (d or {}).get("standings", []):
        t = r.get("team") or {}
        rows.append({
            "rank": r.get("rank"),
            "team_slug": t.get("slug"),
            "team": (t.get("name") or {}).get("full"),
            "team_image": _image(t.get("image")),
            "matches": r.get("matches"),
            "wins": r.get("wins"),
            "draws": r.get("draws"),
            "defeats": r.get("defeats"),
            "goals_for": r.get("ownGoals"),
            "goals_against": r.get("againstGoals"),
            "points": r.get("points"),
            "penalty_points": r.get("penaltyPoints"),
        })
    return {"competition": wettbewerb, "season": saison, "rows": rows}


@app.get("/api/coachai/fupa/kader/{slug}", dependencies=[Depends(get_api_key)], tags=["Coach.AI · FuPa"])
async def fupa_kader(slug: str):
    d = await _json(f"/teams/{_slug(slug)}/squad")
    if d is None:
        raise HTTPException(status_code=404, detail="Kader auf FuPa nicht gefunden")
    players: List[Dict[str, Any]] = []
    for p in d.get("players", []):
        if p.get("isDeactivated"):
            continue
        flags = p.get("flags") or []
        players.append({
            "slug": p.get("slug"),
            "first_name": p.get("firstName"),
            "last_name": p.get("lastName"),
            "position": p.get("position"),
            "number": p.get("jerseyNumber"),
            "matches": p.get("matches"),
            "goals": p.get("goals"),
            "assists": p.get("assists"),
            "captain": "captain" in flags,
            "vice_captain": "viceCaptain" in flags,
            "age": p.get("age"),
            **_photo(p.get("image")),
        })
    coaches = [
        {"name": f"{c.get('firstName', '')} {c.get('lastName', '')}".strip(), "role": c.get("role"), "photo_url": _photo(c.get("image"))["photo_url"]}
        for c in d.get("coaches", [])
        if not c.get("isDeactivated")
    ]
    info = d.get("info") or {}
    captain = (info.get("captain") or {}).get("slug")
    return {"team_slug": slug, "players": players, "coaches": coaches, "captain_slug": captain, "season_target": info.get("seasonTarget") or None}


@app.get("/api/coachai/fupa/spieler", dependencies=[Depends(get_api_key)], tags=["Coach.AI · FuPa"])
async def fupa_spieler(slugs: str = Query(..., max_length=1500), team: str = Query(...)):
    team = _slug(team)
    wanted = [_slug(s) for s in slugs.split(",") if s][:10]

    async def one(s: str):
        d = await _json(f"/profiles/{s}/details")
        if not d:
            return None
        season = next((x for x in (d.get("playerRole") or {}).get("seasons", []) if (x.get("team") or {}).get("slug") == team), None)
        stats = (season or {}).get("statistics") or {}
        role = d.get("currentRole") or {}
        same_team = (role.get("team") or {}).get("slug") == team
        details = d.get("details") or {}
        height = details.get("height") or None
        mvp = stats.get("teamMvp")
        return {
            "slug": s,
            "mvp": mvp if isinstance(mvp, (int, float)) and mvp > 0 else None,
            "mvp_updated_at": (role.get("mvp") or {}).get("updatedAt") if same_team else None,
            "height_cm": height if isinstance(height, int) and 140 <= height <= 220 else None,
            "strong_foot": details.get("strongFoot") if details.get("strongFoot") not in (None, "", "unknown") else None,
            "minutes": stats.get("minutes"),
            "top_eleven": stats.get("topEleven"),
        }

    out = await asyncio.gather(*(one(s) for s in wanted))
    return [x for x in out if x]


_photo_cache: Dict[str, tuple] = {}
PHOTO_RE = re.compile(r"^https://image\.fupa\.net/(player|club|team)/[A-Za-z0-9]{6,20}/\d{2,3}x\d{2,3}\.(jpeg|png)$")


@app.get("/api/coachai/fupa/foto", dependencies=[Depends(get_api_key)], tags=["Coach.AI · FuPa"])
async def fupa_foto(url: str = Query(..., max_length=200)):
    """Spielerfoto oder Wappen für den PowerPoint-Export (der Browser darf es wegen fehlender CORS-Freigabe nicht
    direkt lesen). Nur Adressen von image.fupa.net/player|club|team/…"""
    from fastapi import Response

    if not PHOTO_RE.match(url):
        raise HTTPException(status_code=400, detail="Nur FuPa-Spielerfotos und -Wappen")
    hit = _photo_cache.get(url)
    if not hit or time.time() - hit[0] > TTL:
        async with _sem:
            try:
                res = await _http().get(url)
            except httpx.HTTPError as e:
                raise HTTPException(status_code=502, detail=f"Foto nicht abrufbar: {e}") from e
        if res.status_code != 200 or not res.headers.get("content-type", "").startswith("image/"):
            raise HTTPException(status_code=502, detail="Foto nicht abrufbar")
        hit = (time.time(), res.content, res.headers.get("content-type", "image/jpeg").split(";")[0])
        _photo_cache[url] = hit
    return Response(content=hit[1], media_type=hit[2], headers={"Cache-Control": "max-age=86400"})
