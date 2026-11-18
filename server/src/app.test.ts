import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdirSync, mkdtempSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backup, openDb } from './db';
import { createHandler } from './app';
import { hashPassword, verifyPassword } from './auth';

let server: Server, base = '', upstream: Server, upstreamKey = '';
const dir = mkdtempSync(join(tmpdir(), 'coachai-'));
const db = openDb(join(dir, 'test.db'));

beforeAll(async () => {
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>11Plan</title>');
  mkdirSync(join(dir, '.vite'));
  writeFileSync(join(dir, '.vite', 'manifest.json'), JSON.stringify({ 'src/teamzentrale/sync.ts': { file: 'assets/tz-test.js' } }));
  // Stellvertreter für den Datendienst: merkt sich den mitgeschickten Schlüssel.
  upstream = createServer((req, res) => {
    // Stellvertreter für den Sprachdienst: antwortet mit der Größe der Aufnahme und dem Hinweis.
    if (req.url === '/text') { let n = 0; req.on('data', (c) => { n += c.length; }); req.on('end', () => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ text: `${n} Bytes ${decodeURIComponent(String(req.headers['x-hinweis'] || ''))}`.trim() })); }); return; }
    upstreamKey = String(req.headers['x-api-key']); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ pfad: req.url })); });
  await new Promise<void>((r) => upstream.listen(0, r));
  const up = upstream.address() as { port: number };
  writeFileSync(join(dir, 'tz.html'), '<!doctype html><html lang="de"><head><link href="https://fonts.googleapis.com/css2?x" rel="stylesheet"></head><body><aside class="side">Teamzentrale</aside></body></html>');
  server = createServer(createHandler(db, { aktualisierenDatei: join(dir, 'neu-bauen'), teamzentrale: join(dir, 'tz.html'), publicDir: dir, setupToken: 'einrichten-123', datendienstUrl: `http://127.0.0.1:${up.port}`, datendienstKey: 'geheim', spracheUrl: `http://127.0.0.1:${up.port}`, ki: async (a) => ({ aufbau: `${a.felder.length} Felder: ${a.text}` }), secureCookies: false, publicUrl: 'https://coach.example.de', dossierOrdner: join(dir, 'dossiers') }));
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
    expect((await call('/api/status')).json).toEqual({ eingerichtet: false, nutzer: null, teamzentrale: true });
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

  it('zeigt die Teamzentrale nur angemeldet, dunkel und ohne Google-Schriften', async () => {
    const anon = await fetch(base + '/teamzentrale', { redirect: 'manual' });
    expect(anon.status).toBe(302);
    expect((await call('/api/status', { jar: trainer })).json.teamzentrale).toBe(true);
    const r = await fetch(base + '/teamzentrale', { headers: { Cookie: trainer.cookie } });
    const html = await r.text();
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('<script type="module" src="/assets/tz-test.js"></script>');
    expect(html).toContain('/schriften/schriften.css');
    expect(html).not.toContain('googleapis');
  });

  it('speichert gemeinsame Dokumente mit Versionsprüfung', async () => {
    expect((await call('/api/dokumente/teamzentrale')).status).toBe(401);
    expect((await call('/api/dokumente/teamzentrale', { jar: trainer })).json).toEqual({ version: 0, inhalt: null });
    expect((await call('/api/dokumente/teamzentrale', { method: 'PUT', jar: trainer, body: { basisVersion: 0, inhalt: { daten: { a: 1 } } } })).json.version).toBe(1);
    const g = await call('/api/dokumente/teamzentrale', { jar: co });
    expect(g.json.inhalt).toEqual({ daten: { a: 1 } });
    expect(g.json.geaendertVon).toBe('Manuel');
    const alt = await call('/api/dokumente/teamzentrale', { method: 'PUT', jar: co, body: { basisVersion: 0, inhalt: { daten: { a: 2 } } } });
    expect(alt.status).toBe(409);
    expect(alt.json.version).toBe(1);
    expect((await call('/api/dokumente/Bad_Name', { jar: trainer })).status).toBe(404);
  });

  it('nimmt „Jetzt aktualisieren“ nur angemeldet an und legt den Merkzettel für den Bau ab', async () => {
    expect((await call('/api/aktualisieren', { method: 'POST' })).status).toBe(401);
    const r = await call('/api/aktualisieren', { method: 'POST', jar: trainer });
    expect(r.status).toBe(200);
    expect(r.json.angefordert).toBe(true);
    expect(typeof r.json.stand).toBe('string');
  });

  it('wandelt Aufnahmen nur angemeldet über den Sprachdienst in Text um', async () => {
    const audio = (jar?: Jar) => fetch(base + '/api/sprache', { method: 'POST', body: new Uint8Array(1234), headers: { 'X-CoachAI': '1', 'X-Hinweis': encodeURIComponent('Übung'), ...(jar ? { Cookie: jar.cookie } : {}) } });
    expect((await audio()).status).toBe(401);
    const r = await audio(trainer);
    expect(r.status).toBe(200);
    expect((await r.json()).text).toBe('1234 Bytes Übung');
  });

  it('verteilt Text mit der KI nur angemeldet', async () => {
    expect((await call('/api/ki/status')).status).toBe(401);
    expect((await call('/api/ki/status', { jar: trainer })).json.bereit).toBe(true);
    const r = await call('/api/ki/verteilen', { method: 'POST', jar: trainer, body: { maske: 'Übung', text: 'Zwei Tore', felder: [{ key: 'aufbau', label: 'Aufbau' }] } });
    expect(r.status).toBe(200);
    expect(r.json.felder.aufbau).toBe('1 Felder: Zwei Tore');
    expect((await call('/api/ki/verteilen', { method: 'POST', body: { text: 'x' } })).status).toBe(401);
  });

  it('Rollen: Spieler-Link, Spieler-Sicht und Aktionen, Betreuer sieht und ändert nur Erlaubtes', async () => {
    // Gemeinsamer Stand wie von der Teamzentrale gespeichert
    const g = await call('/api/dokumente/teamzentrale', { jar: trainer });
    const daten = { kaderNamen: { 'p-a': 'Anton A', 'p-b': 'Bernd B' }, events: [{ id: 'e1', date: '2026-11-20', type: 'tr', time: '19:00', unit: 'u1' }],
      duties: [{ id: 'd1', title: 'Materialdienst', from: '2026-11-16', to: '2026-11-22', slots: 1, who: ['p-a'] }], absences: [{ pid: 'p-b', from: '2026-11-01', to: '2026-11-15', why: 'verletzt: Kreuzband' }],
      talks: { 'p-a': [{ notizen: 'vertraulich' }] }, state: { grades: { g0: { 'p-a': '5' } }, texts: { 'a-q1-g1': 'geheim' }, notices: [] } };
    expect((await call('/api/dokumente/teamzentrale', { method: 'PUT', jar: trainer, body: { basisVersion: g.json.version, inhalt: { basis: {}, daten } } })).status).toBe(200);

    // Trainer erzeugt den Link, Spieler löst ihn ein
    expect((await call('/api/spieler/links', { method: 'POST', jar: trainer, body: { pid: 'p-x', name: 'Unbekannt' } })).status).toBe(400);
    const l = await call('/api/spieler/links', { method: 'POST', jar: trainer, body: { pid: 'p-a', name: 'Anton A' } });
    expect(l.status).toBe(201);
    const pfad = String(l.json.link).replace('https://coach.example.de', '');
    const r = await fetch(base + pfad, { redirect: 'manual' });
    expect(r.status).toBe(200);
    const spieler: Jar = { cookie: String(r.headers.get('set-cookie')).split(';')[0] };
    expect((await call('/api/status', { jar: spieler })).json.nutzer).toMatchObject({ role: 'spieler', pid: 'p-a', email: '' });

    // Spieler: kein Zugriff auf das ganze Dokument, den Dossier-Stand oder Trainerfunktionen
    expect((await call('/api/dokumente/teamzentrale', { jar: spieler })).status).toBe(403);
    expect((await call('/api/zustand', { jar: spieler })).status).toBe(403);
    expect((await call('/api/einladungen', { method: 'POST', jar: spieler })).status).toBe(403);
    expect((await call('/api/spieler/links', { jar: spieler })).status).toBe(403);
    const sicht = await call('/api/spieler/stand', { jar: spieler });
    expect(sicht.json.daten.talks).toBeUndefined();
    expect(sicht.json.daten.state.grades).toBeUndefined();
    expect(sicht.json.daten.absences[0].why).toBe('abwesend');

    // Aktion: Dienst abgeben – der Stand des Trainers ändert sich, sonst nichts
    const ak = await call('/api/spieler/aktion', { method: 'POST', jar: spieler, body: { typ: 'dienstAbgeben', did: 'd1', an: 'p-b' } });
    expect(ak.status).toBe(200);
    const nach = await call('/api/dokumente/teamzentrale', { jar: trainer });
    expect(nach.json.inhalt.daten.duties[0].who).toEqual(['p-b']);
    expect(nach.json.inhalt.daten.talks).toEqual(daten.talks);
    expect(nach.json.inhalt.daten.state.notices[0]).toMatchObject({ to: 'p-b' });

    // Neuer Link: alter Link und alte Anmeldung gelten nicht mehr
    await call('/api/spieler/links', { method: 'POST', jar: trainer, body: { pid: 'p-a', name: 'Anton A' } });
    expect((await call('/api/spieler/stand', { jar: spieler })).status).toBe(401);
    expect((await fetch(base + pfad, { redirect: 'manual' })).headers.get('location')).toBe('/?link=ungueltig');

    // Betreuer per Einladung
    const inv = await call('/api/einladungen', { method: 'POST', jar: trainer, body: { rolle: 'betreuer' } });
    expect(inv.json.rolle).toBe('betreuer');
    const betreuer: Jar = { cookie: '' };
    const t = String(inv.json.link).split('#einladung/')[1];
    expect((await call(`/api/einladungen/${t}/annehmen`, { method: 'POST', jar: betreuer, body: { name: 'Bea', email: 'b@example.de', passwort: 'betreuer-pass-1' } })).status).toBe(201);
    const bs = await call('/api/dokumente/teamzentrale', { jar: betreuer });
    expect(bs.json.inhalt.daten.talks).toBeUndefined();
    expect(bs.json.inhalt.daten.state.grades).toBeUndefined();
    expect(bs.json.inhalt.daten.state.texts).toEqual({});
    expect((await call('/api/zustand', { jar: betreuer })).status).toBe(403);
    // Betreuer ändert Termin und Planung – nur der Termin kommt an
    const bd = bs.json.inhalt.daten; bd.events[0].time = '18:30'; bd.events[0].unit = 'u-neu'; bd.state.grades = { g0: { 'p-a': '1' } };
    expect((await call('/api/dokumente/teamzentrale', { method: 'PUT', jar: betreuer, body: { basisVersion: bs.json.version, inhalt: { basis: {}, daten: bd } } })).status).toBe(200);
    const end = (await call('/api/dokumente/teamzentrale', { jar: trainer })).json.inhalt.daten;
    expect(end.events[0]).toMatchObject({ time: '18:30', unit: 'u1' });
    expect(end.state.grades).toEqual({ g0: { 'p-a': '5' } });
    expect(end.talks).toEqual(daten.talks);
  });

  it('Team & Zugänge: Trainer ändern Rollen, entfernen Zugänge, ziehen Einladungen zurück', async () => {
    const v = await call('/api/team/verwaltung', { jar: trainer });
    expect(v.status).toBe(200);
    const bea = v.json.nutzer.find((n: { name: string }) => n.name === 'Bea'), ich = v.json.ich;
    expect(bea.role).toBe('betreuer');
    expect(v.json.nutzer.some((n: { role: string }) => n.role === 'spieler')).toBe(false);
    // Betreuer dürfen nicht verwalten, niemand ändert sich selbst
    const bj: Jar = { cookie: '' };
    await call('/api/anmelden', { method: 'POST', jar: bj, body: { email: 'b@example.de', passwort: 'betreuer-pass-1' } });
    expect((await call('/api/team/verwaltung', { jar: bj })).status).toBe(403);
    expect((await call(`/api/team/${ich}`, { method: 'PATCH', jar: trainer, body: { rolle: 'betreuer' } })).status).toBe(400);
    // Betreuer wird Trainer und sieht dann alles
    expect((await call(`/api/team/${bea.id}`, { method: 'PATCH', jar: trainer, body: { rolle: 'trainer' } })).status).toBe(200);
    expect((await call('/api/zustand', { jar: bj })).status).not.toBe(403);
    expect((await call(`/api/team/${bea.id}`, { method: 'PATCH', jar: trainer, body: { rolle: 'betreuer' } })).status).toBe(200);
    // Einladung anlegen und zurückziehen
    const inv = await call('/api/einladungen', { method: 'POST', jar: trainer, body: { rolle: 'betreuer' } });
    const offen = (await call('/api/team/verwaltung', { jar: trainer })).json.einladungen;
    expect(offen.length).toBeGreaterThan(0);
    for (const e of offen) await call(`/api/einladungen/offen/${e.id}`, { method: 'DELETE', jar: trainer });
    expect((await call('/api/team/verwaltung', { jar: trainer })).json.einladungen).toEqual([]);
    expect((await call(`/api/einladungen/${String(inv.json.link).split('#einladung/')[1]}`)).json.gueltig).toBe(false);
    // Zugang entfernen: sofort abgemeldet, Speicherstand bleibt
    expect((await call(`/api/team/${bea.id}`, { method: 'DELETE', jar: trainer })).status).toBe(200);
    expect((await call('/api/dokumente/teamzentrale', { jar: bj })).status).toBe(401);
    expect((await call('/api/dokumente/teamzentrale', { jar: trainer })).status).toBe(200);
    // Der letzte Trainer bleibt: alle anderen Trainer zu Betreuern machen, dann kann man sich nicht selbst entfernen
    expect((await call(`/api/team/${ich}`, { method: 'DELETE', jar: trainer })).status).toBe(400);
  });

  it('Dossier-PDF: nur Trainer laden hoch, Angemeldete sehen es an', async () => {
    const put = (body: Buffer | string, jar: Jar) => fetch(base + '/api/dossier-pdf/g1', { method: 'PUT', headers: { 'X-CoachAI': '1', 'Content-Type': 'application/pdf', Cookie: jar.cookie }, body });
    expect((await put('kein pdf', trainer)).status).toBe(400);
    expect((await put('%PDF-1.7 test', trainer)).status).toBe(200);
    expect((await call('/api/dossier-pdf', { jar: trainer })).json.pdfs.g1.kb).toBe(0);
    const r = await fetch(base + '/api/dossier-pdf/g1', { headers: { Cookie: trainer.cookie } });
    expect(r.headers.get('content-type')).toBe('application/pdf');
    expect(await r.text()).toBe('%PDF-1.7 test');
    expect((await fetch(base + '/api/dossier-pdf/g1')).status).toBe(401);
    expect((await call('/api/dossier-pdf/g1', { method: 'DELETE', jar: trainer })).status).toBe(200);
    expect((await fetch(base + '/api/dossier-pdf/g1', { headers: { Cookie: trainer.cookie } })).status).toBe(404);
  });

  it('Kalender-Abo: persönlicher Link liefert iCal, neuer Link macht den alten ungültig', async () => {
    const l = await call('/api/kalender/link', { method: 'POST', jar: trainer, body: {} });
    expect(l.json.webcal).toMatch(/^webcal:\/\/coach\.example\.de\/kalender\/.+\.ics$/);
    expect((await call('/api/kalender/link', { method: 'POST', jar: trainer, body: {} })).json.https).toBe(l.json.https);
    const pfad = String(l.json.https).replace('https://coach.example.de', '');
    const r = await fetch(base + pfad);
    expect(r.headers.get('content-type')).toContain('text/calendar');
    const ics = await r.text();
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Training');
    const neu = await call('/api/kalender/link', { method: 'POST', jar: trainer, body: { neu: true } });
    expect(neu.json.https).not.toBe(l.json.https);
    expect((await fetch(base + pfad)).status).toBe(404);
  });

  it('liefert das Frontend aus und lässt keine Pfade außerhalb zu', async () => {
    const r = await fetch(base + '/irgendwo');
    expect(await r.text()).toContain('11Plan');
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
