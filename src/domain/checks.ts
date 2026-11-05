import { evaluateBlocks, unresolvedConflicts } from './dataQuality';
import { missionComplete } from './questionnaire';
import { isValidDate, isValidTime } from './time';
import type { Match, Preparation, TeamProfile } from './types';

export interface CheckItem {
  id: string;
  label: string;
  ok: boolean;
  /** Blockiert die Bestätigung. Warnungen müssen nur ausdrücklich zur Kenntnis genommen werden. */
  blocking: boolean;
  detail?: string;
}

/** Prüfungen vor der Bestätigung eines Dossiers. Entwürfe dürfen unvollständig sein. */
export function confirmationChecks(team: TeamProfile, match: Match, prep: Preparation): CheckItem[] {
  const evals = evaluateBlocks(team, match, prep);
  const conflicts = unresolvedConflicts(evals);
  const missingRequired = evals.filter((e) => e.required && (e.status === 'fehlend' || e.status === 'veraltet'));
  const mantrasOk = prep.mission.mantrasWaived || prep.mission.mantras.some((m) => m.trim());
  return [
    {
      id: 'begegnung',
      label: 'Begegnung, Datum und Uhrzeit vorhanden',
      ok: Boolean(match.opponent.trim()) && isValidDate(match.date) && isValidTime(match.kickoff),
      blocking: true,
    },
    {
      id: 'botschaften',
      label: 'Drei Trainerbotschaften geklärt',
      ok: missionComplete(prep),
      blocking: true,
      detail: `${prep.mission.messages.filter((m) => m.headline.trim() || m.text.trim()).length} von 3`,
    },
    { id: 'leitmotiv', label: 'Leitmotiv geklärt', ok: Boolean(prep.mission.motto.trim()), blocking: true },
    {
      id: 'merksaetze',
      label: 'Merksätze erfasst oder ausdrücklich abgewählt',
      ok: mantrasOk,
      blocking: true,
    },
    {
      id: 'konflikte',
      label: 'Faktenkonflikte',
      ok: conflicts.length === 0,
      blocking: false,
      detail: conflicts.length ? `${conflicts.length} ungeklärt – werden im Dossier als „widersprüchlich“ markiert, nicht als Fakt.` : 'Keine ungeklärten Widersprüche',
    },
    {
      id: 'daten',
      label: 'Pflichtdaten vollständig und aktuell',
      ok: missingRequired.length === 0,
      blocking: false,
      detail: missingRequired.length ? `${missingRequired.map((e) => `${e.label} (${e.status})`).join(', ')} – im Dossier als „offen“ markiert.` : undefined,
    },
  ];
}

export function canConfirm(checks: CheckItem[]): boolean {
  return checks.every((c) => c.ok || !c.blocking);
}
