import type {
  FixturePairing,
  HeadToHead,
  OpponentPlayerCandidate,
  ResultEntry,
  SourceRef,
  SourcedFact,
  TableRow,
  TableSnapshot,
} from '../domain/types';

/**
 * BEISPIELDATEN für den historischen Referenzfall
 * TSG Wilhelmshöhe – GSV Eintracht Baunatal (Gruppenliga Kassel 2, 14. Spieltag, 23.10.2026).
 *
 * Alle Ergebnisse, Tabellenstände, weiteren Mannschaften und Spielernamen sind FIKTIV und
 * dienen nur der Vorführung. Sie stammen aus keiner Online-Recherche.
 * Die Tabelle enthält absichtlich einen Widerspruch zwischen zwei Quellen und eine veraltete
 * Quelle mit neuerem Abrufzeitpunkt, um die Prüffunktionen zu zeigen.
 */

export const TSG = 'TSG Wilhelmshöhe';
export const BAUNATAL = 'GSV Eintracht Baunatal';
export const COMPETITION = 'Gruppenliga Kassel 2';

export const SOURCES: Record<'A' | 'B' | 'C' | 'ERG' | 'VEREIN', SourceRef> = {
  A: {
    id: 'demo-verband',
    label: 'Verbandsportal (Beispieldaten)',
    kind: 'demo',
    asOf: 'nach dem 13. Spieltag',
    asOfRank: 13,
    retrievedAt: '2026-10-21T16:05:00+02:00',
  },
  B: {
    id: 'demo-vereinsportal',
    label: 'Vereinsportal (Beispieldaten)',
    kind: 'demo',
    asOf: 'nach dem 12. Spieltag',
    asOfRank: 12,
    retrievedAt: '2026-10-22T09:12:00+02:00',
  },
  C: {
    id: 'demo-ergebnisdienst',
    label: 'Ergebnisdienst (Beispieldaten)',
    kind: 'demo',
    asOf: 'nach dem 13. Spieltag',
    asOfRank: 13,
    retrievedAt: '2026-10-21T18:30:00+02:00',
  },
  ERG: {
    id: 'demo-ergebnisliste',
    label: 'Ergebnislisten (Beispieldaten)',
    kind: 'demo',
    asOf: 'bis 21.10.2026',
    asOfRank: 13,
    retrievedAt: '2026-10-21T18:30:00+02:00',
  },
  VEREIN: {
    id: 'demo-vereinsmeldung',
    label: 'Vereinsmeldungen (Beispieldaten)',
    kind: 'demo',
    asOf: 'Oktober 2026',
    retrievedAt: '2026-10-21T18:40:00+02:00',
  },
};

type RowSpec = [team: string, w: number, d: number, l: number, gf: number, ga: number, deduction: number | null];

/** Stand nach dem 13. Spieltag (fiktiv). Summe Siege = Summe Niederlagen, Tore = Gegentore. */
const ROWS_13: RowSpec[] = [
  ['SV Grünau', 9, 3, 1, 31, 12, null],
  [TSG, 8, 3, 2, 28, 14, null],
  [BAUNATAL, 7, 4, 2, 26, 15, null],
  ['FC Lindenhof', 6, 3, 4, 24, 17, null],
  ['TuS Eichfeld', 6, 4, 3, 22, 18, null],
  ['SG Mühlbachtal', 5, 3, 5, 21, 19, null],
  ['VfB Rosental', 5, 5, 3, 19, 17, null],
  ['SC Steinbrück', 4, 4, 5, 20, 20, null],
  ['FSV Talheim-Nord', 6, 3, 4, 22, 21, 3],
  ['TSV Wiesengrund', 4, 5, 4, 17, 18, null],
  ['SpVgg Hohenfeld', 3, 3, 7, 18, 23, null],
  ['FC Am Kreuzberg', 4, 2, 7, 16, 22, null],
  ['SV Buchenhain', 3, 4, 6, 15, 22, null],
  ['TuS Ostheide', 3, 3, 7, 14, 24, null],
  ['SG Weidenau-Süd', 2, 4, 7, 12, 25, null],
  ['SC Bergwiese', 1, 3, 9, 10, 28, null],
];

function buildRows(specs: RowSpec[], pointPatch: Record<string, number> = {}): TableRow[] {
  const rows = specs.map(([team, w, d, l, gf, ga, ded]) => ({
    rank: 0,
    team,
    played: w + d + l,
    won: w,
    drawn: d,
    lost: l,
    goalsFor: gf,
    goalsAgainst: ga,
    points: pointPatch[team] ?? w * 3 + d - (ded ?? 0),
    pointDeduction: ded,
  }));
  rows.sort((a, b) => b.points - a.points || b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

/** Stand nach dem 12. Spieltag – nur für die veraltete Quelle B. */
const ROWS_12: RowSpec[] = ROWS_13.map(([team, w, d, l, gf, ga, ded]) => {
  // vereinfachte Rückrechnung: jedes Team hat ein Spiel weniger
  if (team === TSG) return [team, 7, 3, 2, 25, 14, ded];
  if (team === BAUNATAL) return [team, 6, 4, 2, 23, 14, ded];
  if (w > 0) return [team, w - 1, d, l, Math.max(0, gf - 1), ga, ded];
  return [team, w, d, Math.max(0, l - 1), gf, Math.max(0, ga - 1), ded];
});

export function demoTables(): TableSnapshot[] {
  return [
    // Quelle A weist für Baunatal 24 statt 25 Punkte aus – ohne Punktabzug anzugeben.
    { source: SOURCES.A, rows: buildRows(ROWS_13, { [BAUNATAL]: 24 }) },
    { source: SOURCES.C, rows: buildRows(ROWS_13) },
    { source: SOURCES.B, rows: buildRows(ROWS_12) },
  ];
}

const MD_DATES: Record<number, string> = {
  1: '2026-08-07', 2: '2026-08-14', 3: '2026-08-21', 4: '2026-08-26', 5: '2026-08-28', 6: '2026-09-04',
  7: '2026-09-11', 8: '2026-09-18', 9: '2026-09-23', 10: '2026-09-25', 11: '2026-10-02', 12: '2026-10-09', 13: '2026-10-16',
};

function liga(md: number, home: string, away: string, gh: number, ga: number): ResultEntry {
  return { date: MD_DATES[md], competitionType: 'liga', competitionLabel: COMPETITION, matchday: md, home, away, goalsHome: gh, goalsAway: ga };
}

export function demoResultsTsg(): ResultEntry[] {
  return [
    { date: '2026-07-31', competitionType: 'test', competitionLabel: 'Testspiel', home: TSG, away: 'SC Bergwiese', goalsHome: 2, goalsAway: 2 },
    liga(1, TSG, 'SV Buchenhain', 3, 1),
    liga(2, 'FC Lindenhof', TSG, 1, 2),
    liga(3, TSG, 'TuS Eichfeld', 1, 1),
    liga(4, 'SV Grünau', TSG, 2, 0),
    liga(5, TSG, 'SC Bergwiese', 4, 0),
    liga(6, 'TuS Ostheide', TSG, 1, 3),
    liga(7, TSG, 'VfB Rosental', 2, 2),
    liga(8, 'SG Weidenau-Süd', TSG, 0, 2),
    liga(9, TSG, 'SG Mühlbachtal', 1, 2),
    liga(10, 'FC Am Kreuzberg', TSG, 1, 3),
    liga(11, TSG, 'TSV Wiesengrund', 1, 1),
    liga(12, 'SpVgg Hohenfeld', TSG, 2, 3),
    liga(13, TSG, 'FSV Talheim-Nord', 3, 0),
    { date: '2026-10-20', competitionType: 'pokal', competitionLabel: 'Kreispokal', home: 'TSV Kirchwald', away: TSG, goalsHome: 0, goalsAway: 3 },
  ];
}

export function demoResultsBaunatal(): ResultEntry[] {
  return [
    liga(1, 'SC Steinbrück', BAUNATAL, 2, 2),
    liga(2, BAUNATAL, 'SpVgg Hohenfeld', 3, 1),
    liga(3, 'TSV Wiesengrund', BAUNATAL, 0, 1),
    liga(4, BAUNATAL, 'FC Lindenhof', 2, 2),
    liga(5, 'SV Grünau', BAUNATAL, 3, 1),
    liga(6, BAUNATAL, 'SG Mühlbachtal', 3, 0),
    liga(7, 'SG Weidenau-Süd', BAUNATAL, 1, 2),
    liga(8, BAUNATAL, 'TuS Eichfeld', 1, 1),
    liga(9, 'FC Am Kreuzberg', BAUNATAL, 1, 0),
    liga(10, BAUNATAL, 'SC Bergwiese', 4, 0),
    liga(11, 'TuS Ostheide', BAUNATAL, 2, 3),
    liga(12, BAUNATAL, 'VfB Rosental', 1, 1),
    liga(13, 'SV Buchenhain', BAUNATAL, 1, 3),
    { date: '2026-10-14', competitionType: 'pokal', competitionLabel: 'Kreispokal', home: BAUNATAL, away: 'TuS Ostheide', goalsHome: 1, goalsAway: 2 },
  ];
}

export function demoPairings(): FixturePairing[] {
  return [
    { home: TSG, away: BAUNATAL, date: '2026-10-23', kickoff: '19:00' },
    { home: 'SV Grünau', away: 'SC Bergwiese', date: '2026-10-24', kickoff: '15:30' },
    { home: 'FC Lindenhof', away: 'TuS Ostheide', date: '2026-10-25', kickoff: '15:00' },
    { home: 'TuS Eichfeld', away: 'SG Weidenau-Süd', date: '2026-10-25', kickoff: '15:00' },
    { home: 'SG Mühlbachtal', away: 'FC Am Kreuzberg', date: '2026-10-25', kickoff: '15:00' },
    { home: 'VfB Rosental', away: 'SV Buchenhain', date: '2026-10-25', kickoff: '15:00' },
    { home: 'SC Steinbrück', away: 'SpVgg Hohenfeld', date: '2026-10-25', kickoff: '15:00' },
    { home: 'FSV Talheim-Nord', away: 'TSV Wiesengrund', date: '2026-10-25', kickoff: '15:00' },
  ];
}

export function demoHeadToHead(): HeadToHead[] {
  return [
    { season: '2025/26', date: '2026-03-20', competitionLabel: COMPETITION, competitionType: 'liga', home: TSG, away: BAUNATAL, goalsHome: 1, goalsAway: 1 },
    { season: '2025/26', date: '2025-09-12', competitionLabel: COMPETITION, competitionType: 'liga', home: BAUNATAL, away: TSG, goalsHome: 2, goalsAway: 1 },
    { season: '2024/25', date: '2024-08-14', competitionLabel: 'Kreispokal', competitionType: 'pokal', home: TSG, away: BAUNATAL, goalsHome: 0, goalsAway: 2 },
  ];
}

export function demoOpponentPlayers(): OpponentPlayerCandidate[] {
  const s = SOURCES.ERG.id;
  return [
    { id: 'gp-berger', name: 'Jonas Berger (fiktiv)', number: '9', position: 'Sturm', goals: 9, assists: 2,
      evidence: [{ text: '9 Ligatore in 13 Spielen', sourceId: s }, { text: '3 Tore in den letzten fünf Ligaspielen', sourceId: s }] },
    { id: 'gp-heinemann', name: 'Luca Heinemann (fiktiv)', number: '10', position: 'Offensives Mittelfeld', goals: 4, assists: 6,
      evidence: [{ text: '4 Tore, 6 Vorlagen in der Liga', sourceId: s }] },
    { id: 'gp-engel', name: 'Marco Engel (fiktiv)', number: '7', position: 'Flügel', goals: 5, assists: 3,
      evidence: [{ text: '5 Ligatore, davon 3 auswärts', sourceId: s }] },
    { id: 'gp-raabe', name: 'Tim Raabe (fiktiv)', number: '4', position: 'Innenverteidigung', goals: 2, assists: 0,
      evidence: [{ text: '13 von 13 Ligaspielen über die volle Spielzeit', sourceId: s }, { text: '2 Kopfballtore', sourceId: s }] },
    { id: 'gp-brandt', name: 'Felix Brandt (fiktiv)', number: '23', position: 'Mittelfeld', evidence: [] },
  ];
}

export function demoOpponentFacts(): SourcedFact[] {
  return [
    { id: 'f-trainer', text: 'Neuer Cheftrainer seit Saisonbeginn 2026/27.', sourceId: SOURCES.VEREIN.id },
    { id: 'f-pokal', text: 'Am 14.10.2026 im Kreispokal gegen TuS Ostheide ausgeschieden (1:2).', sourceId: SOURCES.ERG.id },
  ];
}
