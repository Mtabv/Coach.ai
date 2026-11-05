import type { CompetitionType, DataBlocks, HeadToHead, LocalDate, LocalTime, Match, ResultEntry, SourceRef, TableRow, TeamProfile } from '../../domain/types';
import type { FdGame, FdTable } from './api';

/**
 * Reine Umwandlung der Crawler-Antworten in Coach.AI-Datenblöcke.
 * Keine Werte werden ergänzt oder geschätzt: Was fussball.de nicht liefert
 * (z. B. Punktabzüge, ligaweite Spieltagspaarungen), bleibt leer bzw. fehlend.
 */

export const FD_SOURCE_LABEL = 'fussball.de (inoffiziell ausgelesen)';

// ---------------------------------------------------------------------------
// Namen abgleichen
// ---------------------------------------------------------------------------

export function foldName(s: string): string {
  return s
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

/** Ähnlichkeit zweier Vereinsnamen (0–1): Gleichheit, Enthaltensein oder Wortüberschneidung. */
export function nameSimilarity(a: string, b: string): number {
  const x = foldName(a);
  const y = foldName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const tx = new Set(x.split(' ').filter((t) => t.length > 2));
  const ty = new Set(y.split(' ').filter((t) => t.length > 2));
  const inter = [...tx].filter((t) => ty.has(t)).length;
  const union = new Set([...tx, ...ty]).size;
  return union ? inter / union : 0;
}

export function sameTeam(a: string, b: string): boolean {
  return nameSimilarity(a, b) >= 0.5;
}

/** Ermittelt den Mannschaftsnamen, der in allen Spielen einer Mannschaftsliste vorkommt. */
export function teamNameFromGames(games: FdGame[]): string | null {
  if (!games.length) return null;
  const counts = new Map<string, number>();
  for (const g of games) for (const n of [g.home_team, g.away_team]) counts.set(n, (counts.get(n) ?? 0) + 1);
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return best && best[1] >= Math.ceil(games.length * 0.8) ? best[0] : null;
}

// ---------------------------------------------------------------------------
// Datum, Wettbewerb, Ergebnis
// ---------------------------------------------------------------------------

export function berlinDateTime(iso: string): { date: LocalDate; time: LocalTime } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

export function competitionTypeOf(label: string): CompetitionType {
  const l = label.toLowerCase();
  if (/pokal/.test(l)) return 'pokal';
  if (/freundschaft|test|turnier|hallen/.test(l)) return 'test';
  return 'liga';
}

function score(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).trim());
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function seasonOf(date: LocalDate): string {
  const [y, m] = date.split('-').map(Number);
  const start = m >= 7 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
}

/**
 * Ergebnisliste einer Mannschaft. Die eigene Seite wird auf `canonicalName` umbenannt,
 * damit die Berechnungen (letzte 5, Bilanzen) eindeutig zuordnen.
 * Spiele ohne gültiges Ergebnis (abgesagt, nicht gewertet) werden ausgelassen und gezählt.
 */
export function mapResults(games: FdGame[], canonicalName: string): { results: ResultEntry[]; skipped: number; sourceName: string | null } {
  const sourceName = teamNameFromGames(games);
  const results: ResultEntry[] = [];
  let skipped = 0;
  for (const g of games) {
    const gh = score(g.home_score);
    const ga = score(g.away_score);
    const dt = berlinDateTime(g.datetime_utc);
    if (gh === null || ga === null || !dt) {
      skipped++;
      continue;
    }
    const rename = (n: string) => (sourceName && n === sourceName ? canonicalName : n);
    results.push({
      date: dt.date,
      competitionType: competitionTypeOf(g.competition),
      competitionLabel: g.competition,
      home: rename(g.home_team),
      away: rename(g.away_team),
      goalsHome: gh,
      goalsAway: ga,
    });
  }
  return { results, skipped, sourceName };
}

export function mapTable(table: FdTable, renames: { from: string | null; to: string; fallbackMatch: string }[]): TableRow[] {
  return table.entries.map((e) => {
    const [gf, ga] = e.goal.split(':').map((x) => Number(x.trim()));
    let team = e.team;
    for (const r of renames) {
      if ((r.from && e.team === r.from) || (!r.from && nameSimilarity(e.team, r.fallbackMatch) >= 0.6)) team = r.to;
    }
    return {
      rank: e.place,
      team,
      played: e.games,
      won: e.won,
      drawn: e.draw,
      lost: e.lost,
      goalsFor: Number.isFinite(gf) ? gf : 0,
      goalsAgainst: Number.isFinite(ga) ? ga : 0,
      points: e.points,
      // fussball.de-Tabelle liefert über den Crawler keinen Punktabzug als eigene Angabe.
      pointDeduction: null,
    };
  });
}

export function headToHead(own: ResultEntry[], opp: ResultEntry[], ownName: string, oppName: string): HeadToHead[] {
  const seen = new Set<string>();
  const out: HeadToHead[] = [];
  for (const r of [...own, ...opp]) {
    const teams = [r.home, r.away];
    if (!teams.includes(ownName) || !teams.includes(oppName)) continue;
    const key = `${r.date}|${r.home}|${r.away}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ season: seasonOf(r.date), date: r.date, competitionLabel: r.competitionLabel, competitionType: r.competitionType, home: r.home, away: r.away, goalsHome: r.goalsHome, goalsAway: r.goalsAway });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ---------------------------------------------------------------------------
// Gesamtumwandlung
// ---------------------------------------------------------------------------

export interface FdRaw {
  ownTable: FdTable | null;
  ownPrev: FdGame[];
  ownNext: FdGame[];
  oppPrev: FdGame[] | null;
  retrievedAt: string;
}

export function mapToBlocks(team: TeamProfile, match: Match, raw: FdRaw): { blocks: Partial<DataBlocks>; messages: string[] } {
  const messages: string[] = [];
  const blocks: Partial<DataBlocks> = {};
  const src = (id: string, asOf?: string, asOfRank?: number): SourceRef => ({ id, label: FD_SOURCE_LABEL, kind: 'extern', asOf, asOfRank, retrievedAt: raw.retrievedAt });

  const own = mapResults(raw.ownPrev, team.name);
  const opp = raw.oppPrev ? mapResults(raw.oppPrev, match.opponent) : null;

  // Ergebnisse
  if (own.results.length) {
    const last = own.results.map((r) => r.date).sort().at(-1)!;
    blocks.ergebnisseEigene = {
      key: 'ergebnisseEigene',
      label: 'Ergebnisse eigene Mannschaft (Liga, Pokal, Test)',
      value: { team: team.name, results: own.results },
      provenance: { sources: [src('fd-ergebnisse-eigene', `Spiele bis ${last.split('-').reverse().join('.')}`)], status: 'vorhanden', note: `Name auf fussball.de: „${own.sourceName ?? 'nicht eindeutig'}“. Spieltagnummern liefert die Quelle nicht.${own.skipped ? ` ${own.skipped} Spiel(e) ohne gültiges Ergebnis ausgelassen.` : ''}` },
    };
  } else messages.push('Keine Ergebnisse der eigenen Mannschaft gefunden.');

  if (opp && opp.results.length) {
    const last = opp.results.map((r) => r.date).sort().at(-1)!;
    blocks.ergebnisseGegner = {
      key: 'ergebnisseGegner',
      label: 'Ergebnisse Gegner (Liga, Pokal, Test)',
      value: { team: match.opponent, results: opp.results },
      provenance: { sources: [src('fd-ergebnisse-gegner', `Spiele bis ${last.split('-').reverse().join('.')}`)], status: 'vorhanden', note: `Name auf fussball.de: „${opp.sourceName ?? 'nicht eindeutig'}“.${opp.skipped ? ` ${opp.skipped} Spiel(e) ohne gültiges Ergebnis ausgelassen.` : ''}` },
    };
  } else if (!raw.oppPrev) messages.push('Kein fussball.de-Link des Gegners hinterlegt – Gegnerergebnisse bleiben offen.');
  else messages.push('Keine Ergebnisse des Gegners gefunden.');

  // Tabelle
  if (raw.ownTable && raw.ownTable.entries.length) {
    const rows = mapTable(raw.ownTable, [
      { from: own.sourceName, to: team.name, fallbackMatch: team.name },
      { from: opp?.sourceName ?? null, to: match.opponent, fallbackMatch: match.opponent },
    ]);
    const maxGames = Math.max(...rows.map((r) => r.played));
    const s = src('fd-tabelle', `nach ${maxGames} Spielen (laut Tabelle)`, maxGames);
    blocks.tabelle = {
      key: 'tabelle',
      label: 'Aktuelle Tabelle',
      value: { snapshots: [{ source: s, rows }], primarySourceId: s.id },
      provenance: { sources: [s], status: 'vorhanden', note: 'Punktabzüge werden von der Quelle nicht gesondert geliefert. Abweichungen zwischen Punkten und Bilanz werden als Widerspruch markiert.' },
    };
    if (!rows.some((r) => r.team === team.name)) messages.push('Eigene Mannschaft in der Tabelle nicht eindeutig gefunden – bitte Namen prüfen.');
    if (!rows.some((r) => r.team === match.opponent)) messages.push('Gegner in der Tabelle nicht eindeutig gefunden – Gegnername in der Begegnung an fussball.de angleichen.');
  } else messages.push('Keine Tabelle gefunden (z. B. Pokal- oder Testspiel).');

  // Direkte Duelle (nur aus den verfügbaren Ergebnislisten)
  const h2h = headToHead(own.results, opp?.results ?? [], team.name, match.opponent);
  if (h2h.length) {
    blocks.direkteDuelle = {
      key: 'direkteDuelle',
      label: 'Direkte Duelle',
      value: { games: h2h },
      provenance: { sources: [src('fd-duelle')], status: 'vorhanden', note: 'Nur aus den von fussball.de gelieferten Ergebnislisten – ältere Saisons können fehlen.' },
    };
  }

  // Ansetzung abgleichen
  const fixture = raw.ownNext.find((g) => sameTeam(g.home_team, match.opponent) || sameTeam(g.away_team, match.opponent));
  if (fixture) {
    const dt = berlinDateTime(fixture.datetime_utc);
    blocks.begegnung = {
      key: 'begegnung',
      label: 'Begegnung, Termin, Wettbewerb, Spielort',
      value: {
        confirmedFromSource: Boolean(dt && dt.date === match.date && dt.time === match.kickoff),
        sourceFixture: { date: dt?.date ?? null, kickoff: dt?.time ?? null, venue: fixture.location ?? null, sourceLabel: FD_SOURCE_LABEL },
      },
      provenance: { sources: [{ id: 'trainer', label: 'Trainereingabe', kind: 'trainer' }, src('fd-ansetzung')], status: 'vorhanden' },
    };
  } else messages.push('Begegnung in den kommenden Spielen auf fussball.de nicht gefunden – Termin bitte selbst prüfen.');

  messages.push('Spieltagspaarungen der ganzen Liga, Gegenspieler und Besonderheiten liefert diese Quelle nicht – bitte bei Bedarf manuell ergänzen.');
  return { blocks, messages };
}
