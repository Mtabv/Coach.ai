import { useEffect, useState } from 'react';
import type { DossierContent } from '../../dossier/model';
import { SlideCanvas } from '../dossier/SlideView';

/**
 * Nur für den PDF-Dienst auf dem Server: zeigt die Folien eines Dossiers genau wie die Vorschau, eine Seite
 * je Folie (13,33 × 7,5 Zoll). Den Inhalt setzt der Dienst vor dem Laden in `window.__druckInhalt`;
 * sind alle Bilder und Schriften geladen, meldet die Seite `window.__pdfFertig = true`.
 */
type Fenster = { __druckInhalt?: DossierContent; __pdfFertig?: boolean };

export function PdfAusgabe() {
  const [inhalt] = useState(() => (window as unknown as Fenster).__druckInhalt ?? null);
  useEffect(() => {
    document.body.classList.add('print-mode', 'pdf-ausgabe');
    if (!inhalt) return;
    const bilder = [...document.querySelectorAll<HTMLImageElement>('.print-root img')];
    void Promise.all(bilder.map((b) => (b.complete ? Promise.resolve() : new Promise<void>((r) => { b.onload = b.onerror = () => r(); }))))
      .then(() => document.fonts?.ready)
      .then(() => { (window as unknown as Fenster).__pdfFertig = true; });
  }, [inhalt]);
  if (!inhalt) return <p style={{ padding: 24 }}>Kein Inhalt.</p>;
  return (
    <div className="print-root">
      {inhalt.slides.map((s) => (
        <div key={s.key} className="print-page">
          <SlideCanvas slide={s} content={inhalt} />
        </div>
      ))}
    </div>
  );
}
