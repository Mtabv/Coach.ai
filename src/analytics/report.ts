import type { SeasonData, SeasonGame, SeasonTableRow } from './types';

/**
 * Saison-Zwischenreport: ausschließlich gezählte Werte aus Tabelle und Spielberichten.
 * Hinweise entstehen nur, wenn genug Spiele vorliegen; sie sind als Fragen formuliert, nicht als Bewertung.
 */

export type Res = 'S' | 'U' | 'N';
export type HalfState = 'Führung' | 'Remis' | 'Rückstand';

export const BIN_LABELS = ["1–15'", "16–30'", "31–45'+", "46–60'", "61–75'", "76–90'+"] as const;

/** Mindestens so viele Spiele mit vollständigem Spielbericht, bevor Muster (Torminuten, Halbzeit) gedeutet werden. */
export const MIN_GAMES_PATTERN = 8;
/** Mindestens so viele Spiele je Gruppe für Vergleiche (Tabellenhälften, Halbzeitstand). */
export const MIN_GAMES_GROUP = 3;
/** Ligavergleich der Torminuten erst ab so vielen Ligaspielen mit vollständigem Spielbericht. */
export const MIN_LEAGUE_GAMES = 20;

export interface ReportGame extends SeasonGame {
  res: Res;
  points: number;
  halftime: [number, number] | null;
  firstGoal: 'wir' | 'gegner' | 'keins' | null;
  oppPlace: number | null;
}

export interface Hint {
  id: string;
  title: string;
  text: string;
}

export interface SeasonReport {
  ownRow: SeasonTableRow | null;
  teamsInLeague: number;
  games: ReportGame[];
  n: number;
  points: number;
  record: Record<Res, number>;
  goalsFor: number;
  goalsAgainst: number;
  /** Tore pro Spiel und Mannschaft in der ganzen Liga. */
  leagueGoalsPerGame: number | null;
  /** Spiele mit vollständigen Torminuten (Grundlage der Minuten- und Halbzeitauswertung). */
  withGoals: number;
  binsFor: number[];
  binsAgainst: number[];
  /**
   * Ligaschnitt je Viertelstunde, umgerechnet auf unsere Spiele mit Torminuten: Tore einer Mannschaft pro Spiel
   * in der Liga × unsere Spielzahl. Gilt für Tore und Gegentore gleichermaßen. null ohne Ligavergleich.
   */
  leagueBins: number[] | null;
  /** Anteil der Liga-Tore je Viertelstunde (Summe 1). */
  leagueShares: number[] | null;
  leagueGamesWithGoals: number;
  halves: { first: [number, number]; second: [number, number] } | null;
  halfMatrix: Record<HalfState, Record<Res, number>>;
  lostLeads: ReportGame[];
  firstGoal: Record<'wir' | 'gegner', Record<Res, number>>;
  /** Gegner nach heutigem Tabellenplatz: obere/untere Hälfte. */
  vsTop: Split;
  vsBottom: Split;
  topCut: number;
  scorers: { name: string; goals: number }[];
  jokerGoals: { name: string; game: ReportGame }[];
  starters: { name: string; starts: number }[];
  /** Spiele mit Aufstellung. */
  withLineup: number;
  avgChanges: number | null;
  hints: Hint[];
}

export interface Split {
  games: ReportGame[];
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

const pointsOf = (r: Res) => (r === 'S' ? 3 : r === 'U' ? 1 : 0);
const resOf = (gf: number, ga: number): Res => (gf > ga ? 'S' : gf === ga ? 'U' : 'N');
const emptyRes = (): Record<Res, number> => ({ S: 0, U: 0, N: 0 });

export function binOf(minute: number, half: 1 | 2 | null): number {
  if (half === 1 && minute > 45) return 2;
  return Math.min(5, Math.max(0, Math.floor((minute - 1) / 15)));
}

export function halfState(a: number, b: number): HalfState {
  return a > b ? 'Führung' : a === b ? 'Remis' : 'Rückstand';
}

const fmt = (v: number) => v.toFixed(2).replace('.', ',');

export function buildSeasonReport(data: SeasonData): SeasonReport {
  const place = new Map(data.table.map((r) => [r.team, r.place]));
  const games: ReportGame[] = [...data.games]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((g) => {
      const res = resOf(g.goalsFor, g.goalsAgainst);
      const ht = g.goals ? g.goals.reduce<[number, number]>((acc, x) => (x.half === 1 ? (x.own ? [acc[0] + 1, acc[1]] : [acc[0], acc[1] + 1]) : acc), [0, 0]) : null;
      const firstGoal = g.goals ? (g.goals.length ? (g.goals[0].own ? 'wir' : 'gegner') : 'keins') : null;
      return { ...g, res, points: pointsOf(res), halftime: g.goals && g.goals.every((x) => x.half !== null) ? ht : null, firstGoal, oppPlace: place.get(g.opponent) ?? null };
    });
  const n = games.length;
  const record = emptyRes();
  games.forEach((g) => record[g.res]++);
  const points = games.reduce((s, g) => s + g.points, 0);
  const goalsFor = games.reduce((s, g) => s + g.goalsFor, 0);
  const goalsAgainst = games.reduce((s, g) => s + g.goalsAgainst, 0);
  const lgGames = data.table.reduce((s, r) => s + r.games, 0);
  const leagueGoalsPerGame = lgGames ? data.table.reduce((s, r) => s + r.goalsFor, 0) / lgGames : null;

  // Torminuten
  const binsFor = [0, 0, 0, 0, 0, 0];
  const binsAgainst = [0, 0, 0, 0, 0, 0];
  const withGoalsGames = games.filter((g) => g.goals);
  for (const g of withGoalsGames) for (const x of g.goals!) (x.own ? binsFor : binsAgainst)[binOf(x.minute, x.half)]++;

  // Halbzeit → Endstand
  const lg = data.league && data.league.withGoals >= MIN_LEAGUE_GAMES ? data.league : null;
  const lgTotal = lg ? lg.bins.reduce((a, b) => a + b, 0) : 0;
  const leagueShares = lg && lgTotal ? lg.bins.map((v) => v / lgTotal) : null;
  const leagueBins = lg && lgTotal ? lg.bins.map((v) => (v / (2 * lg.withGoals)) * withGoalsGames.length) : null;

  const halfMatrix: Record<HalfState, Record<Res, number>> = { Führung: emptyRes(), Remis: emptyRes(), Rückstand: emptyRes() };
  const htGames = games.filter((g) => g.halftime);
  for (const g of htGames) halfMatrix[halfState(...g.halftime!)][g.res]++;
  const halves = htGames.length
    ? (() => {
        const f1 = htGames.reduce((s, g) => s + g.halftime![0], 0);
        const a1 = htGames.reduce((s, g) => s + g.halftime![1], 0);
        const gf = htGames.reduce((s, g) => s + g.goalsFor, 0);
        const ga = htGames.reduce((s, g) => s + g.goalsAgainst, 0);
        return { first: [f1, a1] as [number, number], second: [gf - f1, ga - a1] as [number, number] };
      })()
    : null;
  const lostLeads = htGames.filter((g) => g.halftime![0] > g.halftime![1] && g.res !== 'S');
  const firstGoal = { wir: emptyRes(), gegner: emptyRes() };
  for (const g of games) if (g.firstGoal === 'wir' || g.firstGoal === 'gegner') firstGoal[g.firstGoal][g.res]++;

  // Gegnerstärke (Tabelle heute)
  const teamsInLeague = data.table.length;
  const topCut = Math.floor(teamsInLeague / 2);
  const split = (f: (g: ReportGame) => boolean): Split => {
    const gs = games.filter(f);
    return { games: gs, points: gs.reduce((s, g) => s + g.points, 0), goalsFor: gs.reduce((s, g) => s + g.goalsFor, 0), goalsAgainst: gs.reduce((s, g) => s + g.goalsAgainst, 0) };
  };
  const vsTop = split((g) => g.oppPlace !== null && g.oppPlace <= topCut);
  const vsBottom = split((g) => g.oppPlace !== null && g.oppPlace > topCut);

  // Torschützen, Jokertore, Startelf
  const sc = new Map<string, number>();
  const jokerGoals: { name: string; game: ReportGame }[] = [];
  for (const g of games)
    for (const x of g.goals ?? [])
      if (x.own && x.scorer) {
        sc.set(x.scorer, (sc.get(x.scorer) ?? 0) + 1);
        if (g.starting && !g.starting.includes(x.scorer)) jokerGoals.push({ name: x.scorer, game: g });
      }
  const scorers = [...sc].map(([name, goals]) => ({ name, goals })).sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
  const st = new Map<string, number>();
  const lineupGames = games.filter((g) => g.starting && g.starting.length);
  for (const g of lineupGames) for (const p of g.starting!) st.set(p, (st.get(p) ?? 0) + 1);
  const starters = [...st].map(([name, starts]) => ({ name, starts })).sort((a, b) => b.starts - a.starts || a.name.localeCompare(b.name));
  const changes: number[] = [];
  for (let i = 1; i < games.length; i++) {
    const a = games[i - 1].starting, b = games[i].starting;
    if (a?.length && b?.length) changes.push(b.filter((p) => !a.includes(p)).length);
  }
  const avgChanges = changes.length ? changes.reduce((s, v) => s + v, 0) / changes.length : null;

  const ownRow = data.table.find((r) => r.team === data.ownName) ?? null;
  const report: SeasonReport = {
    ownRow, teamsInLeague, games, n, points, record, goalsFor, goalsAgainst, leagueGoalsPerGame,
    withGoals: withGoalsGames.length, binsFor, binsAgainst, leagueBins, leagueShares, leagueGamesWithGoals: lg?.withGoals ?? 0, halves, halfMatrix, lostLeads, firstGoal,
    vsTop, vsBottom, topCut, scorers, jokerGoals, starters, withLineup: lineupGames.length, avgChanges, hints: [],
  };
  report.hints = hintsFor(report);
  return report;
}

/** Hinweise nur bei ausreichender Datenlage; jede Zahl ist gezählt, jede Deutung als Frage formuliert. */
export function hintsFor(r: SeasonReport): Hint[] {
  const out: Hint[] = [];
  const sum = (x: Record<Res, number>) => x.S + x.U + x.N;
  const behind = r.halfMatrix['Rückstand'];
  const oppFirst = r.firstGoal.gegner;
  if (r.withGoals >= MIN_GAMES_PATTERN && (sum(behind) >= MIN_GAMES_GROUP || sum(oppFirst) >= MIN_GAMES_GROUP)) {
    const share = sum(oppFirst) ? oppFirst.N / sum(oppFirst) : 0;
    const noPts = sum(behind) >= MIN_GAMES_GROUP && behind.S + behind.U === 0;
    if (share >= 0.75 || noPts) {
      out.push({
        id: 'erstes-gegentor',
        title: 'Das erste Gegentor entscheidet.',
        text:
          `Trifft der Gegner zuerst, haben wir ${oppFirst.N} von ${sum(oppFirst)} Spielen verloren` +
          (sum(behind) ? `; nach Rückstand zur Pause gab es ${behind.S * 3 + behind.U} Punkte aus ${sum(behind)} Spielen.` : '.') +
          ' Frage an den Trainer: Machen wir dann zu früh auf – oder fehlt die Reaktion?',
      });
    }
  }
  if (r.withGoals >= MIN_GAMES_PATTERN && r.goalsAgainst >= 12) {
    const total = r.binsAgainst.reduce((s, v) => s + v, 0);
    const late = r.binsAgainst[5];
    const lateFor = r.binsFor[4] + r.binsFor[5];
    // Erwartung: Verteilung der Liga, ohne Ligavergleich Gleichverteilung.
    const expected = r.leagueShares ? total * r.leagueShares[5] : total / 6;
    const basis = r.leagueShares ? `im Ligaschnitt wären es etwa ${Math.round(expected)}` : `gleichmäßig wären es etwa ${Math.round(expected)}`;
    if (late >= expected * 1.4 && late - expected >= 3) {
      out.push({
        id: 'schlussphase',
        title: 'Gegentore häufen sich in der Schlussphase.',
        text: `${late} von ${total} Gegentoren fallen ab der 76. Minute, ${basis}. Frage an den Trainer: Fitness, Wechsel oder Konzentration? Ein Schwerpunkt Fitness wäre hier begründbar.`,
      });
    } else {
      out.push({
        id: 'schlussphase',
        title: 'Kein Fitness-Muster bei den Gegentoren.',
        text:
          `In der Schlussphase ${late} von ${total} Gegentoren, ${basis}` +
          (r.goalsFor ? `; unsere eigenen Tore fallen eher spät (${lateFor} von ${r.goalsFor} nach der 60.).` : '.') +
          (r.leagueGoalsPerGame && r.n ? ` Ein Schwerpunkt Fitness lässt sich daraus nicht begründen – eher die Defensive insgesamt (${fmt(r.goalsAgainst / r.n)} Gegentore pro Spiel, Ligaschnitt ${fmt(r.leagueGoalsPerGame)}).` : ''),
      });
    }
  }
  const t = r.vsTop, b = r.vsBottom;
  if (t.games.length >= MIN_GAMES_GROUP && b.games.length >= MIN_GAMES_GROUP) {
    const pt = t.points / t.games.length, pb = b.points / b.games.length;
    if (pb + 0.3 < pt) {
      out.push({ id: 'untere-haelfte', title: 'Gegen die untere Hälfte fehlen die Punkte.', text: `${b.points} Punkte aus ${b.games.length} Spielen gegen Platz ${r.topCut + 1}–${r.teamsInLeague}, aber ${t.points} aus ${t.games.length} gegen die obere Hälfte. Genau diese Spiele entscheiden über die Tabelle.` });
    } else if (pt > 0 && pt + 0.3 >= pb && pt >= 1) {
      out.push({ id: 'obere-haelfte', title: 'Mithalten gegen die Spitze.', text: `${t.points} Punkte aus ${t.games.length} Spielen gegen die obere Tabellenhälfte (Platz 1–${r.topCut}).` });
    }
  }
  if (r.avgChanges !== null && r.withLineup >= MIN_GAMES_PATTERN && r.avgChanges >= 2) {
    out.push({ id: 'rotation', title: 'Viel Rotation.', text: `${r.starters.length} Spieler in der Startelf, im Schnitt ${fmt(r.avgChanges)} Wechsel von Spiel zu Spiel. Ob das gewollt ist oder an Ausfällen liegt, weiß nur der Trainer – das fragen wir in der Nachbereitung ab.` });
  }
  const top = r.scorers[0];
  if (top && r.goalsFor >= 10 && top.goals / r.goalsFor >= 0.3) {
    out.push({ id: 'torjaeger', title: `Abhängig von ${top.name}?`, text: `${top.goals} von ${r.goalsFor} Toren (${Math.round((top.goals / r.goalsFor) * 100)} %) erzielt ein Spieler. Frage an den Trainer: Wer trifft, wenn er ausfällt?` });
  }
  return out.slice(0, 4);
}
