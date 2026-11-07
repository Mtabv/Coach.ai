import { CHOOSABLE_SLIDES, chosenSlides, effectivePhaseModel, PHASE_MODEL_LABELS } from '../../domain/dossierOptions';
import type { Match, PhaseModel, Preparation, SlideKey, TeamProfile } from '../../domain/types';
import { updatePrep } from '../../state/actions';
import { useStore } from '../../state/store';
import { Card, Segmented } from '../components';

export const SLIDE_NAMES: Record<SlideKey, string> = {
  titel: 'Titelseite',
  inhalt: 'Was euch erwartet',
  spieltag: 'Der Spieltag',
  unserSpiel: 'Unser Spiel',
  gegnerForm: 'Der Gegner · Form',
  gegnerGefahr: 'Der Gegner · Gefahr',
  gegnerAuffaelligkeiten: 'Der Gegner · Auffälligkeiten',
  soSpieltGegner: 'So spielt der Gegner',
  soSpielenWir: 'So spielen wir',
  unsereForm: 'Unsere Form',
  kader: 'Unser Kader',
  auftrag: 'Unser Auftrag',
};

const PHASE_OPTIONS: { value: PhaseModel; label: string }[] = (['gegner', 'eigene', 'beides'] as const).map((value) => ({ value, label: PHASE_MODEL_LABELS[value] }));

export const PHASE_HELP = '„So spielen wir“: unser Plan je Spielphase. „Beides“: zwei Folien – erst der Gegner, dann unser Plan. Die passenden Fragen erscheinen im Trainerfragebogen.';

/** Spielphasenmodell und Folienauswahl – im Mannschaftsprofil als Standard, je Spiel überschreibbar. */
export function DossierOptionsFields({ phaseModel, slides, onPhaseModel, onToggle }: { phaseModel: PhaseModel; slides: SlideKey[]; onPhaseModel: (m: PhaseModel) => void; onToggle: (k: SlideKey, on: boolean) => void }) {
  return (
    <>
      <div className="field">
        <span className="field-label">Spielphasenmodell</span>
        <Segmented label="Blickwinkel des Spielphasenmodells" value={phaseModel} onChange={onPhaseModel} options={PHASE_OPTIONS} />
        <span className="muted small">{PHASE_HELP}</span>
      </div>
      <div className="field">
        <span className="field-label">Folien</span>
        <div className="check-grid">
          {CHOOSABLE_SLIDES.map((k) => (
            <label key={k} className="check">
              <input type="checkbox" checked={slides.includes(k)} disabled={k === 'auftrag'} onChange={(e) => onToggle(k, e.target.checked)} />
              {SLIDE_NAMES[k]}
            </label>
          ))}
        </div>
        <span className="muted small">Titel und Inhaltsverzeichnis sind immer dabei; das Inhaltsverzeichnis und die Seitenzahlen passen sich an.</span>
      </div>
    </>
  );
}

export function DossierOptionsCard({ match, team, prep }: { match: Match; team: TeamProfile; prep: Preparation }) {
  const { update } = useStore();
  const set = (fn: (p: Preparation) => void) => update((s) => updatePrep(s, match.id, fn));
  const phaseModel = effectivePhaseModel(team, prep);
  const slides = chosenSlides(team, prep);
  const custom = Boolean(prep.dossierOptions?.phaseModel || prep.dossierOptions?.slides);
  return (
    <Card title="Aufbau dieses Dossiers">
      <p className="muted small">
        Gilt nur für dieses Spiel. Voreinstellung aus dem Mannschaftsprofil: {PHASE_MODEL_LABELS[team.phaseModel ?? 'gegner']}, {chosenSlides(team).length + 2 + (team.phaseModel === 'beides' ? 2 : 1)} Folien.
      </p>
      <DossierOptionsFields
        phaseModel={phaseModel}
        slides={slides}
        onPhaseModel={(m) => set((p) => void (p.dossierOptions = { ...p.dossierOptions, phaseModel: m }))}
        onToggle={(k, on) =>
          set((p) => {
            const cur = chosenSlides(team, p);
            p.dossierOptions = { ...p.dossierOptions, slides: CHOOSABLE_SLIDES.filter((x) => (x === k ? on : cur.includes(x))) };
          })
        }
      />
      {custom && (
        <button type="button" className="btn btn-small" onClick={() => set((p) => void delete p.dossierOptions)}>
          Auf Voreinstellung zurücksetzen
        </button>
      )}
    </Card>
  );
}
