import { describe, expect, it } from 'vitest';
import { betreuerSicht, betreuerUebernehmen, dienstErinnerungen, dienstTage, dienstUmlegen, neueMitteilungen, spielerAktion, spielerSicht, type Daten } from './rollen';

const stand = (): Daten => ({
  kaderNamen: { 'p-a': 'Anton A', 'p-b': 'Bernd B', 'p-c': 'Carl C' },
  events: [
    { id: 'e1', date: '2026-11-20', type: 'tr', time: '19:00', unit: 'u1' },
    { id: 'g1', date: '2026-11-22', type: 'gm', time: '14:30', opp: 'TSV X', home: false },
  ],
  duties: [{ id: 'd1', title: 'Materialdienst (Bälle)', from: '2026-11-16', to: '2026-11-22', slots: 1, who: ['p-a'] }],
  absences: [
    { pid: 'p-a', from: '2026-11-20', to: '2026-11-20', why: 'Arbeit: Spätschicht' },
    { pid: 'p-b', from: '2026-11-01', to: '2026-11-30', why: 'verletzt: Kreuzband' },
  ],
  talks: { 'p-a': [{ code: 'bench', notizen: 'vertraulich' }] },
  sentMsgs: ['x'],
  units: [{ id: 'u1', name: 'Einheit' }],
  state: {
    grades: { g0: { 'p-a': '5' } }, rating: { 'g0|b1': 2 }, phaseRating: { g0: { u2: '3' } },
    texts: { 'a-q1-g1': 'Gegner geheim', 'gr-g0-p-a': 'schwach', 'kleidung-g1': 'Trikot weiß', 'zeitplan-g1': '12:45 Abfahrt' },
    att: { e1: { 'p-a': { s: 'nein', why: 'krank' }, 'p-b': { s: 'nein', why: 'privat' } } },
    rides: {}, notices: [{ id: 'n1', to: 'p-b', text: 'Hallo B' }, { id: 'n2', to: 'p-a', text: 'Hallo A' }],
    pv: { kalender: true }, autoren: { 't:a-q1-g1': { v: 'Manuel', t: 'x' } },
  },
});

describe('Betreuer', () => {
  it('sieht keine Noten, Bewertungen, Gespräche oder Spieltagstexte', () => {
    const b = betreuerSicht(stand());
    expect(b.talks).toBeUndefined();
    expect(b.sentMsgs).toBeUndefined();
    expect(b.state?.grades).toBeUndefined();
    expect(b.state?.rating).toBeUndefined();
    expect(b.state?.phaseRating).toBeUndefined();
    expect(b.state?.autoren).toBeUndefined();
    expect(b.state?.texts).toEqual({ 'kleidung-g1': 'Trikot weiß', 'zeitplan-g1': '12:45 Abfahrt' });
    expect(b.events).toHaveLength(2);
    expect(b.duties).toHaveLength(1);
    expect(b.state?.att).toBeDefined();
  });

  it('ändert nur Termine, Dienste, Abwesenheiten und Anwesenheit – Planung und Noten bleiben', () => {
    const voll = stand(), sicht = betreuerSicht(voll);
    const e = (sicht.events as Daten[])[0]; e.time = '18:30'; e.unit = 'u-anders';
    (sicht.duties as Daten[])[0].who = ['p-c'];
    (sicht.state as Daten).grades = { g0: { 'p-a': '1' } };
    (sicht as Daten).talks = {};
    const neu = betreuerUebernehmen(voll, sicht);
    expect((neu.events as Daten[])[0].time).toBe('18:30');
    expect((neu.events as Daten[])[0].unit).toBe('u1');
    expect((neu.duties as Daten[])[0].who).toEqual(['p-c']);
    expect((neu.state as Daten).grades).toEqual({ g0: { 'p-a': '5' } });
    expect(neu.talks).toEqual(voll.talks);
  });
});

describe('Spieler', () => {
  it('sieht eigene Abwesenheiten mit Grund, bei anderen nur „abwesend“, nur eigene Mitteilungen', () => {
    const s = spielerSicht(stand(), 'p-a');
    expect(s.talks).toBeUndefined();
    expect(s.state?.grades).toBeUndefined();
    expect(s.state?.texts).toEqual({ 'kleidung-g1': 'Trikot weiß', 'zeitplan-g1': '12:45 Abfahrt' });
    const ab = s.absences as Daten[];
    expect(ab.find((a) => a.pid === 'p-a')?.why).toBe('Arbeit: Spätschicht');
    expect(ab.find((a) => a.pid === 'p-b')?.why).toBe('abwesend');
    expect(s.state?.notices).toEqual([{ id: 'n2', to: 'p-a', text: 'Hallo A' }]);
    expect(s.state?.att).toEqual({ e1: { 'p-a': { s: 'nein', why: 'krank' } } });
  });

  it('kann zu- und absagen, Abwesenheit eintragen und nur eigene löschen', () => {
    let d = spielerAktion(stand(), 'p-c', { typ: 'absage', eid: 'e1', why: 'Arbeit', note: 'Spätschicht' });
    expect((d.absences as Daten[]).some((a) => a.pid === 'p-c' && a.src === 'e1' && a.why === 'Arbeit: Spätschicht')).toBe(true);
    d = spielerAktion(d, 'p-c', { typ: 'zusage', eid: 'e1' });
    expect((d.absences as Daten[]).some((a) => a.pid === 'p-c')).toBe(false);
    d = spielerAktion(d, 'p-c', { typ: 'abwesenheit', from: '2026-12-01', to: '2026-12-03', why: 'Urlaub' });
    d = spielerAktion(d, 'p-a', { typ: 'abwesenheitWeg', from: '2026-12-01', to: '2026-12-03', why: 'Urlaub' });
    expect((d.absences as Daten[]).some((a) => a.pid === 'p-c' && a.why === 'Urlaub')).toBe(true);
    expect(() => spielerAktion(d, 'p-c', { typ: 'absage', eid: 'e1' })).toThrow(/Grund/);
  });

  it('gibt nur eigene Dienste ab und der neue bekommt eine Mitteilung', () => {
    expect(() => spielerAktion(stand(), 'p-b', { typ: 'dienstAbgeben', did: 'd1', an: 'p-c' })).toThrow(/nicht dein Dienst/);
    const vorher = stand(), d = spielerAktion(vorher, 'p-a', { typ: 'dienstAbgeben', did: 'd1', an: 'p-c' });
    expect((d.duties as Daten[])[0].who).toEqual(['p-c']);
    expect(neueMitteilungen(vorher, d)).toEqual([{ to: 'p-c', text: expect.stringContaining('Anton A hat dir einen Dienst übergeben') }]);
  });

  it('Dienst nur an jemanden, der an den Diensttagen da ist – Abwesenheit an anderen Tagen zählt nicht', () => {
    const jetzt = new Date('2026-11-18T10:00:00Z');
    // p-b ist den ganzen Monat verletzt → nicht wählbar
    expect(() => spielerAktion(stand(), 'p-a', { typ: 'dienstAbgeben', did: 'd1', an: 'p-b' }, jetzt)).toThrow(/nicht da/);
    // p-c fehlt nur am Mittwoch (kein Training) → wählbar
    const d = stand(); (d.absences as Daten[]).push({ pid: 'p-c', from: '2026-11-18', to: '2026-11-18', why: 'privat' });
    expect((spielerAktion(d, 'p-a', { typ: 'dienstAbgeben', did: 'd1', an: 'p-c' }, jetzt).duties as Daten[])[0].who).toEqual(['p-c']);
  });

  it('Fahrgemeinschaft: anbieten, suchen, mitnehmen', () => {
    let d = spielerAktion(stand(), 'p-a', { typ: 'fahrtAnbieten', gid: 'g1', plaetze: 2, ab: '12:45' });
    d = spielerAktion(d, 'p-b', { typ: 'fahrtSuchen', gid: 'g1' });
    expect(() => spielerAktion(d, 'p-b', { typ: 'fahrtMitnehmen', gid: 'g1', mit: 'p-c' })).toThrow();
    const vorher = d; d = spielerAktion(d, 'p-a', { typ: 'fahrtMitnehmen', gid: 'g1', mit: 'p-b' });
    expect(((d.state as Daten).rides as Record<string, { fahrer: { mit: string[] }[] }>).g1.fahrer[0].mit).toEqual(['p-b']);
    expect(neueMitteilungen(vorher, d)[0]).toEqual({ to: 'p-b', text: expect.stringContaining('Du fährst bei') });
  });
});

describe('Dienstarten', () => {
  it('Materialdienst nur an Trainings- und Spieltagen, eigener Dienst an jedem Tag', () => {
    const d = stand();
    expect(dienstTage(d, (d.duties as Daten[])[0])).toEqual(['2026-11-20', '2026-11-22']);
    expect(dienstTage(d, { id: 'w', title: 'Weihnachtsmarkt', art: 'frei', from: '2026-12-11', to: '2026-12-13', who: [] })).toEqual(['2026-12-11', '2026-12-12', '2026-12-13']);
  });
});

describe('Zeitplan', () => {
  it('15 Uhr: Erinnerung, bei Abwesenheit mit Hinweis aufs Umlegen', () => {
    expect(dienstErinnerungen(stand(), '2026-11-20')).toEqual([{ to: 'p-a', text: expect.stringContaining('noch nicht umgelegt') }]);
    expect(dienstErinnerungen(stand(), '2026-11-21')).toEqual([]); // kein Training, kein Spiel
    const d = stand(); (d.absences as Daten[]).splice(0, 1);
    expect(dienstErinnerungen(d, '2026-11-20')[0].text).toContain('Denk dran');
  });

  it('17 Uhr: Dienst von Abwesenden an einen anwesenden Spieler, einmalig', () => {
    const d = dienstUmlegen(stand(), '2026-11-20', new Date('2026-11-20T16:00:00Z'))!;
    expect((d.duties as Daten[])[0].who).toEqual(['p-c']); // p-b ist verletzt, p-a abwesend
    expect(neueMitteilungen(stand(), d).map((n) => n.to).sort()).toEqual(['p-a', 'p-c']);
    expect(dienstUmlegen(d, '2026-11-20')).toBeNull();
  });
});
