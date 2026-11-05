import { useState } from 'react';
import { canConfirm, confirmationChecks } from '../../domain/checks';
import { formatTimestamp } from '../../domain/time';
import type { Match, TeamProfile } from '../../domain/types';
import { href, navigate } from '../../router';
import { confirmDossier, currentDraft, ensureDraft } from '../../state/actions';
import { contentForDossier } from '../../state/selectors';
import { useStore } from '../../state/store';
import { Badge, Card, Notice, Toast } from '../components';

export function ExportTab({ match, team }: { match: Match; team: TeamProfile }) {
  const { state, update } = useStore();
  const prep = state.preparations[match.id];
  const draft = currentDraft(state, match.id);
  const versions = state.dossiers.filter((d) => d.matchId === match.id).sort((a, b) => b.version - a.version);
  const checks = confirmationChecks(team, match, prep);
  const warnings = checks.filter((c) => !c.ok && !c.blocking);
  const [ack, setAck] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ok = canConfirm(checks) && (warnings.length === 0 || ack) && Boolean(draft);

  const exportDraft = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const name = await (await import('../../export/pptx')).downloadPptx(contentForDossier(state, draft)!, draft.version);
      setToast(`PPTX erstellt: ${name}`);
    } catch (e) {
      setToast(`PPTX-Export fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="two-col">
        <Card title="Prüfung vor der Bestätigung">
          <ul className="checks">
            {checks.map((c) => (
              <li key={c.id} className={c.ok ? 'ok' : c.blocking ? 'fail' : 'warn'}>
                <span className="check-icon" aria-hidden>
                  {c.ok ? '✓' : c.blocking ? '✕' : '⚠'}
                </span>
                <span>
                  <strong>{c.label}</strong>
                  {c.detail && <small>{c.detail}</small>}
                  {!c.ok && c.blocking && <small className="fail-text">Erforderlich für die Bestätigung</small>}
                </span>
              </li>
            ))}
          </ul>
          {warnings.length > 0 && (
            <label className="check ack">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              Mir ist bewusst, dass offene und widersprüchliche Angaben im bestätigten Dossier sichtbar markiert bleiben.
            </label>
          )}
          {!draft && <Notice tone="info">Kein offener Entwurf. Öffnen Sie den Schritt „Dossier“, um einen Entwurf anzulegen.</Notice>}
          <div className="row gap wrap">
            <button
              className="btn btn-primary"
              disabled={!ok}
              onClick={() => {
                if (!draft) return;
                const notes = checks.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail ?? ''}`);
                // Die bestätigte Version behält die ID des Entwurfs.
                update((s) => void confirmDossier(s, draft.id, notes));
                navigate({ name: 'archivDossier', dossierId: draft.id });
              }}
            >
              Dossier bestätigen{draft ? ` (V${draft.version})` : ''}
            </button>
          </div>
          <p className="muted small">Entwürfe dürfen unvollständig sein. Eine bestätigte Version wird eingefroren und ändert sich durch spätere Profil- oder Datenänderungen nicht.</p>
        </Card>

        <Card title="Exportieren">
          {draft ? (
            <>
              <p className="small">
                Aktueller Entwurf <Badge tone="info">V{draft.version}</Badge>
              </p>
              <div className="export-actions">
                <button className="btn btn-primary" onClick={exportDraft} disabled={busy}>
                  {busy ? 'Erstellt …' : 'PPTX herunterladen'}
                </button>
                <a className="btn" href={href({ name: 'druck', dossierId: draft.id })} target="_blank" rel="noreferrer">
                  Druckansicht öffnen · Als PDF speichern
                </a>
              </div>
              <p className="muted small">PPTX: editierbare Textfelder und native Tabellen (PptxGenJS). PDF: über die Druckansicht und „Als PDF speichern“ im Druckdialog des Browsers.</p>
            </>
          ) : (
            <button className="btn" onClick={() => update((s) => void ensureDraft(s, match.id))}>
              Neuen Entwurf anlegen
            </button>
          )}
        </Card>
      </div>

      <Card title="Versionen dieser Begegnung">
        {versions.length === 0 ? (
          <p className="muted">Noch keine Versionen.</p>
        ) : (
          <ul className="archive-list">
            {versions.map((d) => (
              <li key={d.id}>
                <a className="archive-item" href={d.status === 'bestätigt' ? href({ name: 'archivDossier', dossierId: d.id }) : href({ name: 'spiel', matchId: match.id, tab: 'dossier' })}>
                  <span>
                    <strong>Version V{d.version}</strong>
                    <small>{d.status === 'bestätigt' ? `bestätigt ${formatTimestamp(d.confirmedAt)}` : `Entwurf, geändert ${formatTimestamp(d.updatedAt)}`}</small>
                  </span>
                  <Badge tone={d.status === 'bestätigt' ? 'ok' : 'info'}>{d.status}</Badge>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
