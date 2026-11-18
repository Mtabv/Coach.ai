/**
 * Oberfläche je Rolle in der Teamzentrale. Welche Daten jemand bekommt, entscheidet der Server;
 * hier wird nur die Ansicht passend gemacht.
 *
 * - Spieler: nur die Spieler-App (Spielersicht im Vollbild), Aktionen gehen einzeln an den Server.
 * - Betreuer: Kalender, Training (nur ansehen), Kader, Spielersicht; keine Spieltagsvorbereitung, Noten, Gespräche.
 * - Trainer: alles, dazu „Spieler-Zugänge“ (persönliche Links) im Kader.
 */
type Obj = Record<string, unknown>;
export interface Rolle { rolle: 'trainer' | 'betreuer' | 'spieler'; pid: string | null; name: string }
export const rolle: Rolle = (window as unknown as { __11plan?: Rolle }).__11plan ?? { rolle: 'trainer', pid: null, name: '' };

const global = (n: string): unknown => { try { return (0, eval)(n); } catch { return undefined; } };
const HEADERS = { 'Content-Type': 'application/json', 'X-CoachAI': '1' };
const neuZeichnen = () => { const r = global('render'); if (typeof r === 'function') r(); };
const state = () => (global('state') ?? {}) as Obj;
const wert = (id: string) => ((document.getElementById(id) as HTMLInputElement | null)?.value ?? '').trim();
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function hinweis(text: string) {
  const el = document.createElement('div');
  el.className = 'hinweis11'; el.setAttribute('role', 'status'); el.textContent = text;
  document.body.appendChild(el); setTimeout(() => el.remove(), 5000);
}

// =====================================================================================================
// Spieler
// =====================================================================================================

/** Start der Spieler-App: eigene Daten laden, nur die Spielersicht zeigen, Aktionen an den Server. */
export async function spielerStarten(anwenden: (d: Obj) => void) {
  document.body.classList.add('spielermodus');
  const css = document.createElement('style');
  css.textContent = `
    body.spielermodus .app { grid-template-columns: 1fr; background: var(--bg); }
    body.spielermodus .side, body.spielermodus #main > .demo, body.spielermodus #main > .head, body.spielermodus #main > .row,
    body.spielermodus #main > .grid > .card, body.spielermodus .masken-diktat, body.spielermodus .md-meldung { display: none !important; }
    body.spielermodus main { padding: 12px 10px 40px; }
    body.spielermodus #main > .grid { display: block !important; }
    body.spielermodus .phone { border: 0; border-radius: 0; max-width: 620px; margin: 0 auto; padding: 4px 2px; background: transparent; }
    body.spielermodus .phone-h b { font-size: 20px; }
    .push-karte { display: grid; gap: 6px; }
  `;
  document.head.appendChild(css);
  const laden = async () => {
    const r = await fetch('/api/spieler/stand', { credentials: 'same-origin' });
    if (r.status === 401) { location.href = '/'; return; }
    const b = await r.json() as { daten: Obj; pid: string };
    anwenden(b.daten);
    (0, eval)(`ME = ${JSON.stringify(b.pid)}`);
    const st = state(); st.pvMe = b.pid;
    if (location.hash !== '#spielersicht') location.hash = 'spielersicht'; else neuZeichnen();
  };
  window.addEventListener('hashchange', () => { if (location.hash !== '#spielersicht') location.hash = 'spielersicht'; });
  await laden();
  // Andere Änderungen (Trainer, Mitspieler) regelmäßig holen – nicht, während jemand tippt
  setInterval(() => { const a = document.activeElement; if (!a || !a.matches('input, textarea, select')) void laden(); }, 30_000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void laden(); });

  // Aktionen der Spielersicht abfangen und einzeln an den Server schicken
  document.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-reply],[data-decline],[data-abssave],[data-absdel],[data-dutyjoin],[data-dutyleave],[data-dutygive],[data-noticeok],[data-rideoffer],[data-rideseek],[data-ridetake],[data-ridedrop],[data-rideoff],[data-rideleave]');
    if (!t) return;
    const d = t.dataset, st = state();
    let a: Obj | null = null;
    if (d.reply) { if (d.v === 'nein') return; a = { typ: 'zusage', eid: d.reply }; }
    else if (d.decline) {
      if (!wert('rs-' + d.decline)) { document.getElementById('rs-' + d.decline)?.classList.add('need'); ev.stopPropagation(); return; }
      a = { typ: 'absage', eid: d.decline, why: wert('rs-' + d.decline), note: wert('rn-' + d.decline) }; st.declining = null;
    }
    else if (d.abssave) { a = { typ: 'abwesenheit', from: wert('af-from'), to: wert('af-to'), why: wert('af-why'), note: wert('af-note') }; st.absForm = false; }
    else if (d.absdel) { const x = (global('absences') as Obj[] | undefined)?.[Number(d.absdel)]; if (x) a = { typ: 'abwesenheitWeg', from: x.from, to: x.to, why: x.why }; }
    else if (d.dutyjoin) a = { typ: 'dienstNehmen', did: d.dutyjoin };
    else if (d.dutyleave) a = { typ: 'dienstAustragen', did: d.dutyleave };
    else if (d.dutygive) { if (!wert('dg-' + d.dutygive)) { ev.stopPropagation(); return; } a = { typ: 'dienstAbgeben', did: d.dutygive, an: wert('dg-' + d.dutygive) }; }
    else if (d.noticeok) a = { typ: 'mitteilungOk', id: d.noticeok };
    else if (d.rideoffer) a = { typ: 'fahrtAnbieten', gid: d.rideoffer, plaetze: Number(wert('rideseats-' + d.rideoffer)) || 1, ab: wert('rideab-' + d.rideoffer) };
    else if (d.rideseek) a = { typ: 'fahrtSuchen', gid: d.rideseek };
    else if (d.ridetake) { if (!wert('ridepick-' + d.ridetake)) { ev.stopPropagation(); return; } a = { typ: 'fahrtMitnehmen', gid: d.ridetake, mit: wert('ridepick-' + d.ridetake) }; }
    else if (d.ridedrop) { const [gid, mit] = d.ridedrop.split('|'); a = { typ: 'fahrtEntfernen', gid, mit }; }
    else if (d.rideoff) a = { typ: 'fahrtZurueck', gid: d.rideoff };
    else if (d.rideleave) a = { typ: 'fahrtVerlassen', gid: d.rideleave };
    if (!a) return;
    ev.stopPropagation(); ev.preventDefault();
    t.setAttribute('disabled', '');
    void (async () => {
      const r = await fetch('/api/spieler/aktion', { method: 'POST', headers: HEADERS, credentials: 'same-origin', body: JSON.stringify(a) });
      const b = await r.json().catch(() => ({})) as { daten?: Obj; fehler?: string };
      if (!r.ok || !b.daten) { hinweis(b.fehler || 'Das hat nicht geklappt. Bitte gleich nochmal.'); t.removeAttribute('disabled'); return; }
      anwenden(b.daten);
      neuZeichnen();
    })();
  }, true);

  pushKarte();
}

// =====================================================================================================
// Push: Benachrichtigungen einschalten (Spieler-App, auf Wunsch auch Trainer)
// =====================================================================================================

const pushMoeglich = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const iosOhneStartbildschirm = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator as unknown as { standalone?: boolean }).standalone && !matchMedia('(display-mode: standalone)').matches;
const schluessel = (b64: string) => { const p = '='.repeat((4 - (b64.length % 4)) % 4), raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };

export async function pushEinschalten(): Promise<string> {
  if (!pushMoeglich()) return iosOhneStartbildschirm() ? 'Auf dem iPhone zuerst unten auf „Teilen“ › „Zum Home-Bildschirm“ tippen und 11Plan von dort öffnen.' : 'Dieser Browser kann keine Benachrichtigungen.';
  const reg = await navigator.serviceWorker.register('/sw.js');
  const erlaubt = await Notification.requestPermission();
  if (erlaubt !== 'granted') return 'Benachrichtigungen wurden nicht erlaubt. Das lässt sich in den Einstellungen des Handys ändern.';
  const k = await (await fetch('/api/push/schluessel', { credentials: 'same-origin' })).json() as { schluessel?: string };
  if (!k.schluessel) return 'Push ist auf dem Server noch nicht eingerichtet.';
  const abo = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: schluessel(k.schluessel) });
  const r = await fetch('/api/push/abo', { method: 'POST', headers: HEADERS, credentials: 'same-origin', body: JSON.stringify({ abo: abo.toJSON() }) });
  if (!r.ok) return 'Anmelden für Benachrichtigungen hat nicht geklappt.';
  await fetch('/api/push/test', { method: 'POST', headers: HEADERS, credentials: 'same-origin' });
  localStorage.setItem('11plan-push', 'an');
  return '';
}

function pushKarte() {
  const zeigen = () => {
    const phone = document.querySelector('.phone');
    if (!phone || phone.querySelector('.push-karte')) return;
    if (localStorage.getItem('11plan-push') === 'an' && 'Notification' in window && Notification.permission === 'granted') return;
    if (localStorage.getItem('11plan-push') === 'nein') return;
    const k = document.createElement('div');
    k.className = 'pt push-karte';
    const ios = iosOhneStartbildschirm();
    k.innerHTML = `<b>🔔 Benachrichtigungen</b><span class="note">${ios ? 'Damit dich 11Plan an Dienste und Fahrgemeinschaften erinnern kann: unten auf „Teilen“ (Viereck mit Pfeil) › „Zum Home-Bildschirm“ tippen, 11Plan dort öffnen und hier einschalten.' : 'Bei neuen Diensten, Fahrgemeinschaften und Erinnerungen am Spieltag.'}</span>
      <div class="row">${ios ? '' : '<button class="btn small" data-k="an">Einschalten</button>'}<button class="btn ghost small" data-k="nein">Nicht jetzt</button></div><span class="note" data-k="info"></span>`;
    k.addEventListener('click', async (e) => {
      const was = (e.target as HTMLElement).getAttribute('data-k');
      if (was === 'nein') { localStorage.setItem('11plan-push', 'nein'); k.remove(); }
      if (was === 'an') { const f = await pushEinschalten().catch(() => 'Das hat nicht geklappt.'); if (f) k.querySelector<HTMLElement>('[data-k=info]')!.textContent = f; else k.innerHTML = '<b>🔔 Benachrichtigungen sind an.</b>'; }
    });
    const kopf = phone.querySelector('.ptabs');
    if (kopf) kopf.after(k); else phone.prepend(k);
  };
  zeigen();
  new MutationObserver(() => zeigen()).observe(document.body, { childList: true, subtree: true });
}

// =====================================================================================================
// Betreuer
// =====================================================================================================

const BETREUER_SEITEN = ['kalender', 'kader', 'spieler', 'training', 'einheit', 'uebung', 'spielersicht'];

export function betreuerAnpassen() {
  document.body.classList.add('betreuermodus');
  const css = document.createElement('style');
  const nav = BETREUER_SEITEN.map((s) => `:not([href="#${s}"])`).join('');
  css.textContent = `
    body.betreuermodus #nav a${nav} { display: none !important; }
    body.betreuermodus #nav .navsep { display: none; }
    /* Training nur ansehen */
    body.betreuermodus [data-assign], body.betreuermodus [data-exremove], body.betreuermodus [data-exup], body.betreuermodus .exdrop,
    body.betreuermodus [data-pickfor], body.betreuermodus [data-suggest], body.betreuermodus [data-take], body.betreuermodus [data-useunit],
    body.betreuermodus [data-exadd], body.betreuermodus a[href="#uebung-neu"], body.betreuermodus a[href="#einheit-neu"],
    body.betreuermodus [data-exedit], body.betreuermodus .nb-training, body.betreuermodus .tr-focus, body.betreuermodus .ki-leiste,
    body.betreuermodus .side-pick, body.betreuermodus .unitview aside, body.betreuermodus [data-trainadd] { display: none !important; }
    body.betreuermodus .unitview { grid-template-columns: 1fr !important; }
  `;
  document.head.appendChild(css);
  const pruefen = () => { const h = location.hash.slice(1) || 'dashboard'; if (!BETREUER_SEITEN.includes(h)) location.hash = 'kalender'; };
  window.addEventListener('hashchange', pruefen);
  pruefen();
}

// =====================================================================================================
// Trainer: Spieler-Zugänge (persönliche Links) im Kader
// =====================================================================================================

const neueLinks = new Map<string, string>();
let zugaenge: Record<string, { seit: number | null; push: number }> = {};

async function zugaengeLaden() {
  const r = await fetch('/api/spieler/links', { credentials: 'same-origin' });
  if (!r.ok) return;
  const b = await r.json() as { zugaenge: { pid: string; seit: number | null; push: number }[] };
  zugaenge = Object.fromEntries(b.zugaenge.map((z) => [z.pid, { seit: z.seit, push: z.push }]));
}

function zugaengeKarte() {
  if (location.hash !== '#kader') return;
  const main = document.getElementById('main');
  if (!main || main.querySelector('.zugaenge')) return;
  const players = (global('players') ?? []) as { id: string; name: string; pos: string }[];
  const karte = document.createElement('details');
  karte.className = 'card zugaenge';
  if (neueLinks.size) karte.open = true;
  const mit = players.filter((p) => zugaenge[p.id]?.seit).length;
  karte.innerHTML = `<summary><b>Spieler-Zugänge</b> <span class="note">· ${mit} von ${players.length} haben einen Link · ${Object.values(zugaenge).filter((z) => z.push).length} mit Benachrichtigungen</span></summary>
    <p class="sub">Jeder Spieler bekommt einen persönlichen Link (ohne Passwort), z. B. per WhatsApp. Damit sieht er nur seine Spieler-App: Termine, Zu- und Absage, Abwesenheiten, Dienste, Fahrgemeinschaft. Wird ein Link weitergegeben: „Neuer Link“ – der alte gilt dann nicht mehr.</p>
    <div class="zg-liste">${players.map((p) => { const z = zugaenge[p.id], l = neueLinks.get(p.id);
      const text = `Hallo ${p.name.split(' ')[0]}, hier ist dein persönlicher Zugang zu 11Plan (Termine, Zu- und Absagen, Dienste, Fahrgemeinschaften): ${l}\nAm besten öffnen und auf dem Handy „Zum Home-Bildschirm“ hinzufügen. Bitte nicht weitergeben.`;
      return `<div class="zg"><span class="posb">${esc(p.pos || '')}</span><span><b>${esc(p.name)}</b><span class="note">${z?.seit ? ` · Link seit ${new Date(z.seit).toLocaleDateString('de-DE')}${z.push ? ' · 🔔' : ''}` : ' · noch kein Link'}</span>
        ${l ? `<span class="zg-link"><input type="text" readonly value="${esc(l)}" aria-label="Link für ${esc(p.name)}"><a class="btn small" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">Per WhatsApp</a></span>` : ''}</span>
        <span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn ghost small" data-zg="${esc(p.id)}" data-zgname="${esc(p.name)}">${z?.seit ? 'Neuer Link' : 'Link erzeugen'}</button>${z?.seit ? `<button class="ib" data-zgsperren="${esc(p.id)}" title="Zugang sperren" aria-label="Zugang sperren">✕</button>` : ''}</span></div>`; }).join('')}</div>`;
  main.querySelector('.head')?.after(karte) ?? main.prepend(karte);
  karte.addEventListener('click', async (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-zg],[data-zgsperren]'); if (!t) return;
    if (t.dataset.zg) {
      if (zugaenge[t.dataset.zg]?.seit && !confirm('Neuen Link erzeugen? Der bisherige Link gilt dann nicht mehr.')) return;
      const r = await fetch('/api/spieler/links', { method: 'POST', headers: HEADERS, credentials: 'same-origin', body: JSON.stringify({ pid: t.dataset.zg, name: t.dataset.zgname }) });
      const b = await r.json() as { link?: string; fehler?: string };
      if (!b.link) { hinweis(b.fehler || 'Link konnte nicht erzeugt werden.'); return; }
      neueLinks.set(t.dataset.zg, b.link);
      if (navigator.clipboard) void navigator.clipboard.writeText(b.link).catch(() => {});
    } else if (t.dataset.zgsperren) {
      if (!confirm('Zugang sperren? Der Spieler kommt mit seinem Link nicht mehr hinein.')) return;
      await fetch(`/api/spieler/links/${encodeURIComponent(t.dataset.zgsperren)}`, { method: 'DELETE', headers: HEADERS, credentials: 'same-origin' });
      neueLinks.delete(t.dataset.zgsperren);
    }
    await zugaengeLaden(); karte.remove(); zugaengeKarte();
  });
}

// =====================================================================================================
// Trainer: Team & Zugänge (Trainer und Betreuer verwalten, offene Einladungen)
// =====================================================================================================

interface Konto { id: number; name: string; email: string; role: string; seit: string; angemeldet: number; push: number }
interface Einladung { id: number; role: string; bis: number; von: string | null }
let team: { ich: number; nutzer: Konto[]; einladungen: Einladung[] } | null = null;
let teamOffen = false, neueEinladung = '';
const istTrainerRolle = (r: string) => r === 'trainer' || r === 'co-trainer';

async function teamLaden() {
  const r = await fetch('/api/team/verwaltung', { credentials: 'same-origin' });
  team = r.ok ? await r.json() : null;
}

async function teamAnfrage(url: string, method: string, body?: Obj): Promise<boolean> {
  const r = await fetch(url, { method, headers: HEADERS, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined });
  if (r.ok) return true;
  const b = await r.json().catch(() => ({})) as { fehler?: string };
  hinweis(b.fehler || 'Das hat nicht geklappt.');
  return false;
}

function teamKarte() {
  if (location.hash !== '#kader' || !team) return;
  const main = document.getElementById('main');
  if (!main || main.querySelector('.teamzugaenge')) return;
  const karte = document.createElement('details');
  karte.className = 'card teamzugaenge';
  karte.id = 'team-zugaenge';
  karte.open = teamOffen;
  const t = team, trainer = t.nutzer.filter((n) => istTrainerRolle(n.role)), betreuer = t.nutzer.filter((n) => !istTrainerRolle(n.role));
  const zeile = (n: Konto) => {
    const ich = n.id === t.ich, tr = istTrainerRolle(n.role);
    return `<div class="zg tz-konto"><span class="posb">${tr ? 'TR' : 'BT'}</span><span><b>${esc(n.name)}</b>${ich ? ' <span class="pill">du</span>' : ''}<span class="note"> · ${esc(n.email)} · ${n.angemeldet ? 'angemeldet' : 'nicht angemeldet'}${n.push ? ' · 🔔' : ''}</span></span>
      <span class="row" style="gap:6px;flex-wrap:nowrap">${ich ? '<span class="note">eigenes Konto</span>' : `<select class="f" data-tzrolle="${n.id}" aria-label="Rolle von ${esc(n.name)}"><option value="trainer"${tr ? ' selected' : ''}>Trainer</option><option value="betreuer"${tr ? '' : ' selected'}>Betreuer</option></select><button class="ib" data-tzweg="${n.id}" data-tzname="${esc(n.name)}" title="Zugang entfernen" aria-label="Zugang von ${esc(n.name)} entfernen">✕</button>`}</span></div>`;
  };
  karte.innerHTML = `<summary><b>Team &amp; Zugänge</b> <span class="note">· ${trainer.length} Trainer · ${betreuer.length} Betreuer${t.einladungen.length ? ` · ${t.einladungen.length} offene Einladung${t.einladungen.length > 1 ? 'en' : ''}` : ''}</span></summary>
    <p class="sub"><b>Trainer</b> sehen und bearbeiten alles. <b>Betreuer</b> sehen Kalender, Training (nur ansehen), Kader und Spielersicht – keine Noten, Gespräche, Bewertungen oder Spieltagsvorbereitung. Eine geänderte Rolle gilt beim nächsten Öffnen der Seite. Spieler bekommen ihren Zugang unten bei „Spieler-Zugänge“.</p>
    <div class="zg-liste">${[...trainer, ...betreuer].map(zeile).join('')}</div>
    <div class="row" style="gap:6px;margin-top:10px"><button class="btn small ghost" data-tzneu="trainer">+ Trainer einladen</button><button class="btn small ghost" data-tzneu="betreuer">+ Betreuer einladen</button></div>
    ${neueEinladung ? `<div class="zg-link"><input type="text" readonly value="${esc(neueEinladung)}" aria-label="Einladungslink"><a class="btn small" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('Hier ist deine Einladung zu 11Plan (7 Tage und nur einmal gültig): ' + neueEinladung)}">Per WhatsApp</a></div><p class="note">Link kopiert. Er gilt 7 Tage und nur einmal.</p>` : ''}
    ${t.einladungen.length ? `<p class="note" style="margin-top:10px"><b>Offene Einladungen</b></p>${t.einladungen.map((e) => `<div class="zg"><span class="posb">${istTrainerRolle(e.role) ? 'TR' : 'BT'}</span><span>${istTrainerRolle(e.role) ? 'Trainer' : 'Betreuer'}<span class="note"> · gültig bis ${new Date(e.bis).toLocaleDateString('de-DE')}${e.von ? ` · von ${esc(e.von)}` : ''}</span></span><button class="btn ghost small" data-tzinvweg="${e.id}">Zurückziehen</button></div>`).join('')}` : ''}`;
  const spieler = main.querySelector('.zugaenge');
  if (spieler) spieler.before(karte); else main.querySelector('.head')?.after(karte) ?? main.prepend(karte);
  karte.addEventListener('toggle', () => { teamOffen = karte.open; });
  const neu = async () => { await teamLaden(); karte.remove(); teamKarte(); };
  karte.addEventListener('change', async (e) => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>('[data-tzrolle]'); if (!sel) return;
    const n = t.nutzer.find((x) => x.id === Number(sel.dataset.tzrolle));
    if (!confirm(`${n?.name ?? 'Diese Person'} wird ${sel.value === 'trainer' ? 'Trainer und sieht dann alles' : 'Betreuer und sieht dann keine Noten, Gespräche und Spieltagsvorbereitung'}. Fortfahren?`)) { sel.value = istTrainerRolle(n?.role ?? '') ? 'trainer' : 'betreuer'; return; }
    if (await teamAnfrage(`/api/team/${sel.dataset.tzrolle}`, 'PATCH', { rolle: sel.value })) hinweis('Rolle geändert.');
    await neu();
  });
  karte.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tzweg],[data-tzneu],[data-tzinvweg]'); if (!b) return;
    if (b.dataset.tzweg) {
      if (!confirm(`Zugang von ${b.dataset.tzname} entfernen? Die Person wird sofort abgemeldet und kommt nicht mehr hinein. Ihre Einträge in Training, Kalender usw. bleiben erhalten.`)) return;
      if (await teamAnfrage(`/api/team/${b.dataset.tzweg}`, 'DELETE')) hinweis('Zugang entfernt.');
    } else if (b.dataset.tzneu) {
      const r = await fetch('/api/einladungen', { method: 'POST', headers: HEADERS, credentials: 'same-origin', body: JSON.stringify({ rolle: b.dataset.tzneu }) });
      const d = await r.json() as { link?: string; fehler?: string };
      if (!d.link) { hinweis(d.fehler || 'Einladung konnte nicht erzeugt werden.'); return; }
      neueEinladung = d.link;
      if (navigator.clipboard) void navigator.clipboard.writeText(d.link).catch(() => {});
    } else if (b.dataset.tzinvweg) {
      if (!confirm('Einladung zurückziehen? Der Link funktioniert dann nicht mehr.')) return;
      await teamAnfrage(`/api/einladungen/offen/${b.dataset.tzinvweg}`, 'DELETE');
    }
    await neu();
  });
}

/** Aus der Seitenleiste: zum Kader springen und „Team & Zugänge“ aufklappen. */
export function teamZugaengeOeffnen() {
  teamOffen = true;
  const zeigen = () => { const k = document.getElementById('team-zugaenge') as HTMLDetailsElement | null; if (k) { k.open = true; k.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
  if (location.hash === '#kader') zeigen(); else { location.hash = 'kader'; setTimeout(zeigen, 120); }
}

export async function trainerZugaenge() {
  const css = document.createElement('style');
  css.textContent = `
    .zugaenge summary { cursor: pointer; }
    .zg-liste { display: grid; gap: 4px; }
    .zg { display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px solid var(--line); }
    .zg-link { display: flex; gap: 6px; margin-top: 4px; } .zg-link input { flex: 1; font-size: 12px; }
  `;
  document.head.appendChild(css);
  await Promise.all([zugaengeLaden(), teamLaden()]);
  const karten = () => { zugaengeKarte(); teamKarte(); };
  let geplant = false;
  new MutationObserver(() => { if (geplant) return; geplant = true; requestAnimationFrame(() => { geplant = false; karten(); }); }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => setTimeout(karten, 30));
  karten();
}
