import type { DataBlocks, Match, OpponentPlayerCandidate, Preparation, QuestionId, TeamProfile } from '../domain/types';

/**
 * Austauschbare Schnittstelle für Datenanbieter.
 *
 * Die Vorschau nutzt ausschließlich den DemoDataProvider. Spätere Anbieter
 * (z. B. eine serverseitige Recherche für fussball.de/FuPa) implementieren dieselbe
 * Schnittstelle. Zugangsdaten gehören dann auf einen Server – niemals ins Frontend.
 */
export interface ProviderResult {
  /** Nur gelieferte Blöcke werden übernommen; alles andere bleibt „fehlend“. */
  blocks: Partial<DataBlocks>;
  /** Hinweise an den Trainer, z. B. „Keine Beispieldaten für diese Begegnung“. */
  messages: string[];
}

export interface MatchDataProvider {
  id: string;
  label: string;
  /** „demo“ = feste Beispieldaten, „live“ = echte Recherche. */
  kind: 'demo' | 'live';
  /** Beschriftung der Schaltfläche in der Oberfläche. */
  actionLabel: string;
  supports(team: TeamProfile, match: Match): boolean;
  fetch(team: TeamProfile, match: Match): Promise<ProviderResult>;
}

/** Beispielinhalte, die nur im historischen Referenzfall angeboten werden. */
export interface ExampleContentProvider {
  exampleAnswers(match: Match): Partial<Preparation> & {
    answers: Partial<Record<QuestionId, { text: string; state: 'beantwortet' | 'nicht_bekannt' | 'keine_abweichung' }>>;
  };
}

export type { OpponentPlayerCandidate };
