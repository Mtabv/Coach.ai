import { initialState } from '../data/seed';
import type { AppState, QuestionId } from '../domain/types';

/**
 * Lokale Speicherung im Browser (localStorage). Keine Server, keine Konten.
 * Das Schema ist versioniert, damit spätere Erweiterungen migriert werden können.
 */
export const STORAGE_KEY = 'coachai:v1';

export interface StorageAdapter {
  load(): AppState | null;
  save(state: AppState): void;
  clear(): void;
}

export const localStorageAdapter: StorageAdapter = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AppState;
      if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.teams)) return null;
      return parsed;
    } catch {
      return null;
    }
  },
  save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Speicher nicht verfügbar (z. B. eingebettete Ansicht) – App läuft im Arbeitsspeicher weiter.
      throw new Error('Lokaler Speicher nicht verfügbar');
    }
  },
  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignorieren */
    }
  },
};

export function loadOrInit(adapter: StorageAdapter = localStorageAdapter): AppState {
  const s = adapter.load();
  return s ? migrate(s) : initialState();
}

/** Bis November 2026 stand „So spielen wir“ in den Gegnerfragen; seitdem hat der eigene Plan eigene Fragen. */
const OWN_PLAN_MOVE: [QuestionId, QuestionId][] = [
  ['q1_grundordnung', 'u1_grundordnung'],
  ['q2_aufbau', 'u2_ballbesitz'],
  ['q4b_ballverlust', 'u3_ballverlust'],
  ['q3_verteidigung', 'u4_gegnerball'],
  ['q4_umschalten', 'u5_ballgewinn'],
  ['q5b_standards', 'u6_standards'],
];

export function migrate(state: AppState): AppState {
  for (const m of state.matches) {
    const team = state.teams.find((t) => t.id === m.teamId);
    const prep = state.preparations[m.id];
    if (!team || !prep || team.phaseModel !== 'eigene') continue;
    if (OWN_PLAN_MOVE.some(([, to]) => prep.answers[to])) continue;
    for (const [from, to] of OWN_PLAN_MOVE) {
      if (prep.answers[from]) {
        prep.answers[to] = prep.answers[from];
        delete prep.answers[from];
      }
    }
  }
  return state;
}
