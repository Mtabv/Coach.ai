import { useEffect } from 'react';
import { contentForDossier } from '../../state/selectors';
import type { AppState } from '../../domain/types';
import { useStore } from '../../state/store';
import { href } from '../../router';
import { SlideCanvas } from '../dossier/SlideView';
import { isEmbeddedHost } from '../../export/hostBridge';

/** Druckansicht: jede Seite im Format 13,33 × 7,5 Zoll (16:9). „Als PDF speichern“ im Druckdialog. */
export function PrintPage({ dossierId }: { dossierId: string }) {
  const store = useStore();
  // Aus der Teamzentrale geöffnet: genau den Stand nehmen, den der Trainer gerade sieht
  const vonDort = (() => { try { return (window.opener as { __11planDruckStand?: AppState } | null)?.__11planDruckStand ?? null; } catch { return null; } })();
  const state = vonDort ?? store.state;
  const d = state.dossiers.find((x) => x.id === dossierId);
  const content = d ? contentForDossier(state, d) : null;
  useEffect(() => {
    document.body.classList.add('print-mode');
    return () => document.body.classList.remove('print-mode');
  }, []);
  useEffect(() => {
    if (!content || !new URLSearchParams(window.location.search).has('drucken')) return;
    let aus = false;
    const bilder = [...document.querySelectorAll<HTMLImageElement>('.print-root img')];
    void Promise.all(bilder.map((b) => (b.complete ? Promise.resolve() : b.decode().catch(() => undefined))))
      .then(() => document.fonts?.ready)
      .then(() => { if (!aus) window.setTimeout(() => window.print(), 300); });
    return () => { aus = true; };
  }, [content]);
  if (!d || !content) return <p style={{ padding: 24 }}>Dossier nicht gefunden.</p>;
  return (
    <div className="print-root">
      <div className="print-toolbar no-print">
        <div>
          <strong>Druckansicht</strong> · {content.meta.matchLabel} · {d.status === 'bestätigt' ? `bestätigte Version V${d.version}` : `Entwurf V${d.version}`}
          <div className="small">
            {isEmbeddedHost()
              ? 'In dieser eingebetteten Vorschau ist der Druckdialog gesperrt. PDF-Ausgabe: lokal gestartete Version verwenden oder die PPTX in PowerPoint als PDF speichern.'
              : 'Im Druckdialog „Als PDF speichern“ wählen, Querformat und Ränder „Keine“. Hintergrundgrafiken aktivieren.'}
          </div>
        </div>
        <div className="row gap">
          <button className="btn btn-primary" disabled={isEmbeddedHost()} onClick={() => window.print()}>
            Als PDF speichern / Drucken
          </button>
          <a className="btn" href={d.status === 'bestätigt' ? href({ name: 'archivDossier', dossierId: d.id }) : href({ name: 'spiel', matchId: d.matchId, tab: 'export' })}>
            Zurück
          </a>
        </div>
      </div>
      {d.status === 'entwurf' && <div className="print-draft no-print">Entwurf – noch nicht bestätigt</div>}
      {content.slides.map((s) => (
        <div key={s.key} className="print-page">
          <SlideCanvas slide={s} content={content} />
        </div>
      ))}
    </div>
  );
}
