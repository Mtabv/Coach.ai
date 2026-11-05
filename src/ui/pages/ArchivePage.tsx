import { useState } from 'react';
import { formatTimestamp } from '../../domain/time';
import { href, navigate } from '../../router';
import { ensureDraft } from '../../state/actions';
import { useStore } from '../../state/store';
import { Badge, Card, DemoBadge, Notice, Toast } from '../components';
import { ScaledSlide } from '../dossier/SlideView';

export function ArchivePage() {
  const { state } = useStore();
  const confirmed = state.dossiers.filter((d) => d.status === 'bestätigt').sort((a, b) => (b.confirmedAt ?? '').localeCompare(a.confirmedAt ?? ''));
  const drafts = state.dossiers.filter((d) => d.status === 'entwurf');
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Archiv</p>
          <h1>Bisherige Dossiers</h1>
          <p className="muted">Bestätigte Versionen sind eingefroren und ändern sich nicht durch spätere Profil- oder Datenänderungen.</p>
        </div>
      </div>
      <Card title={`Bestätigte Dossiers (${confirmed.length})`}>
        {confirmed.length === 0 ? (
          <p className="muted">Noch keine bestätigten Dossiers.</p>
        ) : (
          <ul className="archive-list">
            {confirmed.map((d) => {
              const team = state.teams.find((t) => t.id === d.teamId);
              return (
                <li key={d.id}>
                  <a className="archive-item" href={href({ name: 'archivDossier', dossierId: d.id })}>
                    <span>
                      <strong>{d.frozen?.meta.matchLabel}</strong>
                      <small>
                        {team?.name ?? d.frozen?.meta.teamName} · {d.frozen?.meta.competition} · {d.frozen?.meta.dateLabel}
                      </small>
                    </span>
                    <span className="archive-meta">
                      {d.frozen?.meta.isHistoricalReference && <Badge tone="dark">Referenz</Badge>}
                      <Badge tone="ok">V{d.version}</Badge>
                      <small>{formatTimestamp(d.confirmedAt)}</small>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {drafts.length > 0 && (
        <Card title={`Offene Entwürfe (${drafts.length})`}>
          <ul className="archive-list">
            {drafts.map((d) => {
              const m = state.matches.find((x) => x.id === d.matchId);
              return (
                <li key={d.id}>
                  <a className="archive-item" href={href({ name: 'spiel', matchId: d.matchId, tab: 'dossier' })}>
                    <span>
                      <strong>{m ? `${m.isHome ? 'Heim' : 'Auswärts'} gegen ${m.opponent}` : 'Begegnung'}</strong>
                      <small>Entwurf V{d.version} · geändert {formatTimestamp(d.updatedAt)}</small>
                    </span>
                    <Badge tone="info">Entwurf</Badge>
                  </a>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

export function ArchiveDossierPage({ dossierId }: { dossierId: string }) {
  const { state, update } = useStore();
  const d = state.dossiers.find((x) => x.id === dossierId);
  const [toast, setToast] = useState<string | null>(null);
  if (!d || d.status !== 'bestätigt' || !d.frozen) {
    return (
      <div className="page">
        <Notice tone="warn" title="Dossier nicht gefunden">
          Diese Version existiert nicht oder ist noch ein Entwurf. <a href={href({ name: 'archiv' })}>Zum Archiv</a>
        </Notice>
      </div>
    );
  }
  const content = d.frozen;
  const matchExists = state.matches.some((m) => m.id === d.matchId);
  const hasDraft = state.dossiers.some((x) => x.matchId === d.matchId && x.status === 'entwurf');
  return (
    <div className="page">
      <a className="back" href={href({ name: 'archiv' })}>
        ← Archiv
      </a>
      <div className="page-head">
        <div>
          <p className="eyebrow">Bestätigtes Dossier · V{d.version}</p>
          <h1>{content.meta.matchLabel}</h1>
          <div className="row gap wrap">
            <span className="muted">
              {content.meta.competition} · {content.meta.dateLabel} · bestätigt {formatTimestamp(d.confirmedAt)}
            </span>
            {content.meta.isHistoricalReference && <Badge tone="dark">Historische Referenz</Badge>}
            {content.meta.containsDemoData && <DemoBadge />}
            <Badge tone="ok">eingefroren</Badge>
          </div>
        </div>
        <div className="row gap wrap">
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                const name = await (await import('../../export/pptx')).downloadPptx(content, d.version);
                setToast(`PPTX erstellt: ${name}`);
              } catch (e) {
                setToast(`PPTX: ${(e as Error).message}`);
              }
            }}
          >
            PPTX herunterladen
          </button>
          <a className="btn" href={href({ name: 'druck', dossierId: d.id })}>
            Druckansicht · Als PDF speichern
          </a>
          {matchExists && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                update((s) => void ensureDraft(s, d.matchId));
                navigate({ name: 'spiel', matchId: d.matchId, tab: 'dossier' });
              }}
            >
              {hasDraft ? 'Zum offenen Entwurf' : 'Als neue Version bearbeiten'}
            </button>
          )}
        </div>
      </div>
      {d.confirmationNotes.length > 0 && (
        <Notice tone="warn" title="Bei der Bestätigung offene Punkte">
          <ul>
            {d.confirmationNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Notice>
      )}
      <div className="archive-slides">
        {content.slides.map((s) => (
          <ScaledSlide key={s.key} slide={s} content={content} />
        ))}
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
