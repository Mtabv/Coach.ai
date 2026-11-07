/**
 * Antwortformate des selbst betriebenen Dienstes: Crawler „fussball_de_api“
 * (https://github.com/Zetabytes/fussball_de_api, MIT) plus Coach.AI-Erweiterung
 * (tools/fussballde-dienst/coachai_dienst.py). Inoffiziell: liest öffentliche Seiten von fussball.de aus.
 * Nur Felder, die Coach.AI verwendet.
 */

/** Echte Begegnung: Datum vorhanden, beide Mannschaften benannt, kein „spielfrei“. */
export function isRealGame(g: Pick<FdGame, 'datetime_utc' | 'home_team' | 'away_team'>): boolean {
  return Boolean(g.datetime_utc && g.home_team && g.away_team) && !/^spielfrei$/i.test(g.home_team.trim()) && !/^spielfrei$/i.test(g.away_team.trim());
}

export interface FdGame {
  id: string;
  datetime_utc: string;
  competition: string | null;
  age_group?: string | null;
  home_team: string;
  away_team: string;
  /** Team-IDs (nur über die Coach.AI-Erweiterung, über Saisons hinweg stabil). */
  home_team_id?: string | null;
  away_team_id?: string | null;
  /** Hinweis statt Ergebnis, z. B. „Ausfall“ oder neues Datum bei Verlegung. */
  status?: string | null;
  home_score?: string | null;
  away_score?: string | null;
  location?: string | null;
}

export interface FdTableRow {
  place: number | null;
  team: string;
  team_id: string | null;
  games: number | null;
  won: number | null;
  draw: number | null;
  lost: number | null;
  goals_for: number | null;
  goals_against: number | null;
  points: number | null;
}

export interface FdScorer {
  rank: number | null;
  name: string;
  team: string;
  team_id: string | null;
  goals: number | null;
}

export interface FdLiga {
  staffel_id: string | null;
  staffel_name: string | null;
  table: FdTableRow[];
  deduction_note: string | null;
  home_table: FdTableRow[];
  away_table: FdTableRow[];
  scorers: FdScorer[];
}

export interface FdMatchdayGame {
  game_id: string | null;
  datetime_utc: string | null;
  home_team: string;
  home_team_id: string | null;
  away_team: string;
  away_team_id: string | null;
  home_score: string | null;
  away_score: string | null;
  note: string | null;
}

export interface FdMatchday {
  staffel_id: string;
  matchday: number;
  games: FdMatchdayGame[];
}

export interface FdLineupPlayer {
  name: string;
  number: number | null;
  is_goalkeeper: boolean;
  is_captain: boolean;
}

export interface FdTeamLineup {
  team: string;
  starting: FdLineupPlayer[];
  substitutes: FdLineupPlayer[];
  coaches: string[];
}

export interface FdMatchEvent {
  time: string | null;
  type: string | null;
  team: 'home' | 'away' | null;
  description: string | null;
  /** Halbzeit (1 oder 2), falls im Spielbericht erkennbar. */
  half?: number | null;
  /** Spielstand nach dem Ereignis, nur bei Toren. */
  score?: string | null;
}

export interface FdGameDetail {
  game_id: string;
  home_team: string | null;
  away_team: string | null;
  lineup: { home: FdTeamLineup; away: FdTeamLineup } | null;
  events: FdMatchEvent[];
}

export interface FdClub {
  id: string;
  name: string;
}

export interface FdClubTeam {
  id: string;
  name: string;
}

/** Basis-URL: wird vom Vite-Entwicklungsserver an den lokalen Dienst weitergeleitet (Schlüssel bleibt serverseitig). */
export const FD_BASE = '/datenquelle/fussballde';

export class FdUnavailableError extends Error {}

export async function getJson<T>(path: string, fetchImpl: typeof fetch = fetch): Promise<T> {
  let res: Response;
  try {
    res = await fetchImpl(`${FD_BASE}${path}`, { headers: { Accept: 'application/json' } });
  } catch {
    throw new FdUnavailableError('Lokaler fussball.de-Dienst nicht erreichbar.');
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new FdUnavailableError(`Lokaler fussball.de-Dienst nicht erreichbar oder fussball.de antwortet nicht (HTTP ${res.status}).`);
  }
  if (res.status === 404) {
    throw new FdUnavailableError('Lokaler fussball.de-Dienst ohne Coach.AI-Erweiterung gestartet (HTTP 404). Bitte wie in docs/fussballde-anbindung.md mit „coachai_dienst:app“ starten.');
  }
  if (res.status === 401) throw new FdUnavailableError('Lokaler fussball.de-Dienst lehnt den Schlüssel ab (HTTP 401). Bitte COACHAI_FUSSBALLDE_KEY prüfen.');
  if (!res.ok) throw new Error(`fussball.de-Dienst: HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('json')) throw new FdUnavailableError('Lokaler fussball.de-Dienst nicht eingerichtet (keine JSON-Antwort).');
  return (await res.json()) as T;
}

const enc = encodeURIComponent;

export const fdApi = {
  liga: (teamId: string, f?: typeof fetch) => getJson<FdLiga>(`/api/coachai/team/${enc(teamId)}/liga`, f),
  // „spielfrei“-Zeilen (ungerade Mannschaftszahl) haben weder Datum noch Gegner – sie sind kein Spiel.
  saison: (teamId: string, von: string, bis: string, f?: typeof fetch) =>
    getJson<FdGame[]>(`/api/coachai/team/${enc(teamId)}/saison?von=${von}&bis=${bis}`, f).then((gs) => gs.filter(isRealGame)),
  spieltag: (staffel: string, n: number, f?: typeof fetch) => getJson<FdMatchday>(`/api/coachai/staffel/${enc(staffel)}/spieltag/${n}`, f),
  aufstellungen: (gameIds: string[], f?: typeof fetch) => getJson<FdGameDetail[]>(`/api/coachai/spiele/aufstellungen?ids=${gameIds.map(enc).join(',')}`, f),
  sucheVerein: (query: string, f?: typeof fetch) => getJson<FdClub[]>(`/api/search/clubs?query=${enc(query)}`, f),
  vereinsTeams: (clubId: string, f?: typeof fetch) => getJson<FdClubTeam[]>(`/api/club/${enc(clubId)}/teams`, f),
};

/** Extrahiert die Team-ID aus einem fussball.de-Mannschaftslink oder akzeptiert eine reine ID. */
export function extractTeamId(input: string | undefined | null): string | null {
  if (!input) return null;
  const s = input.trim();
  const m = /team-id\/([A-Za-z0-9]+)/.exec(s);
  if (m) return m[1];
  if (/^[A-Z0-9]{16,40}$/.test(s)) return s;
  return null;
}
