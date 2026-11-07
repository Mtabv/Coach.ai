import { useEffect, useState } from 'react';

/** Schlanker Hash-Router – keine Serverkonfiguration nötig. */
export type Route =
  | { name: 'start' }
  | { name: 'mannschaft' }
  | { name: 'neueMannschaft' }
  | { name: 'neuesSpiel' }
  | { name: 'spiel'; matchId: string; tab: 'daten' | 'fragebogen' | 'dossier' | 'export' }
  | { name: 'archiv' }
  | { name: 'analytics' }
  | { name: 'analyticsDruck' }
  | { name: 'archivDossier'; dossierId: string }
  | { name: 'druck'; dossierId: string };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'mannschaft':
      return parts[1] === 'neu' ? { name: 'neueMannschaft' } : { name: 'mannschaft' };
    case 'spiel':
      if (parts[1] === 'neu') return { name: 'neuesSpiel' };
      if (parts[1]) {
        const tab = (['daten', 'fragebogen', 'dossier', 'export'] as const).find((t) => t === parts[2]) ?? 'daten';
        return { name: 'spiel', matchId: parts[1], tab };
      }
      return { name: 'start' };
    case 'archiv':
      return parts[1] ? { name: 'archivDossier', dossierId: parts[1] } : { name: 'archiv' };
    case 'druck':
      return parts[1] ? { name: 'druck', dossierId: parts[1] } : { name: 'start' };
    case 'analytics':
      return parts[1] === 'druck' ? { name: 'analyticsDruck' } : { name: 'analytics' };
    default:
      return { name: 'start' };
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case 'start':
      return '#/';
    case 'mannschaft':
      return '#/mannschaft';
    case 'neueMannschaft':
      return '#/mannschaft/neu';
    case 'neuesSpiel':
      return '#/spiel/neu';
    case 'spiel':
      return `#/spiel/${encodeURIComponent(r.matchId)}/${r.tab}`;
    case 'archiv':
      return '#/archiv';
    case 'analytics':
      return '#/analytics';
    case 'analyticsDruck':
      return '#/analytics/druck';
    case 'archivDossier':
      return `#/archiv/${encodeURIComponent(r.dossierId)}`;
    case 'druck':
      return `#/druck/${encodeURIComponent(r.dossierId)}`;
  }
}

export function navigate(r: Route) {
  window.location.hash = href(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
