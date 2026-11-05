import { initialState } from '../data/seed';
import type { AppState } from '../domain/types';

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
  return adapter.load() ?? initialState();
}
