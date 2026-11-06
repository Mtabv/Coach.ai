import type { LocalDate, OpponentPlayerCandidate, SourceRef, TableRow, TableSnapshot } from '../../domain/types';
import { foldName, nameSimilarity, teamSuffix } from '../fussballDe/mapping';
import type { FupaPlayerDetail, FupaSquad, FupaTable, FupaTableRow, FupaTeam } from './api';

export const FUPA_SOURCE_LABEL = 'FuPa (inoffiziell ausgelesen)';
/** Erklärung des MVP-Werts, wie FuPa ihn angibt (für die Fußnote). */
export const FUPA_MVP_DEFINITION = 'Der FuPa-MVP-Wert zeigt laut FuPa, wie wertvoll ein Spieler für sein Team ist, auf Basis der Leistungsdaten (100 % = wertvollster Spieler des Teams).';

/** Wie viele Spieler mit Details (MVP-Wert, Größe) nachgeladen werden. */
export const FUPA_DETAIL_PLAYERS = 8;

export interface FupaBundle {
  own: FupaTeam | null;
  opp: FupaTeam | null;
  oppVia: string | null;
  table: FupaTable | null;
  squad: FupaSquad | null;
  details: FupaPlayerDetail[];
}

/** FuPa-Saisonkennung, z. B. „2026-27“. */
export function fupaSeason(date: LocalDate): string {
  const [y, m] = date.split('-').map(Number);
  const start = m >= 7 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Mannschaftsart im FuPa-Kennungsschema (z. B. „tsg-x-m1-2026-27“, „jsg-y-u17-1-2025-26“). */
export function fupaArt(category: string | null): { art: string; sep: boolean } | null {
  if (!category || /^herren$/i.test(category)) return { art: 'm', sep: false };
  if (/^frauen$/i.test(category)) return { art: 'w', sep: false };
  const j = /^([A-G])-Junior/i.exec(category);
  if (j) {
    const age: Record<string, number> = { A: 19, B: 17, C: 15, D: 13, E: 11, F: 9, G: 7 };
    return { art: `u${age[j[1].toUpperCase()]}-`, sep: true };
  }
  return null;
}

/** Mannschaftsnummer aus dem Namen („TSG X II“ → 2), sonst 1. */
export function teamNumber(name: string): number {
  const s = teamSuffix(name);
  return s ? Number(s) || 1 : 1;
}

/** Sucht eine Mannschaft in der FuPa-Tabelle (eindeutig bester Treffer, mindestens 0,5 Ähnlichkeit). */
export function findInFupaTable(table: FupaTable | null, names: (string | null | undefined)[], exclude: string | null): FupaTableRow | null {
  if (!table) return null;
  const scored = table.rows
    .filter((r) => r.team && r.team_slug && r.team_slug !== exclude)
    .map((r) => ({ r, score: Math.max(...names.filter((n): n is string => Boolean(n)).map((n) => nameSimilarity(n, r.team!))) }))
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score);
  if (!scored.length || (scored[1] && scored[1].score === scored[0].score)) return null;
  return scored[0].r;
}

/**
 * Tabelle laut FuPa als zweite Quelle. Mannschaftsnamen werden auf die Namen der Haupttabelle (fussball.de)
 * abgebildet, damit Abweichungen zeilenweise erkannt werden; nicht eindeutig zuordenbare Zeilen behalten ihren Namen.
 */
export function fupaTableSnapshot(table: FupaTable, primaryRows: TableRow[], renames: Map<string, string>, source: SourceRef): TableSnapshot {
  const rows: TableRow[] = [];
  for (const r of table.rows) {
    if (r.rank === null || r.points === null || !r.team) continue;
    let name = (r.team_slug && renames.get(r.team_slug)) || null;
    if (!name) {
      const best = primaryRows
        .map((p) => ({ p, s: nameSimilarity(r.team!, p.team) }))
        .filter((x) => x.s >= 0.5)
        .sort((a, b) => b.s - a.s);
      name = best.length && !(best[1] && best[1].s === best[0].s) ? best[0].p.team : r.team.trim();
    }
    rows.push({
      rank: r.rank,
      team: name,
      played: r.matches ?? 0,
      won: r.wins ?? 0,
      drawn: r.draws ?? 0,
      lost: r.defeats ?? 0,
      goalsFor: r.goals_for ?? 0,
      goalsAgainst: r.goals_against ?? 0,
      points: r.points,
      pointDeduction: r.penalty_points ? r.penalty_points : null,
    });
  }
  return { source, rows };
}

/** Reihenfolge-unabhängiger Namensschlüssel („Billing, Yannick“ = „Yannick Billing“). */
function personKey(name: string): string {
  return foldName(name).split(' ').filter(Boolean).sort().join(' ');
}

function samePerson(a: string, b: string): boolean {
  if (personKey(a) === personKey(b)) return true;
  // „Y. Billing“ / „Billing“ (nur Nachname) gegen „Yannick Billing“
  const ta = foldName(a).split(' ').filter(Boolean);
  const tb = foldName(b).split(' ').filter(Boolean);
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return short.length > 0 && short.every((t) => long.some((l) => l === t || (t.length === 1 && l.startsWith(t))));
}

function fmtDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
}

/** Welche Kaderspieler Details (MVP, Größe) erhalten: die torgefährlichsten plus Kapitän. */
export function detailSlugs(squad: FupaSquad): string[] {
  const ranked = [...squad.players].filter((p) => (p.goals ?? 0) + (p.assists ?? 0) > 0).sort((a, b) => (b.goals ?? 0) + (b.assists ?? 0) - ((a.goals ?? 0) + (a.assists ?? 0)));
  const slugs = ranked.slice(0, FUPA_DETAIL_PLAYERS).map((p) => p.slug);
  const captain = squad.players.find((p) => p.captain)?.slug ?? squad.captain_slug;
  if (captain && !slugs.includes(captain)) slugs.push(captain);
  return slugs;
}

/**
 * Gegenspieler-Kandidaten nach Datenmodell: Spielerdaten FuPa vor fussball.de (E2). FuPa liefert Position, Einsätze,
 * Tore, Vorlagen, MVP-Wert, Größe und Foto; fussball.de ergänzt Startelf-Einsätze und Tore der letzten Spiele.
 * Weichen die Torzahlen ab, wird das beim Spieler sichtbar vermerkt.
 */
export function mergePlayerCandidates(
  fd: OpponentPlayerCandidate[],
  fdSeasonGoals: Map<string, number>,
  fupa: FupaBundle,
  fupaSourceId: string,
): { candidates: OpponentPlayerCandidate[]; fromFupa: number; withPhoto: number; conflicts: number } {
  if (!fupa.squad) return { candidates: fd, fromFupa: 0, withPhoto: 0, conflicts: 0 };
  const season = fupa.opp?.season_name ? ` (Saison ${fupa.opp.season_name})` : '';
  const details = new Map(fupa.details.map((d) => [d.slug, d]));
  const usedFd = new Set<string>();
  const out: OpponentPlayerCandidate[] = [];
  let conflicts = 0;
  for (const p of fupa.squad.players) {
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
    if (!name) continue;
    const goals = p.goals ?? 0;
    const assists = p.assists ?? 0;
    const fdMatch = fd.find((c) => !usedFd.has(c.id) && samePerson(c.name, name));
    if (fdMatch) usedFd.add(fdMatch.id);
    const relevant = goals + assists > 0 || p.captain || Boolean(fdMatch);
    if (!relevant) continue;
    const d = details.get(p.slug);
    const evidence: { text: string; sourceId: string }[] = [];
    if (p.matches) {
      evidence.push({ text: `${goals} ${goals === 1 ? 'Tor' : 'Tore'}, ${assists} ${assists === 1 ? 'Vorlage' : 'Vorlagen'} in ${p.matches} Einsätzen${season}`, sourceId: fupaSourceId });
    }
    if (d?.mvp) evidence.push({ text: `FuPa-MVP-Wert ${d.mvp} %${d.mvp_updated_at ? ` (Stand ${fmtDateTime(d.mvp_updated_at)})` : ''}`, sourceId: fupaSourceId });
    // Belege von fussball.de: gleiche Saisontore nicht doppeln, Abweichung sichtbar machen.
    const fdGoalsKey = [...fdSeasonGoals.keys()].find((k) => samePerson(k, name));
    const fdGoals = fdGoalsKey !== undefined ? fdSeasonGoals.get(fdGoalsKey)! : null;
    for (const e of fdMatch?.evidence ?? []) {
      if (/Saisontore in der Liga/.test(e.text) && fdGoals !== null) continue;
      evidence.push(e);
    }
    if (fdGoals !== null && fdGoals !== goals) {
      conflicts++;
      evidence.push({ text: `Abweichung: FuPa zählt ${goals} Tore, die Torjägerliste auf fussball.de ${fdGoals} Ligatore – bitte prüfen.`, sourceId: fdMatch?.evidence[0]?.sourceId ?? fupaSourceId });
    }
    if (!evidence.length) continue;
    out.push({
      id: `fupa:${p.slug}`,
      name,
      number: p.number !== null ? String(p.number) : fdMatch?.number,
      position: p.position ?? fdMatch?.position,
      evidence,
      goals,
      assists,
      ...(p.photo_url ? { photo: { url: p.photo_url, credit: p.photo_source ? `FuPa / ${p.photo_source}` : 'FuPa' } } : {}),
      ...(d?.mvp ? { mvp: { value: d.mvp, asOf: d.mvp_updated_at, sourceId: fupaSourceId } } : {}),
      ...(d?.height_cm ? { heightCm: d.height_cm } : {}),
      ...(p.captain ? { isCaptain: true } : {}),
    });
  }
  const fromFupa = out.length;
  // Spieler, die nur fussball.de kennt (z. B. nicht im FuPa-Kader gepflegt), bleiben erhalten.
  for (const c of fd) if (!usedFd.has(c.id)) out.push(c);
  out.sort((x, y) => (y.goals ?? 0) + (y.assists ?? 0) - ((x.goals ?? 0) + (x.assists ?? 0)) || (y.mvp?.value ?? 0) - (x.mvp?.value ?? 0) || x.name.localeCompare(y.name));
  return { candidates: out, fromFupa, withPhoto: out.filter((c) => c.photo).length, conflicts };
}

/** Trainerteam laut FuPa als belegter Fakt. */
export function fupaCoachFact(squad: FupaSquad | null): string | null {
  const head = squad?.coaches.find((c) => /^trainer$/i.test(c.role ?? ''));
  if (!head) return null;
  const co = squad!.coaches.filter((c) => /co-?trainer/i.test(c.role ?? '')).map((c) => c.name);
  return `Trainer laut FuPa: ${head.name}${co.length ? ` (Co-Trainer: ${co.join(', ')})` : ''}.`;
}
