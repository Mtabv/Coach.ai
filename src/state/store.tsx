import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppState } from '../domain/types';
import { localStorageAdapter, loadOrInit } from '../storage/storage';
import { initialState } from '../data/seed';

export type SaveStatus = 'gespeichert' | 'speichert' | 'fehler';

/** Wohin gespeichert wird: lokal im Browser (Vorschau) oder auf dem Server (Trainerteam). */
export interface Persistence {
  load(): AppState;
  save(state: AppState): void | Promise<void>;
  clear(): void;
  /** Wartezeit nach der letzten Änderung, bevor gespeichert wird. */
  debounceMs: number;
}

export const localPersistence: Persistence = {
  load: () => loadOrInit(),
  save: (s) => localStorageAdapter.save(s),
  clear: () => localStorageAdapter.clear(),
  debounceMs: 250,
};

interface StoreValue {
  state: AppState;
  /** Ändert den Zustand über eine Kopie; wird automatisch gespeichert. */
  update: (fn: (draft: AppState) => void) => void;
  /** Ersetzt den Zustand ohne erneutes Speichern (z. B. neuer Stand vom Server). */
  replace: (s: AppState) => void;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  resetAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children, persistence = localPersistence }: { children: ReactNode; persistence?: Persistence }) {
  const [state, setState] = useState<AppState>(() => persistence.load());
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('gespeichert');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timer = useRef<number | null>(null);
  const first = useRef(true);
  const skipNext = useRef(false);

  const doSave = useCallback(async (s: AppState) => {
    try {
      await persistence.save(s);
      setSaveStatus('gespeichert');
      setLastSavedAt(new Date());
    } catch {
      setSaveStatus('fehler');
    }
  }, [persistence]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (persistence === localPersistence) void doSave(state);
      return;
    }
    if (skipNext.current) { skipNext.current = false; return; }
    setSaveStatus('speichert');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void doSave(state); }, persistence.debounceMs);
  }, [state, doSave, persistence]);

  // Beim Verlassen der Seite sofort speichern (lokal; beim Server übernimmt das der letzte Speichervorgang)
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const flush = () => {
      if (persistence !== localPersistence) return;
      try { localStorageAdapter.save(stateRef.current); } catch { /* nicht verfügbar */ }
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [persistence]);

  const update = useCallback((fn: (draft: AppState) => void) => {
    setState((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      return draft;
    });
  }, []);

  const replace = useCallback((s: AppState) => { skipNext.current = true; setState(s); }, []);

  const resetAll = useCallback(() => {
    persistence.clear();
    setState(initialState());
  }, [persistence]);

  const value = useMemo(() => ({ state, update, replace, saveStatus, lastSavedAt, resetAll }), [state, update, replace, saveStatus, lastSavedAt, resetAll]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('StoreProvider fehlt');
  return v;
}
