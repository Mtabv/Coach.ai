/**
 * Ein Mikrofon pro Eingabemaske der Teamzentrale: die Seite, ein offener Dialog und eigene Karten
 * mit Auswahlfeldern (z. B. „Noten mit Begründung“ in der Nachbereitung).
 * Frei sprechen → Whisper → Claude verteilt auf die Felder der jeweiligen Maske.
 * „Übung erfassen“ hat einen eigenen, genaueren Knopf (kiUebung.ts) und wird hier übersprungen.
 */
import { MIC_SVG } from '../sprache/aufnahme';
import { KI_CSS, MaskenDiktat, diktatMoeglich, felderSammeln, type Eingabe, type MaskenFeld, type Sammeln, type Zustand } from '../sprache/maskenKi';

let zuletzt: Eingabe | null = null;

/** Karten, die eine eigene Maske mit eigenem Knopf bekommen (Felder dort zählen nicht zur Seite). */
const KARTEN: { id: string; finden: () => Element | null; knopf: string; titel: string }[] = [
  { id: 'noten', finden: () => document.querySelector('#main [data-grade]')?.closest('.card') ?? null, knopf: 'Noten diktieren', titel: 'Spielernoten mit Begründung (Schulnoten 1 bis 6)' },
];

interface Maske { id: string; wurzel: Element; titel: string; knopf: string; anker: (box: Element, meldung: Element) => void; sammeln: Sammeln }

/** Einzeilige Felder nur, wenn sie zu den Eingaben gehören (nicht Suche, Uhrzeiten, Zeitplan). */
const auchSeite = (el: HTMLInputElement) => (el.hasAttribute('data-text') || !!el.closest('.modal')) && !el.hasAttribute('data-plan');

function masken(): Maske[] {
  const modal = document.querySelector('.modal');
  if (modal) {
    return [{ id: 'dialog', wurzel: modal, titel: modal.querySelector('h2, h3')?.textContent?.trim() || 'Dialog', knopf: 'Diktieren', sammeln: { auch: auchSeite },
      anker: (box, meldung) => { const kopf = modal.querySelector('.row.between') || modal.firstElementChild; const x = kopf?.querySelector('[data-evclose], .ib'); if (kopf && x) x.before(box); else modal.prepend(box); (kopf || box).after(meldung); } }];
  }
  const main = document.getElementById('main');
  if (!main || main.querySelector('#ue-n')) return [];
  const karten = KARTEN.map((k) => ({ k, el: k.finden() })).filter((x): x is { k: typeof KARTEN[number]; el: Element } => !!x.el);
  const liste: Maske[] = [{ id: 'seite', wurzel: main, titel: main.querySelector('h1')?.textContent?.trim() || document.title, knopf: 'Diktieren', sammeln: { auch: auchSeite, ohne: karten.map((x) => x.el) },
    anker: (box, meldung) => { const kopf = main.querySelector('.head'); if (kopf) { (kopf.querySelector(':scope > .row') || kopf).append(box); kopf.after(meldung); } else { main.prepend(meldung); main.prepend(box); } } }];
  for (const { k, el } of karten) {
    liste.push({ id: k.id, wurzel: el, titel: k.titel, knopf: k.knopf, sammeln: { auch: auchSeite, auswahl: true },
      anker: (box, meldung) => { const kopf = el.querySelector('.row.between') || el.querySelector('h3'); if (kopf) { kopf.append(box); kopf.after(meldung); } else { el.prepend(meldung); el.prepend(box); } } });
  }
  return liste;
}

const steuerungen = new Map<string, MaskenDiktat>();
/** Letzte Meldung je Maske – bleibt erhalten, wenn die Seite neu gezeichnet wird. */
const meldungen = new Map<string, { text: string; art: string }>();
function meldungZeigen(id: string) {
  const m = document.querySelector<HTMLElement>(`.md-meldung[data-maske="${id}"]`); const e = meldungen.get(id);
  if (m) { m.textContent = e?.text || ''; m.className = `md-meldung ${e?.art || ''}`; m.hidden = !e?.text; }
}
const aktuell = new Map<string, Maske>();
const felder = (id: string): MaskenFeld[] => { const m = aktuell.get(id); return m ? felderSammeln(m.wurzel, m.sammeln) : []; };

function zeigen(id: string, z: Zustand) {
  const k = document.querySelector<HTMLButtonElement>(`.masken-diktat[data-maske="${id}"] .md-knopf`); if (!k) return;
  const name = aktuell.get(id)?.knopf || 'Diktieren';
  k.classList.toggle('rec', z.art === 'rec');
  k.disabled = z.art === 'arbeit';
  k.innerHTML = z.art === 'rec' ? `<span class="punkt"></span> Fertig · ${z.zeit}` : z.art === 'arbeit' ? `<span class="kreis"></span> ${z.text}` : `${MIC_SVG} ${name}`;
  k.title = z.art === 'bereit' ? 'Alles für diesen Bereich auf einmal diktieren – die KI verteilt es auf die Felder' : k.textContent || '';
}

function steuerung(id: string): MaskenDiktat {
  let s = steuerungen.get(id);
  if (!s) {
    s = new MaskenDiktat(
      () => aktuell.get(id)?.titel || 'Teamzentrale',
      () => felder(id),
      () => zuletzt,
      (z) => zeigen(id, z),
      (e) => { meldungen.set(id, e); meldungZeigen(id); },
    );
    steuerungen.set(id, s);
  }
  return s;
}

function einbauen() {
  const liste = masken().filter((m) => felderSammeln(m.wurzel, m.sammeln).length);
  aktuell.clear(); liste.forEach((m) => aktuell.set(m.id, m));
  // Knöpfe, deren Maske weg ist oder die nicht mehr in ihrer Maske stecken, entfernen
  document.querySelectorAll<HTMLElement>('.masken-diktat[data-maske], .md-meldung[data-maske]').forEach((x) => {
    const m = aktuell.get(x.dataset.maske || '');
    if (!m || !m.wurzel.contains(x)) x.remove();
  });
  for (const m of liste) {
    if (document.querySelector(`.masken-diktat[data-maske="${m.id}"]`)) continue;
    const box = document.createElement('span');
    box.className = 'masken-diktat'; box.dataset.maske = m.id;
    box.innerHTML = '<button type="button" class="btn ghost md-knopf"></button>';
    const meldung = document.createElement('p');
    meldung.className = 'md-meldung'; meldung.dataset.maske = m.id; meldung.hidden = true;
    m.anker(box, meldung);
    box.querySelector('button')!.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); void steuerung(m.id).umschalten(); });
    zeigen(m.id, steuerung(m.id).zustand);
    meldungZeigen(m.id);
  }
  // Meldungen gelten nur für die Seite, auf der sie entstanden sind.
  for (const id of [...meldungen.keys()]) if (!aktuell.has(id)) meldungen.delete(id);
}

export function maskenDiktatStarten() {
  if (!diktatMoeglich()) return;
  const css = document.createElement('style');
  // Die früheren Mikrofone (je Feld, Entwurfsknöpfe) entfallen: ein Knopf pro Maske.
  css.textContent = `button.mic, .secmic { display: none !important; } .head > .row .masken-diktat, .head > .masken-diktat { margin-left: 4px; }
    .card .row.between .masken-diktat { margin-left: auto; } ${KI_CSS}`;
  document.head.appendChild(css);
  document.addEventListener('focusin', (e) => { const t = e.target; if (t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement) zuletzt = t; });
  einbauen();
  let geplant = false;
  new MutationObserver(() => { if (geplant) return; geplant = true; requestAnimationFrame(() => { geplant = false; einbauen(); }); }).observe(document.body, { childList: true, subtree: true });
}
