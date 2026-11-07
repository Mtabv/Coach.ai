import { describe, expect, it } from 'vitest';
import { goalsFromDetail } from './fetch';
import { binOf, buildSeasonReport } from './report';
import type { SeasonData, SeasonGame, SeasonGoal } from './types';

const table = Array.from({ length: 8 }, (_, i) => ({ place: i + 1, team: i === 7 ? 'Wir' : `Gegner ${i + 1}`, games: 10, won: 3, draw: 2, lost: 5, goalsFor: 20, goalsAgainst: 20, points: 11 }));

const g = (id: string, date: string, opp: number, gf: number, ga: number, goals: SeasonGoal[] | null, starting: string[] | null = null): SeasonGame => ({
  id, date, opponent: `Gegner ${opp}`, home: true, goalsFor: gf, goalsAgainst: ga, goals, starting,
});
const goal = (minute: number, own: boolean, half: 1 | 2 = minute > 45 ? 2 : 1, scorer: string | null = own ? 'Max Muster' : null): SeasonGoal => ({ minute, half, own, scorer });

function data(games: SeasonGame[]): SeasonData {
  return { teamId: 't', fetchedAt: '2026-11-07T12:00:00Z', until: '2026-11-07', season: '2026/27', competition: 'Testliga', ownName: 'Wir', table, homeRow: null, awayRow: null, games, photos: {}, crest: null, sources: [] };
}

describe('Saison-Zwischenreport', () => {
  it('ordnet Minuten den Viertelstunden zu, Nachspielzeit der ersten Halbzeit zum Abschnitt davor', () => {
    expect(binOf(1, 1)).toBe(0);
    expect(binOf(15, 1)).toBe(0);
    expect(binOf(16, 1)).toBe(1);
    expect(binOf(45, 1)).toBe(2);
    expect(binOf(47, 1)).toBe(2);
    expect(binOf(46, 2)).toBe(3);
    expect(binOf(90, 2)).toBe(5);
  });

  it('zählt Punkte, Halbzeitstand, erstes Tor und Gegnerstärke', () => {
    const r = buildSeasonReport(
      data([
        g('a', '2026-08-01', 1, 2, 1, [goal(10, false), goal(50, true), goal(80, true)]),
        g('b', '2026-08-08', 6, 0, 2, [goal(30, false), goal(70, false)]),
        g('c', '2026-08-15', 7, 1, 1, [goal(44, true), goal(90, false)]),
        g('d', '2026-08-22', 2, 3, 0, null),
      ]),
    );
    expect(r.points).toBe(7);
    expect(r.record).toEqual({ S: 2, U: 1, N: 1 });
    expect(r.withGoals).toBe(3);
    expect(r.binsFor).toEqual([0, 0, 1, 1, 0, 1]);
    expect(r.binsAgainst).toEqual([1, 1, 0, 0, 1, 1]);
    expect(r.halfMatrix['Rückstand']).toEqual({ S: 1, U: 0, N: 1 });
    expect(r.halfMatrix['Führung']).toEqual({ S: 0, U: 1, N: 0 });
    expect(r.lostLeads.map((x) => x.id)).toEqual(['c']);
    expect(r.firstGoal.gegner).toEqual({ S: 1, U: 0, N: 1 });
    // 8 Mannschaften: obere Hälfte Platz 1–4
    expect(r.vsTop.games.map((x) => x.id)).toEqual(['a', 'd']);
    expect(r.vsBottom.points).toBe(1);
    expect(r.hints).toEqual([]); // zu wenige Spiele für Muster
  });

  it('erkennt eine Häufung der Gegentore in der Schlussphase erst ab genug Spielen', () => {
    const late = Array.from({ length: 8 }, (_, i) => g(`x${i}`, `2026-09-${String(i + 10)}`, (i % 7) + 1, 0, 2, [goal(80, false), goal(20 + i, false)]));
    const r = buildSeasonReport(data(late));
    expect(r.binsAgainst[5]).toBe(8);
    expect(r.hints.find((h) => h.id === 'schlussphase')?.title).toMatch(/Schlussphase/);
    const even = Array.from({ length: 8 }, (_, i) => g(`y${i}`, `2026-09-${String(i + 10)}`, (i % 7) + 1, 0, 2, [goal(10 + i * 10, false), goal(15 + i * 9, false)]));
    expect(buildSeasonReport(data(even)).hints.find((h) => h.id === 'schlussphase')?.title).toMatch(/Kein Fitness-Muster/);
  });

  it('zählt Startelf, Jokertore und Wechsel in der Startelf', () => {
    const xi1 = ['A', 'B', 'C'], xi2 = ['A', 'B', 'D'];
    const r = buildSeasonReport(
      data([
        g('a', '2026-08-01', 1, 1, 0, [goal(60, true, 2, 'E')], xi1),
        g('b', '2026-08-08', 2, 1, 0, [goal(60, true, 2, 'A')], xi2),
      ]),
    );
    expect(r.starters[0]).toEqual({ name: 'A', starts: 2 });
    expect(r.jokerGoals.map((j) => j.name)).toEqual(['E']);
    expect(r.avgChanges).toBe(1);
  });
});

describe('Spielbericht', () => {
  it('verwirft Berichte, deren Tore nicht zum Ergebnis passen', () => {
    const detail = { game_id: 'x', home_team: 'A', away_team: 'B', lineup: null, events: [{ time: '12’', type: 'goal', team: 'home' as const, description: 'Max', half: 1 }, { time: '90+2’', type: 'goal', team: 'away' as const, description: 'Tim', half: 2 }] };
    expect(goalsFromDetail(detail, 'home', 2)).toEqual([
      { minute: 12, half: 1, own: true, scorer: 'Max' },
      { minute: 90, half: 2, own: false, scorer: 'Tim' },
    ]);
    expect(goalsFromDetail(detail, 'away', 3)).toBeNull();
    expect(goalsFromDetail(undefined, 'home', 0)).toBeNull();
  });
});
