import { applyExampleAnswers, REFERENCE_MATCH_ID, demoTeam, referenceMatch } from '../data/seed';
import { buildDossier } from '../dossier/build';
import { applyOverrides } from '../dossier/overrides';
import { createPreparation, now, uid } from '../domain/factory';
import type { AppState, DossierRecord, Match, Preparation, TeamProfile } from '../domain/types';
import type { ProviderResult } from '../data/provider';

/**
 * Reine Zustandsänderungen (ohne React). Dadurch testbar und später durch einen
 * Server-Speicher ersetzbar.
 */

export function teamOf(s: AppState, teamId: string): TeamProfile {
  const t = s.teams.find((x) => x.id === teamId);
  if (!t) throw new Error('Mannschaft nicht gefunden');
  return t;
}

export function matchOf(s: AppState, matchId: string): Match {
  const m = s.matches.find((x) => x.id === matchId);
  if (!m) throw new Error('Spiel nicht gefunden');
  return m;
}

export function addMatch(s: AppState, match: Match): void {
  s.matches.push(match);
  // Neue Spiele starten mit leerer Vorbereitung – keine Antworten anderer Spiele.
  s.preparations[match.id] = createPreparation(teamOf(s, match.teamId), match);
}

export function applyProviderResult(s: AppState, matchId: string, result: ProviderResult): void {
  const prep = s.preparations[matchId];
  for (const [key, block] of Object.entries(result.blocks)) {
    if (block) (prep.dataBlocks as unknown as Record<string, unknown>)[key] = block;
  }
  prep.dataLoadedAt = now();
  prep.updatedAt = now();
}

export function insertExampleAnswers(s: AppState, matchId: string): void {
  if (matchId !== REFERENCE_MATCH_ID) throw new Error('Nur im Referenzfall verfügbar');
  s.preparations[matchId] = applyExampleAnswers(s.preparations[matchId]);
}

export function resetReferenceCase(s: AppState): void {
  const match = referenceMatch();
  let team = s.teams.find((t) => t.id === match.teamId);
  if (!team) {
    team = demoTeam();
    s.teams.push(team);
  }
  if (!s.matches.some((m) => m.id === match.id)) s.matches.push(match);
  else s.matches = s.matches.map((m) => (m.id === match.id ? match : m));
  s.preparations[match.id] = createPreparation(team, match);
  // Entwürfe des Referenzfalls verwerfen; bestätigte Versionen bleiben erhalten.
  s.dossiers = s.dossiers.filter((d) => d.matchId !== match.id || d.status === 'bestätigt');
}

export function currentDraft(s: AppState, matchId: string): DossierRecord | undefined {
  return s.dossiers.find((d) => d.matchId === matchId && d.status === 'entwurf');
}

export function ensureDraft(s: AppState, matchId: string): DossierRecord {
  const existing = currentDraft(s, matchId);
  if (existing) return existing;
  const match = matchOf(s, matchId);
  const versions = s.dossiers.filter((d) => d.matchId === matchId).map((d) => d.version);
  const lastConfirmed = s.dossiers
    .filter((d) => d.matchId === matchId && d.status === 'bestätigt')
    .sort((a, b) => b.version - a.version)[0];
  const t = now();
  const draft: DossierRecord = {
    id: uid('dossier'),
    matchId,
    teamId: match.teamId,
    version: (versions.length ? Math.max(...versions) : 0) + 1,
    status: 'entwurf',
    overrides: lastConfirmed ? { ...lastConfirmed.overrides } : {},
    frozen: null,
    createdAt: t,
    updatedAt: t,
    confirmedAt: null,
    confirmationNotes: [],
  };
  s.dossiers.push(draft);
  return draft;
}

export function setOverride(s: AppState, dossierId: string, path: string, value: string | null): void {
  const d = s.dossiers.find((x) => x.id === dossierId);
  if (!d || d.status !== 'entwurf') throw new Error('Nur Entwürfe sind bearbeitbar');
  if (value === null) delete d.overrides[path];
  else d.overrides[path] = value;
  d.updatedAt = now();
}

/** Bestätigt einen Entwurf: Inhalt wird eingefroren und ist danach unveränderlich. */
export function confirmDossier(s: AppState, dossierId: string, notes: string[]): DossierRecord {
  const d = s.dossiers.find((x) => x.id === dossierId);
  if (!d || d.status !== 'entwurf') throw new Error('Nur Entwürfe können bestätigt werden');
  const team = teamOf(s, d.teamId);
  const match = matchOf(s, d.matchId);
  const prep = s.preparations[d.matchId];
  const t = now();
  d.frozen = structuredClone(applyOverrides(buildDossier(team, match, prep), d.overrides));
  d.status = 'bestätigt';
  d.confirmedAt = t;
  d.updatedAt = t;
  d.confirmationNotes = notes;
  // Kader und Vorlage gelten als zuletzt bestätigt.
  if (prep.squad && prep.squad.players.length) {
    team.lastConfirmedSquad = {
      ...structuredClone(prep.squad),
      confirmedAt: t,
      origin: { kind: 'dossier', dossierId: d.id, label: `Dossier ${d.frozen.meta.matchLabel} (V${d.version})` },
    };
  }
  team.template = { ...team.template, confirmedAt: t };
  team.updatedAt = t;
  return d;
}

export function updatePrep(s: AppState, matchId: string, fn: (p: Preparation) => void): void {
  const p = s.preparations[matchId];
  fn(p);
  p.updatedAt = now();
}

export function deleteMatch(s: AppState, matchId: string): void {
  const m = matchOf(s, matchId);
  if (m.isHistoricalReference) throw new Error('Der Referenzfall kann nur zurückgesetzt werden.');
  s.matches = s.matches.filter((x) => x.id !== matchId);
  delete s.preparations[matchId];
  // Bestätigte Dossiers bleiben im Archiv erhalten.
  s.dossiers = s.dossiers.filter((d) => d.matchId !== matchId || d.status === 'bestätigt');
}
