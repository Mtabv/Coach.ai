import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backup, openDb } from './db';
import { createHandler } from './app';
import { hashPassword, verifyPassword } from './auth';

let server: Server, base = '', upstream: Server, upstreamKey = '';
const dir = mkdtempSync(join(tmpdir(), 'coachai-'));
const db = openDb(join(dir, 'test.db'));

beforeAll(async () => {
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Coach.AI</title>');
  // Stellvertreter für den Datendienst: merkt sich den mitgeschickten Schlüssel.
  upstream = createServer((req, res) => { upstreamKey = String(req.headers['x-api-key']); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ pfad: req.url })); });
  await new Promise<void>((r) => upstream.listen(0, r));
  const up = upstream.address() as { port: number };
  server = createServer(createHandler(db, { publicDir: dir, setupToken: 'einrichten-123', datendienstUrl: `http://127.0.0.1:${up.port}`, datendienstKey: 'geheim', secureCookies: false, publicUrl: 'https://coach.example.de' }));
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => { server.close(); upstream.close(); });

type Jar = { cookie: string };
async function call(path: string, opts: { method?: string; body?: unknown; jar?: Jar; noHeader?: boolean } = {}) {
  const r = await fetch(base + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.noHeader ? {} : { 'X-CoachAI': '1' }), ...(opts.jar?.cookie ? { Cookie: opts.jar.cookie } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const set = r.headers.get('set-cookie');
  if (set && opts.jar) opts.jar.cookie = set.split(';')[0];
  return { status: r.status, json: await r.json().catch(() => null) as Record<string, any> };
}

describe('Passwörter', () => {
  it('speichert nur einen Hash und prüft ihn', () => {
    const h = hashPassword('richtig-langes-passwort');
    expect(h).not.toContain('richtig');
    expect(verifyPassword('richtig-langes-passwort', h)).toBe(true);
    expect(verifyPassword('falsch-langes-passwort', h)).toBe(false);
  });
});

describe('Server', () => {
  const trainer: Jar = { cookie: '' }, co: Jar = { cookie: '' };

  it('ist anfangs nicht eingerichtet und braucht für das erste Konto den Schlüssel', async () => {
    expect((await call('/api/status')).json).toEqual({ eingerichtet: false, nutzer: null });
    expect((await call('/api/einrichten', { method: 'POST', body: { einrichtungsschluessel: 'falsch', name: 'Manuel', email: 'm@example.de', passwort: 'sehr-geheim-123' } })).status).toBe(403);
    const r = await call('/api/einrichten', { method: 'POST', jar: trainer, body: { einrichtungsschluessel: 'einrichten-123', name: 'Manuel', email: 'm@example.de', passwort: 'sehr-geheim-123' } });
    expect(r.status).toBe(201);
    expect(r.json.nutzer.role).toBe('trainer');
    expect((await call('/api/einrichten', { method: 'POST', body: { einrichtungsschluessel: 'einrichten-123', name: 'X', email: 'x@example.de', passwort: 'sehr-geheim-123' } })).status).toBe(409);
  });

  it('lehnt Änderungen ohne Schutzkopf ab', async () => {
    expect((await call('/api/abmelden', { method: 'POST', noHeader: true, jar: { cookie: trainer.cookie } })).status).toBe(403);
  });

  it('meldet an und ab und bremst falsche Passwörter', async () => {
    const jar: Jar = { cookie: '' };
    expect((await call('/api/anmelden', { method: 'POST', jar, body: { email: 'm@example.de', passwort: 'falsch' } })).status).toBe(401);
    expect((await call('/api/anmelden', { method: 'POST', jar, body: { email: 'M@example.de', passwort: 'sehr-geheim-123' } })).status).toBe(200);
    expect((await call('/api/status', { jar })).json.nutzer.name).toBe('Manuel');
    await call('/api/abmelden', { method: 'POST', jar });
    expect((await call('/api/zustand', { jar })).status).toBe(401);
    for (let i = 0; i < 8; i++) await call('/api/anmelden', { method: 'POST', body: { email: 'm@example.de', passwort: 'falsch' } });
    expect((await call('/api/anmelden', { method: 'POST', body: { email: 'm@example.de', passwort: 'sehr-geheim-123' } })).status).toBe(429);
  });

  it('lädt weitere Trainer per Einladungslink ein, der Link gilt nur einmal', async () => {
    const r = await call('/api/einladungen', { method: 'POST', jar: trainer });
    expect(r.status).toBe(201);
    const t = String(r.json.link).split('#einladung/')[1];
    expect(r.json.link.startsWith('https://coach.example.de/#einladung/')).toBe(true);
    expect((await call(`/api/einladungen/${t}`)).json.gueltig).toBe(true);
    const a = await call(`/api/einladungen/${t}/annehmen`, { method: 'POST', jar: co, body: { name: 'Thorsten', email: 't@example.de', passwort: 'auch-sehr-geheim' } });
    expect(a.status).toBe(201);
    expect(a.json.nutzer.role).toBe('trainer');
    expect((await call(`/api/einladungen/${t}/annehmen`, { method: 'POST', body: { name: 'Y', email: 'y@example.de', passwort: 'auch-sehr-geheim' } })).status).toBe(410);
    expect((await call('/api/einladungen', { method: 'POST', jar: co })).status).toBe(201);
  });

  it('teilt den Zustand und verhindert, dass jemand einen neueren Stand überschreibt', async () => {
    expect((await call('/api/zustand', { jar: trainer })).json).toEqual({ version: 0, zustand: null });
    expect((await call('/api/zustand', { method: 'PUT', jar: trainer, body: { basisVersion: 0, zustand: { teams: [1] } } })).json.version).toBe(1);
    const g = await call('/api/zustand', { jar: co });
    expect(g.json.zustand).toEqual({ teams: [1] });
    expect(g.json.geaendertVon).toBe('Manuel');
    expect((await call('/api/zustand', { method: 'PUT', jar: co, body: { basisVersion: 1, zustand: { teams: [1, 2] } } })).json.version).toBe(2);
    const stale = await call('/api/zustand', { method: 'PUT', jar: trainer, body: { basisVersion: 1, zustand: { teams: [9] } } });
    expect(stale.status).toBe(409);
    expect(stale.json.version).toBe(2);
  });

  it('leitet an den Datendienst weiter, nur angemeldet und mit Schlüssel vom Server', async () => {
    expect((await call('/datenquelle/fussballde/api/coachai/team/x/liga')).status).toBe(401);
    const r = await call('/datenquelle/fussballde/api/coachai/team/x/liga?a=1', { jar: trainer });
    expect(r.status).toBe(200);
    expect(r.json.pfad).toBe('/api/coachai/team/x/liga?a=1');
    expect(upstreamKey).toBe('geheim');
  });

  it('liefert das Frontend aus und lässt keine Pfade außerhalb zu', async () => {
    const r = await fetch(base + '/irgendwo');
    expect(await r.text()).toContain('Coach.AI');
    const bad = await fetch(base + '/..%2f..%2fetc%2fpasswd');
    expect([200, 400]).toContain(bad.status);
    expect(await bad.text()).not.toContain('root:');
  });
});

describe('Sicherung', () => {
  it('legt eine Datei je Tag an und behält nur die letzten', () => {
    const d = join(dir, 'sicherungen');
    for (let i = 1; i <= 5; i++) backup(db, d, 3, new Date(`2026-11-0${i}T12:00:00Z`));
    expect(readdirSync(d).sort()).toEqual(['coachai-2026-11-03.db', 'coachai-2026-11-04.db', 'coachai-2026-11-05.db']);
  });
});
