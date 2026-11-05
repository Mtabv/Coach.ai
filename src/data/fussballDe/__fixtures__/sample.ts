// Testdaten im Antwortformat des Crawlers (fussball_de_api). Fiktive Werte, nur für Tests.
import type { FdGame, FdTable } from '../api';

const g = (id: string, utc: string, comp: string, home: string, away: string, hs: string | null, as: string | null, location: string | null = null): FdGame => ({
  id, datetime_utc: utc, competition: comp, home_team: home, away_team: away, home_score: hs, away_score: as, location,
});

export const OWN_FD = 'TSG Wilhelmshöhe';
export const OPP_FD = 'GSV Eintr. Baunatal';

export const ownPrev: FdGame[] = [
  g('1', '2026-10-17T13:00:00Z', 'Gruppenliga', 'SV Türkgücü', OWN_FD, '6', '3'),
  g('2', '2026-10-11T13:00:00Z', 'Gruppenliga', OWN_FD, 'FSV Schauenburg', '0', '3'),
  g('3', '2026-10-04T13:00:00Z', 'Gruppenliga', 'SV Großalmerode', OWN_FD, '1', '2'),
  g('4', '2026-09-30T17:00:00Z', 'Kreispokal', OWN_FD, 'TSV X', '4', '0'),
  g('5', '2026-09-27T13:00:00Z', 'Gruppenliga', OWN_FD, 'SG Reinhardshagen', '1', '6'),
  g('6', '2026-09-20T13:00:00Z', 'Gruppenliga', 'TSV Rothwesten', OWN_FD, '8', '0'),
  g('7', '2026-09-13T13:00:00Z', 'Gruppenliga', OWN_FD, 'SV Abgesagt', null, null),
  g('8', '2026-03-20T18:00:00Z', 'Gruppenliga', OWN_FD, OPP_FD, '1', '1'),
];

export const oppPrev: FdGame[] = [
  g('11', '2026-10-18T13:00:00Z', 'Gruppenliga', OPP_FD, 'Kaufungen', '3', '1'),
  g('12', '2026-10-11T13:00:00Z', 'Gruppenliga', 'Sandershausen', OPP_FD, '1', '0'),
  g('13', '2026-10-04T13:00:00Z', 'Gruppenliga', OPP_FD, 'Türkgücü', '5', '2'),
  g('8', '2026-03-20T18:00:00Z', 'Gruppenliga', OWN_FD, OPP_FD, '1', '1'),
];

export const ownNext: FdGame[] = [
  g('20', '2026-10-23T17:00:00Z', 'Gruppenliga', OWN_FD, OPP_FD, null, null, 'Kunstrasen Schulstraße, Schulstraße 2, 34131 Kassel'),
];

export const table: FdTable = {
  entries: [
    { place: 1, team: 'Sandershausen', games: 13, won: 13, draw: 0, lost: 0, goal: '63:10', goal_difference: 53, points: 39 },
    { place: 2, team: OPP_FD, games: 13, won: 11, draw: 0, lost: 2, goal: '42:16', goal_difference: 26, points: 33 },
    { place: 14, team: OWN_FD, games: 13, won: 3, draw: 1, lost: 9, goal: '27:53', goal_difference: -26, points: 10 },
    { place: 15, team: 'Großalmerode', games: 13, won: 2, draw: 2, lost: 9, goal: '18:39', goal_difference: -21, points: 8 },
  ],
};
