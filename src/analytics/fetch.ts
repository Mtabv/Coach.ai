import { now } from '../domain/factory';
import type { LocalDate, TeamProfile } from '../domain/types';
import { fdApi, type FdGameDetail, type FdMatchdayGame, type FdTableRow } from '../data/fussballDe/api';
import { berlinDateTime, categoryOf, cleanName, competitionTypeOf, foldName, seasonRange } from '../data/fussballDe/mapping';
import { fupaTeamFor, ownFupaLink, ownFussballDeTeamId } from '../data/fussballDe/provider';
import { fupaSeason } from '../data/fupa/mapping';
import { fupaApi } from '../data/fupa/api';
import { binOf } from './report';
import type { LeagueMinutes, SeasonData, SeasonGame, SeasonGoal, SeasonTableRow } from './types';

/** Der Dienst liefert höchstens 17 Spielberichte je Abruf. */
const CHUNK = 17;

function row(r: FdTableRow): SeasonTableRow | null {
  if (r.place === null || r.games === null) return null;
  return { place: r.place, team: cleanName(r.team), games: r.games, won: r.won ?? 0, draw: r.draw ?? 0, lost: r.lost ?? 0, goalsFor: r.goals_for ?? 0, goalsAgainst: r.goals_against ?? 0, points: r.points ?? 0 };
}

function minuteOf(t: string | null): number | null {
  const m = /^(\d{1,3})/.exec((t ?? '').replace(/[’']/g, ''));
  return m ? Number(m[1]) : null;
}

/** Tore aus dem Spielbericht; null, wenn der Bericht nicht zum Endergebnis passt (unvollständig). */
export function goalsFromDetail(detail: FdGameDetail | undefined, side: 'home' | 'away', expected: number): SeasonGoal[] | null {
  if (!detail) return null;
  const goals: SeasonGoal[] = [];
  for (const e of detail.events ?? []) {
    if (e.type !== 'goal') continue;
    const minute = minuteOf(e.time);
    if (minute === null || !e.team) return null;
    const half = e.half === 1 || e.half === 2 ? e.half : null;
    goals.push({ minute, half, own: e.team === side, scorer: e.description ? cleanName(e.description) || null : null });
  }
  return goals.length === expected ? goals : null;
}

/**
 * Lädt alle Ligaspiele der laufenden Saison bis gestern samt Spielberichten (fussball.de) und die Spielerfotos (FuPa).
 * Nur auf Klick; Ergebnis wird gespeichert, damit der Report ohne erneuten Abruf angezeigt werden kann.
 */
export async function loadSeasonData(team: TeamProfile, today: LocalDate, progress: (msg: string) => void = () => {}, f?: typeof fetch, withLeague = true): Promise<SeasonData> {
  const ownId = ownFussballDeTeamId(team);
  if (!ownId) throw new Error('Im Mannschaftsprofil fehlt der Link zur Mannschaftsseite auf fussball.de.');
  progress('Tabelle wird geladen …');
  const liga = await fdApi.liga(ownId, f);
  const range = seasonRange(today);
  progress('Spielplan der Saison wird geladen …');
  const fixtures = await fdApi.saison(ownId, range.von, range.bis, f);
  const ownTableRow = liga.table.find((r) => r.team_id === ownId);
  const ownName = cleanName(ownTableRow?.team ?? team.name);
  const isOwn = (id: string | null | undefined, name: string) => id === ownId || foldName(name) === foldName(ownName);
  const played = fixtures.filter((g) => {
    const d = berlinDateTime(g.datetime_utc)?.date ?? '';
    return competitionTypeOf(g.competition) === 'liga' && d < today && /^\d+$/.test(String(g.home_score ?? '')) && /^\d+$/.test(String(g.away_score ?? ''));
  });

  const details = new Map<string, FdGameDetail>();
  const fetchDetails = async (ids: string[], label: string) => {
    for (let i = 0; i < ids.length; i += CHUNK) {
      progress(`${label} ${i + 1}–${Math.min(i + CHUNK, ids.length)} von ${ids.length} werden geladen …`);
      const part = await fdApi.aufstellungen(ids.slice(i, i + CHUNK), f);
      for (const d of part) details.set(d.game_id, d);
    }
  };
  await fetchDetails(played.map((g) => g.id), 'Spielberichte');

  // Ligavergleich: Spielberichte aller Ligaspiele der Staffel (beim ersten Abruf einige Minuten, danach im Zwischenspeicher des Dienstes).
  let league: LeagueMinutes | null = null;
  if (withLeague && liga.staffel_id) {
    try {
      const all = await leagueGames(liga.staffel_id, today, progress, f);
      await fetchDetails(all.filter((g) => !details.has(g.game_id!)).map((g) => g.game_id!), 'Spielberichte der Liga');
      league = leagueMinutes(all, details);
    } catch {
      league = null;
    }
  }

  const games: SeasonGame[] = played.map((g) => {
    const home = isOwn(g.home_team_id, g.home_team);
    const side = home ? 'home' : 'away';
    const hs = Number(g.home_score), as = Number(g.away_score);
    const goalsFor = home ? hs : as, goalsAgainst = home ? as : hs;
    const detail = details.get(g.id);
    const lineup = detail?.lineup?.[side];
    const starting = lineup?.starting?.map((p) => cleanName(p.name)).filter(Boolean) ?? [];
    return {
      id: g.id,
      date: berlinDateTime(g.datetime_utc)!.date,
      opponent: cleanName(home ? g.away_team : g.home_team),
      home,
      goalsFor,
      goalsAgainst,
      goals: goalsFromDetail(detail, side, goalsFor + goalsAgainst),
      starting: starting.length ? starting : null,
    };
  });

  // Spielerfotos: FuPa ist die Hauptquelle; fehlt dort ein Bild (oder die Mannschaft), wird das Bild aus der
  // fussball.de-Aufstellung genommen. Der Report funktioniert auch ganz ohne Fotos.
  const names = new Set<string>();
  for (const g of games) {
    g.starting?.forEach((p) => names.add(p));
    g.goals?.forEach((x) => x.own && x.scorer && names.add(x.scorer));
  }
  const fdImages = new Map<string, string>();
  for (const g of played) {
    const side = isOwn(g.home_team_id, g.home_team) ? 'home' : 'away';
    const lu = details.get(g.id)?.lineup?.[side];
    for (const p of [...(lu?.starting ?? []), ...(lu?.substitutes ?? [])]) {
      const n = cleanName(p.name);
      if (n && p.image_url && !fdImages.has(n)) fdImages.set(n, p.image_url);
    }
  }
  const photos: Record<string, string> = {};
  let crest: string | null = team.crest ?? null;
  const sources = [`fussball.de: Tabelle und ${played.length} Spielberichte der Saison ${team.season || ''}`.trim()];
  if (league) sources.push(`Ligavergleich: ${league.withGoals} von ${league.games} Ligaspielen mit vollständigen Torminuten`);
  else if (withLeague) sources.push('Ligavergleich nicht verfügbar');
  // FuPa-Mannschaft über den Link im Profil oder – wie beim Dossier – über den Vereinsnamen (von FuPa bestätigt, nicht geraten).
  const fupaOwn = await fupaTeamFor(ownFupaLink(team), [team.name, ownName], fupaSeason(today), categoryOf(liga.staffel_name), f).catch(() => null);
  let fromFupa = 0;
  if (fupaOwn) {
    progress('Spielerfotos von FuPa werden geladen …');
    try {
      const squad = await fupaApi.kader(fupaOwn.team.slug, f);
      for (const n of names) {
        const p = matchSquadPlayer(squad.players, n);
        if (p?.photo_url) {
          photos[n] = p.photo_url;
          fromFupa++;
        }
      }
      crest = crest ?? fupaOwn.team.image_url ?? null;
    } catch {
      /* weiter mit fussball.de-Bildern */
    }
  }
  let fromFd = 0;
  for (const n of names) {
    if (!photos[n] && fdImages.has(n)) {
      photos[n] = fdImages.get(n)!;
      fromFd++;
    }
  }
  if (fromFupa || fromFd) sources.push(`Spielerfotos: ${[fromFupa ? `${fromFupa} FuPa` : '', fromFd ? `${fromFd} fussball.de` : ''].filter(Boolean).join(', ')}`);

  return {
    teamId: team.id,
    fetchedAt: now(),
    until: today,
    season: team.season,
    competition: liga.staffel_name,
    ownName,
    table: liga.table.map((r) => { const x = row(r); return x && r.team_id === ownId ? { ...x, team: ownName } : x; }).filter((r): r is SeasonTableRow => r !== null),
    homeRow: pick(liga.home_table, ownId),
    awayRow: pick(liga.away_table, ownId),
    games,
    photos,
    crest,
    sources,
    league,
  };
}

const isScore = (v: string | null) => /^\d+$/.test(String(v ?? ''));

/** Alle gespielten Partien der Staffel über die Spieltage (Nachholspiele erscheinen mehrfach – einmal gezählt). */
async function leagueGames(staffel: string, today: LocalDate, progress: (msg: string) => void, f?: typeof fetch): Promise<FdMatchdayGame[]> {
  const byId = new Map<string, FdMatchdayGame>();
  let empty = 0;
  for (let n = 1; n <= 40; n++) {
    progress(`Spieltage der Liga werden gelesen (${n}) …`);
    const md = await fdApi.spieltag(staffel, n, f).catch(() => null);
    if (!md || !md.games.length) break;
    const played = md.games.filter((g) => g.game_id && isScore(g.home_score) && isScore(g.away_score) && (berlinDateTime(g.datetime_utc)?.date ?? '') < today);
    for (const g of played) byId.set(g.game_id!, g);
    // Nach zwei Spieltagen ohne Ergebnis ist die laufende Saison durchgelesen (eine Winterpause überspringt das nicht).
    empty = played.length ? 0 : empty + 1;
    if (empty >= 2) break;
  }
  return [...byId.values()];
}

/** Torminuten der Liga; nur Spiele, deren Spielbericht genau so viele Tore enthält wie das Ergebnis. */
export function leagueMinutes(games: FdMatchdayGame[], details: Map<string, FdGameDetail>): LeagueMinutes {
  const bins = [0, 0, 0, 0, 0, 0];
  let withGoals = 0;
  for (const g of games) {
    const goals = goalsFromDetail(details.get(g.game_id!), 'home', Number(g.home_score) + Number(g.away_score));
    if (!goals) continue;
    withGoals++;
    for (const x of goals) bins[binOf(x.minute, x.half)]++;
  }
  return { games: games.length, withGoals, bins };
}

function pick(rows: FdTableRow[], ownId: string): SeasonTableRow | null {
  const r = rows.find((x) => x.team_id === ownId);
  return r ? row(r) : null;
}

type SquadName = { first_name: string | null; last_name: string | null };

/**
 * Spieler aus dem FuPa-Kader zum Namen im Spielbericht finden. fussball.de führt oft alle Vornamen
 * („Anton Nady Wasef Moawed“), FuPa nur den Rufnamen („Anton Moawed“). Reihenfolge:
 * voller Name → erster Vorname + Nachname → Nachname, wenn er im Kader nur einmal vorkommt.
 */
export function matchSquadPlayer<T extends SquadName>(players: T[], name: string): T | null {
  const full = (p: SquadName) => foldName(`${p.first_name ?? ''} ${p.last_name ?? ''}`);
  const target = foldName(name);
  const exact = players.find((p) => full(p) === target);
  if (exact) return exact;
  const parts = target.split(' ').filter(Boolean);
  if (parts.length < 2) return null;
  const first = parts[0];
  const endsWith = (p: SquadName) => {
    const last = foldName(p.last_name);
    return Boolean(last) && (target === last || target.endsWith(` ${last}`));
  };
  const firstLast = players.filter((p) => endsWith(p) && foldName(p.first_name).split(' ')[0] === first);
  if (firstLast.length === 1) return firstLast[0];
  const lastOnly = players.filter(endsWith);
  return lastOnly.length === 1 ? lastOnly[0] : null;
}
