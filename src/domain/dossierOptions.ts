import { ALL_SLIDES } from './factory';
import type { PhaseModel, Preparation, SlideKey, TeamProfile } from './types';

/**
 * Aufbau eines Dossiers: Das Mannschaftsprofil liefert die Standards, jedes Spiel kann sie überschreiben.
 * Titel und Inhalt sind immer dabei; welche Spielphasen-Folie(n) erscheinen, folgt aus dem Phasenmodell.
 */

export const PHASE_SLIDES: SlideKey[] = ['soSpieltGegner', 'soSpielenWir'];
export const FIXED_SLIDES: SlideKey[] = ['titel', 'inhalt'];
/** Folien, die der Trainer ein- und ausblenden kann. */
export const CHOOSABLE_SLIDES: SlideKey[] = ALL_SLIDES.filter((k) => !PHASE_SLIDES.includes(k) && !FIXED_SLIDES.includes(k));

export const PHASE_MODEL_LABELS: Record<PhaseModel, string> = {
  gegner: 'So spielt der Gegner',
  eigene: 'So spielen wir',
  beides: 'Beides',
};

export function effectivePhaseModel(team: Pick<TeamProfile, 'phaseModel'>, prep?: Pick<Preparation, 'dossierOptions'> | null): PhaseModel {
  return prep?.dossierOptions?.phaseModel ?? team.phaseModel ?? 'gegner';
}

export function showsOpponentPhases(m: PhaseModel): boolean {
  return m !== 'eigene';
}

export function showsOwnPhases(m: PhaseModel): boolean {
  return m !== 'gegner';
}

/** Gewählte Folien ohne Titel/Inhalt/Spielphasen – aus dem Spiel, sonst aus der Vorlage des Profils. */
export function chosenSlides(team: Pick<TeamProfile, 'template'>, prep?: Pick<Preparation, 'dossierOptions'> | null): SlideKey[] {
  const base = prep?.dossierOptions?.slides ?? team.template.slides;
  return CHOOSABLE_SLIDES.filter((k) => base.includes(k));
}

/** Alle Folien des Dossiers in fester Reihenfolge. */
export function effectiveSlides(team: Pick<TeamProfile, 'template' | 'phaseModel'>, prep?: Pick<Preparation, 'dossierOptions'> | null): SlideKey[] {
  const m = effectivePhaseModel(team, prep);
  const chosen = new Set(chosenSlides(team, prep));
  return ALL_SLIDES.filter((k) => {
    if (FIXED_SLIDES.includes(k)) return true;
    if (k === 'soSpieltGegner') return showsOpponentPhases(m);
    if (k === 'soSpielenWir') return showsOwnPhases(m);
    return chosen.has(k);
  });
}
