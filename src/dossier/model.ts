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
  deduction: string;
  highlight: 'own' | 'opp' | null;
}

export interface MatchdaySlide extends SlideBase<'spieltag'> {
  table: TableLine[];
  tableStatus: FV;
  pairings: { home: string; away: string; when: string; highlight: boolean }[];
}

export interface OurMatchSlide extends SlideBase<'unserSpiel'> {
  facts: { label: string; value: FV }[];
  h2h: { season: string; date: string; competition: string; match: string; result: string }[];
  h2hNote: string;
  schedule: { time: FV; label: string; note?: string }[];
  scheduleOpen: string[];
}

export interface FormSlide<K extends 'gegnerForm' | 'unsereForm'> extends SlideBase<K> {
  teamName: string;
  last5: { date: string; opponent: string; ha: 'H' | 'A'; result: string; outcome: 'S' | 'U' | 'N' }[];
  last5Note: string;
  records: { label: string; value: FV }[];
  facts: FV[];
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
  profile: FV[];
  facts: FV[];
}

export interface ObservationSlide extends SlideBase<'soSpieltGegner'> {
  phases: { label: string; value: FV }[];
}

export interface SquadSlide extends SlideBase<'kader'> {
  groups: { label: string; players: string[] }[];
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
  };
  slides: Slide[];
}
