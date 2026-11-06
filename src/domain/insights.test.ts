import { describe, expect, it } from 'vitest';
import { formFacts, goalPhases, keyStats, tableGapFact } from './insights';
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

  it('nennt wichtige Statistiken: Phasen knapp, dann Torschützen, Joker, Karten', () => {
    const g = (opponent: string, goals: [number, boolean, string?, boolean?][], yellow = 1) => ({
      date: '2026-10-01', opponent, isHome: true, cards: { yellow, red: 0 },
      goals: goals.map(([minute, own, scorer, joker]) => ({ minute, own, ...(scorer ? { scorer } : {}), ...(joker ? { joker: true } : {}) })),
    });
    const log: GoalLog = {
      sourceId: 'x',
      games: [
        g('B', [[5, true, 'Billing'], [12, true, 'Müller'], [60, false], [70, true, 'Billing']]),
        g('C', [[10, true, 'Billing'], [80, true, 'Späth', true]]),
        g('E', [[30, false], [35, true, 'Harder', true], [40, true, 'Plasczyk']]),
        g('F', [[88, true, 'Wissling', true]], 2),
      ],
    };
    const t = keyStats(log);
    expect(t).toEqual([
      'Stärkste Offensivphase: Minute 1–15 – 3 von 8 Toren.',
      'Anfälligste Phase: Minute 16–30 – 1 von 2 Gegentoren.',
      'Zur Pause geführt in 3 von 4 Spielen, nie zurückgelegen.',
      '8 Tore von 6 verschiedenen Torschützen – Billing trifft am häufigsten (3).',
      '3 Tore durch eingewechselte Spieler – auch die Bank sticht.',
      '5 Gelbe Karten, kein Platzverweis in 4 Ligaspielen.',
    ]);
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
      'Bester Torschütze: Lüer mit 9 Toren.',
      'Meiste Vorlagen: Palang mit 5.',
    ]);
  });
});

describe('Gefahr-Folie: nur herausragende Belege', () => {
  it('lässt letzte Spiele, Startelf, Torjägerplatz und reine Einsätze weg', async () => {
    const { standoutReasons } = await import('../dossier/build');
    expect(
      standoutReasons([
        '18 Saisontore in der Liga (Platz 2 der Torjägerliste)',
        '9 Vorlagen in 13 Einsätzen (Saison 26/27)',
        '3 Tore in den letzten 5 Ligaspielen',
        'In der Startelf in 5 der letzten 5 Ligaspiele',
        '14 Einsätze (Saison 26/27)',
        'FuPa-MVP-Wert 100 %',
      ]),
    ).toEqual(['18 Saisontore', '9 Vorlagen in 13 Einsätzen (Saison 26/27)']);
  });
});
