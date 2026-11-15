import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { kiDienst, KI_MODELL, schemaFuer, type KiFeld } from './ki';

/** Nachgebauter Anthropic-Server: merkt sich die Anfrage und antwortet wie die Messages-API. */
let srv: Server, url = '', letzte: Record<string, any> = {}, antwort: { status: number; body: unknown } = { status: 200, body: {} };
beforeAll(async () => {
  srv = createServer((req, res) => {
    let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => {
      letzte = { pfad: req.url, kopf: req.headers, body: JSON.parse(b || '{}') };
      res.writeHead(antwort.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(antwort.body));
    });
  });
  await new Promise<void>((r) => srv.listen(0, r));
  url = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
});
afterAll(() => srv.close());

const FELDER: KiFeld[] = [
  { key: 'name', label: 'Name' },
  { key: 'art', label: 'Art', optionen: [{ wert: 'Spielform', label: 'Spielform' }, { wert: 'Athletik', label: 'Athletik' }] },
  { key: 'aufbau', label: 'Aufbau' },
  { key: 'ziel', label: 'Ziel' },
];
const msg = (text: string, stop = 'end_turn') => ({ id: 'msg_1', type: 'message', role: 'assistant', model: KI_MODELL, content: [{ type: 'text', text }], stop_reason: stop, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } });

describe('KI-Verteilung', () => {
  it('baut ein Schema mit genau den Feldern, Auswahl nur aus erlaubten Werten', () => {
    const s = schemaFuer(FELDER) as any;
    expect(s.required).toEqual(['name', 'art', 'aufbau', 'ziel']);
    expect(s.properties.art.enum).toEqual(['', 'Spielform', 'Athletik']);
    expect(s.additionalProperties).toBe(false);
  });

  it('schickt Sonnet 5.5 mit Schema und Schlüssel vom Server und übernimmt nur bekannte Felder', async () => {
    antwort = { status: 200, body: msg(JSON.stringify({ name: 'Doppelter Sechzehner', art: 'Fußballtennis', aufbau: 'Zwei Strafräume', ziel: '', extra: 'nein' })) };
    const f = await kiDienst('sk-test', url)({ maske: 'Übung erfassen', text: 'Doppelter Sechzehner, zwei Strafräume …', felder: FELDER, kontext: 'Max Muster' });
    expect(letzte.pfad).toBe('/v1/messages');
    expect(letzte.kopf.authorization).toBe('Bearer sk-test');
    expect(letzte.body.model).toBe('claude-sonnet-5-5');
    expect(letzte.body.output_config.format.type).toBe('json_schema');
    expect(letzte.body.messages[0].content).toContain('Doppelter Sechzehner, zwei Strafräume');
    expect(letzte.body.messages[0].content).toContain('Max Muster');
    expect(f).toEqual({ name: 'Doppelter Sechzehner', art: '', aufbau: 'Zwei Strafräume', ziel: '' });
  });

  it('meldet verständliche Fehler', async () => {
    antwort = { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } };
    await expect(kiDienst('falsch', url)({ maske: 'x', text: 'a', felder: FELDER })).rejects.toThrow(/Schlüssel/);
    antwort = { status: 200, body: msg('', 'refusal') };
    await expect(kiDienst('sk', url)({ maske: 'x', text: 'a', felder: FELDER })).rejects.toThrow(/nicht verarbeitet/);
    await expect(kiDienst('sk', url)({ maske: 'x', text: '  ', felder: FELDER })).rejects.toThrow(/Kein Text/);
  });
});
