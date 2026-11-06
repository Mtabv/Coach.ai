import { describe, expect, it } from 'vitest';
import { formFacts, goalPatterns, goalPhases, tableGapFact } from './insights';
import type { GoalLog, ResultEntry, TableRow } from './types';

const row = (rank: number, team: string, points: number): TableRow => ({ rank, team, played: 15, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points, pointDeduction: null });
const table = [row(1, 'A', 45), row(2, 'B', 39), row(3, 'C', 27), row(4, 'D', 16), row(5, 'E', 14), row(6, 'F', 10)];

describe('Auswertungen für die Formfolien', () => {
  it('zählt Tore je Spielphase (Nachspielzeit zur letzten Phase)', () => {
    const log: GoalLog = {
      sourceId: 'x',
      games: [{ date: '2026-10-01', opponent: 'B', isHome: true, goals: [{ minute: 3, own: true }, { minute: 45, own: true }, { minute: 90, own: false }] }],
    };
    const p = goalPhases(log);
    expect(p.map((x) => [x.goalsFor, x.goalsAgainst])).toEqual([[1, 0], [0, 0], [1, 0], [0, 0], [0, 0], [0, 1]]);
  });

  it('erkennt Muster nur aus gezählten Toren', () => {
    const g = (goals: [number, boolean][]) => ({ date: '2026-10-01', opponent: 'X', isHome: true, goals: goals.map(([minute, own]) => ({ minute, own })) });
    const log: GoalLog = {
      sourceId: 'x',
      games: [
        g([[5, true], [12, true], [60, false], [70, true]]),
        g([[10, true], [80, true]]),
        g([[30, false], [35, true], [40, true]]),
        g([[88, true]]),
      ],
    };
    const t = goalPatterns(log, 'TSG X');
    expect(t).toContain('In 3 von 4 Spielen das erste Tor erzielt – im Mittel in Minute 10.');
    expect(t).toContain('In 2 von 4 Spielen zwei oder mehr Tore innerhalb von 10 Minuten.');
    // Erst ab drei Gegentoren mit Folgetor aussagekräftig – hier nur zwei.
    expect(t.some((x) => x.startsWith('Nach einem Gegentor'))).toBe(false);
    expect(t).toContain('Zur Pause geführt in 3 von 4 Spielen, nie zurückgelegen.');
  });

  it('nennt den Abstand zum ersten Nichtabstiegsplatz nach den Zonen im Profil', () => {
    expect(tableGapFact('F', table, { promotion: 1, promotionPlayoff: 1, relegation: 2 })).toBe('Platz 6 (Abstiegsplatz) – 6 Punkte Rückstand auf Platz 4, den ersten Nichtabstiegsplatz.');
    expect(tableGapFact('A', table, undefined)).toBe('Tabellenführer mit 6 Punkten Vorsprung auf Platz 2.');
    expect(tableGapFact('C', table, undefined)).toBe('Platz 3 – 12 Punkte hinter Platz 2.');
  });

  it('nennt für die eigene Mannschaft auch Ermutigendes – nur aus Daten', () => {
    const r = (date: string, home: string, away: string, gh: number, ga: number, competitionType: 'liga' | 'pokal' = 'liga'): ResultEntry => ({ date, competitionType, competitionLabel: competitionType, home, away, goalsHome: gh, goalsAway: ga });
    const results = [r('2026-10-20', 'F', 'A', 0, 3), r('2026-10-10', 'B', 'F', 1, 2), r('2026-10-01', 'F', 'C', 1, 1), r('2026-09-01', 'F', 'Z', 4, 0, 'pokal'), r('2026-08-20', 'Y', 'F', 0, 2, 'pokal')];
    const facts = formFacts({ team: 'F', results, before: '2026-11-01', table, zones: { promotion: 1, promotionPlayoff: 0, relegation: 2 }, own: true, roster: { sourceId: 'x', coaches: [], players: [{ name: 'Lüer', goals: 9, assists: 3 }, { name: 'Palang', goals: 3, assists: 5 }] } });
    expect(facts).toEqual([
      'Platz 6 (Abstiegsplatz) – 6 Punkte Rückstand auf Platz 4, den ersten Nichtabstiegsplatz.',
      'Letzter Ligasieg: 2:1 bei B (10.10.).',
      'In 2 von 3 Ligaspielen getroffen – 3 Tore insgesamt.',
      'Im Pokal 2 von 2 Spielen gewonnen.',
      'Bester Torschütze: Lüer mit 9 Toren (laut FuPa).',
      'Meiste Vorlagen: Palang mit 5 (laut FuPa).',
    ]);
  });
});
