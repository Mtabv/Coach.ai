import type { SlideKey } from '../domain/types';

/**
 * Darstellungsunabhängiges Inhaltsmodell des Dossiers. Wird von der HTML-Vorschau,
 * der Druckansicht (PDF) und dem PPTX-Export gleichermaßen genutzt.
 */

/** Kennzeichnung eines Werts. Nur „ok“ darf als gesicherte Angabe erscheinen. */
export type Flag = 'ok' | 'offen' | 'widersprüchlich' | 'veraltet' | 'beispiel' | 'trainer';

export interface FV {
  text: string;
  flag: Flag;
  note?: string;
  /** Klickbarer Link (z. B. Spielort → Google Maps), in Vorschau, PDF und PowerPoint. */
  href?: string;
}

export const fv = (text: string, flag: Flag = 'ok', note?: string): FV => ({ text, flag, note });

export const FLAG_LABEL: Record<Flag, string> = {
  ok: '',
  offen: 'offen',
  widersprüchlich: 'widersprüchlich – nicht bestätigt',
  veraltet: 'veralteter Datenstand',
  beispiel: 'Beispielangabe',
  trainer: 'Trainerangabe',
};

interface SlideBase<K extends SlideKey> {
  key: K;
  number: number;
  title: string;
  kicker: string;
  /** Quellenangaben unten auf der Folie. */
  sources: string[];
  footnote: string;
}

export interface TitleSlide extends SlideBase<'titel'> {
  home: string;
  away: string;
  competition: string;
  matchdayLabel: string;
  dateLabel: FV;
  timeLabel: FV;
  venue: FV;
}

export interface ContentsSlide extends SlideBase<'inhalt'> {
  items: { number: number; title: string; text: string }[];
}

export interface TableLine {
  rank: string;
  team: string;
  played: string;
  record: string;
  goals: string;
  diff: string;
  points: FV;
  highlight: 'own' | 'opp' | null;
  /** Tabellenzone laut Mannschaftsprofil: Aufstieg, Aufstiegsrelegation, Abstieg. */
  zone: 'auf' | 'relegation' | 'ab' | null;
}

export interface MatchdaySlide extends SlideBase<'spieltag'> {
  table: TableLine[];
  tableStatus: FV;
  /** Legende der Tabellenzonen (nur vorhandene Zonen). */
  zones: { zone: 'auf' | 'relegation' | 'ab'; label: string }[];
  pairings: { home: string; away: string; day: string; time: string; highlight: boolean }[];
}

export interface KitView {
  label: FV;
  /** Bilder (Data-URL oder Adresse) von Trikot, Hose, Stutzen – sofern hinterlegt. */
  images: { part: 'Trikot' | 'Hose' | 'Stutzen'; src: string; text: string }[];
}

export interface OurMatchSlide extends SlideBase<'unserSpiel'> {
  facts: { label: string; value: FV }[];
  kit: KitView;
  h2h: { season: string; date: string; competition: string; match: string; result: string }[];
  h2hNote: string;
  schedule: { time: FV; label: string; note?: string }[];
  scheduleOpen: string[];
}

export interface FormSlide<K extends 'gegnerForm' | 'unsereForm'> extends SlideBase<K> {
  teamName: string;
  last5: { date: string; opponent: string; crest?: string; ha: 'H' | 'A'; result: string; outcome: 'S' | 'U' | 'N' }[];
  last5Note: string;
  /** Bilanztabelle: Saison und die für dieses Spiel relevante Heim- bzw. Auswärtsbilanz. */
  records: RecordLine[];
  recordsNote: FV | null;
  facts: FV[];
}

export interface RecordLine {
  label: string;
  played: string;
  won: string;
  drawn: string;
  lost: string;
  goals: string;
  diff: string;
  flag: FV['flag'];
}

export interface DangerSlide extends SlideBase<'gegnerGefahr'> {
  players: {
    name: string;
    meta: string;
    reasons: string[];
    coachNote: string;
    /** Initialen als Platzhalter, wenn kein Foto vorliegt. */
    initials: string;
    photo?: { url: string; credit: string };
    /** FuPa-MVP-Wert in Prozent. */
    mvp?: number;
  }[];
  note: string;
  /** Erklärung des MVP-Werts und Bildnachweise – auf der Folie sichtbar, nicht nur in der Fußzeile. */
  legend: string;
}

export interface ProfileSlide extends SlideBase<'gegnerAuffaelligkeiten'> {
  kpis: { label: string; value: string; basis: string }[];
  /** Tore und Gegentore je Spielphase (15-Minuten-Abschnitte) aus Spielberichten. */
  phases: { label: string; goalsFor: number; goalsAgainst: number }[];
  phasesBasis: string;
  /** Wichtige Statistiken aus Spielberichten, Ergebnissen und Tabelle (gezählt). */
  keyStats: string[];
}

/** Spielphasenmodell: vier Phasen im Kreislauf, dazu Grundordnung, Standards, Stärken, Verwundbarkeit. */
export interface ObservationSlide extends SlideBase<'soSpieltGegner' | 'soSpielenWir'> {
  formationLabel: string;
  absencesLabel: string;
  formation: FV;
  /** false: Grundordnung nicht zeigen (bei „So spielen wir“, wenn der Trainer keine angegeben hat). */
  showFormation?: boolean;
  /** Ausfälle/Besonderheiten – nur, wenn etwas eingetragen ist. */
  absences: FV | null;
  /** Reihenfolge im Kreislauf: Ballbesitz → Ballverlust → gegnerischer Ballbesitz → Ballgewinn. */
  phases: { key: 'ballbesitz' | 'ballverlust' | 'gegnerBall' | 'ballgewinn'; label: string; sub: string; value: FV }[];
  extras: { label: string; value: FV }[];
}

export interface SquadCard {
  name: string;
  meta: string;
  initials: string;
  photo?: string;
}

export interface SquadSlide extends SlideBase<'kader'> {
  goalkeepers: SquadCard[];
  players: SquadCard[];
  coaches: SquadCard[];
  /** Freie Plätze bis zur Kadergröße (Platzhalter, nur in der Vorschau ohne Kader). */
  placeholders: { goalkeepers: number; players: number; coaches: number; playerLabel: string };
  count: number;
  note: string;
  origin: string;
}

export interface MissionSlide extends SlideBase<'auftrag'> {
  messages: { headline: FV; text: string }[];
  motto: FV;
  mantras: string[];
  mantrasWaived: boolean;
}

export type Slide =
  | TitleSlide
  | ContentsSlide
  | MatchdaySlide
  | OurMatchSlide
  | FormSlide<'gegnerForm'>
  | DangerSlide
  | ProfileSlide
  | ObservationSlide
  | FormSlide<'unsereForm'>
  | SquadSlide
  | MissionSlide;

export interface DossierContent {
  meta: {
    teamName: string;
    teamShort: string;
    opponent: string;
    matchLabel: string;
    competition: string;
    dateLabel: string;
    isHistoricalReference: boolean;
    containsDemoData: boolean;
    generatedAt: string;
    templateName: string;
    /** Wappen der Spielpaarung (Heim, Gast) für die Kopfzeile. */
    crests: { home?: string; away?: string };
  };
  slides: Slide[];
}
