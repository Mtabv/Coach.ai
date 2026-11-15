/**
 * Diktieren in jedes Textfeld der Teamzentrale.
 * An jedem Feld genau ein Mikrofon-Symbol: antippen, sprechen, nochmal antippen – der Text wird ans Feld angehängt.
 * Die Aufnahme geht an den eigenen Server (/api/sprache, Whisper) und wird dort nicht gespeichert.
 * Die alten Entwurfsknöpfe („Sprechen“, „Sprachnachricht“, „Sprachaufnahme“) werden ausgeblendet.
 */
import { MAX_SEKUNDEN, MIC_SVG, anhaengen, aufnahmeStarten, dauer, diktatMoeglich, inText, type Aufnahme } from '../sprache/aufnahme';

type Feld = HTMLTextAreaElement | HTMLInputElement;
let aktiv: { schluessel: string; aufnahme: Aufnahme; uhr: number } | null = null;
/** Felder, deren Aufnahme gerade umgewandelt wird. */
const inArbeit = new Set<string>();
const FELDER = 'textarea, input[type="text"][data-text]';

/** Stabiler Schlüssel, um das Feld nach einem Neuzeichnen wiederzufinden. */
function schluessel(t: Feld): string {
  if (t.id) return `#${CSS.escape(t.id)}`;
  const attrs = [...t.attributes].filter((a) => a.name.startsWith('data-') && !a.name.startsWith('data-diktat'));
  if (attrs.length) return t.tagName.toLowerCase() + attrs.map((a) => `[${a.name}="${CSS.escape(a.value)}"]`).join('');
  return '';
}
const feldVon = (s: string) => (s ? document.querySelector<Feld>(s) : null);
const knopfVon = (s: string) => document.querySelector<HTMLButtonElement>(`button.diktat[data-diktat-fuer="${CSS.escape(s)}"]`);

function zeigen(k: HTMLButtonElement | null, zustand: 'bereit' | 'rec' | 'arbeit' | 'fehler', text = '') {
  if (!k) return;
  k.classList.toggle('rec', zustand === 'rec');
  k.classList.toggle('arbeit', zustand === 'arbeit');
  k.classList.toggle('fehler', zustand === 'fehler');
  k.disabled = zustand === 'arbeit';
  k.innerHTML = zustand === 'rec' ? `<span class="punkt"></span>${text}` : zustand === 'arbeit' ? '<span class="kreis"></span>' : MIC_SVG;
  k.title = zustand === 'rec' ? 'Aufnahme beenden' : zustand === 'arbeit' ? 'wird in Text umgewandelt …' : zustand === 'fehler' ? text : 'In dieses Feld diktieren';
  k.setAttribute('aria-label', k.title);
}

/** Namen aus dem Kader helfen Whisper bei der Schreibweise. */
function hinweis(): string {
  let p: unknown;
  try { p = (0, eval)('players'); } catch { p = undefined; }
  if (!Array.isArray(p)) return '';
  let out = '';
  for (const x of p as { name?: string }[]) {
    const n = String(x?.name || '').trim();
    if (!n) continue;
    const neu = out ? `${out}, ${n}` : n;
    if (encodeURIComponent(neu).length > 1200) break;
    out = neu;
  }
  return out;
}

function fehlerZeigen(s: string, text: string) {
  zeigen(knopfVon(s), 'fehler', text);
  setTimeout(() => { if (!inArbeit.has(s) && aktiv?.schluessel !== s) zeigen(knopfVon(s), 'bereit'); }, 6000);
}

async function stoppen() {
  const a = aktiv;
  if (!a) return;
  aktiv = null;
  clearInterval(a.uhr);
  inArbeit.add(a.schluessel);
  zeigen(knopfVon(a.schluessel), 'arbeit');
  try {
    const text = await inText(await a.aufnahme.stoppen(), hinweis());
    inArbeit.delete(a.schluessel);
    const t = feldVon(a.schluessel);
    if (text && t) {
      t.value = anhaengen(t.value, text);
      t.dispatchEvent(new Event('input', { bubbles: true }));
      t.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (text) zeigen(knopfVon(a.schluessel), 'bereit'); else fehlerZeigen(a.schluessel, 'Nichts verstanden – bitte nochmal');
  } catch (e) {
    inArbeit.delete(a.schluessel);
    fehlerZeigen(a.schluessel, (e as Error).message.slice(0, 80));
  }
}

async function umschalten(s: string) {
  if (aktiv) { const war = aktiv.schluessel; await stoppen(); if (war === s) return; }
  try {
    const aufnahme = await aufnahmeStarten();
    const tick = () => {
      if (!aktiv) return;
      const ms = Date.now() - aktiv.aufnahme.start;
      zeigen(knopfVon(s), 'rec', dauer(ms));
      if (ms > MAX_SEKUNDEN * 1000) void stoppen();
    };
    aktiv = { schluessel: s, aufnahme, uhr: window.setInterval(tick, 500) };
    tick();
  } catch (e) {
    fehlerZeigen(s, (e as Error).message);
  }
}

function schmuecken() {
  document.querySelectorAll<Feld>(`${FELDER}`).forEach((t) => {
    if (t.hasAttribute('data-diktat-ok')) return;
    t.setAttribute('data-diktat-ok', '1');
    if (t.readOnly || t.disabled || t.closest('[data-kein-diktat]')) return;
    const s = schluessel(t);
    if (!s) return;
    const k = document.createElement('button');
    k.type = 'button';
    k.className = 'diktat';
    k.setAttribute('data-diktat-fuer', s);
    if (aktiv?.schluessel === s) zeigen(k, 'rec', dauer(Date.now() - aktiv.aufnahme.start));
    else if (inArbeit.has(s)) zeigen(k, 'arbeit');
    else zeigen(k, 'bereit');
    k.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); void umschalten(s); });
    // Gibt es über dem Feld eine Kopfzeile mit Beschriftung (Fragebogen), kommt das Symbol dorthin, sonst ans Feld.
    const kopf = t.closest('.tb')?.querySelector('.tbh');
    if (kopf) kopf.appendChild(k);
    else {
      const rahmen = document.createElement('span');
      rahmen.className = 'diktat-rahmen';
      const fokus = document.activeElement === t;
      t.replaceWith(rahmen);
      rahmen.append(t, k);
      if (fokus) t.focus();
    }
  });
}

export function diktatStarten() {
  if (!diktatMoeglich()) return;
  const css = document.createElement('style');
  css.textContent = `
    button.mic, .secmic { display: none !important; }
    .diktat-rahmen { position: relative; display: block; width: 100%; flex: 1 1 auto; min-width: 0; }
    .diktat-rahmen > textarea { padding-right: 40px; }
    .diktat-rahmen > input { padding-right: 40px; }
    .diktat-rahmen > button.diktat { position: absolute; right: 6px; top: 6px; }
    .diktat-rahmen > input + button.diktat { top: 50%; transform: translateY(-50%); }
    .tbh button.diktat { margin-left: auto; }
    button.diktat { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-width: 30px; height: 30px; padding: 0 8px;
      font: inherit; font-size: 12px; line-height: 1; border-radius: 999px; cursor: pointer; width: auto;
      background: var(--panel, #1a2220); color: var(--muted, #9aa); border: 1px solid var(--line, #2a3431); }
    button.diktat:hover { color: var(--accent, #5ec29a); border-color: var(--accent, #5ec29a); }
    button.diktat.rec { color: #fff; background: var(--game, #d9534f); border-color: var(--game, #d9534f); }
    button.diktat.arbeit { cursor: progress; }
    button.diktat.fehler { color: var(--warn, #e0a030); border-color: var(--warn, #e0a030); }
    button.diktat .punkt { width: 8px; height: 8px; border-radius: 50%; background: #fff; animation: diktatPuls 1s infinite; }
    button.diktat .kreis { width: 12px; height: 12px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: diktatDreh .8s linear infinite; }
    @keyframes diktatPuls { 50% { opacity: .3; } }
    @keyframes diktatDreh { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(css);
  schmuecken();
  new MutationObserver(() => schmuecken()).observe(document.body, { childList: true, subtree: true });
}
