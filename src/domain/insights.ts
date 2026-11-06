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

/**
 * Wichtige Statistiken für die Folie „Auffälligkeiten“ – aus Trainersicht: Was sollte die Mannschaft über den
 * Gegner wissen? Spielphasen nur knapp (stärkste und anfälligste Phase, Pausenstand), dazu Gegnerstärke,
 * Torgefahr in der Breite, Joker-Tore und Karten. Alles gezählt, nichts geschätzt.
 */
export function keyStats(log: GoalLog | undefined): string[] {
  const out: string[] = [];
  const games = log?.games ?? [];
  const N = games.length;
  if (log && N >= 3) {
    const phases = goalPhases(log);
    const totalFor = phases.reduce((a, p) => a + p.goalsFor, 0);
    const totalAgainst = phases.reduce((a, p) => a + p.goalsAgainst, 0);
    if (totalFor) {
      const best = [...phases].sort((a, b) => b.goalsFor - a.goalsFor)[0];
      out.push(`Stärkste Offensivphase: Minute ${best.label} – ${best.goalsFor} von ${totalFor} Toren.`);
    }
    if (totalAgainst) {
      const worst = [...phases].sort((a, b) => b.goalsAgainst - a.goalsAgainst)[0];
      out.push(`Anfälligste Phase: Minute ${worst.label} – ${worst.goalsAgainst} von ${n(totalAgainst, 'Gegentor', 'Gegentoren')}.`);
    }
    let leadHt = 0;
    let behindHt = 0;
    for (const g of games) {
      const f = g.goals.filter((x) => x.own && x.minute <= 45).length;
      const a = g.goals.filter((x) => !x.own && x.minute <= 45).length;
      if (f > a) leadHt++;
      else if (f < a) behindHt++;
    }
    out.push(`Zur Pause geführt in ${leadHt} von ${N} Spielen${behindHt ? `, zurückgelegen in ${behindHt}` : ', nie zurückgelegen'}.`);
  }

  if (log && N >= 3) {
    const byScorer = new Map<string, number>();
    let named = 0;
    for (const g of games) for (const x of g.goals) if (x.own && x.scorer) {
      named++;
      byScorer.set(x.scorer, (byScorer.get(x.scorer) ?? 0) + 1);
    }
    if (byScorer.size >= 3) {
      const [topName, topGoals] = [...byScorer.entries()].sort((a, b) => b[1] - a[1])[0];
      out.push(`${named} Tore von ${byScorer.size} verschiedenen Torschützen – ${topName} trifft am häufigsten (${topGoals}).`);
    }
    const jokers = games.reduce((a, g) => a + g.goals.filter((x) => x.joker).length, 0);
    if (jokers >= 3) out.push(`${jokers} Tore durch eingewechselte Spieler – auch die Bank sticht.`);
    const withCards = games.filter((g) => g.cards);
    if (withCards.length >= 3) {
      const y = withCards.reduce((a, g) => a + g.cards!.yellow, 0);
      const r = withCards.reduce((a, g) => a + g.cards!.red, 0);
      out.push(`${n(y, 'Gelbe Karte', 'Gelbe Karten')}${r ? ` und ${n(r, 'Platzverweis', 'Platzverweise')}` : ', kein Platzverweis'} in ${withCards.length} Ligaspielen.`);
    }
  }
  return out.slice(0, 7);
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
    if (top) out.push(`Bester Torschütze: ${top.name} mit ${top.goals} Toren.`);
    const ast = roster?.players.filter((p) => (p.assists ?? 0) > 0).sort((a, b) => (b.assists ?? 0) - (a.assists ?? 0))[0];
    if (ast && ast.name !== top?.name) out.push(`Meiste Vorlagen: ${ast.name} mit ${ast.assists}.`);
  } else {
    if (best && best.goalsFor - best.goalsAgainst >= 3) out.push(`Höchster Ligasieg: ${best.goalsFor}:${best.goalsAgainst} ${vs(best)} (${formatDate(best.date).slice(0, 6)}).`);
    const noScore = rec.played - scored;
    out.push(noScore ? `Ohne eigenes Tor in ${n(noScore, 'Ligaspiel', 'Ligaspielen')}.` : `In allen ${rec.played} Ligaspielen getroffen.`);
  }
  return out;
}
