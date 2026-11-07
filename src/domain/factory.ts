import type {
  DataBlocks,
  DossierTemplate,
  Match,
  Preparation,
  SlideKey,
  TeamProfile,
  Timestamp,
} from './types';

export const ALL_SLIDES: SlideKey[] = [
  'titel',
  'inhalt',
  'spieltag',
  'unserSpiel',
  'gegnerForm',
  'gegnerGefahr',
  'gegnerAuffaelligkeiten',
  'soSpieltGegner',
  'soSpielenWir',
  'unsereForm',
  'kader',
  'auftrag',
];

export function uid(prefix = 'id'): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}

export function now(): Timestamp {
  return new Date().toISOString();
}

export function defaultTemplate(confirmedAt: Timestamp | null = null): DossierTemplate {
  return { id: 'standard-11', name: 'Spieltagsdossier · 11 Folien', slides: [...ALL_SLIDES], confirmedAt };
}

export function emptyBlocks(): DataBlocks {
  const p = { sources: [], status: 'fehlend' as const };
  return {
    begegnung: { key: 'begegnung', label: 'Begegnung, Termin, Wettbewerb, Spielort', value: { confirmedFromSource: false }, provenance: { sources: [{ id: 'trainer', label: 'Trainereingabe', kind: 'trainer' }], status: 'vorhanden' } },
    tabelle: { key: 'tabelle', label: 'Aktuelle Tabelle', value: null, provenance: { ...p } },
    spieltag: { key: 'spieltag', label: 'Spieltagspaarungen', value: null, provenance: { ...p } },
    ergebnisseEigene: { key: 'ergebnisseEigene', label: 'Ergebnisse eigene Mannschaft (Liga, Pokal, Test)', value: null, provenance: { ...p } },
    ergebnisseGegner: { key: 'ergebnisseGegner', label: 'Ergebnisse Gegner (Liga, Pokal, Test)', value: null, provenance: { ...p } },
    direkteDuelle: { key: 'direkteDuelle', label: 'Direkte Duelle', value: null, provenance: { ...p } },
    gegenspieler: { key: 'gegenspieler', label: 'Relevante Gegenspieler', value: null, provenance: { ...p } },
    gegnerFakten: { key: 'gegnerFakten', label: 'Belegte Besonderheiten des Gegners', value: null, provenance: { ...p } },
    fahrzeit: { key: 'fahrzeit', label: 'Fahrzeit (nur auswärts)', value: null, provenance: { ...p } },
  };
}

/** Neue, leere Vorbereitung. Gegnerspezifische Antworten werden nie übernommen. */
export function createPreparation(team: TeamProfile, match: Match): Preparation {
  const kit = match.isHome ? team.kits.home : team.kits.away;
  return {
    matchId: match.id,
    dataBlocks: emptyBlocks(),
    dataLoadedAt: null,
    answers: {},
    playerHints: [],
    organisation: {
      travelMinutes: null,
      travelSource: null,
      venueOverride: null,
      blockOverrides: {},
      meetingOverride: null,
      kit: kit ? { ...kit } : null,
      notes: '',
    },
    squad: team.lastConfirmedSquad ? structuredClone(team.lastConfirmedSquad) : null,
    squadReviewed: false,
    mission: {
      messages: [
        { headline: '', text: '', coachRaw: '' },
        { headline: '', text: '', coachRaw: '' },
        { headline: '', text: '', coachRaw: '' },
      ],
      motto: '',
      mantras: [],
      mantrasWaived: false,
      origin: null,
    },
    layoutWish: '',
    updatedAt: now(),
  };
}

export function createTeam(input: Partial<TeamProfile> & { name: string }): TeamProfile {
  const t = now();
  return {
    id: uid('team'),
    name: input.name,
    shortName: input.shortName || input.name.split(' ')[0] || input.name,
    club: input.club ?? input.name,
    ageGroup: input.ageGroup ?? '',
    competition: input.competition ?? '',
    season: input.season ?? '',
    timezone: 'Europe/Berlin',
    links: input.links ?? [
      { kind: 'fussball.de', url: '' },
      { kind: 'FuPa', url: '' },
    ],
    homeVenue: input.homeVenue ?? { name: '', address: '' },
    // Andere Mannschaften erhalten eigene, zunächst leere Standards.
    schedule: input.schedule ?? {
      home: { meetingOffsetMin: null, blocks: [] },
      away: { arrivalOffsetMin: null, meetingBeforeDepartureMin: null, departurePoint: '', blocks: [] },
    },
    kits: input.kits ?? { home: null, away: null },
    gameIdea: null,
    formation: null,
    template: input.template ?? defaultTemplate(null),
    lastConfirmedSquad: null,
    isDemo: false,
    createdAt: t,
    updatedAt: t,
  };
}

export function createMatch(teamId: string, input: Omit<Match, 'id' | 'teamId' | 'createdAt' | 'isDemo' | 'isHistoricalReference'>): Match {
  return { ...input, id: uid('spiel'), teamId, isDemo: false, isHistoricalReference: false, createdAt: now() };
}
