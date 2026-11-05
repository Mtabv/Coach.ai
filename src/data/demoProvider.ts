import { now } from '../domain/factory';
import type { DataBlocks, Match, TeamProfile } from '../domain/types';
import {
  BAUNATAL,
  SOURCES,
  TSG,
  demoHeadToHead,
  demoOpponentFacts,
  demoOpponentPlayers,
  demoPairings,
  demoResultsBaunatal,
  demoResultsTsg,
  demoTables,
} from './demoData';
import type { MatchDataProvider, ProviderResult } from './provider';

/**
 * Demo-Datenanbieter. Liefert ausschließlich feste, fiktive Beispieldaten für den
 * historischen Referenzfall. Es findet KEINE Online-Recherche statt.
 */
export const demoProvider: MatchDataProvider = {
  id: 'demo',
  label: 'Demo-Datenanbieter (feste Beispieldaten, keine Online-Recherche)',
  kind: 'demo',
  actionLabel: 'Beispieldaten laden',

  supports(_team: TeamProfile, match: Match) {
    return match.isHistoricalReference;
  },

  async fetch(team: TeamProfile, match: Match): Promise<ProviderResult> {
    if (!match.isHistoricalReference) {
      return {
        blocks: {},
        messages: [
          'Für diese Begegnung liegen keine Beispieldaten vor.',
          'Eine Live-Recherche (z. B. fussball.de oder FuPa) ist in dieser Vorschau nicht angebunden. Bitte Angaben manuell ergänzen.',
        ],
      };
    }
    const loadedAt = now();
    const tables = demoTables();
    const blocks: Partial<DataBlocks> = {
      begegnung: {
        key: 'begegnung',
        label: 'Begegnung, Termin, Wettbewerb, Spielort',
        value: { confirmedFromSource: true },
        provenance: { sources: [SOURCES.C, { id: 'trainer', label: 'Trainereingabe', kind: 'trainer' }], status: 'vorhanden', note: 'Ansetzung stimmt mit der Spielanlage überein (Beispieldaten).' },
      },
      tabelle: {
        key: 'tabelle',
        label: 'Aktuelle Tabelle',
        value: { snapshots: tables, primarySourceId: SOURCES.A.id },
        provenance: { sources: tables.map((t) => t.source), status: 'vorhanden' },
      },
      spieltag: {
        key: 'spieltag',
        label: 'Spieltagspaarungen',
        value: { matchday: match.matchday, pairings: demoPairings() },
        provenance: { sources: [SOURCES.C], status: 'vorhanden' },
      },
      ergebnisseEigene: {
        key: 'ergebnisseEigene',
        label: 'Ergebnisse eigene Mannschaft (Liga, Pokal, Test)',
        value: { team: team.name || TSG, results: demoResultsTsg() },
        provenance: { sources: [SOURCES.ERG], status: 'vorhanden' },
      },
      ergebnisseGegner: {
        key: 'ergebnisseGegner',
        label: 'Ergebnisse Gegner (Liga, Pokal, Test)',
        value: { team: BAUNATAL, results: demoResultsBaunatal() },
        provenance: { sources: [SOURCES.ERG], status: 'vorhanden' },
      },
      direkteDuelle: {
        key: 'direkteDuelle',
        label: 'Direkte Duelle',
        value: { games: demoHeadToHead() },
        provenance: { sources: [SOURCES.ERG], status: 'vorhanden' },
      },
      gegenspieler: {
        key: 'gegenspieler',
        label: 'Relevante Gegenspieler',
        value: { candidates: demoOpponentPlayers() },
        provenance: { sources: [SOURCES.ERG], status: 'vorhanden' },
      },
      gegnerFakten: {
        key: 'gegnerFakten',
        label: 'Belegte Besonderheiten des Gegners',
        value: { facts: demoOpponentFacts() },
        provenance: { sources: [SOURCES.VEREIN, SOURCES.ERG], status: 'vorhanden' },
      },
    };
    // Abrufzeitpunkt der Vorschau ergänzen – der fachliche Datenstand bleibt unverändert.
    for (const b of Object.values(blocks)) {
      if (b) b.provenance.note = [b.provenance.note, `In die Vorschau geladen: ${new Date(loadedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`].filter(Boolean).join(' · ');
    }
    return { blocks, messages: ['Beispieldaten geladen. Diese Daten sind fiktiv und stammen nicht aus einer Online-Recherche.'] };
  },
};

export const providers: MatchDataProvider[] = [demoProvider];
