import { describe, expect, it } from 'vitest';
import { abgleichen } from './merge';

describe('Abgleich der Teamzentrale', () => {
  it('übernimmt Änderungen von beiden Seiten an verschiedenen Stellen', () => {
    const basis = { settings: { dauer: 90, ort: 'A' }, notiz: '' };
    const meins = { settings: { dauer: 100, ort: 'A' }, notiz: '' };
    const fremd = { settings: { dauer: 90, ort: 'B' }, notiz: 'neu' };
    expect(abgleichen(basis, meins, fremd)).toEqual({ settings: { dauer: 100, ort: 'B' }, notiz: 'neu' });
  });

  it('gleicht Listen mit id Eintrag für Eintrag ab, auch beim Hinzufügen und Löschen', () => {
    const basis = { events: [{ id: 'a', t: 1 }, { id: 'b', t: 1 }, { id: 'c', t: 1 }] };
    const meins = { events: [{ id: 'a', t: 2 }, { id: 'b', t: 1 }, { id: 'c', t: 1 }, { id: 'x', t: 1 }] };
    const fremd = { events: [{ id: 'a', t: 1 }, { id: 'c', t: 1 }, { id: 'y', t: 1 }] };
    expect(abgleichen(basis, meins, fremd)).toEqual({ events: [{ id: 'a', t: 2 }, { id: 'c', t: 1 }, { id: 'y', t: 1 }, { id: 'x', t: 1 }] });
  });

  it('legt eigene Eingaben über neue Daten von fussball.de', () => {
    const alteDatei: { events: { id: string; res: string | null; notiz: string }[] } = { events: [{ id: 'g1', res: null, notiz: '' }] };
    const eingaben = { events: [{ id: 'g1', res: null, notiz: 'Pressing hoch' }] };
    const neueDatei = { events: [{ id: 'g1', res: '2:1', notiz: '' }] };
    expect(abgleichen(alteDatei, eingaben, neueDatei)).toEqual({ events: [{ id: 'g1', res: '2:1', notiz: 'Pressing hoch' }] });
  });

  it('lässt bei echtem Widerspruch die eigene Eingabe gewinnen', () => {
    expect(abgleichen({ n: 1 }, { n: 2 }, { n: 3 })).toEqual({ n: 2 });
  });
});
