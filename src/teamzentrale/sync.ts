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
  'komTab', 'dragged', 'pvNow', 'msg', 'showEv', 'pvAna', 'travel',
]);

const global = (name: string): unknown => {
  try { return (0, eval)(name); } catch { return undefined; }
};
const json = (v: unknown) => JSON.stringify(v);
const kopie = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? null));
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

function schnappschuss(): Daten {
  const out: Daten = {};
  for (const n of NAMEN) { const v = global(n); if (v !== undefined) out[n] = kopie(v); }
  const state = global('state');
  if (isObj(state)) out.state = kopie(Object.fromEntries(Object.entries(state).filter(([k]) => !NUR_ANSICHT.has(k))));
  const players = global('players');
  if (Array.isArray(players)) out.players = kopie(players.map((p: Obj) => { const { photo: _photo, ...rest } = p; return rest; }));
  return out;
}

/** Überträgt `wert` in das bestehende Objekt, damit Verweise innerhalb der Teamzentrale gültig bleiben. */
function einsetzen(ziel: unknown, wert: unknown, behalten: string[] = []): unknown {
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

function anwenden(d: Daten) {
  for (const n of NAMEN) {
    const ziel = global(n);
    if (n in d && ziel && typeof ziel === 'object') einsetzen(ziel, d[n]);
  }
  const state = global('state');
  if (isObj(state) && isObj(d.state)) for (const [k, v] of Object.entries(d.state)) if (!NUR_ANSICHT.has(k)) {
    state[k] = (isObj(state[k]) && isObj(v)) || (Array.isArray(state[k]) && Array.isArray(v)) ? einsetzen(state[k], v) : v;
  }
  const players = global('players');
  if (Array.isArray(players) && Array.isArray(d.players)) einsetzen(players, d.players, ['photo']);
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
  .konto11 { order: 2; margin: 0 0 0 auto; padding: 0; border: 0; display: flex; align-items: center; gap: 6px; font-size: 12px; }
  .konto11 > div:first-child, .konto11 [data-k=status] { display: none; }
  .konto11 .row { flex-wrap: nowrap; }
  .konto11 [data-k=link] { position: absolute; left: 12px; right: 12px; top: 100%; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 10px; }
  .konto11 .row .btn { padding: 4px 8px; font-size: 13px; }
  .demo { display: none; }
  .hinweis11 { left: 12px; right: 12px; bottom: 12px; }
}
/* Zustand des Speicherns auf dem Handy als kleiner Punkt am Logo */
.side .brand[data-status]::after { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-left: 6px; vertical-align: middle; background: var(--accent); }
.side .brand[data-status=speichert]::after { background: var(--warn); }
.side .brand[data-status=fehler]::after { background: #f0857a; }
@media (min-width: 901px) { .side .brand[data-status]::after { display: none; } }`;
  document.head.appendChild(css);
  const box = document.createElement('div');
  box.className = 'konto11';
  box.innerHTML = '<div>Angemeldet als <b></b></div><div class="row"><button class="btn small ghost" data-k="einladen">Trainer einladen</button><button class="btn small ghost" data-k="ab">Abmelden</button></div><div data-k="link" hidden></div><div class="note" data-k="status">Wird geladen …</div>';
  box.querySelector('b')!.textContent = name;
  anzeige = box.querySelector('[data-k=status]');
  (document.querySelector('.side') || document.body).appendChild(box);
  box.addEventListener('click', async (e) => {
    const k = (e.target as HTMLElement).getAttribute('data-k');
    if (k === 'ab') {
      await speichernJetzt();
      await fetch('/api/abmelden', { method: 'POST', headers: HEADERS, credentials: 'same-origin' });
      location.href = '/';
    }
    if (k === 'einladen') {
      const d = await (await fetch('/api/einladungen', { method: 'POST', headers: HEADERS, credentials: 'same-origin' })).json();
      const el = box.querySelector<HTMLElement>('[data-k=link]')!;
      el.hidden = false;
      el.textContent = 'Link, 7 Tage und nur einmal gültig:';
      const i = document.createElement('input');
      i.type = 'text'; i.readOnly = true; i.value = d.link || d.fehler;
      el.appendChild(i); i.select();
      if (d.link && navigator.clipboard) navigator.clipboard.writeText(d.link).then(() => { el.firstChild!.textContent = 'Link kopiert, 7 Tage und nur einmal gültig:'; }, () => {});
    }
  });
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
  return r.json() as Promise<{ version: number; inhalt: { basis: Daten; daten: Daten } | null; geaendertVon?: string | null }>;
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
    if (json(zusammen) !== json(aktuell)) { anwenden(zusammen); if (!tipptGerade()) neuZeichnen(); }
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
      const aktuell = schnappschuss();
      const zusammen = zusammenfuehren(server.daten, aktuell, neu.inhalt.daten);
      server = { version: neu.version, daten: neu.inhalt.daten };
      if (json(zusammen) !== json(aktuell)) wartend = { daten: zusammen, von: neu.geaendertVon ?? null };
    }
    if (wartend && !tipptGerade()) {
      anwenden(wartend.daten);
      neuZeichnen();
      if (wartend.von) hinweis(`Neuer Stand von ${wartend.von} geladen.`);
      wartend = null;
    }
  } catch { /* nächster Versuch beim nächsten Abgleich */ } finally { laeuft = false; }
}

async function start() {
  const st = await (await fetch('/api/status', { credentials: 'same-origin' })).json();
  if (!st.nutzer) { location.href = '/'; return; }
  kontoKasten(st.nutzer.name);
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
  setInterval(() => { if (!wartend) void speichernJetzt(); }, 1500);
  setInterval(() => void holen(), 15000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void holen(); else void speichernJetzt(); });
  window.addEventListener('pagehide', () => {
    const aktuell = schnappschuss();
    if (json(aktuell) === json(server.daten)) return;
    const body = JSON.stringify({ basisVersion: server.version, inhalt: { basis: dateiStand, daten: aktuell } });
    void fetch(DOKUMENT, { method: 'PUT', headers: HEADERS, credentials: 'same-origin', keepalive: body.length < 60000, body });
  });
}

void start();
