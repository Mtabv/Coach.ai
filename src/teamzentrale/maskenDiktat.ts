/**
 * Ein Mikrofon pro Eingabemaske der Teamzentrale (Seite oder offener Dialog).
 * Frei sprechen → Whisper → Claude verteilt auf alle Textfelder der Maske.
 * „Übung erfassen“ hat einen eigenen, genaueren Knopf (kiUebung.ts) und wird hier übersprungen.
 */
import { MIC_SVG } from '../sprache/aufnahme';
import { KI_CSS, MaskenDiktat, diktatMoeglich, felderSammeln, type Eingabe, type Zustand } from '../sprache/maskenKi';

let zuletzt: Eingabe | null = null;

/** Die gerade aktive Maske: ein offener Dialog, sonst die Seite. */
function maske(): { wurzel: Element; titel: string } | null {
  const modal = document.querySelector('.modal');
  if (modal) return { wurzel: modal, titel: modal.querySelector('h2, h3')?.textContent?.trim() || 'Dialog' };
  const main = document.getElementById('main');
  if (!main || main.querySelector('#ue-n')) return null;
  return { wurzel: main, titel: main.querySelector('h1')?.textContent?.trim() || document.title };
}
/** Einzeilige Felder nur, wenn sie zu den Eingaben gehören (nicht Suche, Uhrzeiten, Zeitplan). */
const auch = (el: HTMLInputElement) => (el.hasAttribute('data-text') || !!el.closest('.modal')) && !el.hasAttribute('data-plan');
const felder = () => { const m = maske(); return m ? felderSammeln(m.wurzel, auch) : []; };

const steuerung = new MaskenDiktat(
  () => maske()?.titel || 'Teamzentrale',
  felder,
  () => zuletzt,
  (z) => zeigen(z),
  (e) => { const m = document.querySelector<HTMLElement>('.md-meldung'); if (m) { m.textContent = e.text; m.className = `md-meldung ${e.art}`; m.hidden = !e.text; } },
);

function zeigen(z: Zustand) {
  const k = document.querySelector<HTMLButtonElement>('.masken-diktat .md-knopf'); if (!k) return;
  k.classList.toggle('rec', z.art === 'rec');
  k.disabled = z.art === 'arbeit';
  k.innerHTML = z.art === 'rec' ? `<span class="punkt"></span> Fertig · ${z.zeit}` : z.art === 'arbeit' ? `<span class="kreis"></span> ${z.text}` : `${MIC_SVG} Diktieren`;
  k.title = z.art === 'bereit' ? 'Alles für diese Seite auf einmal diktieren – die KI verteilt es auf die Felder' : k.textContent || '';
}

function einbauen() {
  const m = maske();
  const vorhanden = document.querySelector('.masken-diktat');
  if (!m || !felder().length) { vorhanden?.remove(); document.querySelector('.md-meldung')?.remove(); return; }
  if (vorhanden && m.wurzel.contains(vorhanden)) return;
  vorhanden?.remove(); document.querySelector('.md-meldung')?.remove();
  const box = document.createElement('span');
  box.className = 'masken-diktat';
  box.innerHTML = '<button type="button" class="btn ghost md-knopf"></button>';
  const meldung = document.createElement('p');
  meldung.className = 'md-meldung'; meldung.hidden = true;
  if (m.wurzel.classList.contains('modal')) {
    const kopf = m.wurzel.querySelector('.row.between') || m.wurzel.firstElementChild;
    const schliessen = kopf?.querySelector('[data-evclose], .ib');
    if (kopf && schliessen) schliessen.before(box); else m.wurzel.prepend(box);
    (kopf || box).after(meldung);
  } else {
    const kopf = m.wurzel.querySelector('.head');
    if (kopf) { (kopf.querySelector(':scope > .row') || kopf).append(box); kopf.after(meldung); }
    else { m.wurzel.prepend(meldung); m.wurzel.prepend(box); }
  }
  box.querySelector('button')!.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); void steuerung.umschalten(); });
  zeigen(steuerung.zustand);
}

export function maskenDiktatStarten() {
  if (!diktatMoeglich()) return;
  const css = document.createElement('style');
  // Die früheren Mikrofone (je Feld, Entwurfsknöpfe) entfallen: ein Knopf pro Maske.
  css.textContent = `button.mic, .secmic { display: none !important; } .head > .row .masken-diktat, .head > .masken-diktat { margin-left: 4px; } ${KI_CSS}`;
  document.head.appendChild(css);
  document.addEventListener('focusin', (e) => { const t = e.target; if (t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement) zuletzt = t; });
  einbauen();
  let geplant = false;
  new MutationObserver(() => { if (geplant) return; geplant = true; requestAnimationFrame(() => { geplant = false; einbauen(); }); }).observe(document.body, { childList: true, subtree: true });
}
