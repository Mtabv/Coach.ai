import { useCallback, useEffect, useRef, useState } from 'react';
import { providers } from '../../data/registry';
import type { Match, TeamProfile } from '../../domain/types';
import { applyProviderResult } from '../../state/actions';
import { useStore } from '../../state/store';
import { eingebettet, melden, nurLaden } from './vorbereitung';

/**
 * Daten von fussball.de und FuPa für das eingebettete Dossier.
 * Lädt beim ersten Öffnen selbst, auf Zuruf der Teamzentrale („Daten laden“ im Spielkopf) erneut,
 * und meldet den Stand erst, wenn er auf dem Server gespeichert ist.
 */
export function useDatenImRahmen(match: Match, team: TeamProfile) {
  const { state, update, saveStatus } = useStore();
  const stand = state.preparations[match.id]?.dataLoadedAt ?? null;
  const [laeuft, setLaeuft] = useState(false);
  const [fortschritt, setFortschritt] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laeuftRef = useRef(false);
  const wartet = useRef<'nein' | 'geladen' | 'speichert'>('nein');
  const gestartet = useRef(false);

  const laden = useCallback(async () => {
    const provider = providers.find((p) => p.supports(team, match));
    if (!provider || laeuftRef.current) return;
    laeuftRef.current = true; setLaeuft(true); setFehler(null);
    try {
      const res = await provider.fetch(team, match, { onProgress: setFortschritt });
      update((s) => applyProviderResult(s, match.id, res));
      wartet.current = 'geladen';
    } catch (e) {
      const t = (e as Error).message || 'Laden fehlgeschlagen';
      setFehler(t);
      melden('daten-fehler', { fehler: t });
    } finally {
      laeuftRef.current = false; setLaeuft(false); setFortschritt(null);
    }
  }, [team, match, update]);

  useEffect(() => {
    if (!eingebettet || gestartet.current) return;
    gestartet.current = true;
    melden('datenstand', { am: stand });
    if (nurLaden || !stand) void laden();
    // nur beim Öffnen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!eingebettet) return;
    const h = (ev: MessageEvent) => {
      if (ev.origin === window.location.origin && ev.data && ev.data.typ === '11plan-laden') void laden();
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, [laden]);

  // Erst melden, wenn der neue Stand gespeichert ist (der unsichtbare Rahmen wird danach entfernt).
  useEffect(() => {
    if (wartet.current === 'geladen' && saveStatus === 'speichert') wartet.current = 'speichert';
    else if (wartet.current === 'speichert' && saveStatus === 'gespeichert') { wartet.current = 'nein'; melden('daten-geladen', { am: stand }); }
    else if (wartet.current !== 'nein' && saveStatus === 'fehler') { wartet.current = 'nein'; melden('daten-fehler', { fehler: 'Speichern fehlgeschlagen' }); }
  }, [saveStatus, stand]);

  return { laeuft, fortschritt, fehler, stand };
}
