import { lastLeagueGames, normalizeName, record, teamResults } from './stats';
import type {
  Conflict,
  DataBlock,
  DataBlockKey,
  DataStatus,
  Match,
  Preparation,
  SourceRef,
  TableRow,
  TableSnapshot,
  TeamProfile,
} from './types';

/**
 * Prüflogik für die Datenbasis.
 * - Ein neuerer Abrufzeitpunkt macht Daten NICHT automatisch aktuell: maßgeblich ist der
 *   fachliche Datenstand (asOfRank).
 * - Widersprüche bleiben sichtbar, bis der Trainer ausdrücklich eine Quelle wählt.
 * - Tabellenpunkte werden nie aus Siegen/Remis überschrieben; Abweichungen werden markiert.
 */

const TABLE_FIELDS: { field: keyof TableRow; label: string }[] = [
  { field: 'points', label: 'Punkte' },
  { field: 'played', label: 'Spiele' },
  { field: 'goalsFor', label: 'Tore' },
  { field: 'goalsAgainst', label: 'Gegentore' },
  { field: 'pointDeduction', label: 'Punktabzug' },
];

export interface TableAnalysis {
  primary: TableSnapshot | null;
  /** Quellen mit älterem fachlichem Datenstand als die Primärquelle. */
  staleSources: SourceRef[];
  conflicts: Conflict[];
  /** Effektive Tabelle: Primärquelle mit vom Trainer gewählten Konfliktwerten. */
  rows: (TableRow & { unresolved: string[] })[];
  expectedAsOfRank: number | null;
  primaryIsStale: boolean;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return 'nicht angegeben';
  return String(v);
}

export function analyzeTable(
  block: DataBlock<{ snapshots: TableSnapshot[]; primarySourceId: string | null }>,
  match: Pick<Match, 'matchday' | 'competitionType'>,
): TableAnalysis {
  const snaps = block.value?.snapshots ?? [];
  const expectedAsOfRank = match.competitionType === 'liga' && match.matchday ? match.matchday - 1 : null;
  if (snaps.length === 0) {
    return { primary: null, staleSources: [], conflicts: [], rows: [], expectedAsOfRank, primaryIsStale: false };
  }
  const maxRank = Math.max(...snaps.map((s) => s.source.asOfRank ?? -1));
  const current = snaps.filter((s) => (s.source.asOfRank ?? -1) === maxRank);
  const staleSources = snaps.filter((s) => (s.source.asOfRank ?? -1) < maxRank).map((s) => s.source);
  const chosen = block.value?.primarySourceId ? current.find((s) => s.source.id === block.value!.primarySourceId) : undefined;
  const primary = chosen ?? current[0];
  const resolutions = block.resolutions ?? {};

  const conflicts: Conflict[] = [];
  // Abweichungen zwischen Quellen mit gleichem fachlichem Datenstand
  for (const row of primary.rows) {
    for (const { field, label } of TABLE_FIELDS) {
      const values = current
        .map((s) => {
          const r = s.rows.find((x) => normalizeName(x.team) === normalizeName(row.team));
          return r ? { sourceId: s.source.id, sourceLabel: s.source.label, value: fmt(r[field]) } : null;
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);
      const distinct = new Set(values.map((v) => v.value));
      if (distinct.size > 1) {
        const id = `tabelle:${normalizeName(row.team)}:${field}`;
        conflicts.push({
          id,
          blockKey: 'tabelle',
          subject: row.team,
          field,
          label: `${label} von ${row.team}`,
          values,
          resolution: resolutions[id] ?? null,
        });
      }
    }
    // Plausibilität: Punkte vs. Bilanz ohne angegebenen Punktabzug
    const fromRecord = row.won * 3 + row.drawn - (row.pointDeduction ?? 0);
    const id = `tabelle:${normalizeName(row.team)}:plausibilitaet`;
    if (fromRecord !== row.points && !conflicts.some((c) => c.subject === row.team && c.field === 'points')) {
      conflicts.push({
        id,
        blockKey: 'tabelle',
        subject: row.team,
        field: 'points',
        label: `Punkte von ${row.team} passen nicht zur Bilanz (${row.won}S ${row.drawn}U${row.pointDeduction ? `, −${row.pointDeduction} Abzug` : ', kein Punktabzug angegeben'})`,
        values: [{ sourceId: primary.source.id, sourceLabel: primary.source.label, value: fmt(row.points) }],
        resolution: resolutions[id] ?? null,
      });
    }
  }

  const rows = primary.rows.map((row) => {
    const out: TableRow & { unresolved: string[] } = { ...row, unresolved: [] };
    for (const c of conflicts.filter((c) => normalizeName(c.subject) === normalizeName(row.team))) {
      if (c.resolution) {
        const src = current.find((s) => s.source.id === c.resolution!.sourceId);
        const r = src?.rows.find((x) => normalizeName(x.team) === normalizeName(row.team));
        if (r) (out as unknown as Record<string, unknown>)[c.field] = r[c.field as keyof TableRow];
      } else {
        out.unresolved.push(c.field);
      }
    }
    return out;
  });

  const primaryIsStale = expectedAsOfRank !== null && (primary.source.asOfRank ?? -1) < expectedAsOfRank;
  return { primary, staleSources, conflicts, rows, expectedAsOfRank, primaryIsStale };
}

export interface BlockEvaluation {
  key: DataBlockKey;
  label: string;
  status: DataStatus;
  issues: string[];
  conflicts: Conflict[];
  required: boolean;
}

function baseStatus(block: DataBlock<unknown>, hasValue: boolean): DataStatus {
  if (!hasValue) return 'fehlend';
  if (block.confirmedAt) return 'bestätigt';
  return 'vorhanden';
}

export function evaluateBlocks(team: TeamProfile, match: Match, prep: Preparation): BlockEvaluation[] {
  const b = prep.dataBlocks;
  const out: BlockEvaluation[] = [];
  const expected = match.competitionType === 'liga' && match.matchday ? match.matchday - 1 : null;

  // Begegnung – stammt aus der Spielanlage; Pflichtangaben prüfen
  {
    const issues: string[] = [];
    if (!match.opponent) issues.push('Gegner fehlt');
    if (!match.date) issues.push('Datum fehlt');
    if (!match.kickoff) issues.push('Anstoßzeit fehlt');
    if (!match.competition) issues.push('Wettbewerb fehlt');
    const venue = prep.organisation.venueOverride ?? match.venue ?? (match.isHome ? team.homeVenue : null);
    if (!venue?.name) issues.push('Spielort fehlt');
    const sf = b.begegnung.value?.sourceFixture;
    let mismatch = false;
    if (sf) {
      if (sf.date && match.date && sf.date !== match.date) {
        mismatch = true;
        issues.push(`Datum laut ${sf.sourceLabel}: ${sf.date.split('-').reverse().join('.')} – Spielanlage: ${match.date.split('-').reverse().join('.')}`);
      }
      if (sf.kickoff && match.kickoff && sf.kickoff !== match.kickoff) {
        mismatch = true;
        issues.push(`Anstoß laut ${sf.sourceLabel}: ${sf.kickoff} – Spielanlage: ${match.kickoff}`);
      }
    }
    out.push({
      key: 'begegnung',
      label: b.begegnung.label,
      status: issues.some((i) => /fehlt$/.test(i)) ? 'fehlend' : mismatch ? 'widersprüchlich' : b.begegnung.confirmedAt ? 'bestätigt' : 'vorhanden',
      issues,
      conflicts: [],
      required: true,
    });
  }

  // Tabelle
  {
    const a = analyzeTable(b.tabelle, match);
    const issues: string[] = [];
    let status = baseStatus(b.tabelle, Boolean(a.primary));
    for (const s of a.staleSources) {
      issues.push(`${s.label}: Datenstand „${s.asOf ?? 'unbekannt'}“ ist älter als die Hauptquelle – trotz Abruf am ${s.retrievedAt ? new Date(s.retrievedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }) : '–'}.`);
    }
    if (a.primaryIsStale) {
      status = 'veraltet';
      issues.push(`Datenstand „${a.primary?.source.asOf}“ – erwartet wird der Stand nach dem ${expected}. Spieltag.`);
    }
    const unresolved = a.conflicts.filter((c) => !c.resolution);
    if (unresolved.length) status = 'widersprüchlich';
    out.push({ key: 'tabelle', label: b.tabelle.label, status, issues, conflicts: a.conflicts, required: true });
  }

  // Spieltag
  {
    const has = Boolean(b.spieltag.value && b.spieltag.value.pairings.length);
    out.push({ key: 'spieltag', label: b.spieltag.label, status: baseStatus(b.spieltag, has), issues: [], conflicts: [], required: false });
  }

  // Ergebnisse
  for (const key of ['ergebnisseEigene', 'ergebnisseGegner'] as const) {
    const blk = b[key];
    const teamName = key === 'ergebnisseEigene' ? team.name : match.opponent;
    const results = blk.value?.results ?? [];
    const league = teamResults(teamName, results, { type: 'liga', before: match.date });
    const issues: string[] = [];
    let status = baseStatus(blk, league.length > 0);
    if (league.length > 0 && league.length < 5) issues.push(`Nur ${league.length} Ligaspiele vorhanden.`);
    const maxMd = Math.max(...league.map((r) => r.matchday ?? 0));
    if (league.length > 0 && expected !== null && maxMd > 0 && maxMd < expected) {
      status = 'veraltet';
      issues.push(`Letztes erfasstes Ligaspiel: ${maxMd}. Spieltag – erwartet: ${expected}. Spieltag.`);
    }
    const tRow = analyzeTable(b.tabelle, match).rows.find((r) => normalizeName(r.team) === normalizeName(teamName));
    if (tRow && league.length > 0 && tRow.played > league.length) {
      issues.push(`Ergebnisliste unvollständig: ${league.length} von ${tRow.played} Ligaspielen laut Tabelle. Saisonbilanz wird aus der Tabelle übernommen, Heim-/Auswärtsbilanz bleibt offen.`);
    }
    const other = teamResults(teamName, results, { before: match.date }).filter((r) => r.competitionType !== 'liga');
    if (other.length) issues.push(`${other.length} Pokal-/Testspiel(e) erkannt – nicht in „letzte fünf Ligaspiele“ enthalten.`);
    if (blk.value && league.length > 0) {
      const rec = record(league);
      issues.push(`Saisonbilanz aus Ergebnissen: ${rec.won}S ${rec.drawn}U ${rec.lost}N (${rec.played} Spiele).`);
    }
    out.push({ key, label: blk.label, status, issues, conflicts: [], required: true });
  }

  // Direkte Duelle
  {
    const has = Boolean(b.direkteDuelle.value && b.direkteDuelle.value.games.length);
    const issues = has ? [] : ['Keine direkten Duelle erfasst – im Dossier als „keine Angaben“ markiert.'];
    out.push({ key: 'direkteDuelle', label: b.direkteDuelle.label, status: baseStatus(b.direkteDuelle, has), issues, conflicts: [], required: false });
  }

  // Gegenspieler
  {
    const c = b.gegenspieler.value?.candidates ?? [];
    const withEvidence = c.filter((x) => x.evidence.length > 0);
    const issues: string[] = [];
    if (withEvidence.length > 0 && withEvidence.length < 4) issues.push(`Nur ${withEvidence.length} belegte Spieler – es werden keine vier erzwungen.`);
    out.push({ key: 'gegenspieler', label: b.gegenspieler.label, status: baseStatus(b.gegenspieler, withEvidence.length > 0), issues, conflicts: [], required: false });
  }

  // Gegnerfakten
  {
    const has = Boolean(b.gegnerFakten.value && b.gegnerFakten.value.facts.length);
    out.push({ key: 'gegnerFakten', label: b.gegnerFakten.label, status: baseStatus(b.gegnerFakten, has), issues: [], conflicts: [], required: false });
  }

  // Fahrzeit – nur auswärts relevant
  if (!match.isHome) {
    const minutes = prep.organisation.travelMinutes;
    const issues: string[] = [];
    if (minutes === null) issues.push('Keine aktuelle Fahrzeit für diese Fahrt. Abfahrt und Treffpunkt bleiben offen. Fahrzeiten früherer Gegner werden nicht übertragen.');
    out.push({
      key: 'fahrzeit',
      label: b.fahrzeit.label,
      status: minutes === null ? 'fehlend' : prep.organisation.travelSource === 'verifiziert' ? 'bestätigt' : 'vorhanden',
      issues,
      conflicts: [],
      required: true,
    });
  }

  return out;
}

export function unresolvedConflicts(evals: BlockEvaluation[]): Conflict[] {
  return evals.flatMap((e) => e.conflicts.filter((c) => !c.resolution));
}

export { lastLeagueGames };
