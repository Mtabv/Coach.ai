import { useState } from 'react';
import type { DossierContent } from '../../dossier/model';
import { saveFile } from '../../export/hostBridge';

/** Dateiname wie beim PowerPoint-Export, nur mit .pdf. */
const dateiname = (c: DossierContent, version?: number) =>
  `Dossier_${c.meta.matchLabel}_${c.meta.dateLabel}${version ? `_V${version}` : ''}`
    // ASCII-sicher wie beim PowerPoint-Export: manche Browser verwerfen Umlaute im Dateinamen
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .replace(/[^A-Za-z0-9.-]+/g, '_').replace(/_+/g, '_') + '.pdf';

/**
 * „PDF herunterladen“: Der Server rendert genau diese Folien mit Chrome (wie die Vorschau) und schickt eine
 * fertige PDF-Datei zurück – ohne Druckdialog, randlos, Querformat.
 */
export function PdfKnopf({ content, version, onMeldung }: { content: DossierContent; version?: number; onMeldung?: (t: string) => void }) {
  const [laeuft, setLaeuft] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-primary"
      disabled={laeuft}
      onClick={async () => {
        setLaeuft(true);
        try {
          const r = await fetch('/api/dossier/pdf', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CoachAI': '1' }, body: JSON.stringify(content) });
          if (!r.ok) {
            const b = (await r.json().catch(() => ({}))) as { fehler?: string };
            throw new Error(b.fehler || 'Die PDF konnte nicht erzeugt werden.');
          }
          // als Datei speichern (nicht im PDF-Betrachter öffnen), damit der Dateiname erhalten bleibt
          await saveFile(dateiname(content, version), new Blob([await r.arrayBuffer()], { type: 'application/octet-stream' }));
          onMeldung?.('PDF heruntergeladen.');
        } catch (e) {
          onMeldung?.((e as Error).message);
        } finally {
          setLaeuft(false);
        }
      }}
    >
      {laeuft ? 'PDF wird erstellt …' : 'PDF herunterladen'}
    </button>
  );
}
