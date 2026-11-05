/**
 * Antwortformate des selbst betriebenen Crawlers „fussball_de_api“
 * (https://github.com/Zetabytes/fussball_de_api, MIT). Inoffiziell: liest öffentliche
 * Seiten von fussball.de aus. Nur Felder, die Coach.AI verwendet.
 */
export interface FdTableEntry {
  place: number;
  team: string;
  img?: string;
  games: number;
  won: number;
  draw: number;
  lost: number;
  goal: string; // "42:16"
  goal_difference: number;
  points: number;
}

export interface FdTable {
  entries: FdTableEntry[];
}

export interface FdGame {
  id: string;
  datetime_utc: string;
  competition: string;
  age_group?: string | null;
  home_team: string;
  away_team: string;
  home_logo?: string;
  away_logo?: string;
  status?: string | null;
  home_score?: string | null;
  away_score?: string | null;
  location?: string | null;
}

/** Basis-URL: wird vom Vite-Entwicklungsserver an den lokalen Crawler weitergeleitet (Schlüssel bleibt serverseitig). */
export const FD_BASE = '/datenquelle/fussballde';

export class FdUnavailableError extends Error {}

async function getJson<T>(path: string, fetchImpl: typeof fetch = fetch): Promise<T> {
  let res: Response;
  try {
    res = await fetchImpl(`${FD_BASE}${path}`, { headers: { Accept: 'application/json' } });
  } catch {
    throw new FdUnavailableError('Lokaler fussball.de-Dienst nicht erreichbar.');
  }
  if (res.status === 502 || res.status === 503 || res.status === 504 || res.status === 404) {
    throw new FdUnavailableError(`Lokaler fussball.de-Dienst nicht erreichbar (HTTP ${res.status}).`);
  }
  if (res.status === 401) throw new FdUnavailableError('Lokaler fussball.de-Dienst lehnt den Schlüssel ab (HTTP 401). Bitte COACHAI_FUSSBALLDE_KEY prüfen.');
  if (!res.ok) throw new Error(`fussball.de-Dienst: HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('json')) throw new FdUnavailableError('Lokaler fussball.de-Dienst nicht eingerichtet (keine JSON-Antwort).');
  return (await res.json()) as T;
}

export const fdApi = {
  table: (teamId: string, f?: typeof fetch) => getJson<FdTable | null>(`/api/team/${encodeURIComponent(teamId)}/table`, f),
  prevGames: (teamId: string, f?: typeof fetch) => getJson<FdGame[]>(`/api/team/${encodeURIComponent(teamId)}/prev_games`, f),
  nextGames: (teamId: string, f?: typeof fetch) => getJson<FdGame[]>(`/api/team/${encodeURIComponent(teamId)}/next_games`, f),
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
