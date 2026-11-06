import { formatDate } from './time';
import { normalizeName, record, teamResults, type TeamResult } from './stats';
import type { GoalLog, LeagueZones, LocalDate, ResultEntry, Roster, TableRow } from './types';

/**
 * Deterministische Auswertungen für die Form- und Auffälligkeiten-Folien. Jede Aussage ist eine Zählung aus
 * Ergebnissen, Tabelle oder Spielberichten – keine Schätzung, keine taktische Deutung.
 */

export const PHASES: { label: string; from: number; to: number }[] = [
  { label: '1–15', from: 0, to: 15 },
  { label: '16–30', from: 16, to: 30 },
  { label: '31–45', from: 31, to: 45 },
  { label: '46–60', from: 46, to: 60 },
  { label: '61–75', from: 61, to: 75 },
  { label: '76–90', from: 76, to: 200 },
];

export interface PhaseCount {
  label: string;
  goalsFor: number;
  goalsAgainst: number;
}

function phaseOf(minute: number): number {
  const i = PHASES.findIndex((p) => minute >= p.from && minute <= p.to);
  return i < 0 ? PHASES.length - 1 : i;
}

export function goalPhases(log: GoalLog): PhaseCount[] {
  const out = PHASES.map((p) => ({ label: p.label, goalsFor: 0, goalsAgainst: 0 }));
  for (const g of log.games) for (const x of g.goals) out[phaseOf(x.minute)][x.own ? 'goalsFor' : 'goalsAgainst']++;
  return out;
}

const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
const pct = (a: number, b: number) => Math.round((a / b) * 100);

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Muster in den Torminuten (aus Sicht der Mannschaft des Protokolls). */
export function goalPatterns(log: GoalLog, team: string): string[] {
  const games = log.games;
  const N = games.length;
  if (N < 3) return [];
  const out: string[] = [];
  const phases = goalPhases(log);
  const totalFor = phases.reduce((a, p) => a + p.goalsFor, 0);
  const totalAgainst = phases.reduce((a, p) => a + p.goalsAgainst, 0);

  if (totalFor >= 6) {
    const best = [...phases].sort((a, b) => b.goalsFor - a.goalsFor)[0];
    if (pct(best.goalsFor, totalFor) >= 22) out.push(`Stärkste Phase: Minute ${best.label} mit ${best.goalsFor} von ${totalFor} Toren (${pct(best.goalsFor, totalFor)} %).`);
    const firstHalf = phases.slice(0, 3).reduce((a, p) => a + p.goalsFor, 0);
    out.push(`${firstHalf} Tore vor der Pause, ${totalFor - firstHalf} danach.`);
  }

  const firstGoals = games.map((g) => [...g.goals].sort((a, b) => a.minute - b.minute)[0]).filter(Boolean);
  const scoredFirst = firstGoals.filter((g) => g.own);
  if (scoredFirst.length) out.push(`In ${scoredFirst.length} von ${N} Spielen das erste Tor erzielt – im Mittel in Minute ${median(scoredFirst.map((g) => g.minute))}.`);

  const early = games.filter((g) => g.goals.some((x) => x.own && x.minute <= 15)).length;
  if (early >= 2) out.push(`In ${early} von ${N} Spielen schon in den ersten 15 Minuten getroffen.`);

  const bursts = games.filter((g) => {
    const own = g.goals.filter((x) => x.own).map((x) => x.minute).sort((a, b) => a - b);
    return own.some((m, i) => i > 0 && m - own[i - 1] <= 10);
  }).length;
  if (bursts >= 2) out.push(`In ${bursts} von ${N} Spielen zwei oder mehr Tore innerhalb von 10 Minuten.`);

  let conceded = 0;
  let answered = 0;
  for (const g of games) {
    const seq = [...g.goals].sort((a, b) => a.minute - b.minute);
    seq.forEach((x, i) => {
      if (x.own || i === seq.length - 1) return;
      conceded++;
      if (seq[i + 1].own) answered++;
    });
  }
  if (conceded >= 3) out.push(`Nach einem Gegentor fiel das nächste Tor in ${answered} von ${conceded} Fällen für ${team}.`);

  let leadHt = 0;
  let behindHt = 0;
  for (const g of games) {
    const f = g.goals.filter((x) => x.own && x.minute <= 45).length;
    const a = g.goals.filter((x) => !x.own && x.minute <= 45).length;
    if (f > a) leadHt++;
    else if (f < a) behindHt++;
  }
  out.push(`Zur Pause geführt in ${leadHt} von ${N} Spielen, ${behindHt ? `zurückgelegen in ${behindHt}` : 'nie zurückgelegen'}.`);

  if (totalAgainst >= 4) {
    const worst = [...phases].sort((a, b) => b.goalsAgainst - a.goalsAgainst)[0];
    out.push(`Gegentore: ${worst.goalsAgainst} von ${totalAgainst} in Minute ${worst.label}.`);
  } else if (totalAgainst > 0) out.push(`Nur ${n(totalAgainst, 'Gegentor', 'Gegentore')} in diesen ${N} Spielen.`);
  return out;
}

/** Wo steht die Mannschaft relativ zu den Zonen? Liefert eine nüchterne Abstandsangabe. */
export function tableGapFact(team: string, rows: TableRow[], zones: LeagueZones | undefined): string | null {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const i = sorted.findIndex((r) => normalizeName(r.team) === normalizeName(team));
  if (i < 0) return null;
  const me = sorted[i];
  const total = sorted.length;
  const pts = (k: number) => n(Math.abs(k), 'Punkt', 'Punkte');
  if (zones && zones.relegation > 0 && me.rank > total - zones.relegation) {
    const safe = sorted[total - zones.relegation - 1];
    return `Platz ${me.rank} (Abstiegsplatz) – ${pts(safe.points - me.points)} Rückstand auf Platz ${safe.rank}, den ersten Nichtabstiegsplatz.`;
  }
  if (me.rank === 1 && sorted[1]) return `Tabellenführer mit ${n(me.points - sorted[1].points, 'Punkt', 'Punkten')} Vorsprung auf Platz 2.`;
  const above = sorted[i - 1];
  return above ? `Platz ${me.rank} – ${pts(above.points - me.points)} hinter Platz ${above.rank}.` : `Platz ${me.rank}.`;
}

function shortDate(d: LocalDate): string {
  const [, m, day] = d.split('-');
  return `${day}.${m}.`;
}

function vs(r: TeamResult): string {
  return `${r.isHome ? 'gegen' : 'bei'} ${r.opponent}`;
}

/**
 * Zusätzliche Fakten für die Formfolien. Für die eigene Mannschaft werden – nüchtern – auch Ermutigendes
 * genannt, sofern die Daten es hergeben (letzter Sieg, Pokal, Torgefahr, beste Scorer).
 */
export function formFacts(opts: {
  team: string;
  results: ResultEntry[];
  before: LocalDate | null;
  table: TableRow[];
  zones?: LeagueZones;
  own: boolean;
  roster?: Roster;
}): string[] {
  const { team, results, before, table, zones, own, roster } = opts;
  const league = teamResults(team, results, { type: 'liga', before });
  const out: string[] = [];
  const gap = table.length ? tableGapFact(team, table, zones) : null;
  if (gap) out.push(gap);
  if (!league.length) return out;
  const rec = record(league);
  const scored = league.filter((r) => r.goalsFor > 0).length;
  const best = [...league].filter((r) => r.outcome === 'S').sort((a, b) => b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) || (a.date < b.date ? 1 : -1))[0];

  if (own) {
    const lastWin = league.find((r) => r.outcome === 'S');
    if (lastWin && lastWin !== league[0]) out.push(`Letzter Ligasieg: ${lastWin.goalsFor}:${lastWin.goalsAgainst} ${vs(lastWin)} (${shortDate(lastWin.date)}).`);
    if (scored >= Math.ceil(rec.played / 2)) out.push(`In ${scored} von ${rec.played} Ligaspielen getroffen – ${rec.goalsFor} Tore insgesamt.`);
    const cup = teamResults(team, results, { type: 'pokal', before });
    const cupWins = cup.filter((r) => r.outcome === 'S').length;
    if (cupWins >= 2) out.push(`Im Pokal ${cupWins} von ${cup.length} Spielen gewonnen.`);
    const top = roster?.players.filter((p) => (p.goals ?? 0) > 0).sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0))[0];
    if (top) out.push(`Bester Torschütze: ${top.name} mit ${top.goals} Toren (laut FuPa).`);
    const ast = roster?.players.filter((p) => (p.assists ?? 0) > 0).sort((a, b) => (b.assists ?? 0) - (a.assists ?? 0))[0];
    if (ast && ast.name !== top?.name) out.push(`Meiste Vorlagen: ${ast.name} mit ${ast.assists} (laut FuPa).`);
  } else {
    if (best && best.goalsFor - best.goalsAgainst >= 3) out.push(`Höchster Ligasieg: ${best.goalsFor}:${best.goalsAgainst} ${vs(best)} (${formatDate(best.date).slice(0, 6)}).`);
    const noScore = rec.played - scored;
    out.push(noScore ? `Ohne eigenes Tor in ${n(noScore, 'Ligaspiel', 'Ligaspielen')}.` : `In allen ${rec.played} Ligaspielen getroffen.`);
  }
  return out;
}
