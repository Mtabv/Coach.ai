// Testdaten im Antwortformat des lokalen fussball.de-Dienstes. Fiktive Werte, nur für Tests.
import type { FdGame, FdGameDetail, FdLiga, FdMatchday, FdTableRow } from '../api';

const g = (id: string, utc: string, comp: string, home: string, away: string, hs: string | null, as: string | null, location: string | null = null): FdGame => ({
  id, datetime_utc: utc, competition: comp, home_team: home, away_team: away, home_score: hs, away_score: as, location,
});

export const OWN_ID = '011MIEXAMPLEOWN0000000VS54898DL';
export const OPP_ID = '011MIEXAMPLEOPP0000000VS54898DL';
export const OWN_FD = 'TSG Wilhelmshöhe';
export const OPP_FD = 'GSV Eintr.Baunatal';

const row = (place: number, team: string, team_id: string, games: number, won: number, draw: number, lost: number, gf: number, ga: number, points: number): FdTableRow => ({
  place, team, team_id, games, won, draw, lost, goals_for: gf, goals_against: ga, points,
});

export const liga: FdLiga = {
  staffel_id: 'STAFFEL0000000000000000001-G',
  staffel_name: 'Gruppenliga - Region Kassel – Herren - 2026/2027',
  deduction_note: 'Tabelle enthält Punktabzüge wegen Nicht-Erfüllung SR-Pflichtsoll',
  table: [
    row(1, OPP_FD, OPP_ID, 4, 3, 0, 1, 9, 3, 9),
    row(2, 'SV Kaufungen', 'KAUFUNGEN0000000000000000001', 4, 2, 1, 1, 7, 5, 6), // 2S 1U → 7, 6 Punkte: 1 Abzug
    row(3, OWN_FD, OWN_ID, 4, 1, 1, 2, 5, 10, 4),
    row(4, 'TSG Wilhelmshöhe II', 'RESERVE00000000000000000001', 4, 0, 0, 4, 1, 12, 0),
  ],
  home_table: [row(1, OPP_FD, OPP_ID, 2, 2, 0, 0, 6, 1, 6)],
  away_table: [row(1, OPP_FD, OPP_ID, 2, 1, 0, 1, 3, 2, 3)],
  scorers: [
    { rank: 1, name: 'Hendrik Bestmann', team: OPP_FD, team_id: OPP_ID, goals: 5 },
    { rank: 2, name: 'Max Muster', team: 'SV Kaufungen', team_id: 'KAUFUNGEN0000000000000000001', goals: 4 },
  ],
};

export const ownSeason: FdGame[] = [
  g('1', '2026-08-02T12:30:00Z', 'Kreisfreundschaftsspiele', OWN_FD, 'FSV X', '6', '1'),
  g('2', '2026-08-09T13:30:00Z', 'Gruppenliga', 'SV Kaufungen', OWN_FD, '2', '2'),
  g('3', '2026-08-16T13:30:00Z', 'Gruppenliga', OWN_FD, 'TSG Wilhelmshöhe II', '3', '1'),
  g('4', '2026-08-23T13:30:00Z', 'Kreispokal', OWN_FD, 'TSV Y', '22.07.2026', '18:30'), // verlegt
  g('5', '2026-09-06T13:30:00Z', 'Gruppenliga', OPP_FD, OWN_FD, '3', '0'),
  g('6', '2026-09-13T13:30:00Z', 'Gruppenliga', OWN_FD, 'SV Kaufungen', '0', '4'),
  g('7', '2026-10-23T17:00:00Z', 'Gruppenliga', OWN_FD, OPP_FD, null, '::', 'Kunstrasenplatz, KR KS-Wilhelmshöhe, Schulstr., 34131 Kassel'),
];

export const oppSeason: FdGame[] = [
  g('5', '2026-09-06T13:30:00Z', 'Gruppenliga', OPP_FD, OWN_FD, '3', '0'),
  g('11', '2026-09-13T13:30:00Z', 'Gruppenliga', 'TSG Wilhelmshöhe II', OPP_FD, '0', '3'),
  g('GAME00000000000012', '2026-09-20T13:30:00Z', 'Gruppenliga', OPP_FD, 'SV Kaufungen', '3', '1'),
  g('GAME00000000000013', '2026-09-27T13:30:00Z', 'Gruppenliga', 'SV Kaufungen', OPP_FD, '2', '0'),
  g('14', '2026-09-30T17:00:00Z', 'Kreispokal', 'TSV Z', OPP_FD, '0', '5'),
  g('7', '2026-10-23T17:00:00Z', 'Gruppenliga', OWN_FD, OPP_FD, null, '::'),
];

export const history: FdGame[] = [
  g('h1', '2025-03-20T18:00:00Z', 'Gruppenliga', OWN_FD, OPP_FD, '1', '1'),
  g('h2', '2024-10-01T17:00:00Z', 'Kreisoberliga', 'GSV Eintr.Baunatal II zg.', OWN_FD, '0', '2'), // zweite Mannschaft – kein direktes Duell
];

export const matchday: FdMatchday = {
  staffel_id: liga.staffel_id!,
  matchday: 5,
  games: [
    { game_id: '7', datetime_utc: '2026-10-23T17:00:00Z', home_team: OWN_FD, home_team_id: OWN_ID, away_team: OPP_FD, away_team_id: OPP_ID, home_score: null, away_score: null, note: null },
    { game_id: '8', datetime_utc: '2026-10-25T13:00:00Z', home_team: 'SV Kaufungen', home_team_id: 'KAUFUNGEN0000000000000000001', away_team: 'TSG Wilhelmshöhe II', away_team_id: 'RESERVE00000000000000000001', home_score: null, away_score: null, note: null },
  ],
};

const p = (name: string, number: number, opts: { gk?: boolean; c?: boolean } = {}) => ({ name, number, is_goalkeeper: Boolean(opts.gk), is_captain: Boolean(opts.c) });
const lineupFor = (oppHome: boolean, players: ReturnType<typeof p>[], coach: string) => {
  const oppTeam = { team: OPP_FD, starting: players, substitutes: [], coaches: [coach] };
  const other = { team: 'Andere', starting: [], substitutes: [], coaches: [] };
  return oppHome ? { home: oppTeam, away: other } : { home: other, away: oppTeam };
};

export const lineups: FdGameDetail[] = [
  {
    game_id: 'GAME00000000000013', home_team: 'SV Kaufungen', away_team: OPP_FD,
    lineup: lineupFor(false, [p('Tim Torwart', 1, { gk: true }), p('Hendrik Bestmann', 9, { c: true }), p('Paul Läufer', 8)], 'Andre Coach'),
    events: [],
  },
  {
    game_id: 'GAME00000000000012', home_team: OPP_FD, away_team: 'SV Kaufungen',
    lineup: lineupFor(true, [p('Tim Torwart', 1, { gk: true }), p('Hendrik Bestmann', 9, { c: true }), p('Paul Läufer', 8)], 'Andre Coach'),
    events: [
      { time: '10’', type: 'goal', team: 'home', description: 'Hendrik Bestmann' },
      { time: '50’', type: 'goal', team: 'home', description: 'Paul Läufer' },
      { time: '60’', type: 'goal', team: 'away', description: 'Max Muster' },
    ],
  },
];
