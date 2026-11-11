import type { AppState } from '../domain/types';

/**
 * Anbindung an den 11Plan-Server (Version 1: Trainerteam). Läuft die App ohne Server
 * (lokale Entwicklung, Vorschau als Artefakt), bleibt alles wie bisher im Browser.
 */
export interface SessionUser { id: number; name: string; email: string; role: 'trainer' | 'co-trainer' }
export type ServerStatus = { mode: 'lokal' } | { mode: 'server'; eingerichtet: boolean; nutzer: SessionUser | null; teamzentrale: boolean };

export class ApiError extends Error { constructor(public status: number, message: string, public data?: Record<string, unknown>) { super(message); } }

export async function api<T = Record<string, unknown>>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(path, {
    method: opts.method || 'GET',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CoachAI': '1' },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, (data as { fehler?: string }).fehler || `Fehler ${r.status}`, data as Record<string, unknown>);
  return data as T;
}

export async function serverStatus(): Promise<ServerStatus> {
  try {
    const r = await fetch('/api/status', { credentials: 'same-origin' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('application/json')) return { mode: 'lokal' };
    const d = await r.json();
    return { mode: 'server', eingerichtet: !!d.eingerichtet, nutzer: d.nutzer ?? null, teamzentrale: !!d.teamzentrale };
  } catch {
    return { mode: 'lokal' };
  }
}

export interface ServerState { version: number; zustand: AppState | null; geaendertVon?: string | null; geaendertAm?: string }
export const loadServerState = () => api<ServerState>('/api/zustand');

/** Speichert mit Versionsprüfung. Bei einem neueren Stand auf dem Server kommt `konflikt` zurück. */
export async function saveServerState(basisVersion: number, zustand: AppState): Promise<{ version: number } | { konflikt: number }> {
  try {
    return await api<{ version: number }>('/api/zustand', { method: 'PUT', body: { basisVersion, zustand } });
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return { konflikt: Number(e.data?.version) };
    throw e;
  }
}

/**
 * Speichern auf dem Server. Merkt sich die Version, auf der die eigenen Änderungen beruhen.
 * Hat ein anderer Trainer inzwischen gespeichert, wird nicht überschrieben: `onKonflikt` meldet das.
 */
export function serverPersistence(start: ServerState, initial: AppState, onKonflikt: (aktuell: number) => void) {
  let version = start.version;
  let gesperrt = false;
  return {
    get version() { return version; },
    set version(v: number) { version = v; gesperrt = false; },
    load: () => initial,
    async save(s: AppState) {
      if (gesperrt) throw new Error('Neuerer Stand auf dem Server');
      const r = await saveServerState(version, s);
      if ('konflikt' in r) { gesperrt = true; onKonflikt(r.konflikt); throw new Error('Neuerer Stand auf dem Server'); }
      version = r.version;
    },
    clear() { /* auf dem Server wird nichts gelöscht */ },
    debounceMs: 1200,
  };
}
