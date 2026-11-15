/**
 * Diktieren in jedes Textfeld der Teamzentrale.
 * Neben jedem mehrzeiligen Feld steht ein Mikrofon-Knopf: antippen, sprechen, „Stopp“ – der Text wird ans Feld angehängt.
 * Die Aufnahme geht an den eigenen Server (/api/sprache, Whisper) und wird dort nicht gespeichert.
 */
const MAX_SEKUNDEN = 300;
const MIC = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';

type Aktiv = { schluessel: string; feld: HTMLTextAreaElement; knopf: HTMLButtonElement; rec: MediaRecorder; stream: MediaStream; teile: Blob[]; start: number; uhr: number };
let aktiv: Aktiv | null = null;
/** Felder, deren Aufnahme gerade umgewandelt wird. */
const inArbeit = new Set<string>();

/** Stabiler Schlüssel, um das Feld nach einem Neuzeichnen wiederzufinden. */
function schluessel(t: HTMLTextAreaElement): string {
  if (t.id) return `#${CSS.escape(t.id)}`;
  const attrs = [...t.attributes].filter((a) => a.name.startsWith('data-') && !a.name.startsWith('data-diktat'));
  if (attrs.length) return 'textarea' + attrs.map((a) => `[${a.name}="${CSS.escape(a.value)}"]`).join('');
  if (t.name) return `textarea[name="${CSS.escape(t.name)}"]`;
  return '';
}

const finden = (s: string, ersatz?: HTMLTextAreaElement): HTMLTextAreaElement | null =>
  (s ? document.querySelector<HTMLTextAreaElement>(s) : null) || (ersatz && ersatz.isConnected ? ersatz : null);
const knopfVon = (s: string) => {
  const t = finden(s);
  const k = t?.nextElementSibling;
  return k instanceof HTMLButtonElement && k.classList.contains('diktat') ? k : null;
};

function zeigen(k: HTMLButtonElement | null, zustand: 'bereit' | 'rec' | 'arbeit' | 'fehler', text?: string) {
  if (!k) return;
  k.classList.toggle('rec', zustand === 'rec');
  k.classList.toggle('arbeit', zustand === 'arbeit');
  k.classList.toggle('fehler', zustand === 'fehler');
  k.disabled = zustand === 'arbeit';
  k.innerHTML = zustand === 'rec' ? `<span class="punkt"></span>${text || 'Stopp'}`
    : zustand === 'arbeit' ? 'wird umgewandelt …'
    : zustand === 'fehler' ? `${MIC} ${text || 'Fehler'}`
    : `${MIC} Diktieren`;
  k.title = zustand === 'rec' ? 'Aufnahme beenden' : 'In dieses Feld diktieren';
}

const dauer = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Namen aus dem Kader helfen Whisper bei der Schreibweise. */
function hinweis(): string {
  const p = (window as unknown as { players?: { name?: string }[] }).players;
  if (!Array.isArray(p)) return '';
  let out = '';
  for (const x of p) {
    const n = String(x?.name || '').trim();
    if (!n) continue;
    const neu = out ? `${out}, ${n}` : n;
    if (encodeURIComponent(neu).length > 1200) break;
    out = neu;
  }
  return out;
}

function einfuegen(t: HTMLTextAreaElement, text: string) {
  const v = t.value.replace(/\s+$/, '');
  t.value = v ? `${v}${/[.!?:]$/.test(v) ? ' ' : v.endsWith('\n') ? '' : ' '}${text}` : text;
  t.dispatchEvent(new Event('input', { bubbles: true }));
  t.dispatchEvent(new Event('change', { bubbles: true }));
}

async function umwandeln(s: string, feld: HTMLTextAreaElement, blob: Blob) {
  inArbeit.add(s);
  zeigen(knopfVon(s), 'arbeit');
  try {
    const h = hinweis();
    const r = await fetch('/api/sprache', {
      method: 'POST', credentials: 'same-origin', body: blob,
      headers: { 'X-CoachAI': '1', 'Content-Type': blob.type || 'application/octet-stream', ...(h ? { 'X-Hinweis': encodeURIComponent(h) } : {}) },
    });
    const b = await r.json().catch(() => ({})) as { text?: string; fehler?: string };
    inArbeit.delete(s);
    if (!r.ok) throw new Error(b.fehler || 'Umwandlung fehlgeschlagen');
    const t = finden(s, feld);
    if (b.text && t) einfuegen(t, b.text.trim());
    zeigen(knopfVon(s), b.text ? 'bereit' : 'fehler', b.text ? undefined : 'nichts verstanden');
    if (!b.text) setTimeout(() => zeigen(knopfVon(s), 'bereit'), 4000);
  } catch (e) {
    inArbeit.delete(s);
    zeigen(knopfVon(s), 'fehler', (e as Error).message.slice(0, 60));
    setTimeout(() => zeigen(knopfVon(s), 'bereit'), 6000);
  }
}

function stoppen() {
  const a = aktiv;
  if (!a) return;
  aktiv = null;
  clearInterval(a.uhr);
  if (a.rec.state !== 'inactive') a.rec.stop();
}

async function aufnehmen(feld: HTMLTextAreaElement, knopf: HTMLButtonElement) {
  const s = schluessel(feld);
  if (aktiv) { const war = aktiv.schluessel; stoppen(); if (war === s) return; }
  let stream: MediaStream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch {
    zeigen(knopf, 'fehler', 'Mikrofon nicht erlaubt');
    setTimeout(() => zeigen(knopfVon(s) || knopf, 'bereit'), 6000);
    return;
  }
  const typ = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find((x) => MediaRecorder.isTypeSupported?.(x));
  const rec = new MediaRecorder(stream, typ ? { mimeType: typ } : undefined);
  const a: Aktiv = { schluessel: s, feld, knopf, rec, stream, teile: [], start: Date.now(), uhr: 0 };
  rec.ondataavailable = (e) => { if (e.data.size) a.teile.push(e.data); };
  rec.onstop = () => {
    stream.getTracks().forEach((x) => x.stop());
    const blob = new Blob(a.teile, { type: rec.mimeType || typ || 'audio/webm' });
    if (blob.size < 1000) { zeigen(knopfVon(s), 'bereit'); return; }
    void umwandeln(s, feld, blob);
  };
  rec.start(1000);
  aktiv = a;
  const tick = () => {
    const ms = Date.now() - a.start;
    zeigen(knopfVon(s) || a.knopf, 'rec', `Stopp · ${dauer(ms)}`);
    if (ms > MAX_SEKUNDEN * 1000) stoppen();
  };
  tick();
  a.uhr = window.setInterval(tick, 500);
}

function schmuecken() {
  document.querySelectorAll<HTMLTextAreaElement>('textarea:not([data-diktat-ok])').forEach((t) => {
    t.setAttribute('data-diktat-ok', '1');
    if (t.readOnly || t.disabled || t.closest('[data-kein-diktat]')) return;
    const k = document.createElement('button');
    k.type = 'button';
    k.className = 'diktat';
    const s = schluessel(t);
    if (aktiv && aktiv.schluessel === s) zeigen(k, 'rec', `Stopp · ${dauer(Date.now() - aktiv.start)}`);
    else if (inArbeit.has(s)) zeigen(k, 'arbeit');
    else zeigen(k, 'bereit');
    k.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const feld = (k.previousElementSibling as HTMLTextAreaElement) || t;
      void aufnehmen(feld, k);
    });
    t.insertAdjacentElement('afterend', k);
  });
}

export function diktatStarten() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return;
  const css = document.createElement('style');
  css.textContent = `
    .secmic { display: none !important; }
    button.diktat { justify-self: end; align-self: end; display: inline-flex; align-items: center; gap: 6px; margin-top: 4px;
      font: inherit; font-size: 12px; line-height: 1; padding: 6px 10px; border-radius: 999px; cursor: pointer;
      background: transparent; color: var(--muted, #9aa); border: 1px solid var(--line, #2a3431); width: auto; }
    button.diktat:hover { color: var(--ink, #eee); border-color: var(--accent, #5ec29a); }
    button.diktat.rec { color: #fff; background: var(--game, #d9534f); border-color: var(--game, #d9534f); }
    button.diktat.arbeit { opacity: .75; cursor: progress; }
    button.diktat.fehler { color: var(--warn, #e0a030); border-color: var(--warn, #e0a030); }
    button.diktat .punkt { width: 8px; height: 8px; border-radius: 50%; background: #fff; animation: diktatPuls 1s infinite; }
    @keyframes diktatPuls { 50% { opacity: .3; } }
    textarea + button.diktat { display: inline-flex; }
    :not(label):not(.fl) > textarea + button.diktat { margin-left: auto; float: right; }
  `;
  document.head.appendChild(css);
  schmuecken();
  new MutationObserver(() => schmuecken()).observe(document.body, { childList: true, subtree: true });
}
