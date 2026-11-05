import { evaluateBlocks } from './dataQuality';
import { questionProgress } from './questionnaire';
import type { DossierRecord, Match, Preparation, TeamProfile } from './types';

export interface MatchProgress {
  started: boolean;
  dataReady: number;
  dataTotal: number;
  questionsDone: number;
  questionsTotal: number;
  openItems: string[];
  draft: DossierRecord | undefined;
  confirmed: DossierRecord[];
  stage: 'nicht begonnen' | 'Daten prüfen' | 'Fragebogen' | 'Dossier prüfen' | 'bestätigt';
}

export function matchProgress(team: TeamProfile, match: Match, prep: Preparation, dossiers: DossierRecord[]): MatchProgress {
  const evals = evaluateBlocks(team, match, prep);
  const q = questionProgress(team, match, prep);
  const ownDossiers = dossiers.filter((d) => d.matchId === match.id);
  const draft = ownDossiers.find((d) => d.status === 'entwurf');
  const confirmed = ownDossiers.filter((d) => d.status === 'bestätigt').sort((a, b) => b.version - a.version);
  const dataReady = evals.filter((e) => e.status === 'vorhanden' || e.status === 'bestätigt').length;
  const questionsDone = q.filter((x) => x.status === 'erledigt').length;
  const started = Boolean(prep.dataLoadedAt) || Object.keys(prep.answers).length > 0 || prep.mission.motto !== '' || Boolean(draft) || confirmed.length > 0 || prep.squadReviewed;
  const openItems: string[] = [];
  for (const e of evals) {
    if (e.status === 'fehlend') openItems.push(`${e.label}: fehlt`);
    else if (e.status === 'widersprüchlich') openItems.push(`${e.label}: widersprüchlich`);
    else if (e.status === 'veraltet') openItems.push(`${e.label}: veraltet`);
  }
  for (const x of q) if (x.status === 'offen') openItems.push(`Frage ${x.id.slice(1).split('_')[0]}: ${x.summary}`);
  let stage: MatchProgress['stage'] = 'nicht begonnen';
  if (confirmed.length && !draft) stage = 'bestätigt';
  else if (draft) stage = 'Dossier prüfen';
  else if (Object.keys(prep.answers).length || prep.mission.motto) stage = 'Fragebogen';
  else if (started) stage = 'Daten prüfen';
  return { started, dataReady, dataTotal: evals.length, questionsDone, questionsTotal: q.length, openItems, draft, confirmed, stage };
}
