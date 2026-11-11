import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import type { Db } from './db.js';
import {
  checkPasswordRules, clearAttempts, countUsers, createInvite, createSession, createUser, deleteSession, findUserByEmail,
  hashPassword, noteAttempt, openInvite, tooManyAttempts, useInvite, userForSession, verifyPassword, type User,
} from './auth.js';

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
}

const COOKIE = 'coachai_session';
const MAX_BODY = 25 * 1024 * 1024; // Zustand mit Wappen und Bildern als Daten-URLs
const HISTORY_KEEP = 50;
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
const publicUser = (u: User) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

export function createHandler(db: Db, cfg: Config) {
  const sessionCookie = (t: string, maxAge: number) => `${COOKIE}=${encodeURIComponent(t)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${cfg.secureCookies ? '; Secure' : ''}`;
  const clearCookie = `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${cfg.secureCookies ? '; Secure' : ''}`;

  function currentUser(req: IncomingMessage): User | null { return userForSession(db, cookies(req)[COOKIE]); }
  function requireUser(req: IncomingMessage): User { const u = currentUser(req); if (!u) throw new HttpError(401, 'Bitte anmelden.'); return u; }

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
      const u = requireUser(req);
      // Alle im Trainerteam sind gleichberechtigt und dürfen einladen.
      const t = createInvite(db, u.id, 'trainer');
      return send(res, 201, { link: `${cfg.publicUrl.replace(/\/$/, '')}/#einladung/${t}`, gueltigTage: 7 });
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
      requireUser(req);
      return send(res, 200, { nutzer: db.prepare('SELECT id, name, email, role FROM users ORDER BY id').all() });
    }
    const doc = /^\/api\/dokumente\/([a-z0-9-]{1,40})$/.exec(path);
    if (doc && m === 'GET') {
      requireUser(req);
      const row = db.prepare('SELECT version, json, updated_at, u.name AS von FROM docs LEFT JOIN users u ON u.id = updated_by WHERE docs.name = ?').get(doc[1]) as { version: number; json: string; updated_at: string; von: string | null } | undefined;
      return send(res, 200, row ? { version: row.version, inhalt: JSON.parse(row.json), geaendertAm: row.updated_at, geaendertVon: row.von } : { version: 0, inhalt: null });
    }
    if (doc && m === 'PUT') {
      const u = requireUser(req), b = await readJson(req);
      if (!b.inhalt || typeof b.inhalt !== 'object') throw new HttpError(400, 'Inhalt fehlt.');
      const cur = (db.prepare('SELECT version FROM docs WHERE name = ?').get(doc[1]) as { version: number } | undefined)?.version ?? 0;
      if (Number(b.basisVersion) !== cur) return send(res, 409, { fehler: 'Inzwischen hat jemand anderes gespeichert.', version: cur });
      const json = JSON.stringify(b.inhalt), next = cur + 1;
      db.exec('BEGIN');
      try {
        db.prepare("INSERT INTO docs (name, version, json, updated_by, updated_at) VALUES (?, ?, ?, ?, datetime('now')) ON CONFLICT(name) DO UPDATE SET version = excluded.version, json = excluded.json, updated_by = excluded.updated_by, updated_at = excluded.updated_at").run(doc[1], next, json, u.id);
        db.prepare("INSERT INTO docs_history (name, version, json, updated_by, updated_at) VALUES (?, ?, ?, ?, datetime('now'))").run(doc[1], next, json, u.id);
        db.prepare('DELETE FROM docs_history WHERE name = ? AND version <= ?').run(doc[1], next - HISTORY_KEEP);
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      return send(res, 200, { version: next });
    }
    if (path === '/api/zustand' && m === 'GET') {
      requireUser(req);
      const row = db.prepare('SELECT version, json, updated_at, u.name AS von FROM app_state LEFT JOIN users u ON u.id = updated_by WHERE app_state.id = 1').get() as { version: number; json: string; updated_at: string; von: string | null } | undefined;
      return send(res, 200, row ? { version: row.version, zustand: JSON.parse(row.json), geaendertAm: row.updated_at, geaendertVon: row.von } : { version: 0, zustand: null });
    }
    if (path === '/api/zustand' && m === 'PUT') {
      const u = requireUser(req), b = await readJson(req);
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
    requireUser(req);
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
  let tzCache: { mtime: number; html: string } | null = null;
  /** Name der gebauten Abgleich-Datei laut Vite-Manifest, z. B. assets/teamzentrale-AbC123.js. */
  const syncScript = (): string | null => {
    try {
      const m = JSON.parse(readFileSync(join(cfg.publicDir, '.vite', 'manifest.json'), 'utf8')) as Record<string, { file: string }>;
      return m['src/teamzentrale/sync.ts']?.file ?? null;
    } catch { return null; }
  };
  function serveTeamzentrale(req: IncomingMessage, res: ServerResponse) {
    const file = cfg.teamzentrale;
    if (!currentUser(req) || !file || !existsSync(file)) { res.writeHead(302, { Location: '/' }); return res.end(); }
    const mtime = statSync(file).mtimeMs;
    if (!tzCache || tzCache.mtime !== mtime) tzCache = { mtime, html: prepareTeamzentrale(readFileSync(file, 'utf8'), syncScript()) };
    res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
    res.end(tzCache.html);
  }

  function serveStatic(res: ServerResponse, path: string) {
    const root = resolve(cfg.publicDir);
    let file = normalize(join(root, decodeURIComponent(path)));
    if (!file.startsWith(root)) return send(res, 400, { fehler: 'Ungültiger Pfad.' });
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    if (!existsSync(file)) return send(res, 404, { fehler: 'Frontend nicht gebaut.' });
    const ext = extname(file);
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
    createReadStream(file).pipe(res);
  }

  return async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url || '/', 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, res, url.pathname);
      if (url.pathname.startsWith('/datenquelle/fussballde/')) return await proxy(req, res, url.pathname, url.search);
      if (url.pathname === '/teamzentrale') return serveTeamzentrale(req, res);
      return serveStatic(res, url.pathname);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { fehler: e.message });
      console.error(e);
      return send(res, 500, { fehler: 'Interner Fehler.' });
    }
  };
}

/** Passt die gebaute Teamzentrale für den Server an, ohne die Datei selbst zu verändern. */
export function prepareTeamzentrale(html: string, syncScript: string | null): string {
  const einbinden = syncScript ? `<script type="module" src="/${syncScript}"></script>` : '';
  return html
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>\s*/g, '')
    .replace('</head>', '<link rel="stylesheet" href="/schriften/schriften.css">\n</head>')
    .replace(/<html lang="de"( data-theme="[a-z]+")?>/, '<html lang="de" data-theme="dark">')
    .replace(/<\/body>(?![\s\S]*<\/body>)/, () => einbinden + '\n</body>');
}
