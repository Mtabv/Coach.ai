import { useEffect, useMemo, useRef, useState } from 'react';
import { MIC_SVG } from '../../sprache/aufnahme';
import { KI_CSS, MaskenDiktat, diktatMoeglich, felderSammeln, type Eingabe, type Ergebnis, type Zustand } from '../../sprache/maskenKi';
import { isEmbeddedHost } from '../../export/hostBridge';

let cssDa = false;
let zuletzt: Eingabe | null = null;

/**
 * Ein Mikrofon pro Seite des Dossiers: alles am Stück sprechen, die KI verteilt auf die Textfelder dieser Seite.
 * Erfasst wird beim Klick, was gerade sichtbar ist (nächstes Element mit Klasse „page“).
 */
export function MaskenDiktatKnopf({ titel }: { titel: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [z, setZ] = useState<Zustand>({ art: 'bereit' });
  const [e, setE] = useState<Ergebnis>({ text: '', art: '' });
  const an = diktatMoeglich() && !isEmbeddedHost() && /^https?:$/.test(window.location.protocol);

  useEffect(() => {
    if (!an) return;
    if (!cssDa) { const s = document.createElement('style'); s.textContent = KI_CSS; document.head.appendChild(s); cssDa = true; }
    const f = (ev: FocusEvent) => { const t = ev.target; if (t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement) zuletzt = t; };
    document.addEventListener('focusin', f);
    return () => document.removeEventListener('focusin', f);
  }, [an]);

  const steuerung = useMemo(() => new MaskenDiktat(
    () => titel,
    () => { const w = ref.current?.closest('.page') || document.querySelector('.main'); return w ? felderSammeln(w) : []; },
    () => zuletzt,
    setZ,
    setE,
  ), [titel]);

  if (!an) return null;
  return (
    <span className="masken-diktat" ref={ref}>
      <button type="button" className={`btn md-knopf ${z.art === 'rec' ? 'rec' : ''}`} disabled={z.art === 'arbeit'} onClick={() => void steuerung.umschalten()}
        title="Alles für diese Seite auf einmal diktieren – die KI verteilt es auf die Felder">
        {z.art === 'rec' ? <><span className="punkt" /> Fertig · {z.zeit}</> : z.art === 'arbeit' ? <><span className="kreis" /> {z.text}</> : <><span dangerouslySetInnerHTML={{ __html: MIC_SVG }} /> Diktieren</>}
      </button>
      {e.text && <span className={`md-meldung ${e.art}`}>{e.text}</span>}
    </span>
  );
}
