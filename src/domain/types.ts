/**
 * Zentrales Datenmodell von 11Plan.
 *
 * Grundsätze:
 * - Jede extern beschaffte Angabe liegt in einem DataBlock mit Herkunft, Datenstand,
 *   Abrufzeitpunkt und Prüfstatus.
 * - Trainereingaben (Beobachtungen, Botschaften, Spielidee) werden getrennt von
 *   statistischen Daten gespeichert.
 * - `extensions` an Mannschaft, Spiel und Vorbereitung ist für spätere Module reserviert
 *   (Spielnachbereitung, Trainingsableitung, Halbserienanalyse, SpielerPlus, Veo …).
 */

import type { SeasonData } from '../analytics/types';

export type ID = string;

/** ISO-Datum `YYYY-MM-DD` (Ortszeit Europe/Berlin). */
export type LocalDate = string;
/** Uhrzeit `HH:mm` (Ortszeit Europe/Berlin). */
export type LocalTime = string;
/** ISO-Zeitstempel inkl. Zeitzone. */
export type Timestamp = string;

export type Timezone = 'Europe/Berlin';

// ---------------------------------------------------------------------------
// Mannschaft
// ---------------------------------------------------------------------------

export interface TeamLink {
  kind: 'fussball.de' | 'FuPa' | 'Verein' | 'Sonstiges';
  url: string;
}

export type DataSourceChoice = 'fussball.de' | 'FuPa';

/** Angaben, die fussball.de und FuPa beide liefern. Gewählte Quelle gilt, die andere springt nur bei fehlendem Wert ein. */
export interface SourcePriority {
  tabelle: DataSourceChoice;
  saisontore: DataSourceChoice;
  rueckennummer: DataSourceChoice;
  kapitaen: DataSourceChoice;
  trainer: DataSourceChoice;
}

export interface LeagueZones {
  promotion: number;
  promotionPlayoff: number;
  relegation: number;
}

export interface Venue {
  name: string;
  address?: string;
}

/** Ein organisatorischer Zeitblock relativ zum Anstoß (negative Minuten = vor Anstoß). */
export interface TimeBlockTemplate {
  id: string;
  label: string;
  startOffsetMin: number;
  endOffsetMin: number;
  /** Ohne feste Uhrzeit („danach“): Offsets dienen nur der Reihenfolge. Keine erfundenen Zeiten. */
  untimed?: boolean;
  /** Traineransprache ist ausschließlich ein organisatorischer Zeitblock. */
  kind?: 'puffer' | 'ankommen' | 'umziehen' | 'ansprache' | 'warmmachen' | 'kabine' | 'sonstiges';
}

export interface HomeScheduleTemplate {
  meetingOffsetMin: number | null;
  blocks: TimeBlockTemplate[];
}

export interface AwayScheduleTemplate {
  arrivalOffsetMin: number | null;
  /** Treffpunkt liegt so viele Minuten vor der Abfahrt. */
  meetingBeforeDepartureMin: number | null;
  departurePoint: string;
  blocks: TimeBlockTemplate[];
}

export interface KitCombination {
  shirt: string;
  shorts: string;
  socks: string;
  /** Bilder der Teile (Data-URL), z. B. aus der Dossiervorlage des Trainers. */
  images?: { shirt?: string; shorts?: string; socks?: string };
}

export interface KitProfile {
  /** Bekannte Kombinationen; die erste gilt als Vorschlag für Heimspiele. */
  home: KitCombination | null;
  away: KitCombination | null;
  notes?: string;
}

export interface TrainerStatement {
  text: string;
  /** Spielidee/Grundordnung dürfen nur als ausdrückliche Trainereingabe existieren. */
  enteredBy: 'trainer';
  enteredAt: Timestamp;
}

export interface Player {
  id: ID;
  name: string;
  number?: string;
  position?: string;
  note?: string;
  /** Torwart (für die getrennte Darstellung auf der Kaderfolie). */
  isGoalkeeper?: boolean;
}

export interface SquadSnapshot {
  players: Player[];
  /** Freitext für Kaderhinweise, z. B. „Ersatz: …“. */
  note?: string;
  /** Trainerteam für dieses Spiel (Namen), getrennt von den Spielern dargestellt. */
  coaches?: string[];
  /** Noch offene Kaderplätze, z. B. für Spieler aus der zweiten Mannschaft. */
  openSlots?: { count: number; label: string };
  confirmedAt: Timestamp | null;
  /** Herkunft: aus welchem Dossier übernommen, oder Ersteingabe. */
  origin: { kind: 'dossier'; dossierId: ID; label: string } | { kind: 'ersteingabe' } | { kind: 'beispiel'; label: string };
}

/** Blickwinkel des Vier-Phasen-Modells: Gegner, eigene Mannschaft oder beides (zwei Folien). */
export type PhaseModel = 'gegner' | 'eigene' | 'beides';

export type SlideKey =
  | 'titel'
  | 'inhalt'
  | 'spieltag'
  | 'unserSpiel'
  | 'gegnerForm'
  | 'gegnerGefahr'
  | 'gegnerAuffaelligkeiten'
  | 'soSpieltGegner'
  | 'soSpielenWir'
  | 'unsereForm'
  | 'kader'
  | 'auftrag';

export interface DossierTemplate {
  id: ID;
  name: string;
  slides: SlideKey[];
  confirmedAt: Timestamp | null;
  note?: string;
}

export interface TeamProfile {
  id: ID;
  name: string;
  /** Kurzbezeichnung für Folientitel, z. B. „TSG“. */
  shortName: string;
  club: string;
  ageGroup: string;
  competition: string;
  season: string;
  timezone: Timezone;
  links: TeamLink[];
  /** Welche Quelle je Angabe gilt, wenn fussball.de und FuPa beide liefern (die andere nur als Ersatz). */
  sourcePriority?: Partial<SourcePriority>;
  /** Tabellenzonen der eigenen Liga (fussball.de liefert sie nicht mit): Aufsteiger, Relegation, Absteiger. */
  leagueZones?: LeagueZones;
  /**
   * Standard für das Spielphasenmodell neuer Dossiers: 'gegner' = So spielt der Gegner,
   * 'eigene' = So spielen wir, 'beides' = beide Folien. Je Spiel überschreibbar (Preparation.dossierOptions).
   */
  phaseModel?: PhaseModel;
  /** Eigenes Wappen (Data-URL), hat Vorrang vor dem Wappen laut FuPa. */
  crest?: string;
  /** Trainingseinheiten pro Woche (Trainerangabe); Grundlage für Nachbereitung und Trainingsableitung. */
  trainingsPerWeek?: number;
  /** Trainingstage, frei eingegeben, z. B. „Di, Do, Fr“. */
  trainingDays?: string;
  homeVenue: Venue;
  schedule: { home: HomeScheduleTemplate; away: AwayScheduleTemplate };
  kits: KitProfile;
  gameIdea: TrainerStatement | null;
  formation: TrainerStatement | null;
  template: DossierTemplate;
  lastConfirmedSquad: SquadSnapshot | null;
  isDemo: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  extensions?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Spiel
// ---------------------------------------------------------------------------

export type CompetitionType = 'liga' | 'pokal' | 'test';

export interface Match {
  id: ID;
  teamId: ID;
  opponent: string;
  competition: string;
  competitionType: CompetitionType;
  matchday: number | null;
  date: LocalDate | null;
  kickoff: LocalTime | null;
  isHome: boolean;
  venue: Venue | null;
  /** Fester historischer Beispielfall – niemals als „nächstes Spiel“ darstellen. */
  isHistoricalReference: boolean;
  isDemo: boolean;
  createdAt: Timestamp;
  /** Link oder ID der Gegnermannschaft auf fussball.de (für den Datenabruf). */
  opponentFussballDe?: string;
  /** FuPa-Link des Gegners (Mannschaft oder Verein), optional – sonst automatische Zuordnung. */
  opponentFupa?: string;
  extensions?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Datenbasis
// ---------------------------------------------------------------------------

export type DataStatus = 'vorhanden' | 'fehlend' | 'veraltet' | 'widersprüchlich' | 'bestätigt';

export type SourceKind = 'demo' | 'trainer' | 'berechnet' | 'extern';

export interface SourceRef {
  id: string;
  label: string;
  kind: SourceKind;
  url?: string;
  /** Fachlicher Datenstand, z. B. „nach dem 13. Spieltag“ – unabhängig vom Abrufzeitpunkt. */
  asOf?: string;
  /** Sortierbarer Datenstand (z. B. Spieltagnummer) zur Erkennung veralteter Quellen. */
  asOfRank?: number;
  retrievedAt?: Timestamp;
}

export interface Provenance {
  sources: SourceRef[];
  status: DataStatus;
  note?: string;
}

export interface ResultEntry {
  date: LocalDate;
  competitionType: CompetitionType;
  competitionLabel: string;
  matchday?: number;
  home: string;
  away: string;
  goalsHome: number;
  goalsAway: number;
}

export interface TableRow {
  rank: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  /** Punktabzug als eigene Angabe (positiv = abgezogene Punkte). null = nicht angegeben. */
  pointDeduction: number | null;
}

export interface TableSnapshot {
  source: SourceRef;
  rows: TableRow[];
}

export interface FixturePairing {
  home: string;
  away: string;
  date?: LocalDate;
  kickoff?: LocalTime;
}

export interface HeadToHead {
  season: string;
  date: LocalDate;
  competitionLabel: string;
  competitionType: CompetitionType;
  home: string;
  away: string;
  goalsHome: number;
  goalsAway: number;
}

export interface OpponentPlayerCandidate {
  id: ID;
  name: string;
  number?: string;
  position?: string;
  /** Belegte Angaben inkl. Quelle. */
  evidence: { text: string; sourceId: string }[];
  /** Kennzahl für die deterministische Vorauswahl (z. B. Saisontore). */
  goals?: number;
  assists?: number;
  /** Spielerfoto (Adresse) mit Bildnachweis, z. B. von FuPa. */
  photo?: { url: string; credit: string };
  /** FuPa-MVP-Wert in Prozent mit Stand (ISO-Zeitpunkt, falls von FuPa angegeben). */
  mvp?: { value: number; asOf: string | null; sourceId: string };
  heightCm?: number;
  isCaptain?: boolean;
}

/** Tore aus Spielberichten (Ligaspiele), aus Sicht der betrachteten Mannschaft. */
export interface GoalLog {
  /** Spiele, für die ein Spielbericht mit Torminuten vorliegt. */
  games: {
    date: LocalDate;
    opponent: string;
    isHome: boolean;
    /** scorer: Torschütze laut Spielbericht; joker: Torschütze kam von der Bank (nur mit Aufstellung). */
    goals: { minute: number; own: boolean; scorer?: string; joker?: boolean }[];
    /** Karten der betrachteten Mannschaft (Gelb-Rot zählt als Rot). */
    cards?: { yellow: number; red: number };
  }[];
  sourceId: string;
}

/** Kader der eigenen Mannschaft laut FuPa (für Fotos und Positionen auf der Kaderfolie). */
export interface Roster {
  players: { name: string; position?: string; number?: string; photo?: string; goals?: number; assists?: number; matches?: number }[];
  coaches: { name: string; role?: string; photo?: string }[];
  sourceId: string;
}

export interface SourcedFact {
  id: ID;
  text: string;
  sourceId: string;
}

export interface Conflict {
  id: string;
  blockKey: DataBlockKey;
  /** Betroffenes Objekt, z. B. Mannschaftsname in der Tabelle. */
  subject: string;
  field: string;
  label: string;
  values: { sourceId: string; sourceLabel: string; value: string }[];
  /** Vom Trainer gewählte Quelle; null = ungeklärt. */
  resolution: { sourceId: string; resolvedAt: Timestamp } | null;
}

export type DataBlockKey =
  | 'begegnung'
  | 'tabelle'
  | 'spieltag'
  | 'ergebnisseEigene'
  | 'ergebnisseGegner'
  | 'direkteDuelle'
  | 'gegenspieler'
  | 'gegnerFakten'
  | 'fahrzeit';

export interface DataBlocks {
  begegnung: DataBlock<{
    confirmedFromSource: boolean;
    /** Ansetzung laut externer Quelle – wird mit der Spielanlage verglichen. */
    sourceFixture?: { date: LocalDate | null; kickoff: LocalTime | null; venue: string | null; sourceLabel: string; matchday?: number | null; competition?: string | null };
  }>;
  tabelle: DataBlock<{
    snapshots: TableSnapshot[];
    primarySourceId: string | null;
    /** Wappen je Mannschaft (Name wie in der Haupttabelle → Bildadresse), laut FuPa. */
    crests?: Record<string, string>;
  }>;
  spieltag: DataBlock<{ matchday: number | null; pairings: FixturePairing[] }>;
  ergebnisseEigene: DataBlock<{ team: string; results: ResultEntry[]; roster?: Roster }>;
  ergebnisseGegner: DataBlock<{ team: string; results: ResultEntry[]; goals?: GoalLog }>;
  direkteDuelle: DataBlock<{ games: HeadToHead[] }>;
  gegenspieler: DataBlock<{ candidates: OpponentPlayerCandidate[] }>;
  gegnerFakten: DataBlock<{ facts: SourcedFact[] }>;
  fahrzeit: DataBlock<{ minutes: number | null; verifiedFor: string | null }>;
}

export interface DataBlock<T> {
  key: DataBlockKey;
  label: string;
  value: T | null;
  provenance: Provenance;
  /** Manuelle Ergänzung durch den Trainer (Freitext), getrennt von Quelldaten. */
  manualNote?: { text: string; enteredAt: Timestamp };
  /** Ausdrückliche Bestätigung durch den Trainer. */
  confirmedAt?: Timestamp | null;
  /** Vom Trainer getroffene Auflösungen von Widersprüchen (Konflikt-ID → gewählte Quelle). */
  resolutions?: Record<string, { sourceId: string; resolvedAt: Timestamp }>;
}

// ---------------------------------------------------------------------------
// Trainerfragebogen
// ---------------------------------------------------------------------------

export type QuestionId =
  | 'q1_grundordnung'
  | 'q2_aufbau'
  | 'q3_verteidigung'
  | 'q4_umschalten'
  | 'q4b_ballverlust'
  | 'q5b_standards'
  | 'q5_staerken'
  | 'q6_verwundbar'
  | 'q7_schluesselspieler'
  | 'q8_ausfaelle'
  | 'q9_abweichungen'
  | 'q10_ablauf'
  | 'q11_kleidung'
  | 'q12_kader'
  | 'q13_layout'
  | 'q14_auftrag'
  | 'q15_leitmotiv'
  // Unser Plan nach Spielphasen (nur bei Phasenmodell „eigene“ oder „beides“)
  | 'u1_grundordnung'
  | 'u2_ballbesitz'
  | 'u3_ballverlust'
  | 'u4_gegnerball'
  | 'u5_ballgewinn'
  | 'u6_standards';

export type AnswerState = 'offen' | 'beantwortet' | 'nicht_bekannt' | 'keine_abweichung';

export interface Answer {
  state: AnswerState;
  text: string;
  updatedAt: Timestamp;
  /** „beispiel“ = Beispielantwort des historischen Referenzfalls. */
  origin: 'trainer' | 'beispiel';
}

export interface MissionMessage {
  /** Kurze Überschrift (aus dem Trainertext formuliert oder selbst geschrieben). */
  headline: string;
  /** Verständlicher Begleitsatz. */
  text: string;
  /** Originaler Trainertext, aus dem formuliert wurde. */
  coachRaw: string;
}

export interface MissionState {
  messages: [MissionMessage, MissionMessage, MissionMessage];
  motto: string;
  mantras: string[];
  /** Ausdrückliches „Merksätze entfallen“. */
  mantrasWaived: boolean;
  origin: 'trainer' | 'beispiel' | null;
}

export interface OrganisationInput {
  /** Aktuelle Fahrzeit für genau diese Fahrt (Minuten). */
  travelMinutes: number | null;
  /** osm: aus OpenStreetMap berechnet (Teamzentrale), ab dem Abfahrtsort des Mannschaftsprofils */
  travelSource: 'trainer' | 'verifiziert' | 'osm' | null;
  /** Ausdrücklich genannte Abweichungen beim Spielort. */
  venueOverride: Venue | null;
  /** Ausdrücklich genannte Zeitänderungen je Block (Block-ID → neue Start-/Endzeit). */
  blockOverrides: Record<string, { start: LocalTime; end: LocalTime }>;
  meetingOverride: LocalTime | null;
  /** Abfahrtstreffpunkt nur für dieses Spiel (sonst der aus dem Mannschaftsprofil). */
  departurePointOverride?: string | null;
  kit: KitCombination | null;
  notes: string;
}

export interface PlayerHint {
  candidateId: ID | null;
  name: string;
  reason: string;
}

export interface Preparation {
  matchId: ID;
  dataBlocks: DataBlocks;
  dataLoadedAt: Timestamp | null;
  answers: Partial<Record<QuestionId, Answer>>;
  playerHints: PlayerHint[];
  organisation: OrganisationInput;
  squad: SquadSnapshot | null;
  /** true, sobald der Trainer den Kader ausdrücklich bearbeitet oder übernommen hat. */
  squadReviewed: boolean;
  mission: MissionState;
  layoutWish: string;
  /** Aufbau genau dieses Dossiers; ohne Angabe gelten die Standards aus dem Mannschaftsprofil. */
  dossierOptions?: DossierOptions;
  updatedAt: Timestamp;
  extensions?: Record<string, unknown>;
}

export interface DossierOptions {
  phaseModel?: PhaseModel;
  /** Gewählte Folien (ohne Titel, Inhalt und Spielphasen – die ergeben sich aus dem Phasenmodell). */
  slides?: SlideKey[];
}

// ---------------------------------------------------------------------------
// Dossier
// ---------------------------------------------------------------------------

export type DossierStatus = 'entwurf' | 'bestätigt';

export interface DossierRecord {
  id: ID;
  matchId: ID;
  teamId: ID;
  version: number;
  status: DossierStatus;
  /** Textänderungen des Trainers an der generierten Fassung (Pfad → Text). */
  overrides: Record<string, string>;
  /** Eingefrorener Inhalt – nur bei bestätigten Dossiers gesetzt. */
  frozen: import('../dossier/model').DossierContent | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  confirmedAt: Timestamp | null;
  /** Bei Bestätigung angezeigte offene Punkte, damit sie nachvollziehbar bleiben. */
  confirmationNotes: string[];
}

// ---------------------------------------------------------------------------
// Gesamtzustand
// ---------------------------------------------------------------------------

export interface AppState {
  schemaVersion: 1;
  activeTeamId: ID | null;
  /** Zuletzt gewählte Begegnung je Mannschaft (Team-ID → Spiel-ID). */
  selectedMatch?: Record<ID, ID>;
  teams: TeamProfile[];
  matches: Match[];
  preparations: Record<ID, Preparation>;
  dossiers: DossierRecord[];
  /** Saison-Zwischenreport (Analytics): geladene Rohdaten je Mannschaft. */
  analytics?: Record<ID, SeasonData>;
}
