import { describe, expect, it } from 'vitest';
import { inflateRawSync } from 'node:zlib';
import { buildPptx, pptxFileName } from './pptx';
import { buildDossier } from '../dossier/build';
import { initialState, REFERENCE_MATCH_ID } from '../data/seed';
import { demoProvider } from '../data/demoProvider';
import { applyProviderResult, insertExampleAnswers } from '../state/actions';

/** Minimaler ZIP-Leser: liefert Dateinamen und entpackte Inhalte. */
function unzip(buf: Buffer): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  while (i < buf.length - 4 && buf.readUInt32LE(i) === 0x04034b50) {
    const method = buf.readUInt16LE(i + 8);
    const size = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extra = buf.readUInt16LE(i + 28);
    const name = buf.toString('utf8', i + 30, i + 30 + nameLen);
    const start = i + 30 + nameLen + extra;
    const data = buf.subarray(start, start + size);
    out.set(name, method === 8 ? inflateRawSync(data).toString('utf8') : data.toString('utf8'));
    i = start + size;
  }
  return out;
}

describe('PPTX-Export', () => {
  it('erzeugt eine echte PPTX mit 11 Folien und nativen Tabellen/Texten', async () => {
    const s = initialState();
    applyProviderResult(s, REFERENCE_MATCH_ID, await demoProvider.fetch(s.teams[0], s.matches[0]));
    insertExampleAnswers(s, REFERENCE_MATCH_ID);
    const content = buildDossier(s.teams[0], s.matches[0], s.preparations[REFERENCE_MATCH_ID]);
    const buf = (await buildPptx(content).write({ outputType: 'nodebuffer', compression: true })) as Buffer;
    expect(buf.length).toBeGreaterThan(20000);
    const files = unzip(buf);
    const slides = [...files.keys()].filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slides).toHaveLength(11);
    const s3 = files.get('ppt/slides/slide3.xml')!;
    expect(s3).toContain('<a:tbl>');
    expect(s3).toContain('GSV Eintracht Baunatal');
    expect(s3).toContain('widersprüchlich');
    const s11 = files.get('ppt/slides/slide11.xml')!;
    expect(s11).toContain('Zweite Bälle gehören uns');
    expect(s11).not.toContain('<p:pic>');
    const s4 = files.get('ppt/slides/slide4.xml')!;
    expect(s4).toContain('17:20');
    expect(pptxFileName(content)).toMatch(/\.pptx$/);
  });

  it('bettet Spielerfotos der Gefahr-Folie ein und zeigt sonst Initialen', async () => {
    const s = initialState();
    applyProviderResult(s, REFERENCE_MATCH_ID, await demoProvider.fetch(s.teams[0], s.matches[0]));
    insertExampleAnswers(s, REFERENCE_MATCH_ID);
    const content = buildDossier(s.teams[0], s.matches[0], s.preparations[REFERENCE_MATCH_ID]);
    const danger = content.slides.find((x) => x.key === 'gegnerGefahr');
    if (!danger || danger.key !== 'gegnerGefahr' || danger.players.length < 2) throw new Error('Gefahr-Folie ohne Spieler');
    danger.players[0] = { ...danger.players[0], photo: { url: 'https://image.fupa.net/player/abcdef/200x200.jpeg', credit: 'FuPa / Test' }, mvp: 87 };
    // 1×1-Pixel-JPEG
    const jpeg =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const buf = (await buildPptx(content, new Map([[danger.players[0].photo!.url, jpeg]])).write({ outputType: 'nodebuffer', compression: true })) as Buffer;
    const files = unzip(buf);
    const n = content.slides.indexOf(danger) + 1;
    const xml = files.get(`ppt/slides/slide${n}.xml`)!;
    expect(xml).toContain('<p:pic>');
    expect(xml).toContain('87 %');
    expect(xml).toContain(danger.players[1].initials);
    expect([...files.keys()].some((f) => f.startsWith('ppt/media/'))).toBe(true);
  });
});
