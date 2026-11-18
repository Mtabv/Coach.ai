/**
 * Wer hat was zuletzt geändert? Für jedes Feld (Texte, Noten, Bewertungen), jede Trainingseinheit und
 * jede Übung wird beim Speichern festgehalten, welcher Trainer es zuletzt geändert hat und wann.
 * Erkannt werden nur eigene Änderungen (Vergleich mit dem zuletzt gemerkten Stand); was vom anderen
 * Trainer hereinkommt, bringt dessen Stempel schon mit. Gespeichert in state.autoren:
 *   { "<schlüssel>": { v: "Name", t: "2026-11-16T19:20:00.000Z" } }
 * Anzeige: farbiger Rand am Feld, darunter „✎ Name · Datum Uhrzeit“, Stempel in Training und Übung,
 * Punkt im Kalender, Legende in der Seitenleiste.
 */
type Obj = Record<string, unknown>;
type Stempel = { v: string; t: string };

const global = (n: string): unknown => { try { return (0, eval)(n); } catch { return undefined; } };
const isObj = (v: unknown): v is Obj => Object.prototype.toString.call(v) === '[object Object]';
const ser = (v: unknown) => JSON.stringify(v, (_k, x) => (x instanceof Set ? [...x].sort() : x instanceof Map ? [...x] : x));

/** Teile von state, die je Eintrag zwei Ebenen tief verfolgt werden (z. B. Note je Spiel und Spieler). */
const ZWEI_EBENEN = new Set(['grades', 'phaseRating']);
/** Nicht verfolgen: reine Ansicht, Hilfsdaten, die Stempel selbst. */
const OHNE = new Set(['autoren', 'texts', 'imgs', 'flash', 'flashNext']);

function fingerabdruck(): Map<string, string> {
  const m = new Map<string, string>();
  const state = global('state');
  if (isObj(state)) {
    if (isObj(state.texts)) for (const [k, v] of Object.entries(state.texts)) m.set(`t:${k}`, String(v ?? ''));
    for (const [k, v] of Object.entries(state)) {
      if (OHNE.has(k) || !isObj(v)) continue;
      for (const [sub, w] of Object.entries(v)) {
        if (ZWEI_EBENEN.has(k) && isObj(w)) for (const [s2, x] of Object.entries(w)) m.set(`s:${k}:${sub}:${s2}`, ser(x));
        else m.set(`s:${k}:${sub}`, ser(w));
      }
    }
  }
  const events = global('events');
  if (Array.isArray(events)) for (const e of events) if (isObj(e) && e.id) m.set(`ev:${e.id}`, ser(e));
  const exercises = global('exercises'), EXD = global('EXD');
  if (Array.isArray(exercises)) for (const x of exercises) if (isObj(x) && x.id) m.set(`ex:${x.id}`, ser([x, isObj(EXD) ? EXD[String(x.id)] : null]));
  return m;
}

let ich = '';
let basis: Map<string, string> | null = null;

/** Aktuellen Stand als „nicht von mir“ merken (nach dem Laden oder nach Änderungen des anderen Trainers). */
export function autorenMerken() { basis = fingerabdruck(); }

/** Eigene Änderungen seit dem letzten Merken mit Name und Zeit stempeln. */
export function autorenStempeln() {
  const state = global('state');
  if (!ich || !basis || !isObj(state)) return;
  const jetzt = fingerabdruck(), t = new Date().toISOString();
  let autoren = isObj(state.autoren) ? (state.autoren as Record<string, Stempel>) : null;
  for (const [k, v] of jetzt) {
    if (basis.get(k) === v) continue;
    // Neu angelegte, aber leere Einträge und Vorbelegungen der Seite (z. B. Kleidung aus dem Profil) sind keine Änderung.
    if (!basis.has(k) && (['', '[]', '{}', 'null', '""', 'false'].includes(v) || k.startsWith('t:kleidung-') || /^t:talk-.*-(anlass|ziel)$/.test(k))) continue;
    if (!autoren) { autoren = {}; state.autoren = autoren; }
    autoren[k] = { v: ich, t };
  }
  basis = jetzt;
}

// ---------- Anzeige ----------
const FARBEN = ['#5ec29a', '#5aa9ff', '#f0a35e', '#c08cf0', '#e8d25a'];
const farbe = new Map<string, string>();
const vorname = (n: string) => n.trim().split(/\s+/)[0] || n;
const farbeVon = (n: string) => { if (!farbe.has(n)) farbe.set(n, FARBEN[farbe.size % FARBEN.length]); return farbe.get(n)!; };
const wann = (iso: string) => {
  const d = new Date(iso), heute = new Date();
  const tag = d.toDateString() === heute.toDateString() ? 'heute' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return `${tag} ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
};
const autoren = (): Record<string, Stempel> => { const s = global('state'); return isObj(s) && isObj(s.autoren) ? (s.autoren as Record<string, Stempel>) : {}; };

/** Schlüssel des Feldes in state.autoren. */
function feldSchluessel(el: HTMLElement): string | null {
  const d = el.dataset;
  if (d.text) return `t:${d.text}`;
  if (d.grade) { const [g, p] = d.grade.split('|'); return `s:grades:${g}:${p}`; }
  if (d.phrate) { const [g, q] = d.phrate.split('|'); return `s:phaseRating:${g}:${q}`; }
  return null;
}

/** Neuester Stempel unter allen Schlüsseln, die zu einer Kennung gehören (z. B. eine Trainingseinheit). */
function neuester(id: string): Stempel | null {
  let best: Stempel | null = null;
  for (const [k, s] of Object.entries(autoren())) if (k.includes(id) && (!best || s.t > best.t)) best = s;
  return best;
}

const zeile = (s: Stempel) => `<span class="autor-punkt" style="background:${farbeVon(s.v)}"></span>${vorname(s.v)} · ${wann(s.t)}`;

function felderZeigen() {
  const a = autoren();
  document.querySelectorAll<HTMLElement>('#main [data-text], #main [data-grade], #main [data-phrate], .modal [data-text]').forEach((el) => {
    const k = feldSchluessel(el); if (!k) return;
    const s = a[k], sig = s ? `${s.v}|${s.t}` : '';
    if (el.dataset.autorSig === sig) return;
    el.dataset.autorSig = sig;
    let z = el.nextElementSibling as HTMLElement | null;
    if (!z || !z.classList.contains('autor-zeile')) z = null;
    if (!s) { el.style.removeProperty('box-shadow'); z?.remove(); return; }
    el.style.boxShadow = `inset 3px 0 0 ${farbeVon(s.v)}`;
    el.title = `Zuletzt geändert von ${s.v}, ${wann(s.t)}`;
    if (!z) { z = document.createElement('span'); z.className = 'autor-zeile'; el.after(z); }
    z.innerHTML = `✎ ${zeile(s)}`;
  });
}

function stempelZeigen() {
  const hash = location.hash.slice(1), state = global('state') as Obj | undefined;
  const id = hash === 'einheit' ? String(state?.trainEv ?? '') : hash === 'uebung' ? String(state?.exId ?? '') : '';
  const kopf = document.querySelector('#main .head');
  let box = document.querySelector<HTMLElement>('#main .autor-stempel');
  if (!id || !kopf) { box?.remove(); return; }
  const s = neuester(id);
  const text = s ? `Zuletzt bearbeitet von <b>${vorname(s.v)}</b> am ${new Date(s.t).toLocaleDateString('de-DE')} um ${new Date(s.t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
    : (hash === 'einheit' ? 'Noch von keinem Trainer bearbeitet – automatisch angelegt oder vor Einführung der Stempel geplant.' : 'Noch von keinem Trainer bearbeitet.');
  const html = `${s ? `<span class="autor-punkt" style="background:${farbeVon(s.v)}"></span>` : '<span class="autor-punkt leer"></span>'}${text}`;
  if (!box) { box = document.createElement('p'); box.className = 'autor-stempel'; kopf.after(box); }
  if (box.innerHTML !== html) box.innerHTML = html;
}

/** Punkt mit Farbe und Vorname an Trainingskarten in Kalender und Dashboard. */
function kalenderZeigen() {
  document.querySelectorAll<HTMLElement>('#main [data-open], #main a.ev.tr[data-settrain]').forEach((el) => {
    const id = el.dataset.open || el.dataset.settrain || '';
    const s = id ? neuester(id) : null, sig = s ? `${s.v}|${s.t}` : '';
    if (el.dataset.autorSig === sig) return;
    el.dataset.autorSig = sig;
    el.querySelector(':scope > .autor-mini')?.remove();
    if (!s) return;
    const m = document.createElement('span');
    m.className = 'autor-mini'; m.title = `Zuletzt bearbeitet von ${s.v}, ${wann(s.t)}`;
    m.innerHTML = `<span class="autor-punkt" style="background:${farbeVon(s.v)}"></span>${vorname(s.v)}`;
    el.appendChild(m);
  });
}

function legende() {
  if (farbe.size < 2) return;
  const side = document.querySelector('aside.side, .side');
  if (!side) return;
  let l = side.querySelector<HTMLElement>('.autor-legende');
  if (l && l.dataset.anzahl === String(farbe.size)) return;
  if (!l) { l = document.createElement('div'); l.className = 'autor-legende'; side.appendChild(l); }
  l.dataset.anzahl = String(farbe.size);
  l.innerHTML = `Zuletzt geändert von: ${[...farbe].map(([n, f]) => `<span><span class="autor-punkt" style="background:${f}"></span>${vorname(n)}</span>`).join(' ')}`;
}

function zeigen() { felderZeigen(); stempelZeigen(); kalenderZeigen(); legende(); }

export async function autorenStarten(name: string) {
  ich = name;
  (window as unknown as { __11planIch?: string }).__11planIch = name;
  try {
    const t = await (await fetch('/api/team', { credentials: 'same-origin' })).json() as { nutzer?: { name: string }[] };
    (t.nutzer ?? []).forEach((u, i) => farbe.set(u.name, FARBEN[i % FARBEN.length]));
  } catch { /* ohne Liste: Farben nach Reihenfolge des Auftretens */ }
  if (!farbe.has(name)) farbe.set(name, FARBEN[farbe.size % FARBEN.length]);
  const css = document.createElement('style');
  css.textContent = `
    .autor-zeile { display: block; margin-top: 3px; font-size: 11.5px; line-height: 1.3; color: var(--muted, #9aa); }
    .autor-punkt { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; vertical-align: baseline; }
    .autor-punkt.leer { border: 1px solid var(--muted, #9aa); }
    .autor-stempel { margin: 0 0 10px; font-size: 13px; color: var(--muted, #9aa); }
    .autor-mini { display: inline-flex; align-items: center; font-size: 11px; color: var(--muted, #9aa); margin-top: 2px; }
    .autor-legende { margin-top: 10px; font-size: 12px; color: var(--muted, #9aa); display: flex; flex-wrap: wrap; gap: 4px 10px; }
  `;
  document.head.appendChild(css);
  zeigen();
  let geplant = false;
  new MutationObserver(() => { if (geplant) return; geplant = true; requestAnimationFrame(() => { geplant = false; zeigen(); }); }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => setTimeout(zeigen, 50));
  setInterval(zeigen, 2000);
}
