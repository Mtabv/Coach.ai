import type { CompetitionType, LocalDate, ResultEntry, TableRow } from './types';

/** Deterministische fachliche Berechnungen aus Ergebnislisten. Keine Schätzungen. */

export type Outcome = 'S' | 'U' | 'N';

export interface TeamResult extends ResultEntry {
  isHome: boolean;
  opponent: string;
  goalsFor: number;
  goalsAgainst: number;
  outcome: Outcome;
}

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function toTeamResult(team: string, r: ResultEntry): TeamResult | null {
  const t = normalizeName(team);
  const isHome = normalizeName(r.home) === t;
  const isAway = normalizeName(r.away) === t;
  if (!isHome && !isAway) return null;
  const goalsFor = isHome ? r.goalsHome : r.goalsAway;
  const goalsAgainst = isHome ? r.goalsAway : r.goalsHome;
  const outcome: Outcome = goalsFor > goalsAgainst ? 'S' : goalsFor < goalsAgainst ? 'N' : 'U';
  return { ...r, isHome, opponent: isHome ? r.away : r.home, goalsFor, goalsAgainst, outcome };
}

export function teamResults(
  team: string,
  results: ResultEntry[],
  opts: { type?: CompetitionType; before?: LocalDate | null } = {},
): TeamResult[] {
  return results
    .filter((r) => (opts.type ? r.competitionType === opts.type : true))
    .filter((r) => (opts.before ? r.date < opts.before : true))
    .map((r) => toTeamResult(team, r))
    .filter((r): r is TeamResult => r !== null)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Letzte n Ligaspiele vor dem Stichtag – Pokal- und Testspiele sind ausgeschlossen. */
export function lastLeagueGames(team: string, results: ResultEntry[], before: LocalDate | null, n = 5): TeamResult[] {
  return teamResults(team, results, { type: 'liga', before }).slice(0, n);
}

export interface Record_ {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  /** Punkte aus Ergebnissen – NICHT Tabellenpunkte (Punktabzüge möglich). */
  pointsFromResults: number;
}

export function record(rs: TeamResult[]): Record_ {
  const r: Record_ = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, pointsFromResults: 0 };
  for (const x of rs) {
    r.played++;
    r.goalsFor += x.goalsFor;
    r.goalsAgainst += x.goalsAgainst;
    if (x.outcome === 'S') r.won++;
    else if (x.outcome === 'U') r.drawn++;
    else r.lost++;
  }
  r.pointsFromResults = r.won * 3 + r.drawn;
  return r;
}

export interface SeasonSummary {
  all: Record_;
  home: Record_;
  away: Record_;
  last5: TeamResult[];
  otherCompetitions: TeamResult[];
}

export function seasonSummary(team: string, results: ResultEntry[], before: LocalDate | null): SeasonSummary {
  const league = teamResults(team, results, { type: 'liga', before });
  return {
    all: record(league),
    home: record(league.filter((r) => r.isHome)),
    away: record(league.filter((r) => !r.isHome)),
    last5: league.slice(0, 5),
    otherCompetitions: teamResults(team, results, { before }).filter((r) => r.competitionType !== 'liga'),
  };
}

export function formatRecord(r: Record_): string {
  return `${r.won}S ${r.drawn}U ${r.lost}N · ${r.goalsFor}:${r.goalsAgainst} Tore`;
}

export function ratio(a: number, b: number, digits = 1): string {
  if (b === 0) return '–';
  return (a / b).toFixed(digits).replace('.', ',');
}

export interface Kpi {
  id: string;
  label: string;
  value: string;
  basis: string;
}

/** Kennzahlen ausschließlich aus Ergebnissen und Tabelle. */
export function opponentKpis(team: string, results: ResultEntry[], before: LocalDate | null, table: TableRow[] | null): Kpi[] {
  const league = teamResults(team, results, { type: 'liga', before });
  const rec = record(league);
  if (rec.played === 0) return [];
  const cleanSheets = league.filter((r) => r.goalsAgainst === 0).length;
  const noGoal = league.filter((r) => r.goalsFor === 0).length;
  const basis = `${rec.played} Ligaspiele`;
  const kpis: Kpi[] = [
    { id: 'tore', label: 'Tore pro Spiel', value: ratio(rec.goalsFor, rec.played), basis },
    { id: 'gegentore', label: 'Gegentore pro Spiel', value: ratio(rec.goalsAgainst, rec.played), basis },
    { id: 'punkteschnitt', label: 'Punkte pro Spiel', value: ratio(rec.pointsFromResults, rec.played, 2), basis },
    { id: 'zunull', label: 'Spiele zu null', value: String(cleanSheets), basis },
    { id: 'ohnetor', label: 'Spiele ohne eigenes Tor', value: String(noGoal), basis },
  ];
  if (table && table.length) {
    const byFor = [...table].sort((a, b) => b.goalsFor - a.goalsFor);
    const byAgainst = [...table].sort((a, b) => a.goalsAgainst - b.goalsAgainst);
    const t = normalizeName(team);
    const offRank = byFor.findIndex((r) => normalizeName(r.team) === t) + 1;
    const defRank = byAgainst.findIndex((r) => normalizeName(r.team) === t) + 1;
    if (offRank > 0) kpis.push({ id: 'offrang', label: 'Rang Offensive (Liga)', value: `${offRank}.`, basis: 'Tabelle' });
    if (defRank > 0) kpis.push({ id: 'defrang', label: 'Rang Defensive (Liga)', value: `${defRank}.`, basis: 'Tabelle' });
  }
  return kpis;
}
