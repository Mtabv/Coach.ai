import { now } from '../../domain/factory';
import type { Match, TeamProfile } from '../../domain/types';
import type { MatchDataProvider, ProviderResult } from '../provider';
import { extractTeamId, fdApi, FdUnavailableError } from './api';
import { mapToBlocks } from './mapping';

export function ownFussballDeTeamId(team: TeamProfile): string | null {
  return extractTeamId(team.links.find((l) => l.kind === 'fussball.de')?.url);
}

/**
 * Datenanbieter über den lokal betriebenen Crawler (inoffiziell).
 * Läuft nur mit dem Vite-Entwicklungsserver, der Anfragen samt Schlüssel an den Crawler weiterleitet.
 * Abruf nur auf ausdrücklichen Klick – keine Hintergrundabfragen.
 */
export const fussballDeProvider: MatchDataProvider = {
  id: 'fussballde-inoffiziell',
  label: 'fussball.de (inoffiziell, über lokalen Dienst)',
  kind: 'live',
  actionLabel: 'Daten von fussball.de laden',

  supports(team: TeamProfile, match: Match) {
    return !match.isHistoricalReference && ownFussballDeTeamId(team) !== null;
  },

  async fetch(team: TeamProfile, match: Match, fetchImpl?: typeof fetch): Promise<ProviderResult> {
    const ownId = ownFussballDeTeamId(team);
    if (!ownId) return { blocks: {}, messages: ['Kein fussball.de-Link der eigenen Mannschaft im Mannschaftsprofil.'] };
    const oppId = extractTeamId(match.opponentFussballDe);
    try {
      const [ownTable, ownPrev, ownNext, oppPrev] = await Promise.all([
        fdApi.table(ownId, fetchImpl),
        fdApi.prevGames(ownId, fetchImpl),
        fdApi.nextGames(ownId, fetchImpl),
        oppId ? fdApi.prevGames(oppId, fetchImpl) : Promise.resolve(null),
      ]);
      const { blocks, messages } = mapToBlocks(team, match, { ownTable, ownPrev, ownNext, oppPrev, retrievedAt: now() });
      return { blocks, messages: ['Daten von fussball.de geladen (inoffiziell ausgelesen). Bitte Datenstand und Zuordnung prüfen.', ...messages] };
    } catch (e) {
      if (e instanceof FdUnavailableError) {
        return { blocks: {}, messages: [e.message, 'Anleitung: docs/fussballde-anbindung.md. Ohne den lokalen Dienst bleiben die Angaben offen.'] };
      }
      return { blocks: {}, messages: [`Abruf fehlgeschlagen: ${(e as Error).message}`] };
    }
  },
};
