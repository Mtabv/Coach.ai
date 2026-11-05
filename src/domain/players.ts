import type { OpponentPlayerCandidate, PlayerHint } from './types';

export interface SelectedPlayer {
  name: string;
  number?: string;
  position?: string;
  reasons: string[];
  coachNote: string;
  fromCoach: boolean;
}

/**
 * Wählt bis zu vier Gegenspieler aus.
 * 1. Trainerhinweise haben Vorrang.
 * 2. Danach nur Kandidaten mit Belegen, sortiert nach Toren + Vorlagen.
 * Bei dünner Datenlage werden keine vier Spieler erzwungen.
 */
export function selectKeyPlayers(candidates: OpponentPlayerCandidate[], hints: PlayerHint[], max = 4): SelectedPlayer[] {
  const out: SelectedPlayer[] = [];
  const used = new Set<string>();
  for (const h of hints) {
    if (out.length >= max) break;
    const c = h.candidateId ? candidates.find((x) => x.id === h.candidateId) : undefined;
    const key = c?.id ?? `hint:${h.name}`;
    if (used.has(key)) continue;
    used.add(key);
    out.push({
      name: c?.name ?? h.name,
      number: c?.number,
      position: c?.position,
      reasons: c?.evidence.map((e) => e.text) ?? [],
      coachNote: h.reason,
      fromCoach: true,
    });
  }
  const ranked = candidates
    .filter((c) => c.evidence.length > 0 && !used.has(c.id))
    .sort((a, b) => (b.goals ?? 0) + (b.assists ?? 0) - ((a.goals ?? 0) + (a.assists ?? 0)) || a.name.localeCompare(b.name));
  for (const c of ranked) {
    if (out.length >= max) break;
    out.push({ name: c.name, number: c.number, position: c.position, reasons: c.evidence.map((e) => e.text), coachNote: '', fromCoach: false });
  }
  return out;
}
