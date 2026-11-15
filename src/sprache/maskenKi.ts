/**
 * Ein Mikrofon pro Eingabemaske: frei sprechen, Whisper macht Text daraus (eigener Server),
 * Claude verteilt den Text auf alle Textfelder der Maske. Gemeinsam für Teamzentrale und Dossier.
 * Nichts wird automatisch gespeichert, was über das hinausgeht, was ein Tippen ins Feld auch täte.
 */
import { MAX_SEKUNDEN, aufnahmeStarten, dauer, diktatMoeglich, inText, type Aufnahme } from './aufnahme';

export type Eingabe = HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement;
export interface MaskenFeld { el: Eingabe; key: string; label: string; hinweis?: string; optionen?: { wert: string; label: string }[]; sel: string }

/** Stabiler Suchausdruck, um ein Feld nach einem Neuzeichnen der Seite wiederzufinden. */
function suchausdruck(el: Eingabe): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const a = [...el.attributes].filter((x) => x.name.startsWith('data-'));
  return a.length ? el.tagName.toLowerCase() + a.map((x) => `[${x.name}="${CSS.escape(x.value)}"]`).join('') : '';
}
const aktuellesFeld = (f: MaskenFeld): Eingabe | null => (f.el.isConnected ? f.el : (f.sel ? document.querySelector<Eingabe>(f.sel) : null));

const sichtbar = (el: Element) => !!(el as HTMLElement).offsetParent || (el as HTMLElement).getClientRects().length > 0;
const kurz = (t: string | null | undefined, n: number) => (t || '').replace(/\s+/g, ' ').replace(/[*:]+$/, '').trim().slice(0, n);

/** Beschriftung eines Feldes, wie der Trainer sie sieht. */
function beschriftung(el: Eingabe): string {
  const id = el.id;
  const lab = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) || el.closest('label');
  let t = '';
  if (lab) { const c = lab.cloneNode(true) as HTMLElement; c.querySelectorAll('textarea, input, select, button, small, .note').forEach((x) => x.remove()); t = c.textContent || ''; }
  if (!kurz(t, 80)) t = el.closest('.tb')?.querySelector('.tbh label')?.textContent || '';
  if (!kurz(t, 80)) t = el.closest('.field')?.querySelector('.field-label, label')?.textContent || '';
  if (!kurz(t, 80)) t = el.getAttribute('aria-label') || (el instanceof HTMLSelectElement ? '' : el.placeholder) || '';
  return kurz(t, 80) || 'Textfeld';
}

/** Zusammenhang: Überschrift des Abschnitts und Platzhalter als Hinweis für die KI. */
function zusammenhang(el: Eingabe, wurzel: Element): string {
  let ab: Element | null = el.parentElement;
  let titel = '';
  while (ab && ab !== wurzel && !titel) {
    const h = ab.querySelector(':scope > h2, :scope > h3, :scope > h4, :scope > .row h3, :scope > header h3, :scope > .card-head h3');
    if (h) titel = h.textContent || '';
    ab = ab.parentElement;
  }
  const ph = el instanceof HTMLSelectElement ? '' : el.placeholder;
  const teile = [titel && `Abschnitt „${kurz(titel, 70)}“`, ph && `Beispiel: ${kurz(ph, 120)}`].filter(Boolean);
  return teile.join('; ').slice(0, 280);
}

export interface Sammeln {
  /** Welche einzeiligen Felder dazugehören (Standard: alle). */
  auch?: (el: HTMLInputElement) => boolean;
  /** Auswahlfelder mitnehmen (z. B. Noten). */
  auswahl?: boolean;
  /** Felder in diesen Bereichen gehören zu einer eigenen Maske. */
  ohne?: Element[];
}

/** Alle sichtbaren, beschreibbaren Felder einer Maske. */
export function felderSammeln(wurzel: Element, o: Sammeln = {}): MaskenFeld[] {
  const els = [...wurzel.querySelectorAll<Eingabe>(`textarea, input[type="text"], input:not([type])${o.auswahl ? ', select' : ''}`)].filter((el) =>
    sichtbar(el) && !el.disabled && !(el as HTMLInputElement).readOnly && !el.closest('[data-kein-diktat]') && !(o.ohne || []).some((x) => x.contains(el))
    && (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el.inputMode !== 'numeric' && (!o.auch || o.auch(el)))));
  return els.slice(0, 40).map((el, i) => {
    const optionen = el instanceof HTMLSelectElement ? [...el.options].map((x) => ({ wert: x.value, label: x.text })).filter((x) => x.wert && !/^[–-]$/.test(x.wert)) : undefined;
    return { el, sel: suchausdruck(el), key: `f${i + 1}`, label: beschriftung(el), hinweis: zusammenhang(el, wurzel) || undefined, ...(optionen ? { optionen } : {}) };
  });
}

/** Wert setzen, so dass auch React (gesteuerte Felder) und die Teamzentrale die Änderung mitbekommen. */
export function wertSetzen(el: Eingabe, v: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.classList.add('ki-neu');
  setTimeout(() => el.classList.remove('ki-neu'), 6000);
}

let bereitCache: Promise<boolean> | null = null;
export function kiBereit(): Promise<boolean> {
  bereitCache ??= fetch('/api/ki/status', { credentials: 'same-origin' }).then((r) => r.json()).then((b: { bereit?: boolean }) => !!b.bereit).catch(() => false);
  return bereitCache;
}

function spielernamen(): string {
  let p: unknown;
  try { p = (0, eval)('players'); } catch { p = undefined; }
  if (!Array.isArray(p)) { try { p = (window.parent as unknown as { eval?: (s: string) => unknown }).eval?.('players'); } catch { p = undefined; } }
  return Array.isArray(p) ? (p as { name?: string }[]).map((x) => x?.name).filter(Boolean).join(', ').slice(0, 2500) : '';
}

export interface Ergebnis { text: string; art: '' | 'ok' | 'warn' }

/** Text auf die Felder verteilen. Ohne KI (oder bei nur einem Feld) landet er im zuletzt benutzten oder ersten Feld. */
export async function verteilen(maske: string, felder: MaskenFeld[], text: string, zuletzt: Eingabe | null): Promise<Ergebnis> {
  const anhaengen = (el: HTMLTextAreaElement | HTMLInputElement, v: string) => wertSetzen(el, el.value.trim() ? `${el.value.trim()}${el instanceof HTMLTextAreaElement ? '\n' : ' '}${v}` : v);
  const text_ = felder.filter((f) => !(f.el instanceof HTMLSelectElement));
  const ziel = ((zuletzt && !(zuletzt instanceof HTMLSelectElement) && text_.some((f) => f.el === zuletzt) ? zuletzt : null) || text_.find((f) => f.el instanceof HTMLTextAreaElement && !f.el.value.trim())?.el || text_[0]?.el) as HTMLTextAreaElement | HTMLInputElement | null | undefined;
  if (text_.length === felder.length && felder.length === 1 || !(await kiBereit())) {
    if (!ziel) return { text: 'Kein Textfeld gefunden.', art: 'warn' };
    anhaengen(ziel, text);
    return felder.length === 1
      ? { text: 'Text eingetragen.', art: 'ok' }
      : { text: `KI noch nicht eingerichtet (ANTHROPIC_API_KEY auf dem Server). Der Text steht im Feld „${beschriftung(ziel)}“.`, art: 'warn' };
  }
  const namen = spielernamen();
  const r = await fetch('/api/ki/verteilen', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CoachAI': '1' },
    body: JSON.stringify({ maske, text, felder: felder.map(({ key, label, hinweis, optionen }) => ({ key, label, ...(hinweis ? { hinweis } : {}), ...(optionen ? { optionen } : {}) })), kontext: namen ? `Spielernamen im Kader: ${namen}` : undefined }),
  });
  const b = await r.json().catch(() => ({})) as { felder?: Record<string, string>; fehler?: string };
  if (!r.ok || !b.felder) {
    if (ziel) anhaengen(ziel, text);
    return { text: `${b.fehler || 'Die KI ist gerade nicht erreichbar.'}${ziel ? ` Der Text steht im Feld „${beschriftung(ziel)}“.` : ''}`, art: 'warn' };
  }
  let n = 0, schon = 0;
  for (const f of felder) {
    const v = (b.felder[f.key] || '').trim();
    const el = aktuellesFeld(f);
    if (!v || !el) continue;
    // Auswahl (z. B. Note): gesagt ist gesagt. Textfelder und Kommentarzeilen: anhängen. Andere einzeilige Felder: nur füllen, wenn leer.
    if (el instanceof HTMLSelectElement) {
      if (![...el.options].some((x) => x.value === v)) continue;
      if (el.value === v) { schon++; continue; }
      wertSetzen(el, v);
    } else if (el.value.trim() === v || el.value.includes(v)) { schon++; continue; }
    else if (el instanceof HTMLTextAreaElement) anhaengen(el, v);
    else if (!el.value.trim()) wertSetzen(el, v);
    else if (el.hasAttribute('data-text')) wertSetzen(el, `${el.value.trim().replace(/[.;,]$/, '')}; ${v}`);
    else continue;
    n++;
  }
  if (n) return { text: `${n} ${n === 1 ? 'Feld' : 'Felder'} ausgefüllt (grün markiert). Bitte kurz prüfen.`, art: 'ok' };
  if (schon) return { text: 'Das Gesagte ist bereits so eingetragen.', art: 'ok' };
  return { text: 'Die KI hat nichts Passendes gefunden. Bitte nochmal etwas ausführlicher.', art: 'warn' };
}

export type Zustand = { art: 'bereit' } | { art: 'rec'; zeit: string } | { art: 'arbeit'; text: string };

/** Aufnahme-Steuerung einer Maske; meldet Zustand und Ergebnis über Rückrufe (DOM oder React). */
export class MaskenDiktat {
  private aufnahme: Aufnahme | null = null;
  private uhr = 0;
  private laeuft = false;
  constructor(
    private maske: () => string,
    private felder: () => MaskenFeld[],
    private zuletzt: () => Eingabe | null,
    private zeige: (z: Zustand) => void,
    private melde: (e: Ergebnis) => void,
  ) {}

  get zustand(): Zustand {
    if (this.aufnahme) return { art: 'rec', zeit: dauer(Date.now() - this.aufnahme.start) };
    if (this.laeuft) return { art: 'arbeit', text: 'läuft …' };
    return { art: 'bereit' };
  }

  async umschalten() {
    if (this.laeuft) return;
    if (this.aufnahme) return this.fertig();
    if (!this.felder().length) { this.melde({ text: 'Hier gibt es kein Textfeld zum Ausfüllen.', art: 'warn' }); return; }
    try {
      this.aufnahme = await aufnahmeStarten();
      const tick = () => { if (!this.aufnahme) return; const ms = Date.now() - this.aufnahme.start; this.zeige({ art: 'rec', zeit: dauer(ms) }); if (ms > MAX_SEKUNDEN * 1000) void this.fertig(); };
      tick(); this.uhr = window.setInterval(tick, 500);
      this.melde({ text: 'Erzähl einfach alles für diese Seite am Stück. Zum Schluss „Fertig“ antippen.', art: '' });
    } catch (e) { this.melde({ text: `${(e as Error).message}.`, art: 'warn' }); }
  }

  private async fertig() {
    const a = this.aufnahme; if (!a) return;
    this.aufnahme = null; clearInterval(this.uhr); this.laeuft = true;
    try {
      this.zeige({ art: 'arbeit', text: 'Sprache wird erkannt …' });
      const text = await inText(await a.stoppen());
      if (!text) { this.melde({ text: 'Nichts verstanden – bitte nochmal und etwas näher ans Mikrofon.', art: 'warn' }); return; }
      const felder = this.felder();
      if (felder.length > 1) this.zeige({ art: 'arbeit', text: 'KI verteilt auf die Felder …' });
      this.melde(await verteilen(this.maske(), felder, text, this.zuletzt()));
    } catch (e) {
      this.melde({ text: `Diktat: ${(e as Error).message}`, art: 'warn' });
    } finally {
      this.laeuft = false; this.zeige({ art: 'bereit' });
    }
  }
}

export { diktatMoeglich };

export const KI_CSS = `
  .ki-neu { outline: 2px solid var(--accent, #5ec29a) !important; outline-offset: 1px; }
  .masken-diktat { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
  .masken-diktat .md-knopf { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
  .masken-diktat .md-knopf.rec { background: var(--game, #d9534f) !important; border-color: var(--game, #d9534f) !important; color: #fff !important; }
  .masken-diktat .punkt { width: 9px; height: 9px; border-radius: 50%; background: #fff; animation: diktatPuls 1s infinite; }
  .masken-diktat .kreis { width: 12px; height: 12px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: diktatDreh .8s linear infinite; }
  .md-meldung { margin: 6px 0 0; font-size: 13px; color: var(--muted, #9aa); flex-basis: 100%; }
  .md-meldung.ok { color: var(--accent, #5ec29a); }
  .md-meldung.warn { color: var(--warn, #e0a030); }
  @keyframes diktatPuls { 50% { opacity: .3; } }
  @keyframes diktatDreh { to { transform: rotate(360deg); } }
`;
