import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import type { Db } from './db.js';
import {
  checkPasswordRules, clearAttempts, countUsers, createInvite, createSession, createUser, deleteSession, findUserByEmail,
  hashPassword, noteAttempt, openInvite, tooManyAttempts, useInvite, userForSession, verifyPassword, type User,
  istTrainer, spielerKonto, spielerLinkErzeugen, spielerLinkEinloesen, spielerSessionTage,
} from './auth.js';
import { AktionsFehler, betreuerSicht, betreuerUebernehmen, dienstErinnerungen, dienstUmlegen, neueMitteilungen, spielerAktion, spielerSicht, type Daten } from './rollen.js';
import { reinerText, type PushDienst } from './push.js';
import { KiFehler, KI_MODELL, type KiAnfrage } from './ki.js';

export interface Config {
  /** Ordner mit dem gebauten Frontend (index.html, assets/). */
  publicDir: string;
  /** Einmal-Schlüssel für das erste Konto. Steht nur in der .env auf dem Server. */
  setupToken: string;
  /** Interner Datendienst (fussball.de, FuPa) und sein Schlüssel. Der Schlüssel erreicht nie den Browser. */
  datendienstUrl: string;
  datendienstKey: string;
  /** Hinter HTTPS (Caddy): Cookie nur über HTTPS senden. */
  secureCookies: boolean;
  /** Öffentliche Adresse für Einladungslinks, z. B. https://coach.example.de */
  publicUrl: string;
  /**
   * Gebaute Teamzentrale (prototype/bauen.sh) mit den echten Mannschaftsdaten. Liegt nur auf dem Server,
   * nie im Repository. Wird nach der Anmeldung unter /teamzentrale ausgeliefert.
   */
  teamzentrale?: string;
  /** Startstand für das Spieltagsdossier (Mannschaftsprofil), solange auf dem Server noch nichts gespeichert ist. */
  dossierStart?: string;
  /** Merkzettel für den Bau-Container: Teamzentrale sofort neu bauen (Knopf „Jetzt aktualisieren“). */
  aktualisierenDatei?: string;
  /** Interner Sprachdienst (Whisper auf dem eigenen Server): Aufnahme rein, Text raus. */
  spracheUrl?: string;
  /** KI-Verteilung auf Felder (Anthropic), nur wenn ANTHROPIC_API_KEY in der .env steht. */
  ki?: (a: KiAnfrage) => Promise<Record<string, string>>;
  /** Push-Nachrichten (Web Push); ohne: keine Benachrichtigungen. */
  push?: PushDienst;
}

const COOKIE = 'coachai_session';
const MAX_BODY = 25 * 1024 * 1024; // Zustand mit Wappen und Bildern als Daten-URLs
const HISTORY_KEEP = 50;
const MAX_AUDIO = 20 * 1024 * 1024; // etwa eine Viertelstunde Sprache
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(json);
}

function cookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0; const chunks: Buffer[] = [];
  for await (const c of req) { size += (c as Buffer).length; if (size > MAX_BODY) throw new HttpError(413, 'Die Daten sind zu groß.'); chunks.push(c as Buffer); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Ungültige Daten.'); }
}

const str = (v: unknown, field: string, max = 200): string => {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `${field} fehlt.`);
  if (v.length > max) throw new HttpError(400, `${field} ist zu lang.`);
  return v.trim();
};
const email = (v: unknown) => { const e = str(v, 'E-Mail'); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new HttpError(400, 'Die E-Mail-Adresse ist ungültig.'); return e; };
const ip = (req: IncomingMessage) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const publicUser = (u: User) => ({ id: u.id, name: u.name, email: u.role === 'spieler' ? '' : u.email, role: u.role, pid: u.pid ?? null });

export function createHandler(db: Db, cfg: Config) {
  const sessionCookie = (t: string, maxAge: number) => `${COOKIE}=${encodeURIComponent(t)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${cfg.secureCookies ? '; Secure' : ''}`;
  const clearCookie = `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${cfg.secureCookies ? '; Secure' : ''}`;

  const kiNutzung = new Map<number, number[]>();
  function currentUser(req: IncomingMessage): User | null { return userForSession(db, cookies(req)[COOKIE]); }
  function requireUser(req: IncomingMessage): User { const u = currentUser(req); if (!u) throw new HttpError(401, 'Bitte anmelden.'); return u; }
  /** Nur Trainer (volle Rechte). */
  function requireTrainer(req: IncomingMessage): User { const u = requireUser(req); if (!istTrainer(u)) throw new HttpError(403, 'Nur für das Trainerteam.'); return u; }
  /** Trainer oder Betreuer (Organisation). */
  function requireStab(req: IncomingMessage): User { const u = requireUser(req); if (!istTrainer(u) && u.role !== 'betreuer') throw new HttpError(403, 'Nicht freigegeben.'); return u; }

  // ---------- Gemeinsame Dokumente lesen und schreiben (mit Verlauf und Push für neue Mitteilungen) ----------
  type DocRow = { version: number; json: string; updated_at: string; von: string | null };
  const docLesen = (name: string) => db.prepare('SELECT version, json, updated_at, u.name AS von FROM docs LEFT JOIN users u ON u.id = updated_by WHERE docs.name = ?').get(name) as DocRow | undefined;
  function docSchreiben(name: string, inhalt: unknown, userId: number | null, version: number): number {
    const json = JSON.stringify(inhalt), next = version + 1;
    const vorher = docLesen(name);
    db.exec('BEGIN');
    try {
      db.prepare("INSERT INTO docs (name, version, json, updated_by, updated_at) VALUES (?, ?, ?, ?, datetime('now')) ON CONFLICT(name) DO UPDATE SET version = excluded.version, json = excluded.json, updated_by = excluded.updated_by, updated_at = excluded.updated_at").run(name, next, json, userId);
      db.prepare("INSERT INTO docs_history (name, version, json, updated_by, updated_at) VALUES (?, ?, ?, ?, datetime('now'))").run(name, next, json, userId);
      db.prepare('DELETE FROM docs_history WHERE name = ? AND version <= ?').run(name, next - HISTORY_KEEP);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    if (name === 'teamzentrale') {
      const alt = vorher ? (JSON.parse(vorher.json) as { daten?: Daten }).daten ?? null : null;
      const neu = (inhalt as { daten?: Daten }).daten;
      if (neu) void mitteilungenPushen(neueMitteilungen(alt, neu));
    }
    return next;
  }
  /** Neue Mitteilungen als Push an die betroffenen Spieler schicken. */
  async function mitteilungenPushen(liste: { to: string; text: string }[]) {
    if (!cfg.push || !liste.length) return;
    for (const n of liste) {
      const ids = (db.prepare('SELECT id FROM users WHERE pid = ?').all(n.to) as { id: number }[]).map((r) => r.id);
      if (ids.length) await cfg.push.senden(ids, { title: '11Plan', body: reinerText(n.text), url: '/teamzentrale' }).catch(() => 0);
    }
  }
  const tzDaten = (): { version: number; basis: unknown; daten: Daten } => {
    const r = docLesen('teamzentrale');
    if (!r) return { version: 0, basis: null, daten: {} };
    const j = JSON.parse(r.json) as { basis?: unknown; daten?: Daten };
    return { version: r.version, basis: j.basis ?? null, daten: j.daten ?? {} };
  };

  async function api(req: IncomingMessage, res: ServerResponse, path: string) {
    const m = req.method || 'GET';
    // Schutz gegen fremde Seiten, die Anfragen im Namen des Nutzers schicken: Änderungen nur mit diesem Kopf.
    if (m !== 'GET' && req.headers['x-coachai'] !== '1') throw new HttpError(403, 'Anfrage abgelehnt.');

    if (path === '/api/status' && m === 'GET') {
      const u = currentUser(req);
      return send(res, 200, { eingerichtet: countUsers(db) > 0, nutzer: u ? publicUser(u) : null, teamzentrale: !!cfg.teamzentrale && existsSync(cfg.teamzentrale) });
    }
    if (path === '/api/einrichten' && m === 'POST') {
      if (countUsers(db) > 0) throw new HttpError(409, '11Plan ist bereits eingerichtet.');
      const b = await readJson(req);
      if (!cfg.setupToken || b.einrichtungsschluessel !== cfg.setupToken) throw new HttpError(403, 'Der Einrichtungsschlüssel stimmt nicht.');
      const pwErr = checkPasswordRules(b.passwort); if (pwErr) throw new HttpError(400, pwErr);
      const u = createUser(db, { email: email(b.email), name: str(b.name, 'Name'), role: 'trainer', password: b.passwort as string });
      const s = createSession(db, u.id);
      return send(res, 201, { nutzer: publicUser(u) }, { 'Set-Cookie': sessionCookie(s.token, s.maxAge) });
    }
    if (path === '/api/anmelden' && m === 'POST') {
      const b = await readJson(req);
      const e = email(b.email), key = `${ip(req)}|${e.toLowerCase()}`;
      if (tooManyAttempts(db, key)) throw new HttpError(429, 'Zu viele Versuche. Bitte in 15 Minuten erneut probieren.');
      const u = findUserByEmail(db, e);
      if (!u || typeof b.passwort !== 'string' || !verifyPassword(b.passwort, u.pw_hash)) { noteAttempt(db, key); throw new HttpError(401, 'E-Mail oder Passwort stimmen nicht.'); }
      clearAttempts(db, key);
      const s = createSession(db, u.id);
      return send(res, 200, { nutzer: publicUser(u) }, { 'Set-Cookie': sessionCookie(s.token, s.maxAge) });
    }
    if (path === '/api/abmelden' && m === 'POST') {
      deleteSession(db, cookies(req)[COOKIE]);
      return send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie });
    }
    if (path === '/api/passwort' && m === 'POST') {
      const u = requireUser(req), b = await readJson(req);
      const full = findUserByEmail(db, u.email)!;
      if (typeof b.alt !== 'string' || !verifyPassword(b.alt, full.pw_hash)) throw new HttpError(400, 'Das bisherige Passwort stimmt nicht.');
      const pwErr = checkPasswordRules(b.neu); if (pwErr) throw new HttpError(400, pwErr);
      db.prepare('UPDATE users SET pw_hash = ? WHERE id = ?').run(hashPassword(b.neu as string), u.id);
      return send(res, 200, { ok: true });
    }
    if (path === '/api/einladungen' && m === 'POST') {
      const u = requireTrainer(req), b = await readJson(req).catch(() => ({} as Record<string, unknown>));
      // Alle im Trainerteam sind gleichberechtigt und dürfen Trainer oder Betreuer einladen.
      const rolle = b.rolle === 'betreuer' ? 'betreuer' : 'trainer';
      const t = createInvite(db, u.id, rolle);
      return send(res, 201, { link: `${cfg.publicUrl.replace(/\/$/, '')}/#einladung/${t}`, gueltigTage: 7, rolle });
    }
    const inv = /^\/api\/einladungen\/([A-Za-z0-9_-]{20,})$/.exec(path);
    if (inv && m === 'GET') {
      return send(res, 200, { gueltig: !!openInvite(db, inv[1]) });
    }
    const acc = /^\/api\/einladungen\/([A-Za-z0-9_-]{20,})\/annehmen$/.exec(path);
    if (acc && m === 'POST') {
      const i = openInvite(db, acc[1]); if (!i) throw new HttpError(410, 'Die Einladung ist abgelaufen oder wurde schon benutzt.');
      const b = await readJson(req);
      const pwErr = checkPasswordRules(b.passwort); if (pwErr) throw new HttpError(400, pwErr);
      const e = email(b.email); if (findUserByEmail(db, e)) throw new HttpError(409, 'Mit dieser E-Mail gibt es schon ein Konto.');
      const u = createUser(db, { email: e, name: str(b.name, 'Name'), role: i.role, password: b.passwort as string });
      useInvite(db, acc[1]);
      const s = createSession(db, u.id);
      return send(res, 201, { nutzer: publicUser(u) }, { 'Set-Cookie': sessionCookie(s.token, s.maxAge) });
    }
    if (path === '/api/team' && m === 'GET') {
      requireStab(req);
      return send(res, 200, { nutzer: db.prepare("SELECT id, name, email, role FROM users WHERE role <> 'spieler' ORDER BY id").all() });
    }
    // ---------- Spieler-Zugänge (persönliche Links) ----------
    if (path === '/api/spieler/links' && m === 'GET') {
      requireTrainer(req);
      const rows = db.prepare("SELECT u.pid, u.name, (SELECT MAX(created_at) FROM zugangslinks z WHERE z.user_id = u.id) AS seit, (SELECT COUNT(*) FROM push_abos p WHERE p.user_id = u.id) AS push FROM users u WHERE u.role = 'spieler'").all();
      return send(res, 200, { zugaenge: rows });
    }
    if (path === '/api/spieler/links' && m === 'POST') {
      requireTrainer(req);
      const b = await readJson(req), pid = str(b.pid, 'Spieler', 80), nm = str(b.name, 'Name');
      const kader = tzDaten().daten.kaderNamen as Record<string, string> | undefined;
      if (kader && !(pid in kader)) throw new HttpError(400, 'Dieser Spieler steht nicht im Kader.');
      const konto = spielerKonto(db, pid, nm), t = spielerLinkErzeugen(db, konto.id);
      return send(res, 201, { link: `${cfg.publicUrl.replace(/\/$/, '')}/s/${t}` });
    }
    const linkWeg = /^\/api\/spieler\/links\/([A-Za-z0-9_-]{1,80})$/.exec(path);
    if (linkWeg && m === 'DELETE') {
      requireTrainer(req);
      const u = db.prepare('SELECT id FROM users WHERE pid = ?').get(linkWeg[1]) as { id: number } | undefined;
      if (u) { db.prepare('DELETE FROM zugangslinks WHERE user_id = ?').run(u.id); db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id); }
      return send(res, 200, { ok: true });
    }
    // ---------- Spieler: eigene Sicht und Aktionen ----------
    if (path === '/api/spieler/stand' && m === 'GET') {
      const u = requireUser(req);
      if (u.role !== 'spieler' || !u.pid) throw new HttpError(403, 'Nur für Spieler.');
      const t = tzDaten();
      return send(res, 200, { version: t.version, daten: spielerSicht(t.daten, u.pid), pid: u.pid });
    }
    if (path === '/api/spieler/aktion' && m === 'POST') {
      const u = requireUser(req);
      if (u.role !== 'spieler' || !u.pid) throw new HttpError(403, 'Nur für Spieler.');
      const b = await readJson(req);
      for (let versuch = 0; versuch < 3; versuch++) {
        const t = tzDaten();
        let neu: Daten;
        try { neu = spielerAktion(t.daten, u.pid, b); } catch (e) { if (e instanceof AktionsFehler) throw new HttpError(400, e.message); throw e; }
        const cur = docLesen('teamzentrale')?.version ?? 0;
        if (cur !== t.version) continue; // gleichzeitig gespeichert: neu lesen
        const v = docSchreiben('teamzentrale', { basis: t.basis, daten: neu }, u.id, cur);
        return send(res, 200, { version: v, daten: spielerSicht(neu, u.pid) });
      }
      throw new HttpError(409, 'Gerade wird viel gespeichert. Bitte gleich nochmal.');
    }
    // ---------- Push ----------
    if (path === '/api/push/schluessel' && m === 'GET') {
      requireUser(req);
      if (!cfg.push) throw new HttpError(503, 'Push ist nicht eingerichtet.');
      return send(res, 200, { schluessel: cfg.push.schluessel });
    }
    if (path === '/api/push/abo' && m === 'POST') {
      const u = requireUser(req);
      if (!cfg.push) throw new HttpError(503, 'Push ist nicht eingerichtet.');
      const b = await readJson(req);
      try { cfg.push.abonnieren(u.id, b.abo); } catch { throw new HttpError(400, 'Ungültiges Abo.'); }
      return send(res, 201, { ok: true });
    }
    if (path === '/api/push/abo' && m === 'DELETE') {
      requireUser(req);
      const b = await readJson(req);
      if (cfg.push && typeof b.endpoint === 'string') cfg.push.abbestellen(b.endpoint);
      return send(res, 200, { ok: true });
    }
    if (path === '/api/push/test' && m === 'POST') {
      const u = requireUser(req);
      if (!cfg.push) throw new HttpError(503, 'Push ist nicht eingerichtet.');
      const n = await cfg.push.senden([u.id], { title: '11Plan', body: 'Benachrichtigungen sind eingeschaltet.', url: '/teamzentrale' });
      return send(res, 200, { gesendet: n });
    }
    if (path === '/api/aktualisieren') {
      if (m === 'POST') requireStab(req); else requireUser(req);
      if (!cfg.aktualisierenDatei) throw new HttpError(404, 'Nicht verfügbar.');
      if (m === 'POST') writeFileSync(cfg.aktualisierenDatei, new Date().toISOString());
      else if (m !== 'GET') throw new HttpError(405, 'Nicht erlaubt.');
      const stand = cfg.teamzentrale && existsSync(cfg.teamzentrale) ? statSync(cfg.teamzentrale).mtime.toISOString() : null;
      return send(res, 200, { angefordert: existsSync(cfg.aktualisierenDatei), stand });
    }
    if (path === '/api/ki/status' && m === 'GET') {
      requireUser(req);
      return send(res, 200, { bereit: !!cfg.ki, modell: cfg.ki ? KI_MODELL : null });
    }
    if (path === '/api/ki/verteilen' && m === 'POST') {
      const u = requireStab(req);
      if (!cfg.ki) throw new HttpError(503, 'KI noch nicht eingerichtet: ANTHROPIC_API_KEY fehlt in deploy/.env.');
      // Schutz vor Fehlbedienung und Kosten: höchstens 60 Verteilungen je Trainer und Stunde.
      const stunde = Date.now() - 3600e3, l = (kiNutzung.get(u.id) ?? []).filter((t) => t > stunde);
      if (l.length >= 60) throw new HttpError(429, 'Stundengrenze für die KI erreicht. Bitte später erneut.');
      kiNutzung.set(u.id, [...l, Date.now()]);
      const b = await readJson(req);
      try {
        const felder = await cfg.ki({ maske: String(b.maske ?? '').slice(0, 60), text: b.text as string, felder: b.felder as KiAnfrage['felder'], kontext: typeof b.kontext === 'string' ? b.kontext : undefined });
        return send(res, 200, { felder });
      } catch (e) {
        if (e instanceof KiFehler) throw new HttpError(e.status, e.message);
        throw e;
      }
    }
    if (path === '/api/sprache' && m === 'POST') {
      requireUser(req);
      if (!cfg.spracheUrl) throw new HttpError(503, 'Diktieren ist auf diesem Server nicht eingerichtet.');
      let size = 0; const chunks: Buffer[] = [];
      for await (const c of req) { size += (c as Buffer).length; if (size > MAX_AUDIO) throw new HttpError(413, 'Die Aufnahme ist zu lang.'); chunks.push(c as Buffer); }
      if (!size) throw new HttpError(400, 'Keine Aufnahme.');
      const hinweis = String(req.headers['x-hinweis'] || '').slice(0, 1500);
      let r: Response;
      try {
        r = await fetch(cfg.spracheUrl.replace(/\/$/, '') + '/text', {
          method: 'POST', body: Buffer.concat(chunks), headers: { 'Content-Type': 'application/octet-stream', ...(hinweis ? { 'X-Hinweis': hinweis } : {}) },
          signal: AbortSignal.timeout(300_000),
        });
      } catch (e) {
        if ((e as Error).name === 'TimeoutError') throw new HttpError(504, 'Die Umwandlung hat zu lange gedauert. Bitte kürzer aufnehmen oder gleich nochmal versuchen.');
        throw new HttpError(502, 'Der Sprachdienst ist gerade nicht erreichbar (startet vielleicht gerade neu). Bitte in einer Minute nochmal.');
      }
      const b = await r.json().catch(() => ({})) as { text?: string; fehler?: string };
      if (!r.ok || typeof b.text !== 'string') throw new HttpError(r.status === 413 ? 413 : 502, b.fehler || 'Die Aufnahme konnte nicht umgewandelt werden.');
      return send(res, 200, { text: b.text });
    }
    const doc = /^\/api\/dokumente\/([a-z0-9-]{1,40})$/.exec(path);
    if (doc && m === 'GET') {
      const u = requireStab(req);
      if (!istTrainer(u) && doc[1] !== 'teamzentrale') throw new HttpError(403, 'Nur für das Trainerteam.');
      const row = docLesen(doc[1]);
      if (!row) return send(res, 200, { version: 0, inhalt: null });
      let inhalt = JSON.parse(row.json) as { basis?: Daten; daten?: Daten };
      if (!istTrainer(u)) inhalt = { basis: inhalt.basis ? betreuerSicht(inhalt.basis) : inhalt.basis, daten: betreuerSicht(inhalt.daten ?? {}) };
      return send(res, 200, { version: row.version, inhalt, geaendertAm: row.updated_at, geaendertVon: row.von });
    }
    if (doc && m === 'PUT') {
      const u = requireStab(req), b = await readJson(req);
      if (!istTrainer(u) && doc[1] !== 'teamzentrale') throw new HttpError(403, 'Nur für das Trainerteam.');
      if (!b.inhalt || typeof b.inhalt !== 'object') throw new HttpError(400, 'Inhalt fehlt.');
      const cur = docLesen(doc[1])?.version ?? 0;
      if (Number(b.basisVersion) !== cur) return send(res, 409, { fehler: 'Inzwischen hat jemand anderes gespeichert.', version: cur });
      let inhalt = b.inhalt as { basis?: unknown; daten?: Daten };
      if (!istTrainer(u)) {
        // Betreuer: nur die erlaubten Teile übernehmen, alles andere bleibt wie gespeichert.
        const t = tzDaten();
        inhalt = { basis: t.basis ?? inhalt.basis, daten: betreuerUebernehmen(t.daten, inhalt.daten ?? {}) };
      }
      return send(res, 200, { version: docSchreiben(doc[1], inhalt, u.id, cur) });
    }
    if (path === '/api/zustand' && m === 'GET') {
      requireTrainer(req);
      const row = db.prepare('SELECT version, json, updated_at, u.name AS von FROM app_state LEFT JOIN users u ON u.id = updated_by WHERE app_state.id = 1').get() as { version: number; json: string; updated_at: string; von: string | null } | undefined;
      if (row) return send(res, 200, { version: row.version, zustand: JSON.parse(row.json), geaendertAm: row.updated_at, geaendertVon: row.von });
      let start: unknown = null;
      if (cfg.dossierStart && existsSync(cfg.dossierStart)) { try { const d = JSON.parse(readFileSync(cfg.dossierStart, 'utf8')); start = d.state ?? d; } catch { start = null; } }
      return send(res, 200, { version: 0, zustand: start });
    }
    if (path === '/api/zustand' && m === 'PUT') {
      const u = requireTrainer(req), b = await readJson(req);
      const base = Number(b.basisVersion);
      if (!b.zustand || typeof b.zustand !== 'object') throw new HttpError(400, 'Zustand fehlt.');
      const cur = (db.prepare('SELECT version FROM app_state WHERE id = 1').get() as { version: number } | undefined)?.version ?? 0;
      // Optimistische Sperre: Wer auf einem veralteten Stand speichert, bekommt den aktuellen zurück.
      if (base !== cur) return send(res, 409, { fehler: 'Inzwischen hat jemand anderes gespeichert.', version: cur });
      const json = JSON.stringify(b.zustand), next = cur + 1;
      db.exec('BEGIN');
      try {
        db.prepare("INSERT INTO app_state (id, version, json, updated_by, updated_at) VALUES (1, ?, ?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET version = excluded.version, json = excluded.json, updated_by = excluded.updated_by, updated_at = excluded.updated_at").run(next, json, u.id);
        db.prepare("INSERT INTO app_state_history (version, json, updated_by, updated_at) VALUES (?, ?, ?, datetime('now'))").run(next, json, u.id);
        db.prepare('DELETE FROM app_state_history WHERE version <= ?').run(next - HISTORY_KEEP);
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      return send(res, 200, { version: next });
    }
    throw new HttpError(404, 'Nicht gefunden.');
  }

  /** Weiterleitung an den internen Datendienst. Nur für angemeldete Nutzer, der Schlüssel wird hier ergänzt. */
  async function proxy(req: IncomingMessage, res: ServerResponse, path: string, query: string) {
    requireStab(req);
    if (req.method !== 'GET') throw new HttpError(405, 'Nur Abrufe erlaubt.');
    const target = cfg.datendienstUrl.replace(/\/$/, '') + path.replace(/^\/datenquelle\/fussballde/, '') + query;
    let r: Response;
    try { r = await fetch(target, { headers: { 'X-API-Key': cfg.datendienstKey }, signal: AbortSignal.timeout(300_000) }); }
    catch { throw new HttpError(502, 'Der Datendienst ist gerade nicht erreichbar.'); }
    const buf = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  }

  /** Teamzentrale nur für Angemeldete. Schriften vom eigenen Server, dunkler Modus, Kontomenü in der Seitenleiste. */
  let tzCache: { mtime: number; script: string | null; html: string } | null = null;
  /** Name der gebauten Abgleich-Datei laut Vite-Manifest, z. B. assets/teamzentrale-AbC123.js. */
  const syncScript = (): string | null => {
    try {
      const m = JSON.parse(readFileSync(join(cfg.publicDir, '.vite', 'manifest.json'), 'utf8')) as Record<string, { file: string }>;
      return m['src/teamzentrale/sync.ts']?.file ?? null;
    } catch { return null; }
  };
  function serveTeamzentrale(req: IncomingMessage, res: ServerResponse) {
    const file = cfg.teamzentrale, u = currentUser(req);
    if (!u || !file || !existsSync(file)) { res.writeHead(302, { Location: '/' }); return res.end(); }
    const mtime = statSync(file).mtimeMs, script = syncScript();
    if (!tzCache || tzCache.mtime !== mtime || tzCache.script !== script) tzCache = { mtime, script, html: prepareTeamzentrale(readFileSync(file, 'utf8'), script) };
    // Rolle für die Oberfläche (Spieler-App, Betreuer-Ansicht). Die Daten filtert ohnehin der Server.
    const rolle = istTrainer(u) ? 'trainer' : u.role;
    const info = JSON.stringify({ rolle, pid: u.pid ?? null, name: u.name }).replace(/</g, '\\u003c');
    res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
    res.end(tzCache.html.replace('<head>', `<head><script>window.__11plan=${info};</script>`));
  }

  function serveStatic(res: ServerResponse, path: string) {
    const root = resolve(cfg.publicDir);
    let file = normalize(join(root, decodeURIComponent(path)));
    if (!file.startsWith(root)) return send(res, 400, { fehler: 'Ungültiger Pfad.' });
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    if (!existsSync(file)) return send(res, 404, { fehler: 'Frontend nicht gebaut.' });
    const ext = extname(file);
    // Service Worker (Push) und App-Beschreibung nie lange zwischenspeichern
    if (/\/(sw\.js|manifest\.webmanifest)$/.test(file)) {
      res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      return createReadStream(file).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
    createReadStream(file).pipe(res);
  }

  /** Einmal je Schlüssel (z. B. „erinnerung|2026-11-20“): true beim ersten Aufruf. */
  const einmal = (key: string) => Number(db.prepare('INSERT OR IGNORE INTO erledigt (key, at) VALUES (?, ?)').run(key, Date.now()).changes) === 1;
  /** Jede Minute: um 15 Uhr Dienst-Erinnerungen per Push, um 17 Uhr Dienste von Abwesenden automatisch umlegen. */
  async function zeitplanTick(now = new Date()) {
    const teile = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(now).map((p) => [p.type, p.value]));
    const heute = `${teile.year}-${teile.month}-${teile.day}`, stunde = Number(teile.hour) % 24;
    if (stunde >= 15 && stunde < 17 && einmal(`erinnerung|${heute}`)) {
      const t = tzDaten();
      for (const n of dienstErinnerungen(t.daten, heute)) await mitteilungenPushen([n]);
    }
    if (stunde >= 17 && stunde < 23 && einmal(`umlegen|${heute}`)) {
      for (let versuch = 0; versuch < 3; versuch++) {
        const t = tzDaten(), neu = dienstUmlegen(t.daten, heute, now);
        if (!neu) break;
        if ((docLesen('teamzentrale')?.version ?? 0) !== t.version) continue;
        docSchreiben('teamzentrale', { basis: t.basis, daten: neu }, null, t.version);
        break;
      }
    }
  }

  const handle = async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url || '/', 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, res, url.pathname);
      if (url.pathname.startsWith('/datenquelle/fussballde/')) return await proxy(req, res, url.pathname, url.search);
      if (url.pathname === '/teamzentrale') return serveTeamzentrale(req, res);
      const sl = /^\/s\/([A-Za-z0-9_-]{20,})$/.exec(url.pathname);
      if (sl) {
        // Persönlicher Spieler-Link: anmelden (ein Jahr) und zur Spieler-App
        const u = spielerLinkEinloesen(db, sl[1]);
        if (!u) { res.writeHead(302, { Location: '/?link=ungueltig' }); return res.end(); }
        const sess = createSession(db, u.id, Date.now(), spielerSessionTage());
        // Kurze Zwischenseite statt direkter Weiterleitung: Das Anmelde-Cookie (SameSite=Strict) wird erst bei
        // einer Navigation von der eigenen Seite mitgeschickt – beim Antippen aus WhatsApp sonst nicht.
        res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Set-Cookie': sessionCookie(sess.token, sess.maxAge), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
        return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="0;url=/teamzentrale"><title>11Plan</title><p style="font-family:sans-serif">Du wirst angemeldet … <a href="/teamzentrale">weiter</a></p>');
      }
      return serveStatic(res, url.pathname);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { fehler: e.message });
      console.error(e);
      return send(res, 500, { fehler: 'Interner Fehler.' });
    }
  };
  return Object.assign(handle, { zeitplanTick });
}

/** Passt die gebaute Teamzentrale für den Server an, ohne die Datei selbst zu verändern. */
export function prepareTeamzentrale(html: string, syncScript: string | null): string {
  const einbinden = syncScript ? `<script type="module" src="/${syncScript}"></script>` : '';
  return html
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>\s*/g, '')
    .replace(' Die Seite speichert noch nichts.', '')
    .replace('</head>', '<link rel="stylesheet" href="/schriften/schriften.css">\n<link rel="manifest" href="/manifest.webmanifest">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<meta name="theme-color" content="#111816">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="apple-mobile-web-app-title" content="11Plan">\n</head>')
    .replace(/<html lang="de"( data-theme="[a-z]+")?>/, '<html lang="de" data-theme="dark">')
    .replace(/<\/body>(?![\s\S]*<\/body>)/, () => einbinden + '\n</body>');
}
