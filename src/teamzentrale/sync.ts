/**
 * Speichern und Abgleich für die Teamzentrale auf dem 11Plan-Server.
 *
 * Die Teamzentrale (prototype/) hält ihre Daten in globalen Variablen. Dieses Modul
 * - legt beim Öffnen die gespeicherten Eingaben über die Daten der Datei (fussball.de, FuPa),
 * - speichert jede Änderung kurz danach auf dem Server,
 * - holt Änderungen der anderen Trainer und gleicht sie ab, ohne etwas zu überschreiben,
 * - zeigt in der Seitenleiste, wer angemeldet ist, den Speicherstand, „Trainer einladen“ und „Abmelden“.
 */
import { abgleichen } from './merge';
import { maskenDiktatStarten } from './maskenDiktat';
import { kiUebungStarten } from './kiUebung';
import { autorenMerken, autorenStarten, autorenStempeln } from './autoren';
import { betreuerAnpassen, dossierPdfStarten, kalenderAboStarten, rolle, spielerStarten, trainerZugaenge } from './rolle';

type Obj = Record<string, unknown>;
type Daten = Record<string, unknown>;

const DOKUMENT = '/api/dokumente/teamzentrale';
const HEADERS = { 'Content-Type': 'application/json', 'X-CoachAI': '1' };

/** Daten der Teamzentrale, die Trainer verändern können. */
const NAMEN = [
  'absences', 'settings', 'principles', 'blocks', 'exercises', 'exNotes', 'unitNotes', 'planHistory', 'units',
  'events', 'GAMES', 'duties', 'facts', 'todos', 'comments', 'talks', 'talkSeries', 'sentMsgs', 'lineup',
  'FORMATIONS', 'EXD', 'dossierRead',
];
/** Teile von `state`, die nur die Ansicht betreffen und nicht gespeichert werden. */
const NUR_ANSICHT = new Set([
  'calView', 'weekStart', 'showAbs', 'picked', 'activeSpot', 'trainTab', 'unitFilter', 'exFilter', 'exKind', 'exQ',
  'pickFor', 'moreUp', 'morePast', 'exId', 'trainEv', 'game', 'post', 'absForm', 'declining', 'editing', 'flash',
  'anaTab', 'anaPlayer', 'focusSug', 'setTab', 'pvTab', 'kSort', 'evFocus', 'evForm', 'nu', 'nuPhase', 'cmpA', 'cmpB',
  'komTab', 'dragged', 'pvNow', 'msg', 'showEv', 'pvAna', 'spieler', 'absOpen', 'dashWeek', 'flashNext', 'dossierEnde', 'exEdit', 'prNeu', 'prEdit', 'pvMe', 'pvWoche', 'dutyForm', 'rideForm',
]);

const global = (name: string): unknown => {
  try { return (0, eval)(name); } catch { return undefined; }
};
const json = (v: unknown) => JSON.stringify(v);
/** Kopie als reines JSON. Mengen (Set) und Zuordnungen (Map) werden dabei markiert, damit sie beim Laden wieder entstehen. */
const kopie = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? null, (_k, x) => x instanceof Set ? { __set: [...x] } : x instanceof Map ? { __map: [...x] } : x));
const isObj = (v: unknown): v is Obj => Object.prototype.toString.call(v) === '[object Object]';
function wiederherstellen(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(wiederherstellen);
  if (isObj(v)) {
    if (Array.isArray(v.__set) && Object.keys(v).length === 1) return new Set(v.__set);
    if (Array.isArray(v.__map) && Object.keys(v).length === 1) return new Map(v.__map as [unknown, unknown][]);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, wiederherstellen(x)]));
  }
  return v;
}

function schnappschuss(): Daten {
  const out: Daten = {};
  for (const n of NAMEN) { const v = global(n); if (v !== undefined) out[n] = kopie(v); }
  const state = global('state');
  if (isObj(state)) out.state = kopie(Object.fromEntries(Object.entries(state).filter(([k]) => !NUR_ANSICHT.has(k))));
  // Nur Kennung → Name, damit spätere Seiten die Kennungen sicher zuordnen können (der Kader selbst kommt von FuPa).
  const players = global('players');
  if (Array.isArray(players)) out.kaderNamen = Object.fromEntries(players.map((p: Obj) => [String(p.id), String(p.name)]));
  return out;
}

/**
 * Der Kader kommt bei jedem Bau frisch von FuPa und wird nicht mehr gespeichert. Ältere Stände hatten
 * Spielerkennungen nach der Reihenfolge im Kader (p0, p1, …). Die werden hier über den Namen auf die
 * festen Kennungen der aktuellen Seite (p-vorname-nachname) umgestellt, damit Abwesenheiten, Zusagen und
 * Kader beim richtigen Spieler bleiben.
 */
const falten = (t: string) => t.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
function umbenennen(v: unknown, map: Map<string, string>): unknown {
  if (typeof v === 'string') return map.get(v) ?? v;
  if (Array.isArray(v)) return v.map((x) => umbenennen(x, map));
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [map.get(k) ?? k, umbenennen(x, map)]));
  return v;
}
function normalisieren<T extends { basis?: Daten; daten?: Daten } | null>(inhalt: T): T {
  if (!inhalt) return inhalt;
  const ausNamen = (k: unknown) => (isObj(k) ? Object.entries(k).map(([id, name]) => ({ id, name: String(name) })) : undefined);
  const alt = (ausNamen(inhalt.daten?.kaderNamen) ?? (inhalt.daten?.players as { id: string; name: string }[] | undefined) ??
    ausNamen(inhalt.basis?.kaderNamen) ?? (inhalt.basis?.players as { id: string; name: string }[] | undefined)) ?? [];
  const aktuell = (global('players') as { id: string; name: string }[] | undefined) ?? [];
  const map = new Map<string, string>();
  for (const a of alt) {
    if (!/^p\d+$/.test(a.id)) continue;
    const neu = aktuell.find((p) => falten(p.name) === falten(a.name));
    if (neu && neu.id !== a.id) map.set(a.id, neu.id);
  }
  const ohneKader = (d?: Daten) => { if (!d) return d; const { players: _p, kaderNamen: _k, ...rest } = d; return rest as Daten; };
  const basis = ohneKader(inhalt.basis), daten = ohneKader(inhalt.daten);
  return { ...inhalt, basis: map.size ? (umbenennen(basis, map) as Daten) : basis, daten: map.size ? (umbenennen(daten, map) as Daten) : daten };
}

/** Überträgt `wert` in das bestehende Objekt, damit Verweise innerhalb der Teamzentrale gültig bleiben. */
function einsetzen(ziel: unknown, wert: unknown, behalten: string[] = []): unknown {
  if (ziel instanceof Set || ziel instanceof Map) return wert instanceof Set || wert instanceof Map ? wert : ziel;
  if (Array.isArray(ziel) && Array.isArray(wert)) {
    const alt = new Map(ziel.filter(isObj).filter((x) => 'id' in x).map((x) => [String(x.id), x]));
    const neu = wert.map((w) => (isObj(w) && 'id' in w && alt.has(String(w.id)) ? einsetzen(alt.get(String(w.id)), w, behalten) : w));
    ziel.splice(0, ziel.length, ...neu);
    return ziel;
  }
  if (isObj(ziel) && isObj(wert)) {
    for (const k of Object.keys(ziel)) if (!(k in wert) && !behalten.includes(k)) delete ziel[k];
    for (const [k, v] of Object.entries(wert)) {
      const z = ziel[k];
      ziel[k] = (Array.isArray(z) && Array.isArray(v)) || (isObj(z) && isObj(v)) ? einsetzen(z, v, behalten) : v;
    }
    return ziel;
  }
  return wert;
}

function anwenden(roh: Daten) {
  const d = wiederherstellen(roh) as Daten;
  for (const n of NAMEN) {
    const ziel = global(n);
    if (n in d && ziel && typeof ziel === 'object') einsetzen(ziel, d[n]);
  }
  const state = global('state');
  if (isObj(state) && isObj(d.state)) for (const [k, v] of Object.entries(d.state)) if (!NUR_ANSICHT.has(k)) {
    state[k] = (isObj(state[k]) && isObj(v)) || (Array.isArray(state[k]) && Array.isArray(v)) ? einsetzen(state[k], v) : v;
  }
}

const neuZeichnen = () => { const r = global('render'); if (typeof r === 'function') r(); };
const tipptGerade = () => {
  const a = document.activeElement;
  return !!a && (a.matches('input, textarea, select, [contenteditable]') || !!global('drag'));
};

// ---------- Anzeige in der Seitenleiste ----------
let anzeige: HTMLElement | null = null;
function status(text: string, art: '' | 'warn' = '') {
  if (!anzeige) return;
  anzeige.textContent = text;
  anzeige.style.color = art === 'warn' ? 'var(--warn)' : '';
  const marke = document.querySelector<HTMLElement>('.side .brand');
  if (marke) { marke.dataset.status = art === 'warn' ? 'fehler' : text.startsWith('Speichert') ? 'speichert' : 'ok'; marke.title = text; }
}
const uhr = () => new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

function kontoKasten(name: string) {
  const css = document.createElement('style');
  css.textContent = `.side .who { display: none; }
.konto11 { border-top: 1px solid var(--line); margin-top: 10px; padding: 10px 10px 0; display: grid; gap: 6px; font-size: 14px; color: var(--muted); }
.konto11 .row { display: flex; flex-wrap: wrap; gap: 6px; }
.konto11 input { width: 100%; font-size: 12px; }
.hinweis11.neue-daten button { margin-left: 8px; font: inherit; padding: 3px 10px; border-radius: 6px; border: 1px solid var(--accent); background: var(--accent); color: #111; cursor: pointer; }
.hinweis11 { position: fixed; right: 16px; bottom: 16px; z-index: 99; background: var(--accent-soft); color: var(--accent); border: 1px solid var(--accent); border-radius: 8px; padding: 8px 12px; font-size: 14px; }
/* Handy: Kopfbereich kompakt, Menü in einer wischbaren Zeile, Inhalt beginnt sofort */
@media (max-width: 900px) {
  .side { position: sticky; top: 0; z-index: 40; padding: 8px 12px; gap: 6px; border-bottom: 1px solid var(--line); }
  .side .brand { font-size: 22px; padding: 0 4px; }
  .side .team { display: none; }
  .side { min-width: 0; max-width: 100vw; }
  .nav { order: 3; min-width: 0; flex-wrap: nowrap !important; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; margin: 0 -12px; padding: 0 12px; width: calc(100% + 24px) !important; }
  .nav::-webkit-scrollbar { display: none; }
  .nav a { white-space: nowrap; padding: 6px 10px; flex: none; }
  .app > .konto11 { margin: 8px 12px 24px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
  .konto11 > .btn { justify-self: start; }
  .demo { display: none; }
  .hinweis11 { left: 12px; right: 12px; bottom: 12px; }
  .hinweis11 button { margin-left: 8px; }
}
/* Zustand des Speicherns auf dem Handy als kleiner Punkt am Logo */
.side .brand[data-status]::after { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-left: 6px; vertical-align: middle; background: var(--accent); }
.side .brand[data-status=speichert]::after { background: var(--warn); }
.side .brand[data-status=fehler]::after { background: #f0857a; }
@media (min-width: 901px) { .side .brand[data-status]::after { display: none; } }`;
  document.head.appendChild(css);
  const box = document.createElement('div');
  box.className = 'konto11';
  box.innerHTML = `<div>Angemeldet als <b></b>${rolle.rolle === 'betreuer' ? ' (Betreuer)' : ''}</div><div class="row"><button class="btn small ghost" data-kalabo="1">Kalender abonnieren</button><button class="btn small ghost" data-k="ab">Abmelden</button></div><div data-k="link" hidden></div><div class="note" data-k="status">Wird geladen …</div><div class="note" data-k="stand"></div><button class="btn small ghost" data-aktualisieren="1">Daten aktualisieren</button>`;
  box.querySelector('b')!.textContent = name;
  anzeige = box.querySelector('[data-k=status]');
  datenstandZeigen(box.querySelector<HTMLElement>('[data-k=stand]'));
  // Breiter Bildschirm: in der Seitenleiste; Handy: ganz unten unter dem Inhalt
  const handy = window.matchMedia('(max-width: 900px)');
  const platzieren = () => { const ziel = handy.matches ? document.querySelector('.app') : document.querySelector('.side'); (ziel || document.body).appendChild(box); };
  platzieren(); handy.addEventListener('change', platzieren);
  box.addEventListener('click', async (e) => {
    const k = (e.target as HTMLElement).getAttribute('data-k');
    if (k === 'ab') {
      await speichernJetzt();
      await fetch('/api/abmelden', { method: 'POST', headers: HEADERS, credentials: 'same-origin' });
      location.href = '/';
    }
  });
}

/** Wann die Daten von fussball.de und FuPa zuletzt abgerufen wurden; älter als ein Tag: Hinweis. */
function datenstandZeigen(el: HTMLElement | null) {
  const iso = global('STAND_ISO');
  if (!el || typeof iso !== 'string') return;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return;
  const stunden = (Date.now() - t.getTime()) / 36e5;
  const heute = t.toDateString() === new Date().toDateString();
  const zeit = t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  el.textContent = `Daten von fussball.de und FuPa: ${heute ? 'heute' : t.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${zeit}`;
  if (stunden > 24) { el.style.color = 'var(--warn)'; el.textContent += ' – älter als ein Tag, die Aktualisierung hakt.'; }
}

/**
 * „Daten aktualisieren“: Der Server baut die Teamzentrale sofort neu (nur Neues).
 * Sobald die neue Fassung da ist, wird gespeichert und die Seite neu geladen.
 */
let aktualisiertSeit = 0;
async function aktualisieren(knopf: HTMLElement) {
  if (aktualisiertSeit) return;
  aktualisiertSeit = Date.now();
  const vorher = await (await fetch('/api/aktualisieren', { credentials: 'same-origin' })).json().catch(() => ({ stand: null }));
  const r = await fetch('/api/aktualisieren', { method: 'POST', headers: HEADERS, credentials: 'same-origin' });
  if (!r.ok) { aktualisiertSeit = 0; hinweis('Aktualisieren gerade nicht möglich.'); return; }
  const knoepfe = [...document.querySelectorAll<HTMLElement>('[data-aktualisieren]')];
  knoepfe.forEach((k) => { k.textContent = 'Daten werden geholt …'; k.setAttribute('disabled', ''); });
  void knopf;
  const pruefen = async () => {
    const d = await (await fetch('/api/aktualisieren', { credentials: 'same-origin' })).json().catch(() => null);
    if (d && d.stand && d.stand !== vorher.stand) {
      hinweis('Neue Daten von fussball.de sind da. Die Seite lädt neu …');
      await speichernJetzt();
      setTimeout(() => location.reload(), 800);
      return;
    }
    if (Date.now() - aktualisiertSeit > 5 * 60_000) {
      aktualisiertSeit = 0;
      document.querySelectorAll<HTMLElement>('[data-aktualisieren]').forEach((k) => { k.textContent = 'Daten aktualisieren'; k.removeAttribute('disabled'); });
      hinweis('Die Aktualisierung dauert ungewöhnlich lange. Bitte später erneut versuchen.');
      return;
    }
    setTimeout(() => void pruefen(), 5000);
  };
  setTimeout(() => void pruefen(), 5000);
}
document.addEventListener('click', (e) => {
  const k = (e.target as HTMLElement).closest?.('[data-aktualisieren]') as HTMLElement | null;
  if (k) { e.preventDefault(); void aktualisieren(k); }
});

/**
 * Neue Daten vom Server (der Bau-Container hat die Teamzentrale neu gebaut, z. B. nach einem Spiel):
 * Ist die Seite gerade nicht sichtbar und alles gespeichert, lädt sie beim nächsten Hinsehen neu;
 * sonst erscheint ein Hinweis mit Knopf. So stehen Gesprächsimpulse und Erkenntnisse auf dem neuen Stand.
 */
let seitenStand: string | null = null;
let neuerStand = false;
async function aufNeueDatenAchten() {
  const d = await (await fetch('/api/aktualisieren', { credentials: 'same-origin' })).json().catch(() => null) as { stand?: string } | null;
  if (!d?.stand) return;
  if (!seitenStand) { seitenStand = d.stand; return; }
  if (d.stand === seitenStand || neuerStand) return;
  neuerStand = true;
  if (document.querySelector('.neue-daten')) return;
  const el = document.createElement('div');
  el.className = 'hinweis11 neue-daten';
  el.setAttribute('role', 'status');
  el.innerHTML = 'Neue Daten von fussball.de und FuPa sind da (Ergebnisse, Impulse, Erkenntnisse). <button type="button">Jetzt neu laden</button>';
  el.querySelector('button')!.addEventListener('click', async () => { await speichernJetzt(); location.reload(); });
  document.body.appendChild(el);
}
async function neuLadenWennRuhig() {
  if (!neuerStand || wartend || tipptGerade()) return;
  await speichernJetzt();
  if (json(schnappschuss()) === json(server.daten)) location.reload();
}

function hinweis(text: string) {
  const el = document.createElement('div');
  el.className = 'hinweis11';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

// ---------- Abgleich mit dem Server ----------
let dateiStand: Daten = {};               // Daten der Datei beim Öffnen (fussball.de, FuPa, Beispiele)
let server = { version: 0, daten: {} as Daten }; // zuletzt bekannter Stand auf dem Server
let wartend: { daten: Daten; von: string | null } | null = null; // fremder Stand, der beim Tippen warten muss
let laeuft = false;

async function laden() {
  const r = await fetch(DOKUMENT, { credentials: 'same-origin' });
  if (r.status === 401) { location.href = '/'; throw new Error('abgemeldet'); }
  if (!r.ok) throw new Error('Server');
  const d = (await r.json()) as { version: number; inhalt: { basis: Daten; daten: Daten } | null; geaendertVon?: string | null };
  return { ...d, inhalt: normalisieren(d.inhalt) };
}

/** Eigene Eingaben über einen neueren Stand legen (Datei oder anderer Trainer). */
function zusammenfuehren(basis: Daten, meins: Daten, fremd: Daten): Daten {
  return abgleichen(basis, meins, fremd);
}

async function speichern(aktuell: Daten) {
  const r = await fetch(DOKUMENT, {
    method: 'PUT', headers: HEADERS, credentials: 'same-origin',
    body: JSON.stringify({ basisVersion: server.version, inhalt: { basis: dateiStand, daten: aktuell } }),
  });
  if (r.status === 409) {
    // Ein anderer Trainer war schneller: dessen Stand holen, beide Änderungen zusammenführen, erneut speichern.
    const neu = await laden();
    const fremd = neu.inhalt?.daten ?? dateiStand;
    const zusammen = zusammenfuehren(server.daten, aktuell, fremd);
    server = { version: neu.version, daten: fremd };
    if (json(zusammen) !== json(aktuell)) { anwenden(zusammen); if (!tipptGerade()) neuZeichnen(); autorenMerken(); }
    return;
  }
  if (r.status === 401) { location.href = '/'; return; }
  if (!r.ok) throw new Error('Speichern fehlgeschlagen');
  server = { version: (await r.json()).version, daten: aktuell };
  status(`Gespeichert um ${uhr()}`);
}

async function speichernJetzt() {
  if (laeuft) return;
  laeuft = true;
  try {
    autorenStempeln();
    const aktuell = schnappschuss();
    if (json(aktuell) !== json(server.daten)) { status('Speichert …'); await speichern(aktuell); }
  } catch {
    status('Nicht gespeichert, keine Verbindung. Wird nachgeholt.', 'warn');
  } finally { laeuft = false; }
}

async function holen() {
  if (laeuft) return;
  laeuft = true;
  try {
    const neu = await laden();
    if (neu.version > server.version && neu.inhalt) {
      autorenStempeln();
      const aktuell = schnappschuss();
      const zusammen = zusammenfuehren(server.daten, aktuell, neu.inhalt.daten);
      server = { version: neu.version, daten: neu.inhalt.daten };
      if (json(zusammen) !== json(aktuell)) wartend = { daten: zusammen, von: neu.geaendertVon ?? null };
    }
    if (wartend && !tipptGerade()) {
      anwenden(wartend.daten);
      neuZeichnen();
      autorenMerken();
      if (wartend.von) hinweis(`Neuer Stand von ${wartend.von} geladen.`);
      wartend = null;
    }
  } catch { /* nächster Versuch beim nächsten Abgleich */ } finally { laeuft = false; }
}

async function start() {
  const st = await (await fetch('/api/status', { credentials: 'same-origin' })).json();
  if (!st.nutzer) { location.href = '/'; return; }
  // Spieler: eigene App, eigene Daten, keine gemeinsamen Speicherungen
  void dossierPdfStarten();
  kalenderAboStarten();
  if (rolle.rolle === 'spieler') { await spielerStarten((d) => anwenden(d)); return; }
  kontoKasten(st.nutzer.name);
  if (rolle.rolle === 'betreuer') betreuerAnpassen(); else void trainerZugaenge();
  maskenDiktatStarten();
  kiUebungStarten();
  dateiStand = schnappschuss();
  try {
    const gespeichert = await laden();
    if (gespeichert.inhalt) {
      // Eingaben der Trainer über die (vielleicht neueren) Daten der Datei legen.
      const daten = zusammenfuehren(gespeichert.inhalt.basis, gespeichert.inhalt.daten, dateiStand);
      anwenden(daten);
      neuZeichnen();
      server = { version: gespeichert.version, daten: gespeichert.inhalt.daten };
    } else {
      server = { version: 0, daten: dateiStand };
    }
    status('Alles gespeichert');
  } catch {
    status('Server nicht erreichbar. Eingaben werden gespeichert, sobald er wieder da ist.', 'warn');
    server = { version: 0, daten: dateiStand };
  }
  // Ab hier gilt jede Änderung als eigene: Stand merken, Stempel anzeigen.
  autorenMerken();
  void autorenStarten(st.nutzer.name);
  setInterval(() => { if (!wartend) void speichernJetzt(); }, 1500);
  setInterval(() => void holen(), 15000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { void neuLadenWennRuhig(); void holen(); } else void speichernJetzt(); });
  void aufNeueDatenAchten();
  setInterval(() => void aufNeueDatenAchten(), 5 * 60_000);
  window.addEventListener('pagehide', () => {
    autorenStempeln();
    const aktuell = schnappschuss();
    if (json(aktuell) === json(server.daten)) return;
    const body = JSON.stringify({ basisVersion: server.version, inhalt: { basis: dateiStand, daten: aktuell } });
    void fetch(DOKUMENT, { method: 'PUT', headers: HEADERS, credentials: 'same-origin', keepalive: body.length < 60000, body });
  });
}

void start();
