/**
 * „Ganze Übung diktieren“: frei erzählen, Whisper macht daraus Text (eigener Server),
 * Claude Sonnet 5.5 verteilt den Text auf die Felder der Maske. Nur der Text geht an Anthropic.
 * Gespeichert wird nichts automatisch: Die Felder werden vorausgefüllt, der Trainer prüft und speichert selbst.
 */
import { MAX_SEKUNDEN, MIC_SVG, aufnahmeStarten, dauer, diktatMoeglich, inText, type Aufnahme } from '../sprache/aufnahme';

type Feldart = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
interface Feld { key: string; id: string; label: string; hinweis?: string; auswahl?: boolean }

/** Die Maske „Übung erfassen“ (Übungspool und eigene Seite) – gleiche Feld-IDs. */
const UEBUNG: Feld[] = [
  { key: 'name', id: 'ue-n', label: 'Name', hinweis: 'kurzer, griffiger Name der Übung' },
  { key: 'prinzip', id: 'ue-p', label: 'Spielprinzip', auswahl: true, hinweis: 'nur wenn der Trainer ein Prinzip oder eine Spielphase klar nennt' },
  { key: 'art', id: 'ue-k', label: 'Art', auswahl: true },
  { key: 'spieler', id: 'ue-s', label: 'Spieler', hinweis: 'Anzahl, z. B. „14“ oder „7 gegen 7 plus 2 Torhüter“' },
  { key: 'feld', id: 'ue-f', label: 'Feld', hinweis: 'Feldgröße, z. B. „40 × 30 m“ oder „doppelter Strafraum“' },
  { key: 'dauer', id: 'ue-d', label: 'Dauer', hinweis: 'Gesamtdauer in Minuten, nur die Zahl' },
  { key: 'aufbau', id: 'ue-a', label: 'Aufbau', hinweis: 'Feld, Material, Tore, Teams, Startpositionen' },
  { key: 'ablauf', id: 'ue-b', label: 'Ablauf', hinweis: 'wie gespielt wird: Regeln, Abfolge, Punkte, Wechsel' },
  { key: 'ziel', id: 'ue-z', label: 'Ziel', hinweis: 'was trainiert werden soll' },
  { key: 'coaching', id: 'ue-c', label: 'Coaching-Schwerpunkte', hinweis: 'worauf der Trainer achtet und was er korrigiert' },
  { key: 'variationen', id: 'ue-v', label: 'Variationen', hinweis: 'Varianten, Steigerungen, Vereinfachungen' },
];

let kiBereit: boolean | null = null;
let aufnahme: Aufnahme | null = null;
let uhr = 0;
let arbeitet = false;

const knopf = () => document.querySelector<HTMLButtonElement>('button.ki-ganz');
const meldung = () => document.querySelector<HTMLElement>('.ki-meldung');

function zeigen(zustand: 'bereit' | 'rec' | 'arbeit', text = '') {
  const k = knopf(); if (!k) return;
  k.classList.toggle('rec', zustand === 'rec');
  k.disabled = zustand === 'arbeit';
  k.innerHTML = zustand === 'rec' ? `<span class="punkt"></span> Fertig · ${text}` : zustand === 'arbeit' ? `<span class="kreis"></span> ${text}` : `${MIC_SVG} Ganze Übung diktieren`;
}
function melden(text: string, art: '' | 'ok' | 'warn' = '') {
  const m = meldung(); if (!m) return;
  m.textContent = text; m.className = `ki-meldung ${art}`; m.hidden = !text;
}

function spielernamen(): string {
  let p: unknown;
  try { p = (0, eval)('players'); } catch { p = undefined; }
  return Array.isArray(p) ? (p as { name?: string }[]).map((x) => x?.name).filter(Boolean).join(', ').slice(0, 2500) : '';
}

function felderBeschreiben() {
  return UEBUNG.map((f) => {
    const el = document.getElementById(f.id) as Feldart | null;
    const optionen = f.auswahl && el instanceof HTMLSelectElement
      ? [...el.options].filter((o) => o.value || o.text).map((o) => ({ wert: o.value || o.text, label: o.text })).filter((o) => o.wert && !/^ohne/i.test(o.label))
      : undefined;
    return { key: f.key, label: f.label, ...(f.hinweis ? { hinweis: f.hinweis } : {}), ...(optionen ? { optionen } : {}) };
  });
}

function eintragen(felder: Record<string, string>): number {
  let n = 0;
  for (const f of UEBUNG) {
    const v = (felder[f.key] || '').trim();
    const el = document.getElementById(f.id) as Feldart | null;
    if (!v || !el) continue;
    if (el instanceof HTMLSelectElement) {
      const o = [...el.options].find((x) => (x.value || x.text) === v);
      if (!o) continue;
      el.value = o.value;
    } else if (el instanceof HTMLInputElement) {
      // Einzeilige Felder (Name, Spieler, Feld, Dauer): ersetzen; Zahlenfelder nur mit der Zahl.
      const neu = el.type === 'number' ? (/\d+/.exec(v)?.[0] ?? '') : v;
      if (!neu) continue;
      el.value = neu;
    } else {
      // Steht im Textfeld schon etwas, wird angehängt statt überschrieben.
      el.value = el.value.trim() ? `${el.value.trim()}\n${v}` : v;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.classList.add('ki-neu'); setTimeout(() => el.classList.remove('ki-neu'), 6000);
    n++;
  }
  return n;
}

async function fertig() {
  const a = aufnahme; if (!a) return;
  aufnahme = null; clearInterval(uhr); arbeitet = true;
  try {
    zeigen('arbeit', 'Sprache wird erkannt …');
    const text = await inText(await a.stoppen(), spielernamen());
    if (!text) { melden('Nichts verstanden – bitte nochmal und etwas näher ans Mikrofon.', 'warn'); return; }
    zeigen('arbeit', 'KI verteilt auf die Felder …');
    const r = await fetch('/api/ki/verteilen', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CoachAI': '1' },
      body: JSON.stringify({ maske: 'Übung erfassen', text, felder: felderBeschreiben(), kontext: spielernamen() ? `Spielernamen im Kader: ${spielernamen()}` : undefined }),
    });
    const b = await r.json().catch(() => ({})) as { felder?: Record<string, string>; fehler?: string };
    if (!r.ok || !b.felder) {
      // Ohne KI geht der Text nicht verloren: er landet im Feld „Ablauf“ zum Nachsortieren.
      const ablauf = document.getElementById('ue-b') as HTMLTextAreaElement | null;
      if (ablauf) { ablauf.value = ablauf.value.trim() ? `${ablauf.value.trim()}\n${text}` : text; ablauf.dispatchEvent(new Event('input', { bubbles: true })); }
      melden(`${b.fehler || 'Die KI ist gerade nicht erreichbar.'} Der erkannte Text steht im Feld „Ablauf“.`, 'warn');
      return;
    }
    const n = eintragen(b.felder);
    melden(n ? `${n} Felder vorausgefüllt (grün markiert). Bitte prüfen, bei Bedarf ändern und dann „Übung speichern“.` : 'Die KI hat keine passenden Angaben gefunden. Bitte nochmal ausführlicher erzählen.', n ? 'ok' : 'warn');
  } catch (e) {
    melden(`Diktat: ${(e as Error).message}`, 'warn');
  } finally {
    arbeitet = false; zeigen('bereit');
  }
}

async function klick() {
  if (arbeitet) return;
  if (aufnahme) { await fertig(); return; }
  if (kiBereit === false) {
    melden('KI noch nicht eingerichtet: Auf dem Server fehlt der Anthropic-Schlüssel (ANTHROPIC_API_KEY in deploy/.env). Einzelne Felder kannst du über das Mikrofon am Feld diktieren.', 'warn');
    return;
  }
  melden('');
  try {
    aufnahme = await aufnahmeStarten();
    const tick = () => { if (!aufnahme) return; const ms = Date.now() - aufnahme.start; zeigen('rec', dauer(ms)); if (ms > MAX_SEKUNDEN * 1000) void fertig(); };
    tick(); uhr = window.setInterval(tick, 500);
    melden('Erzähl die Übung: Name, Art, Aufbau, Ablauf, Ziel, worauf du achtest, Varianten. Zum Schluss „Fertig“ antippen.');
  } catch (e) { melden(`${(e as Error).message}.`, 'warn'); }
}

function einbauen() {
  const name = document.getElementById('ue-n');
  if (!name || document.querySelector('button.ki-ganz')) return;
  const maske = name.closest('.card') || name.closest('.mask') || name.parentElement?.parentElement;
  if (!maske) return;
  const leiste = document.createElement('div');
  leiste.className = 'ki-leiste';
  leiste.innerHTML = `<button type="button" class="btn ki-ganz"></button><span class="note">Frei erzählen – die KI verteilt auf die Felder. Gespeichert wird erst mit „Übung speichern“.</span><p class="ki-meldung" hidden></p>`;
  const erstesGrid = maske.querySelector('.grid');
  if (erstesGrid) erstesGrid.before(leiste); else maske.prepend(leiste);
  leiste.querySelector('button')!.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); void klick(); });
  if (aufnahme) zeigen('rec', dauer(Date.now() - aufnahme.start)); else if (arbeitet) zeigen('arbeit', 'läuft …'); else zeigen('bereit');
}

export function kiUebungStarten() {
  if (!diktatMoeglich()) return;
  void fetch('/api/ki/status', { credentials: 'same-origin' }).then((r) => r.json()).then((b: { bereit?: boolean }) => { kiBereit = !!b.bereit; }).catch(() => { kiBereit = null; });
  const css = document.createElement('style');
  css.textContent = `
    .ki-leiste { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin: 4px 0 12px; }
    .ki-leiste .btn.ki-ganz { display: inline-flex; align-items: center; gap: 8px; }
    .ki-leiste .btn.ki-ganz.rec { background: var(--game, #d9534f); border-color: var(--game, #d9534f); color: #fff; }
    .ki-leiste .punkt { width: 9px; height: 9px; border-radius: 50%; background: #fff; animation: diktatPuls 1s infinite; }
    .ki-leiste .kreis { width: 12px; height: 12px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: diktatDreh .8s linear infinite; }
    .ki-meldung { flex-basis: 100%; margin: 0; font-size: 13px; color: var(--muted, #9aa); }
    .ki-meldung.ok { color: var(--accent, #5ec29a); }
    .ki-meldung.warn { color: var(--warn, #e0a030); }
    .ki-neu { outline: 2px solid var(--accent, #5ec29a); outline-offset: 1px; transition: outline-color 1s; }
  `;
  document.head.appendChild(css);
  einbauen();
  new MutationObserver(() => einbauen()).observe(document.body, { childList: true, subtree: true });
}
