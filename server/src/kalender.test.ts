import { describe, expect, it } from 'vitest';
import { berlinNachUtc, kalenderIcs } from './kalender';

const daten = {
  kaderNamen: { 'p-a': 'Anton A', 'p-b': 'Bernd B' },
  events: [
    { id: 'e1', date: '2026-11-20', type: 'tr', time: '19:00', dur: 90, place: 'Kunstrasenplatz Schulstraße', unit: 'u1' },
    { id: 'g1', date: '2026-11-22', type: 'gm', time: '14:30', opp: 'TSV X', home: false, comp: 'Gruppenliga, 18. Spieltag', place: 'Sportplatz X, Weg 1' },
    { id: 'alt', date: '2025-01-01', type: 'tr', time: '19:00' },
  ],
  duties: [{ id: 'd1', title: 'Materialdienst (Bälle)', from: '2026-11-16', to: '2026-11-22', slots: 1, who: ['p-a'] }],
  absences: [{ pid: 'p-a', from: '2026-11-20', to: '2026-11-20', why: 'Arbeit' }],
  state: { texts: { 'treffpunkt-g1': '12:45 Schulstraße', 'kleidung-g1': 'Trikot weiß' } },
};

describe('Kalender-Abo', () => {
  it('zeigt Ergebnisse aus unserer Sicht', () => {
    const d = { events: [{ id: 'g', date: '2026-11-01', type: 'gm', time: '15:00', opp: 'SV Y', home: false, res: '8:0' }, { id: 'h', date: '2026-11-08', type: 'gm', time: '15:00', opp: 'SV Z', home: true, res: '2:1' }] };
    const ics = kalenderIcs(d, { name: '11Plan', jetzt: new Date('2026-11-18T10:00:00Z') });
    expect(ics).toContain('SUMMARY:Auswärtsspiel bei SV Y (0:8\\, Niederlage)');
    expect(ics).toContain('SUMMARY:Heimspiel gegen SV Z (2:1\\, Sieg)');
  });

  it('rechnet Berliner Zeit richtig in UTC um (Winter- und Sommerzeit)', () => {
    expect(berlinNachUtc('2026-11-20', '19:00').toISOString()).toBe('2026-11-20T18:00:00.000Z');
    expect(berlinNachUtc('2026-07-05', '15:00').toISOString()).toBe('2026-07-05T13:00:00.000Z');
  });

  it('enthält Trainings, Spiele mit Treffpunkt und Dienste – ohne Trainingsinhalt, alte Termine weg', () => {
    const ics = kalenderIcs(daten, { name: '11Plan', pid: 'p-a', jetzt: new Date('2026-11-18T10:00:00Z') });
    const ent = ics.replace(/\r\n /g, '');
    expect(ent).toContain('DTSTART:20261120T180000Z');
    expect(ent).toContain('DTEND:20261120T193000Z');
    expect(ent).toContain('SUMMARY:Training – nicht dabei');
    expect(ent).toContain('SUMMARY:Auswärtsspiel bei TSV X');
    expect(ent).toContain('Treffpunkt: 12:45 Schulstraße');
    expect(ent).toContain('LOCATION:Sportplatz X\\, Weg 1');
    expect(ent).toContain('SUMMARY:★ Materialdienst: Anton A');
    expect(ent).toContain('DTSTART;VALUE=DATE:20261120');
    expect(ent).not.toContain('u1');
    expect(ent).not.toContain('alt@11plan');
    expect(ics.split('\r\n').every((z) => Buffer.byteLength(z, 'utf8') <= 75)).toBe(true);
  });
});
