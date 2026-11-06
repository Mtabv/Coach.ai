import { createPreparation, defaultTemplate, now } from '../domain/factory';
import type { AppState, Match, Preparation, QuestionId, TeamProfile } from '../domain/types';
import { BAUNATAL, COMPETITION, TSG } from './demoData';

export const DEMO_TEAM_ID = 'team-tsg-wilhelmshoehe';
export const REFERENCE_MATCH_ID = 'spiel-referenz-tsg-baunatal-2026-10-23';

const DEMO_SQUAD_NAMES: [string, string, string][] = [
  ['1', 'Max Keller', 'Tor'],
  ['22', 'Paul Brenner', 'Tor'],
  ['2', 'Lukas Hartmann', 'Abwehr'],
  ['3', 'Jan Vogt', 'Abwehr'],
  ['4', 'Simon Krause', 'Abwehr'],
  ['5', 'Tobias Lange', 'Abwehr'],
  ['15', 'Moritz Schäfer', 'Abwehr'],
  ['6', 'David Richter', 'Mittelfeld'],
  ['8', 'Leon Wagner', 'Mittelfeld'],
  ['10', 'Nico Hoffmann', 'Mittelfeld'],
  ['14', 'Fabian Roth', 'Mittelfeld'],
  ['16', 'Erik Schulz', 'Mittelfeld'],
  ['18', 'Tim Becker', 'Mittelfeld'],
  ['7', 'Kevin Wolf', 'Angriff'],
  ['9', 'Florian Meyer', 'Angriff'],
  ['11', 'Dennis Fuchs', 'Angriff'],
  ['17', 'Philipp Neumann', 'Angriff'],
  ['19', 'Robin Graf', 'Angriff'],
];

export function demoTeam(): TeamProfile {
  const t = '2026-08-01T10:00:00+02:00';
  return {
    id: DEMO_TEAM_ID,
    name: TSG,
    shortName: 'TSG',
    club: TSG,
    ageGroup: 'Herren',
    competition: COMPETITION,
    season: '2026/27',
    timezone: 'Europe/Berlin',
    links: [
      { kind: 'fussball.de', url: '' },
      { kind: 'FuPa', url: '' },
    ],
    homeVenue: { name: 'Heimplatz TSG Wilhelmshöhe (Beispielangabe)', address: '' },
    schedule: {
      home: {
        meetingOffsetMin: -100,
        blocks: [
          { id: 'h-puffer', label: 'Zusätzlicher Puffer', startOffsetMin: -100, endOffsetMin: -90, kind: 'puffer' },
          { id: 'h-ankommen', label: 'Ankommen', startOffsetMin: -90, endOffsetMin: -75, kind: 'ankommen' },
          { id: 'h-umziehen', label: 'Umziehen', startOffsetMin: -75, endOffsetMin: -60, kind: 'umziehen' },
          { id: 'h-ansprache', label: 'Traineransprache', startOffsetMin: -60, endOffsetMin: -40, kind: 'ansprache' },
          { id: 'h-warm', label: 'Warmmachen', startOffsetMin: -40, endOffsetMin: -10, kind: 'warmmachen' },
          { id: 'h-kabine', label: 'Kabine und spielfertig machen', startOffsetMin: -10, endOffsetMin: 0, kind: 'kabine' },
        ],
      },
      away: {
        arrivalOffsetMin: -95,
        meetingBeforeDepartureMin: 10,
        departurePoint: 'Stockwiesen',
        blocks: [
          { id: 'a-ankommen', label: 'Ankommen', startOffsetMin: -95, endOffsetMin: -80, kind: 'ankommen' },
          { id: 'a-umziehen', label: 'Umziehen', startOffsetMin: -80, endOffsetMin: -60, kind: 'umziehen' },
          { id: 'a-ansprache', label: 'Traineransprache', startOffsetMin: -60, endOffsetMin: -40, kind: 'ansprache' },
          { id: 'a-warm', label: 'Warmmachen', startOffsetMin: -40, endOffsetMin: -10, kind: 'warmmachen' },
          { id: 'a-kabine', label: 'Kabine und spielfertig machen', startOffsetMin: -10, endOffsetMin: 0, kind: 'kabine' },
        ],
      },
    },
    kits: {
      home: { shirt: 'Grün (Beispiel)', shorts: 'Weiß (Beispiel)', socks: 'Grün (Beispiel)' },
      away: { shirt: 'Weiß (Beispiel)', shorts: 'Grün (Beispiel)', socks: 'Weiß (Beispiel)' },
      notes: 'Beispielangaben – bitte an die echte Spielkleidung anpassen.',
    },
    gameIdea: null,
    formation: null,
    template: { ...defaultTemplate('2026-08-01T10:00:00+02:00'), name: 'Baunatal-Muster · 11 Folien' },
    lastConfirmedSquad: {
      players: DEMO_SQUAD_NAMES.map(([number, name, position], i) => ({ id: `sp-${i + 1}`, number, name: `${name} (Beispiel)`, position })),
      note: '',
      confirmedAt: '2026-10-16T12:00:00+02:00',
      origin: { kind: 'beispiel', label: 'Beispielkader (fiktiv), zuletzt bestätigt 16.10.2026' },
    },
    isDemo: true,
    createdAt: t,
    updatedAt: t,
  };
}

export function referenceMatch(): Match {
  return {
    id: REFERENCE_MATCH_ID,
    teamId: DEMO_TEAM_ID,
    opponent: BAUNATAL,
    competition: COMPETITION,
    competitionType: 'liga',
    matchday: 14,
    date: '2026-10-23',
    kickoff: '19:00',
    isHome: true,
    venue: null,
    isHistoricalReference: true,
    isDemo: true,
    createdAt: '2026-10-20T10:00:00+02:00',
  };
}

export function initialState(): AppState {
  const team = demoTeam();
  const match = referenceMatch();
  return {
    schemaVersion: 1,
    activeTeamId: team.id,
    teams: [team],
    matches: [match],
    preparations: { [match.id]: createPreparation(team, match) },
    dossiers: [],
  };
}

/**
 * Beispielantworten für den historischen Referenzfall. Sie sind fiktiv, werden als
 * „Beispielantwort“ markiert und sind ausschließlich im Referenzfall verfügbar.
 */
export function applyExampleAnswers(prep: Preparation): Preparation {
  if (prep.matchId !== REFERENCE_MATCH_ID) throw new Error('Beispielantworten gibt es nur für den historischen Referenzfall.');
  const t = now();
  const a = (text: string, state: 'beantwortet' | 'nicht_bekannt' | 'keine_abweichung' = 'beantwortet') => ({ text, state, updatedAt: t, origin: 'beispiel' as const });
  const answers: Partial<Record<QuestionId, ReturnType<typeof a>>> = {
    q1_grundordnung: a('Meist 4-4-2 mit Raute; bei Rückstand Umstellung auf 4-3-3.'),
    q2_aufbau: a('Aufbau oft über den linken Halbraum, viele zweite Bälle nach langen Schlägen auf die 9.'),
    q3_verteidigung: a('Mittelfeldpressing ab der Mittellinie, Auslöser ist der Rückpass zum Innenverteidiger. Nach überspieltem Pressing schnelles Zurückfallen in die Abwehrkette.'),
    q4_umschalten: a('Nach Ballgewinn direkter Ball in die Tiefe.'),
    q4b_ballverlust: a('Sofortiges Gegenpressing mit zwei, drei Spielern.'),
    q5b_standards: a('Kopfballstark bei Ecken (Innenverteidiger kommt mit nach vorn).'),
    q5_staerken: a('Schnelle Flügelspieler.'),
    q6_verwundbar: a('Raum hinter den aufrückenden Außenverteidigern, wenn der Ball schnell verlagert wird.'),
    q7_schluesselspieler: a('Die 9 und die 10 sind die wichtigsten Anspielstationen.'),
    q8_ausfaelle: a('', 'nicht_bekannt'),
    q9_abweichungen: a('', 'keine_abweichung'),
    q10_ablauf: a('', 'keine_abweichung'),
    q11_kleidung: a('Heimkombination wie gespeichert.'),
    q13_layout: a('', 'keine_abweichung'),
  };
  return {
    ...prep,
    answers: { ...prep.answers, ...answers },
    playerHints: [
      { candidateId: 'gp-berger', name: 'Jonas Berger (fiktiv)', reason: 'Zielspieler bei langen Bällen, stark im Strafraum (Beispielhinweis).' },
    ],
    mission: {
      messages: [
        { headline: 'Zweite Bälle gehören uns', text: 'Wir sind nach jedem langen Ball als Erste am Abpraller.', coachRaw: 'Zweite Bälle gehören uns – wir sind nach jedem langen Ball als Erste da. (Beispiel)' },
        { headline: 'Mutig nach vorne', text: 'Wir spielen nach Ballgewinn den ersten Pass nach vorne.', coachRaw: 'Mutig nach vorne spielen, erster Pass nach Ballgewinn nach vorne. (Beispiel)' },
        { headline: 'Zusammen 90 Minuten', text: 'Wir helfen uns gegenseitig bis zum Schlusspfiff.', coachRaw: 'Zusammen 90 Minuten, wir helfen uns bis zum Schluss. (Beispiel)' },
      ],
      motto: 'Heimspiel. Unser Platz. (Beispiel)',
      mantras: ['Jeder Zweikampf zählt.', 'Wir reden auf dem Platz.'],
      mantrasWaived: false,
      origin: 'beispiel',
    },
    updatedAt: t,
  };
}
