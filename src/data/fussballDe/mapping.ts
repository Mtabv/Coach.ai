import type {
  CompetitionType,
  DataBlocks,
  FixturePairing,
  HeadToHead,
  LocalDate,
  LocalTime,
  Match,
  OpponentPlayerCandidate,
  ResultEntry,
  SourceRef,
  SourcedFact,
  TableRow,
  TeamProfile,
} from '../../domain/types';
import type { FdGame, FdGameDetail, FdLiga, FdMatchday, FdTableRow } from './api';

/**
 * Reine Umwandlung der Antworten des lokalen fussball.de-Dienstes in Coach.AI-Datenblöcke.
 * Keine Werte werden geschätzt: Was fussball.de nicht liefert, bleibt leer bzw. fehlend.
 * Einzige Ableitung: Die Höhe eines Punktabzugs wird aus Bilanz und Punkten errechnet,
 * wenn fussball.de ausdrücklich auf Punktabzüge in der Tabelle hinweist.
 */

export const FD_SOURCE_LABEL = 'fussball.de (inoffiziell ausgelesen)';

// ---------------------------------------------------------------------------
// Namen abgleichen
// ---------------------------------------------------------------------------

/** Entfernt unsichtbare Zeichen, die fussball.de in Namen einstreut, und Tabellenkürzel (zg., oW, SW). */
export function cleanName(s: string): string {
  return s
    .replace(/[​-‍⁠﻿­]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(zg\.|oW|SW|a\.\s?K\.)$/u, '')
    .trim();
}

/** Übliche Abkürzungen in Vereinsnamen auf fussball.de. */
const ABBREVIATIONS: Record<string, string> = { ks: 'kassel', ffm: 'frankfurt', eintr: 'eintracht', vikt: 'viktoria', bor: 'borussia', germ: 'germania' };

export function foldName(s: string): string {
  return cleanName(s)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\be\.?\s?v\.?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Kennung einer zweiten/dritten Mannschaft („II“, „2“, „III“ …), sonst leer. */
export function teamSuffix(s: string): string {
  const m = /\s(i{1,3}|iv|[2-9])$/.exec(foldName(s));
  if (!m) return '';
  const roman: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4' };
  return roman[m[1]] ?? m[1];
}

/** Ähnlichkeit zweier Vereinsnamen (0–1). Erste und zweite Mannschaft gelten nie als gleich. */
export function nameSimilarity(a: string, b: string): number {
  if (teamSuffix(a) !== teamSuffix(b)) return 0;
  const x = foldName(a);
  const y = foldName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  // Wortweiser Vergleich; Abkürzungen („KS“, „Eintr.“) und Wortanfänge („Eintr“ ↔ „Eintracht“) zählen als Treffer.
  const tokens = (v: string) => [...new Set(v.split(' ').map((t) => ABBREVIATIONS[t] ?? t).filter((t) => t.length > 2))];
  const tx = tokens(x);
  const ty = tokens(y);
  if (!tx.length || !ty.length) return 0;
  const same = (p: string, q: string) => p === q || (Math.min(p.length, q.length) >= 4 && (p.startsWith(q) || q.startsWith(p)));
  const inter = tx.filter((p) => ty.some((q) => same(p, q))).length;
  const union = tx.length + ty.length - inter;
  return union ? inter / union : 0;
}

export function sameTeam(a: string, b: string): boolean {
  return nameSimilarity(a, b) >= 0.5;
}

/** Gleiche Mannschaft laut Quelle: identischer Name nach Bereinigung (für Ergebnislisten). */
export function isSourceTeam(name: string, sourceName: string | null): boolean {
  return Boolean(sourceName) && foldName(name) === foldName(sourceName!);
}

/** Erkennt eine Mannschaft in Spiellisten: über die Team-ID, wenn vorhanden, sonst über den Quellnamen. */
export type TeamMatcher = (name: string, id?: string | null) => boolean;
export function teamMatcher(teamId: string | null | undefined, sourceName: string | null): TeamMatcher {
  return (name, id) => (id && teamId ? id === teamId : isSourceTeam(name, sourceName));
}

/** Ermittelt den Mannschaftsnamen, der in fast allen Spielen einer Mannschaftsliste vorkommt. */
export function teamNameFromGames(games: FdGame[]): string | null {
  if (!games.length) return null;
  const counts = new Map<string, number>();
  for (const g of games) for (const n of [cleanName(g.home_team), cleanName(g.away_team)]) counts.set(n, (counts.get(n) ?? 0) + 1);
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return best && best[1] >= Math.ceil(games.length * 0.8) ? best[0] : null;
}

// ---------------------------------------------------------------------------
// Datum, Wettbewerb, Ergebnis
// ---------------------------------------------------------------------------

export function berlinDateTime(iso: string | null | undefined): { date: LocalDate; time: LocalTime } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

export function competitionTypeOf(label: string | null | undefined): CompetitionType {
  const l = (label ?? '').toLowerCase();
  if (/pokal/.test(l)) return 'pokal';
  if (/freundschaft|test|turnier|hallen/.test(l)) return 'test';
  return 'liga';
}

function score(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return /^\d{1,2}$/.test(s) ? Number(s) : null;
}

export function seasonOf(date: LocalDate): string {
  const [y, m] = date.split('-').map(Number);
  const start = m >= 7 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Zeitraum einer Saison (1.7.–30.6.), optional um n Saisons zurückversetzt. */
export function seasonRange(date: LocalDate, back = 0): { von: LocalDate; bis: LocalDate } {
  const [y, m] = date.split('-').map(Number);
  const start = (m >= 7 ? y : y - 1) - back;
  return { von: `${start}-07-01`, bis: `${start + 1}-06-30` };
}

/**
 * Ergebnisliste einer Mannschaft. Die eigene Seite (`sourceName`) wird auf `canonicalName` umbenannt,
 * damit die Berechnungen (letzte 5, Bilanzen) eindeutig zuordnen.
 * Vergangene Spiele ohne gültiges Ergebnis (abgesagt, verlegt, nicht gewertet) werden ausgelassen und gezählt.
 */
export function mapResults(games: FdGame[], isSelf: TeamMatcher, canonicalName: string, today: LocalDate): { results: ResultEntry[]; skipped: number } {
  const results: ResultEntry[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  for (const g of games) {
    const dt = berlinDateTime(g.datetime_utc);
    if (!dt || dt.date > today) continue;
    const gh = score(g.home_score);
    const ga = score(g.away_score);
    if (gh === null || ga === null) {
      // Verlegte Spiele stehen zusätzlich mit neuem Datum in der Liste – nur echte Ausfälle zählen.
      if (!games.some((o) => o !== g && o.id === g.id && score(o.home_score) !== null)) skipped++;
      continue;
    }
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    const rename = (n: string, id?: string | null) => (isSelf(n, id) ? canonicalName : cleanName(n));
    results.push({
      date: dt.date,
      competitionType: competitionTypeOf(g.competition),
      competitionLabel: g.competition ?? 'Spiel',
      home: rename(g.home_team, g.home_team_id),
      away: rename(g.away_team, g.away_team_id),
      goalsHome: gh,
      goalsAway: ga,
    });
  }
  return { results: results.sort((a, b) => (a.date < b.date ? 1 : -1)), skipped };
}

/** Errechneter Punktabzug, nur wenn fussball.de auf Punktabzüge hinweist und die Bilanz mehr Punkte ergäbe. */
export function deductionFor(row: FdTableRow, note: string | null): number | null {
  if (!note || !/abz(u|ü)g/i.test(note)) return null;
  if (row.won === null || row.draw === null || row.points === null) return null;
  const diff = row.won * 3 + row.draw - row.points;
  return diff > 0 ? diff : null;
}

export function mapTable(liga: FdLiga, renames: Map<string, string>): TableRow[] {
  return liga.table.map((e, i) => ({
    rank: e.place ?? i + 1,
    team: (e.team_id && renames.get(e.team_id)) || cleanName(e.team),
    played: e.games ?? 0,
    won: e.won ?? 0,
    drawn: e.draw ?? 0,
    lost: e.lost ?? 0,
    goalsFor: e.goals_for ?? 0,
    goalsAgainst: e.goals_against ?? 0,
    points: e.points ?? 0,
    pointDeduction: deductionFor(e, liga.deduction_note),
  }));
}

// ---------------------------------------------------------------------------
// Gegner finden
// ---------------------------------------------------------------------------

/** Sucht den Gegner in der Tabelle der eigenen Liga (eindeutig ähnlichster Name). */
export function findOpponentInTable(liga: FdLiga | null, opponent: string, ownId: string): { id: string; name: string } | null {
  if (!liga) return null;
  const scored = liga.table
    .filter((r) => r.team_id && r.team_id !== ownId)
    .map((r) => ({ id: r.team_id!, name: cleanName(r.team), sim: nameSimilarity(r.team, opponent) }))
    .filter((r) => r.sim >= 0.5)
    .sort((a, b) => b.sim - a.sim);
  if (!scored.length) return null;
  if (scored.length > 1 && scored[1].sim === scored[0].sim) return null; // nicht eindeutig
  return { id: scored[0].id, name: scored[0].name };
}

/** Mannschaftsart aus dem Staffelnamen (z. B. „… – Herren - 2026/2027“). */
export function categoryOf(staffelName: string | null): string | null {
  if (!staffelName) return null;
  const m = /(Alte Herren|Herren|Frauen|[A-G]-Junior(?:en|innen)|Ü\s?\d{2})/i.exec(staffelName);
  return m ? m[1] : null;
}

/** Wählt aus den Mannschaften eines Vereins die passende („Herren - TSG X“ zu Gegner „TSG X“). */
export function pickClubTeam(teams: { id: string; name: string }[], opponent: string, category: string): { id: string; name: string } | null {
  const fits = teams
    .map((t) => {
      const [cat, ...rest] = t.name.split(' - ');
      return { id: t.id, cat: cat.trim(), name: cleanName(rest.join(' - ') || t.name) };
    })
    .filter((t) => t.cat.toLowerCase() === category.toLowerCase())
    .map((t) => ({ ...t, sim: nameSimilarity(t.name, opponent) }))
    .filter((t) => t.sim >= 0.5)
    .sort((a, b) => b.sim - a.sim);
  return fits.length && (fits.length === 1 || fits[0].sim > fits[1].sim) ? { id: fits[0].id, name: fits[0].name } : null;
}

// ---------------------------------------------------------------------------
// Gesamtumwandlung
// ---------------------------------------------------------------------------

export interface FdBundle {
  liga: FdLiga | null;
  ownId: string;
  opp: { id: string; name: string; via: string } | null;
  ownSeason: FdGame[];
  oppSeason: FdGame[] | null;
  history: FdGame[];
  historySeasons: string[];
  matchday: FdMatchday | null;
  lineups: FdGameDetail[];
  retrievedAt: string;
}

const fmtDate = (d: string) => d.split('-').reverse().join('.');

export function headToHead(games: FdGame[], isOwn: TeamMatcher, isOpp: TeamMatcher, ownName: string, oppName: string, today: LocalDate): HeadToHead[] {
  const between = games.filter(
    (g) => (isOwn(g.home_team, g.home_team_id) && isOpp(g.away_team, g.away_team_id)) || (isOpp(g.home_team, g.home_team_id) && isOwn(g.away_team, g.away_team_id)),
  );
  const { results } = mapResults(
    between.map((g) => ({ ...g, home_team: isOwn(g.home_team, g.home_team_id) ? ownName : oppName, away_team: isOwn(g.away_team, g.away_team_id) ? ownName : oppName, home_team_id: null, away_team_id: null })),
    () => false,
    '',
    today,
  );
  return results.map((r) => ({ season: seasonOf(r.date), date: r.date, competitionLabel: r.competitionLabel, competitionType: r.competitionType, home: r.home, away: r.away, goalsHome: r.goalsHome, goalsAway: r.goalsAway }));
}

export function playerCandidates(bundle: FdBundle, oppSource: string | null, sourceId: string): { candidates: OpponentPlayerCandidate[]; games: number } {
  const opp = bundle.opp;
  if (!opp) return { candidates: [], games: 0 };
  type Acc = { name: string; number?: string; gk: boolean; starts: number; captain: number; recentGoals: number; seasonGoals: number | null; rank: number | null };
  const acc = new Map<string, Acc>();
  const get = (name: string) => {
    const key = foldName(name);
    let a = acc.get(key);
    if (!a) {
      a = { name: cleanName(name), gk: false, starts: 0, captain: 0, recentGoals: 0, seasonGoals: null, rank: null };
      acc.set(key, a);
    }
    return a;
  };
  for (const s of bundle.liga?.scorers ?? []) {
    if (s.team_id !== opp.id || s.goals === null) continue;
    const a = get(s.name);
    a.seasonGoals = s.goals;
    a.rank = s.rank;
  }
  let games = 0;
  for (const d of bundle.lineups) {
    if (!d.lineup) continue;
    const side = isSourceTeam(d.lineup.home.team, oppSource) ? 'home' : isSourceTeam(d.lineup.away.team, oppSource) ? 'away' : null;
    if (!side) continue;
    games++;
    for (const p of d.lineup[side].starting) {
      const a = get(p.name);
      a.starts++;
      if (p.is_captain) a.captain++;
      if (p.is_goalkeeper) a.gk = true;
      if (p.number !== null && p.number !== undefined && a.number === undefined) a.number = String(p.number);
    }
    for (const e of d.events) {
      if (e.type === 'goal' && e.team === side && e.description && !/eigentor/i.test(e.description)) get(e.description).recentGoals++;
    }
  }
  const candidates: OpponentPlayerCandidate[] = [];
  for (const a of acc.values()) {
    const evidence: { text: string; sourceId: string }[] = [];
    if (a.seasonGoals !== null) evidence.push({ text: `${a.seasonGoals} Saisontore in der Liga${a.rank ? ` (Platz ${a.rank} der Torjägerliste)` : ''}`, sourceId });
    if (a.recentGoals) evidence.push({ text: `${a.recentGoals} ${a.recentGoals === 1 ? 'Tor' : 'Tore'} in den letzten ${games} Ligaspielen`, sourceId });
    if (a.starts) evidence.push({ text: `In der Startelf in ${a.starts} der letzten ${games} Ligaspiele${a.captain ? `, davon ${a.captain}× Kapitän` : ''}`, sourceId });
    const relevant = a.seasonGoals !== null || a.recentGoals > 0 || (games > 0 && a.starts >= Math.ceil(games / 2));
    if (!relevant || !evidence.length) continue;
    candidates.push({
      id: `fd:${foldName(a.name).replace(/ /g, '-')}`,
      name: a.name,
      number: a.number,
      position: a.gk ? 'Torwart' : undefined,
      evidence,
      goals: a.seasonGoals ?? a.recentGoals,
    });
  }
  candidates.sort((x, y) => (y.goals ?? 0) - (x.goals ?? 0) || x.name.localeCompare(y.name));
  return { candidates, games };
}

export function mapToBlocks(team: TeamProfile, match: Match, raw: FdBundle): { blocks: Partial<DataBlocks>; messages: string[] } {
  const messages: string[] = [];
  const blocks: Partial<DataBlocks> = {};
  const today = raw.retrievedAt.slice(0, 10);
  const src = (id: string, asOf?: string, asOfRank?: number): SourceRef => ({ id, label: FD_SOURCE_LABEL, kind: 'extern', asOf, asOfRank, retrievedAt: raw.retrievedAt });
  const opp = raw.opp;
  const tableName = (id: string | undefined) => {
    const r = id ? raw.liga?.table.find((x) => x.team_id === id) : undefined;
    return r ? cleanName(r.team) : null;
  };
  const ownSource = tableName(raw.ownId) ?? teamNameFromGames(raw.ownSeason);
  const oppSource = tableName(opp?.id) ?? (raw.oppSeason ? teamNameFromGames(raw.oppSeason) : null) ?? opp?.name ?? null;
  const isOwn = teamMatcher(raw.ownId, ownSource);
  const isOpp = teamMatcher(opp?.id, oppSource);

  // Ergebnisse (ganze Saison, alle Wettbewerbe)
  const own = mapResults(raw.ownSeason, isOwn, team.name, today);
  if (own.results.length) {
    blocks.ergebnisseEigene = {
      key: 'ergebnisseEigene',
      label: 'Ergebnisse eigene Mannschaft (Liga, Pokal, Test)',
      value: { team: team.name, results: own.results },
      provenance: {
        sources: [src('fd-ergebnisse-eigene', `Spiele bis ${fmtDate(own.results[0].date)}`)],
        status: 'vorhanden',
        note: `Spielplan der Saison laut fussball.de („${ownSource ?? 'Name nicht eindeutig'}“). Spieltagnummern liefert diese Liste nicht.${own.skipped ? ` ${own.skipped} Spiel(e) ohne gültiges Ergebnis (abgesagt/verlegt) ausgelassen.` : ''}`,
      },
    };
  } else messages.push('Keine Ergebnisse der eigenen Mannschaft in dieser Saison gefunden.');

  if (raw.oppSeason) {
    const r = mapResults(raw.oppSeason, isOpp, match.opponent, today);
    if (r.results.length) {
      blocks.ergebnisseGegner = {
        key: 'ergebnisseGegner',
        label: 'Ergebnisse Gegner (Liga, Pokal, Test)',
        value: { team: match.opponent, results: r.results },
        provenance: {
          sources: [src('fd-ergebnisse-gegner', `Spiele bis ${fmtDate(r.results[0].date)}`)],
          status: 'vorhanden',
          note: `Spielplan der Saison laut fussball.de („${oppSource ?? 'Name nicht eindeutig'}“).${r.skipped ? ` ${r.skipped} Spiel(e) ohne gültiges Ergebnis (abgesagt/verlegt) ausgelassen.` : ''}`,
        },
      };
    } else messages.push('Keine Ergebnisse des Gegners in dieser Saison gefunden.');
  }

  // Tabelle
  if (raw.liga && raw.liga.table.length) {
    const renames = new Map<string, string>([[raw.ownId, team.name]]);
    if (opp) renames.set(opp.id, match.opponent);
    const rows = mapTable(raw.liga, renames);
    const maxGames = Math.max(...rows.map((r) => r.played));
    const s = src('fd-tabelle', `nach ${maxGames} Spielen (laut Tabelle)`, maxGames);
    const deducted = rows.filter((r) => r.pointDeduction);
    const note = [
      raw.liga.staffel_name ? `Staffel: ${raw.liga.staffel_name}.` : '',
      raw.liga.deduction_note ? `Hinweis von fussball.de: „${raw.liga.deduction_note}“.` : '',
      deducted.length ? `Höhe des Abzugs aus Bilanz und Punkten errechnet: ${deducted.map((r) => `${r.team} −${r.pointDeduction}`).join(', ')}.` : '',
    ]
      .filter(Boolean)
      .join(' ');
    blocks.tabelle = {
      key: 'tabelle',
      label: 'Aktuelle Tabelle',
      value: { snapshots: [{ source: s, rows }], primarySourceId: s.id },
      provenance: { sources: [s], status: 'vorhanden', note: note || undefined },
    };
    if (!rows.some((r) => r.team === team.name)) messages.push('Eigene Mannschaft in der Tabelle nicht gefunden – bitte fussball.de-Link im Mannschaftsprofil prüfen.');
    if (match.competitionType === 'liga' && !rows.some((r) => r.team === match.opponent)) messages.push('Gegner nicht in der Tabelle der eigenen Liga gefunden.');
  } else messages.push('Keine Tabelle gefunden.');

  // Spieltag
  if (raw.matchday && raw.matchday.games.length) {
    const nameFor = (n: string, id: string | null) => (id === raw.ownId ? team.name : opp && id === opp.id ? match.opponent : cleanName(n));
    const pairings: FixturePairing[] = raw.matchday.games.map((g) => {
      const dt = berlinDateTime(g.datetime_utc);
      return { home: nameFor(g.home_team, g.home_team_id), away: nameFor(g.away_team, g.away_team_id), ...(dt ? { date: dt.date, kickoff: dt.time } : {}) };
    });
    blocks.spieltag = {
      key: 'spieltag',
      label: 'Spieltagspaarungen',
      value: { matchday: raw.matchday.matchday, pairings },
      provenance: { sources: [src('fd-spieltag', `${raw.matchday.matchday}. Spieltag`)], status: 'vorhanden' },
    };
  } else if (match.competitionType === 'liga') messages.push('Spieltag mit dieser Begegnung auf fussball.de nicht gefunden – Paarungen bleiben offen.');

  // Ansetzung abgleichen
  const mdGame = opp ? raw.matchday?.games.find((g) => [g.home_team_id, g.away_team_id].includes(raw.ownId) && [g.home_team_id, g.away_team_id].includes(opp.id)) : undefined;
  const seasonCandidates = raw.ownSeason.filter((g) => isOpp(g.home_team, g.home_team_id) || isOpp(g.away_team, g.away_team_id));
  const seasonFixture =
    (mdGame ? seasonCandidates.find((g) => g.id === mdGame.game_id) : undefined) ??
    seasonCandidates.find((g) => berlinDateTime(g.datetime_utc)?.date === match.date) ??
    seasonCandidates.filter((g) => (berlinDateTime(g.datetime_utc)?.date ?? '') >= today).sort((a, b) => (a.datetime_utc < b.datetime_utc ? -1 : 1))[0];
  const fixtureDt = berlinDateTime(mdGame?.datetime_utc ?? seasonFixture?.datetime_utc);
  if (fixtureDt) {
    blocks.begegnung = {
      key: 'begegnung',
      label: 'Begegnung, Termin, Wettbewerb, Spielort',
      value: {
        confirmedFromSource: fixtureDt.date === match.date && fixtureDt.time === match.kickoff,
        sourceFixture: {
          date: fixtureDt.date,
          kickoff: fixtureDt.time,
          venue: seasonFixture?.location ?? null,
          sourceLabel: FD_SOURCE_LABEL,
          matchday: mdGame ? raw.matchday!.matchday : null,
          competition: raw.liga?.staffel_name && mdGame ? raw.liga.staffel_name : seasonFixture?.competition ?? null,
        },
      },
      provenance: { sources: [{ id: 'trainer', label: 'Trainereingabe', kind: 'trainer' }, src('fd-ansetzung')], status: 'vorhanden' },
    };
  } else messages.push('Begegnung im Spielplan auf fussball.de nicht gefunden – Termin bitte selbst prüfen.');

  // Direkte Duelle (laufende und frühere Saisons)
  const h2h = headToHead([...raw.ownSeason, ...raw.history], isOwn, isOpp, team.name, match.opponent, today);
  if (h2h.length) {
    blocks.direkteDuelle = {
      key: 'direkteDuelle',
      label: 'Direkte Duelle',
      value: { games: h2h },
      provenance: {
        sources: [src('fd-duelle', raw.historySeasons.length ? `Saisons ${raw.historySeasons.at(-1)} bis ${seasonOf(today)}` : undefined)],
        status: 'vorhanden',
        note: 'Aus den Spielplänen der eigenen Mannschaft auf fussball.de; Spiele gegen zweite Mannschaften zählen nicht.',
      },
    };
  }

  // Gegenspieler
  const pc = playerCandidates(raw, oppSource, 'fd-gegenspieler');
  if (pc.candidates.length) {
    blocks.gegenspieler = {
      key: 'gegenspieler',
      label: 'Gegenspieler (Kandidaten)',
      value: { candidates: pc.candidates },
      provenance: {
        sources: [src('fd-gegenspieler', pc.games ? `Torjägerliste und Spielberichte der letzten ${pc.games} Ligaspiele` : 'Torjägerliste')],
        status: 'vorhanden',
        note: 'Belegt durch Torjägerliste und Aufstellungen auf fussball.de. Positionen außer Torwart liefert die Quelle nicht.',
      },
    };
  } else if (opp) messages.push('Keine Spielerdaten des Gegners gefunden (Torjägerliste/Spielberichte).');

  // Gegner-Fakten
  if (opp && raw.liga) {
    const facts: SourcedFact[] = [];
    const sid = 'fd-gegner-fakten';
    const oppAway = match.isHome;
    const row = (oppAway ? raw.liga.away_table : raw.liga.home_table).find((r) => r.team_id === opp.id);
    if (row && row.place !== null) {
      facts.push({ id: 'fd-ha', sourceId: sid, text: `${oppAway ? 'Auswärtstabelle' : 'Heimtabelle'}: Platz ${row.place} (${row.won}S ${row.draw}U ${row.lost}N, ${row.goals_for}:${row.goals_against} Tore, ${row.points} Punkte).` });
    }
    const top = raw.liga.scorers.filter((s) => s.team_id === opp.id && s.goals !== null).sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0))[0];
    if (top) facts.push({ id: 'fd-top', sourceId: sid, text: `Bester Torschütze: ${top.name} mit ${top.goals} Toren${top.rank ? ` (Platz ${top.rank} der Liga)` : ''}.` });
    const latest = raw.lineups.find((d) => d.lineup);
    const side = latest?.lineup ? (isSourceTeam(latest.lineup.home.team, oppSource) ? 'home' : isSourceTeam(latest.lineup.away.team, oppSource) ? 'away' : null) : null;
    const coach = side ? latest!.lineup![side].coaches[0] : undefined;
    if (coach) facts.push({ id: 'fd-coach', sourceId: sid, text: `Trainer laut letztem Spielbericht: ${coach}.` });
    if (facts.length) {
      blocks.gegnerFakten = {
        key: 'gegnerFakten',
        label: 'Gegnerbezogene Fakten',
        value: { facts },
        provenance: { sources: [src(sid, fmtDate(today))], status: 'vorhanden' },
      };
    }
  }

  messages.push(opp ? `Gegner zugeordnet: „${oppSource ?? opp.name}“ (${opp.via}).` : 'Gegner auf fussball.de nicht gefunden – Gegnerdaten bleiben offen. Bitte fussball.de-Link des Gegners in der Begegnung eintragen.');
  messages.push('Fahrzeit liefert fussball.de nicht – bitte im Datenbereich eintragen.');
  return { blocks, messages };
}
