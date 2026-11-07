import { now } from '../domain/factory';
import type { LocalDate, TeamProfile } from '../domain/types';
import { fdApi, type FdGameDetail, type FdTableRow } from '../data/fussballDe/api';
import { berlinDateTime, cleanName, competitionTypeOf, foldName, seasonRange } from '../data/fussballDe/mapping';
import { ownFupaLink, ownFussballDeTeamId } from '../data/fussballDe/provider';
import { fupaApi, parseFupaLink } from '../data/fupa/api';
import type { SeasonData, SeasonGame, SeasonGoal, SeasonTableRow } from './types';

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
export async function loadSeasonData(team: TeamProfile, today: LocalDate, progress: (msg: string) => void = () => {}, f?: typeof fetch): Promise<SeasonData> {
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
  for (let i = 0; i < played.length; i += CHUNK) {
    progress(`Spielberichte ${i + 1}–${Math.min(i + CHUNK, played.length)} von ${played.length} werden geladen …`);
    const part = await fdApi.aufstellungen(played.slice(i, i + CHUNK).map((g) => g.id), f);
    for (const d of part) details.set(d.game_id, d);
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

  // Spielerfotos und Wappen von FuPa (optional – der Report funktioniert auch ohne).
  const photos: Record<string, string> = {};
  let crest: string | null = team.crest ?? null;
  const sources = [`fussball.de: Tabelle und ${played.length} Spielberichte der Saison ${team.season || ''}`.trim()];
  const fupaSlug = parseFupaLink(ownFupaLink(team))?.team;
  if (fupaSlug) {
    progress('Spielerfotos von FuPa werden geladen …');
    try {
      const [squad, fteam] = await Promise.all([fupaApi.kader(fupaSlug, f), crest ? Promise.resolve(null) : fupaApi.team(fupaSlug, f).catch(() => null)]);
      const names = new Set<string>();
      for (const g of games) {
        g.starting?.forEach((p) => names.add(p));
        g.goals?.forEach((x) => x.own && x.scorer && names.add(x.scorer));
      }
      for (const n of names) {
        const p = squad.players.find((x) => foldName(`${x.first_name ?? ''} ${x.last_name ?? ''}`) === foldName(n));
        if (p?.photo_url) photos[n] = p.photo_url;
      }
      crest = crest ?? fteam?.image_url ?? null;
      sources.push('FuPa: Spielerfotos');
    } catch {
      /* ohne Fotos weiter */
    }
  }

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
  };
}

function pick(rows: FdTableRow[], ownId: string): SeasonTableRow | null {
  const r = rows.find((x) => x.team_id === ownId);
  return r ? row(r) : null;
}
