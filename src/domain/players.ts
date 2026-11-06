import type { OpponentPlayerCandidate, PlayerHint } from './types';

export interface SelectedPlayer {
  name: string;
  number?: string;
  position?: string;
  reasons: string[];
  coachNote: string;
  fromCoach: boolean;
  photo?: { url: string; credit: string };
  mvp?: { value: number; asOf: string | null };
  heightCm?: number;
  isCaptain?: boolean;
}

function extras(c: OpponentPlayerCandidate | undefined): Pick<SelectedPlayer, 'photo' | 'mvp' | 'heightCm' | 'isCaptain'> {
  if (!c) return {};
  return {
    ...(c.photo ? { photo: c.photo } : {}),
    ...(c.mvp ? { mvp: { value: c.mvp.value, asOf: c.mvp.asOf } } : {}),
    ...(c.heightCm ? { heightCm: c.heightCm } : {}),
    ...(c.isCaptain ? { isCaptain: true } : {}),
  };
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
      ...extras(c),
    });
  }
  const ranked = candidates
    .filter((c) => c.evidence.length > 0 && !used.has(c.id))
    .sort((a, b) => (b.goals ?? 0) + (b.assists ?? 0) - ((a.goals ?? 0) + (a.assists ?? 0)) || (b.mvp?.value ?? 0) - (a.mvp?.value ?? 0) || a.name.localeCompare(b.name));
  for (const c of ranked) {
    if (out.length >= max) break;
    out.push({ name: c.name, number: c.number, position: c.position, reasons: c.evidence.map((e) => e.text), coachNote: '', fromCoach: false, ...extras(c) });
  }
  return out;
}
