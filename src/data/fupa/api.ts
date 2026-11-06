/**
 * FuPa-Teil des lokalen Dienstes (tools/fussballde-dienst/fupa_dienst.py). Inoffiziell: liest die öffentliche
 * JSON-Schnittstelle der FuPa-Webseite. Läuft über denselben Vite-Proxy wie fussball.de (Schlüssel bleibt serverseitig).
 */
import { getJson } from '../fussballDe/api';

export interface FupaTeam {
  slug: string;
  name: string | null;
  club_slug: string | null;
  level: number | null;
  age_group: string | null;
  competition_slug: string | null;
  competition_name: string | null;
  season_slug: string | null;
  season_name: string | null;
}

export interface FupaTableRow {
  rank: number | null;
  team_slug: string | null;
  team: string | null;
  matches: number | null;
  wins: number | null;
  draws: number | null;
  defeats: number | null;
  goals_for: number | null;
  goals_against: number | null;
  points: number | null;
  penalty_points: number | null;
}

export interface FupaTable {
  competition: string;
  season: string;
  rows: FupaTableRow[];
}

export interface FupaPlayer {
  slug: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  number: number | null;
  matches: number | null;
  goals: number | null;
  assists: number | null;
  captain: boolean;
  vice_captain: boolean;
  age: number | null;
  photo_url: string | null;
  photo_source: string | null;
}

export interface FupaSquad {
  team_slug: string;
  players: FupaPlayer[];
  coaches: { name: string; role: string | null }[];
  captain_slug: string | null;
  season_target: string | null;
}

export interface FupaPlayerDetail {
  slug: string;
  mvp: number | null;
  mvp_updated_at: string | null;
  height_cm: number | null;
  strong_foot: string | null;
  minutes: number | null;
  top_eleven: number | null;
}

const enc = encodeURIComponent;

export const fupaApi = {
  team: (slug: string, f?: typeof fetch) => getJson<FupaTeam>(`/api/coachai/fupa/team/${enc(slug)}`, f),
  findeTeam: (namen: string[], saison: string, art: string, nummer: number, f?: typeof fetch) =>
    getJson<FupaTeam | null>(`/api/coachai/fupa/finde-team?namen=${enc(namen.join('|'))}&saison=${saison}&art=${enc(art)}&nummer=${nummer}`, f),
  tabelle: (wettbewerb: string, saison: string, f?: typeof fetch) => getJson<FupaTable>(`/api/coachai/fupa/tabelle?wettbewerb=${enc(wettbewerb)}&saison=${saison}`, f),
  kader: (slug: string, f?: typeof fetch) => getJson<FupaSquad>(`/api/coachai/fupa/kader/${enc(slug)}`, f),
  spieler: (slugs: string[], team: string, f?: typeof fetch) => getJson<FupaPlayerDetail[]>(`/api/coachai/fupa/spieler?slugs=${slugs.map(enc).join(',')}&team=${enc(team)}`, f),
};

/** FuPa-Link auswerten: „…/team/<slug>“ → Mannschaft, „…/club/<slug>“ → Verein. */
export function parseFupaLink(url: string | null | undefined): { team?: string; club?: string } | null {
  if (!url) return null;
  const t = /fupa\.net\/team\/([a-z0-9-]+)/i.exec(url);
  if (t) return { team: t[1].toLowerCase() };
  const c = /fupa\.net\/club\/([a-z0-9-]+)/i.exec(url);
  if (c) return { club: c[1].toLowerCase() };
  return null;
}
