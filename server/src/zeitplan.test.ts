import { describe, expect, it } from 'vitest';
import { openDb } from './db';
import { createHandler } from './app';
import { createUser, spielerKonto } from './auth';

describe('Zeitplan um 15 und 17 Uhr', () => {
  it('erinnert per Push und legt um 17 Uhr den Dienst eines Abwesenden um', async () => {
    const db = openDb(':memory:');
    const gesendet: { ids: number[]; body: string }[] = [];
    const push = { schluessel: 'x', abonnieren() {}, abbestellen() {}, async senden(ids: number[], n: { body: string }) { gesendet.push({ ids, body: n.body }); return ids.length; } };
    const h = createHandler(db, { publicDir: '.', setupToken: '', datendienstUrl: '', datendienstKey: '', secureCookies: false, publicUrl: 'https://x', push });
    const trainer = createUser(db, { email: 't@x.de', name: 'T', role: 'trainer', password: 'langes-passwort' });
    const a = spielerKonto(db, 'p-a', 'Anton A'), c = spielerKonto(db, 'p-c', 'Carl C');
    const daten = { kaderNamen: { 'p-a': 'Anton A', 'p-c': 'Carl C' }, events: [{ id: 'e1', date: '2026-11-20', type: 'tr', time: '19:00' }],
      duties: [{ id: 'd1', title: 'Materialdienst (Bälle)', from: '2026-11-16', to: '2026-11-22', slots: 1, who: ['p-a'] }],
      absences: [{ pid: 'p-a', from: '2026-11-20', to: '2026-11-20', why: 'Arbeit' }], state: { notices: [] } };
    db.prepare("INSERT INTO docs (name, version, json, updated_by) VALUES ('teamzentrale', 1, ?, ?)").run(JSON.stringify({ basis: {}, daten }), trainer.id);

    await h.zeitplanTick(new Date('2026-11-20T13:00:00Z')); // 14 Uhr in Berlin: nichts
    expect(gesendet).toHaveLength(0);
    await h.zeitplanTick(new Date('2026-11-20T14:01:00Z')); // 15:01
    expect(gesendet).toEqual([{ ids: [a.id], body: expect.stringContaining('noch nicht umgelegt') }]);
    await h.zeitplanTick(new Date('2026-11-20T14:30:00Z')); // nur einmal am Tag
    expect(gesendet).toHaveLength(1);
    await h.zeitplanTick(new Date('2026-11-20T16:01:00Z')); // 17:01: umlegen
    const doc = JSON.parse((db.prepare("SELECT json FROM docs WHERE name = 'teamzentrale'").get() as { json: string }).json);
    expect(doc.daten.duties[0].who).toEqual(['p-c']);
    await new Promise((r) => setTimeout(r, 20));
    expect(gesendet.slice(1).map((g) => g.ids[0]).sort()).toEqual([a.id, c.id].sort());
    expect(gesendet.find((g) => g.ids[0] === c.id)?.body).toContain('automatisch der Materialdienst zugewiesen');
  });
});
