import type { LocalDate, OpponentPlayerCandidate, SourcePriority, SourceRef, TableRow, TableSnapshot } from '../../domain/types';
import { pick } from '../../domain/sourcePriority';
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
 * Gegenspieler-Kandidaten aus FuPa-Kader und fussball.de. Wo beide Quellen einen Wert liefern (Saisontore,
 * Rückennummer, Kapitän), gilt die im Mannschaftsprofil gewählte Quelle; die andere nur, wenn dort kein Wert steht.
 * Nur FuPa liefert Position, Vorlagen, Einsätze, MVP-Wert, Größe und Foto; nur fussball.de die Startelf und Tore
 * der letzten Spiele.
 */
export function mergePlayerCandidates(
  fd: OpponentPlayerCandidate[],
  fdSeasonGoals: Map<string, { goals: number; rank: number | null }>,
  fupa: FupaBundle,
  fupaSourceId: string,
  fdSourceId: string,
  prio: Pick<SourcePriority, 'saisontore' | 'rueckennummer' | 'kapitaen'>,
): { candidates: OpponentPlayerCandidate[]; fromFupa: number; withPhoto: number } {
  if (!fupa.squad) return { candidates: fd, fromFupa: 0, withPhoto: 0 };
  const season = fupa.opp?.season_name ? ` (Saison ${fupa.opp.season_name})` : '';
  const details = new Map(fupa.details.map((d) => [d.slug, d]));
  const usedFd = new Set<string>();
  const out: OpponentPlayerCandidate[] = [];
  for (const p of fupa.squad.players) {
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
    if (!name) continue;
    const fdMatch = fd.find((c) => !usedFd.has(c.id) && samePerson(c.name, name));
    if (fdMatch) usedFd.add(fdMatch.id);
    const fdKey = [...fdSeasonGoals.keys()].find((k) => samePerson(k, name));
    const fdScorer = fdKey !== undefined ? fdSeasonGoals.get(fdKey)! : null;
    const goals = pick(prio.saisontore, fdScorer?.goals, p.matches ? p.goals : null);
    const assists = p.assists ?? 0;
    const relevant = (goals.value ?? 0) + assists > 0 || p.captain || Boolean(fdMatch);
    if (!relevant) continue;
    const d = details.get(p.slug);
    const evidence: { text: string; sourceId: string }[] = [];
    if (goals.value !== null) {
      evidence.push(
        goals.from === 'fussball.de'
          ? { text: `${goals.value} Saisontore in der Liga${fdScorer?.rank ? ` (Platz ${fdScorer.rank} der Torjägerliste)` : ''}`, sourceId: fdSourceId }
          : { text: `${goals.value} ${goals.value === 1 ? 'Saisontor' : 'Saisontore'}${season}`, sourceId: fupaSourceId },
      );
    }
    if (p.matches) evidence.push({ text: `${assists} ${assists === 1 ? 'Vorlage' : 'Vorlagen'} in ${p.matches} Einsätzen${season}`, sourceId: fupaSourceId });
    if (d?.mvp) evidence.push({ text: `FuPa-MVP-Wert ${d.mvp} %${d.mvp_updated_at ? ` (Stand ${fmtDateTime(d.mvp_updated_at)})` : ''}`, sourceId: fupaSourceId });
    // Belege aus Spielberichten (Startelf, Tore zuletzt); Saisontore sind oben schon nach Quellenwahl entschieden.
    for (const e of fdMatch?.evidence ?? []) if (!/Saisontore in der Liga/.test(e.text)) evidence.push(e);
    if (!evidence.length) continue;
    const number = pick(prio.rueckennummer, fdMatch?.number, p.number !== null ? String(p.number) : null);
    const captain = pick(prio.kapitaen, fdMatch?.isCaptain, p.captain);
    out.push({
      id: `fupa:${p.slug}`,
      name,
      ...(number.value ? { number: number.value } : {}),
      position: p.position ?? fdMatch?.position,
      evidence,
      goals: goals.value ?? 0,
      assists,
      ...(p.photo_url ? { photo: { url: p.photo_url, credit: p.photo_source ? `FuPa / ${p.photo_source}` : 'FuPa' } } : {}),
      ...(d?.mvp ? { mvp: { value: d.mvp, asOf: d.mvp_updated_at, sourceId: fupaSourceId } } : {}),
      ...(d?.height_cm ? { heightCm: d.height_cm } : {}),
      ...(captain.value ? { isCaptain: true } : {}),
    });
  }
  const fromFupa = out.length;
  // Spieler, die nur fussball.de kennt (z. B. nicht im FuPa-Kader gepflegt), bleiben erhalten.
  for (const c of fd) if (!usedFd.has(c.id)) out.push(c);
  out.sort((x, y) => (y.mvp?.value ?? -1) - (x.mvp?.value ?? -1) || (y.goals ?? 0) + (y.assists ?? 0) - ((x.goals ?? 0) + (x.assists ?? 0)) || x.name.localeCompare(y.name));
  return { candidates: out, fromFupa, withPhoto: out.filter((c) => c.photo).length };
}

/** Trainerteam laut FuPa als belegter Fakt. */
export function fupaCoachFact(squad: FupaSquad | null): string | null {
  const head = squad?.coaches.find((c) => /^trainer$/i.test(c.role ?? ''));
  if (!head) return null;
  const co = squad!.coaches.filter((c) => /co-?trainer/i.test(c.role ?? '')).map((c) => c.name);
  return `Trainer laut FuPa: ${head.name}${co.length ? ` (Co-Trainer: ${co.join(', ')})` : ''}.`;
}
