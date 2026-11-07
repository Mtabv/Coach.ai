import type { ID, LocalDate, Timestamp } from '../domain/types';

/**
 * Rohdaten des Saison-Zwischenreports einer Mannschaft. Werden auf Klick geladen (fussball.de, FuPa),
 * im Browser gespeichert und erst beim Anzeigen ausgewertet – so lassen sich Auswertungen später ändern,
 * ohne neu abzurufen.
 */
export interface SeasonData {
  teamId: ID;
  fetchedAt: Timestamp;
  /** Stichtag: nur Ligaspiele vor diesem Tag. */
  until: LocalDate;
  season: string;
  competition: string | null;
  /** Name der eigenen Mannschaft in der Tabelle von fussball.de. */
  ownName: string;
  table: SeasonTableRow[];
  homeRow: SeasonTableRow | null;
  awayRow: SeasonTableRow | null;
  games: SeasonGame[];
  /** Spielerfotos (FuPa) nach Spielername. */
  photos: Record<string, string>;
  crest: string | null;
  sources: string[];
}

export interface SeasonTableRow {
  place: number;
  team: string;
  games: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface SeasonGoal {
  /** Spielminute laut Spielbericht (Nachspielzeit zählt zur Minute davor, z. B. 90+2 → 90). */
  minute: number;
  half: 1 | 2 | null;
  own: boolean;
  scorer: string | null;
}

export interface SeasonGame {
  id: string;
  date: LocalDate;
  opponent: string;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  /** Tore in Reihenfolge des Spielberichts; null, wenn der Bericht fehlt oder nicht zum Ergebnis passt. */
  goals: SeasonGoal[] | null;
  /** Startelf laut Spielbericht; null, wenn keine Aufstellung vorliegt. */
  starting: string[] | null;
}
