import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppState } from '../domain/types';
import { localStorageAdapter, loadOrInit } from '../storage/storage';
import { initialState } from '../data/seed';

export type SaveStatus = 'gespeichert' | 'speichert' | 'fehler';

interface StoreValue {
  state: AppState;
  /** Ändert den Zustand über eine Kopie; wird automatisch lokal gespeichert. */
  update: (fn: (draft: AppState) => void) => void;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  resetAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadOrInit());
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('gespeichert');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timer = useRef<number | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      localStorageAdapter.save(state);
      return;
    }
    setSaveStatus('speichert');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        localStorageAdapter.save(state);
        setSaveStatus('gespeichert');
        setLastSavedAt(new Date());
      } catch {
        setSaveStatus('fehler');
      }
    }, 250);
  }, [state]);

  // Beim Verlassen der Seite sofort speichern
  useEffect(() => {
    const flush = () => localStorageAdapter.save(stateRef.current);
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, []);
  const stateRef = useRef(state);
  stateRef.current = state;

  const update = useCallback((fn: (draft: AppState) => void) => {
    setState((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      return draft;
    });
  }, []);

  const resetAll = useCallback(() => {
    localStorageAdapter.clear();
    setState(initialState());
  }, []);

  const value = useMemo(() => ({ state, update, saveStatus, lastSavedAt, resetAll }), [state, update, saveStatus, lastSavedAt, resetAll]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('StoreProvider fehlt');
  return v;
}
