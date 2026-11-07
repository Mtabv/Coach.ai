import PptxGenJS from 'pptxgenjs';
import { saveFile } from './hostBridge';
import { FLAG_LABEL, type DossierContent, type FV, type Slide, type SquadCard } from '../dossier/model';

/**
 * Echter, editierbarer PPTX-Export. Texte, Tabellen und Diagramme sind native PowerPoint-Objekte
 * (Textfelder, Tabellen, Formen, Säulendiagramm). Bilder: Wappen, Spielerfotos, Spielkleidung – sofern vorab geladen.
 */

/** Bilder als Data-URL (Adresse → Bild). Fehlt ein Foto, erscheinen Initialen; fehlt ein Wappen, bleibt der Platz leer. */
export type PhotoMap = Map<string, string>;

const C = {
  green: '0F3B2C',
  green2: '1C5A43',
  lime: 'C6F35E',
  light: 'F4F7F2',
  line: 'D9E2DA',
  text: '14211B',
  muted: '5B6B62',
  black: '0B0F0D',
  white: 'FFFFFF',
  warn: 'B45309',
  red: 'B42318',
};
const FONT = 'Calibri';
const W = 13.333;
const H = 7.5;

type TextRun = PptxGenJS.TextProps;
type PSlide = PptxGenJS.Slide;

function flagColor(f: FV['flag']): string {
  if (f === 'widersprüchlich') return C.red;
  if (f === 'offen' || f === 'veraltet') return C.warn;
  return C.muted;
}

/** Wert mit sichtbarer Kennzeichnung, falls nicht gesichert. */
function fvRuns(v: FV, base: PptxGenJS.TextPropsOptions = {}): TextRun[] {
  const runs: TextRun[] = [
    {
      text: v.text,
      options: {
        ...base,
        color: v.flag === 'offen' ? C.warn : v.flag === 'widersprüchlich' ? C.red : base.color,
        ...(v.href ? { hyperlink: { url: v.href, tooltip: 'In Google Maps öffnen' }, underline: { style: 'sng' } } : {}),
      },
    },
  ];
  if (v.flag !== 'ok' && v.flag !== 'trainer') {
    runs.push({ text: `  [${FLAG_LABEL[v.flag]}]`, options: { ...base, fontSize: Math.max(9, (base.fontSize ?? 14) - 4), color: flagColor(v.flag), bold: false, italic: true } });
  }
  return runs;
}

function fvText(v: FV): string {
  return v.flag === 'ok' || v.flag === 'trainer' ? v.text : `${v.text} [${FLAG_LABEL[v.flag]}]`;
}

let IMAGES: PhotoMap = new Map();
/** Data-URL eines Bildes: eingebettete Bilder direkt, sonst aus den vorab geladenen. */
function imageData(src: string | undefined): string | undefined {
  if (!src) return undefined;
  return src.startsWith('data:') ? src : IMAGES.get(src);
}

/** Seitenverhältnis (Breite/Höhe) eines PNG/JPEG aus der Data-URL; null, wenn nicht lesbar. */
export function imageAspect(data: string): number | null {
  const m = /^data:image\/(png|jpe?g);base64,(.*)$/.exec(data);
  if (!m) return null;
  const bin = atob(m[2].slice(0, 120000));
  const u8 = (i: number) => bin.charCodeAt(i) & 0xff;
  const u16 = (i: number) => (u8(i) << 8) | u8(i + 1);
  if (m[1] === 'png') {
    const w = (u16(16) << 16) | u16(18);
    const h = (u16(20) << 16) | u16(22);
    return w > 0 && h > 0 ? w / h : null;
  }
  for (let i = 2; i < bin.length - 9; ) {
    if (u8(i) !== 0xff) return null;
    const marker = u8(i + 1);
    if (marker >= 0xc0 && marker <= 0xc3) {
      const h = u16(i + 5);
      const w = u16(i + 7);
      return w > 0 && h > 0 ? w / h : null;
    }
    i += 2 + u16(i + 2);
  }
  return null;
}

/** Bild in ein Feld einpassen (Seitenverhältnis bleibt erhalten, mittig, unten bündig auf Wunsch). */
function fitImage(s: PSlide, data: string, x: number, y: number, w: number, h: number, altText: string, alignBottom = false) {
  const a = imageAspect(data) ?? w / h;
  const iw = Math.min(w, h * a);
  const ih = iw / a;
  s.addImage({ data, x: x + (w - iw) / 2, y: alignBottom ? y + h - ih : y + (h - ih) / 2, w: iw, h: ih, altText });
}

function header(s: PSlide, slide: Slide, content: DossierContent) {
  s.background = { color: C.light };
  s.addShape('rect', { x: 0, y: 0, w: W, h: 0.12, fill: { color: C.green }, line: { color: C.green } });
  s.addShape('rect', { x: 0.5, y: 0.45, w: 0.12, h: 0.75, fill: { color: C.lime }, line: { color: C.lime } });
  s.addText(slide.kicker.toUpperCase(), { x: 0.75, y: 0.38, w: 9, h: 0.35, fontFace: FONT, fontSize: 11, bold: true, color: C.green2, charSpacing: 1 });
  s.addText(slide.title, { x: 0.75, y: 0.68, w: 10, h: 0.6, fontFace: FONT, fontSize: 28, bold: true, color: C.green });
  const crests = [content.meta.crests.home, content.meta.crests.away];
  crests.forEach((c, i) => {
    const data = imageData(c);
    if (data) fitImage(s, data, W - 1.95 + i * 0.75, 0.42, 0.62, 0.62, i ? 'Wappen Gast' : 'Wappen Heim');
  });
  const foot: string[] = [];
  const src = [...new Set(slide.sources)];
  if (src.length) foot.push(`${src.length > 1 ? 'Quellen' : 'Quelle'}: ${src.join(' · ')}`);
  if (slide.footnote) foot.push(slide.footnote);
  if (content.meta.containsDemoData) foot.push('Enthält Beispieldaten (fiktiv)');
  s.addText(foot.join('   |   '), { x: 0.5, y: H - 0.45, w: W - 2, h: 0.3, fontFace: FONT, fontSize: 8.5, color: C.muted, valign: 'middle' });
  s.addText(`${slide.number}/${content.slides.length}`, { x: W - 1.5, y: H - 0.45, w: 1, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: C.green, align: 'right', valign: 'middle' });
}

function card(s: PSlide, x: number, y: number, w: number, h: number, title?: string, dark = false) {
  s.addShape('roundRect', { x, y, w, h, rectRadius: 0.08, fill: { color: dark ? C.green : C.white }, line: { color: dark ? C.green : C.line, width: 0.75 } });
  if (title) s.addText(title.toUpperCase(), { x: x + 0.2, y: y + 0.1, w: w - 0.4, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: dark ? C.lime : C.green2, charSpacing: 1 });
}

function label(s: PSlide, x: number, y: number, w: number, text: string) {
  s.addText(text.toUpperCase(), { x, y, w, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: C.green2, charSpacing: 1 });
}

/** Kleines Kästchen mit Akzentstreifen links (Fakten, Muster, Belege). */
function pill(s: PSlide, x: number, y: number, w: number, h: number, runs: TextRun[] | string, fontSize = 12, accent: string = C.lime, fill: string = C.white) {
  s.addShape('roundRect', { x, y, w, h, rectRadius: 0.06, fill: { color: fill }, line: { color: fill === C.white ? C.line : fill, width: 0.5 } });
  if (accent) s.addShape('rect', { x, y: y + 0.02, w: 0.07, h: h - 0.04, fill: { color: accent }, line: { color: accent } });
  s.addText(runs, { x: x + 0.15, y, w: w - 0.25, h, fontFace: FONT, fontSize, color: C.text, valign: 'middle', fit: 'shrink' });
}

/** Rundes Foto oder Initialen. */
function avatar(s: PSlide, x: number, y: number, size: number, photo: string | undefined, initials: string, name: string) {
  const data = imageData(photo);
  if (data) s.addImage({ data, x, y, w: size, h: size, rounding: true, altText: `Foto ${name}` });
  else {
    s.addShape('ellipse', { x, y, w: size, h: size, fill: { color: 'EEF9D4' }, line: { color: C.lime, width: 2 } });
    s.addText(initials, { x, y, w: size, h: size, fontFace: FONT, fontSize: Math.round(size * 20), bold: true, color: C.green, align: 'center', valign: 'middle' });
  }
}

const th = (t: string): PptxGenJS.TableCell => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.green }, fontSize: 10, align: 'center', valign: 'middle' } });

function tableOpts(x: number, y: number, w: number, colW: number[], fontSize = 10): PptxGenJS.TableProps {
  return { x, y, w, colW, fontFace: FONT, fontSize, color: C.text, border: { type: 'solid', pt: 0.5, color: C.line }, fill: { color: C.white }, margin: 0.04, rowH: 0.26, valign: 'middle', align: 'center' };
}

function addSlide(p: PptxGenJS, slide: Slide, content: DossierContent) {
  const s = p.addSlide();
  if (slide.key !== 'titel') header(s, slide, content);

  switch (slide.key) {
    case 'titel': {
      s.background = { color: C.green };
      s.addShape('rect', { x: 0, y: H - 0.25, w: W, h: 0.25, fill: { color: C.lime }, line: { color: C.lime } });
      s.addText(slide.kicker.toUpperCase(), { x: 0.8, y: 0.8, w: 11, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.lime, charSpacing: 2 });
      s.addText(slide.title, { x: 0.8, y: 1.25, w: 11, h: 0.5, fontFace: FONT, fontSize: 18, color: 'D7E5DC' });
      s.addText(slide.home, { x: 0.8, y: 2.1, w: 11.5, h: 0.9, fontFace: FONT, fontSize: 44, bold: true, color: C.white });
      s.addText('gegen', { x: 0.8, y: 2.95, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 18, color: C.lime });
      s.addText(slide.away, { x: 0.8, y: 3.4, w: 11.5, h: 0.9, fontFace: FONT, fontSize: 44, bold: true, color: C.white });
      s.addText(
        [
          { text: `${slide.competition} · ${slide.matchdayLabel}`, options: { breakLine: true } },
          ...fvRuns(slide.dateLabel, { color: C.white }),
          { text: ' · ' },
          ...fvRuns(slide.timeLabel, { color: C.white }),
          { text: '', options: { breakLine: true } },
          ...fvRuns(slide.venue, { color: C.white }),
        ],
        { x: 0.8, y: 4.75, w: 11.5, h: 1.5, fontFace: FONT, fontSize: 18, color: C.white, valign: 'top', paraSpaceAfter: 4 },
      );
      if (content.meta.containsDemoData) s.addText('Enthält Beispieldaten (fiktiv)', { x: 0.8, y: H - 0.85, w: 6, h: 0.35, fontFace: FONT, fontSize: 10, color: 'B7C9BE' });
      break;
    }
    case 'inhalt': {
      slide.items.forEach((it, i) => {
        const col = i < 5 ? 0 : 1;
        const row = i < 5 ? i : i - 5;
        const x = 0.75 + col * 6.1;
        const y = 1.65 + row * 1.02;
        card(s, x, y, 5.8, 0.88);
        s.addText(String(it.number).padStart(2, '0'), { x: x + 0.15, y: y + 0.14, w: 0.8, h: 0.6, fontFace: FONT, fontSize: 24, bold: true, color: C.green2 });
        s.addText([{ text: it.title, options: { bold: true, fontSize: 15, color: C.green, breakLine: true } }, { text: it.text, options: { fontSize: 11, color: C.muted } }], { x: x + 1, y: y + 0.08, w: 4.7, h: 0.75, fontFace: FONT, valign: 'middle' });
      });
      break;
    }
    case 'spieltag': {
      const zoneFill = { auf: 'E5F4E6', relegation: 'F1F8E4', ab: 'FDECEB' } as const;
      const zoneBar = { auf: '2E7D32', relegation: '8BC34A', ab: C.red } as const;
      const rows: PptxGenJS.TableRow[] = [[th('Pl.'), th('Mannschaft'), th('Sp.'), th('S-U-N'), th('Tore'), th('Diff.'), th('Pkt.')]];
      for (const r of slide.table) {
        const fill = r.highlight === 'own' ? (r.zone === 'ab' ? 'F9D7D4' : 'E8F8C4') : r.zone ? zoneFill[r.zone] : r.highlight === 'opp' ? 'E3ECE6' : C.white;
        const o = { fill: { color: fill }, bold: Boolean(r.highlight), valign: 'middle' as const };
        rows.push([
          { text: r.rank, options: { ...o, align: 'center' } },
          { text: r.team, options: { ...o, align: 'left' } },
          { text: r.played, options: { ...o, align: 'center' } },
          { text: r.record, options: { ...o, align: 'center' } },
          { text: r.goals, options: { ...o, align: 'center' } },
          { text: r.diff, options: { ...o, align: 'center' } },
          { text: fvText(r.points), options: { ...o, align: 'center', bold: true, color: r.points.flag === 'widersprüchlich' ? C.red : C.text } },
        ]);
      }
      const rowH = 0.29;
      if (slide.table.length) {
        s.addTable(rows, { ...tableOpts(0.5, 1.45, 7.9, [0.5, 3.4, 0.5, 0.95, 0.85, 0.65, 1.05], 9.5), rowH });
        slide.table.forEach((r, i) => {
          if (r.zone) s.addShape('rect', { x: 0.5, y: 1.45 + (i + 1) * rowH, w: 0.06, h: rowH, fill: { color: zoneBar[r.zone] }, line: { color: zoneBar[r.zone] } });
        });
      } else s.addText('Tabelle liegt nicht vor [offen]', { x: 0.5, y: 1.6, w: 7.9, h: 0.5, fontFace: FONT, fontSize: 14, color: C.warn });
      const ly = 1.45 + (slide.table.length + 1) * rowH + 0.1;
      slide.zones.forEach((z, i) => {
        s.addShape('rect', { x: 0.5 + i * 2.1, y: ly + 0.08, w: 0.14, h: 0.14, fill: { color: zoneBar[z.zone] }, line: { color: zoneBar[z.zone] } });
        s.addText(z.label, { x: 0.7 + i * 2.1, y: ly, w: 1.9, h: 0.3, fontFace: FONT, fontSize: 9.5, color: C.muted, valign: 'middle' });
      });
      label(s, 8.7, 1.35, 4.15, 'Weitere Paarungen');
      if (slide.pairings.length) {
        const ph = Math.min(0.56, (5.3 - (slide.pairings.length - 1) * 0.08) / slide.pairings.length);
        slide.pairings.forEach((pp, i) => {
          const y = 1.7 + i * (ph + 0.08);
          s.addShape('roundRect', { x: 8.7, y, w: 4.15, h: ph, rectRadius: 0.06, fill: { color: pp.highlight ? C.green : C.white }, line: { color: pp.highlight ? C.green : C.line, width: 0.5 } });
          s.addText(
            [
              { text: [pp.day, pp.time].filter(Boolean).join(' · '), options: { fontSize: 8.5, bold: true, color: pp.highlight ? C.lime : C.green2, breakLine: true } },
              { text: `${pp.home} – ${pp.away}`, options: { fontSize: 10.5, bold: true, color: pp.highlight ? C.white : C.text } },
            ],
            { x: 8.85, y, w: 3.9, h: ph, fontFace: FONT, valign: 'middle', fit: 'shrink' },
          );
        });
      } else s.addText('Keine Paarungen vorhanden [offen]', { x: 8.7, y: 1.75, w: 4.1, h: 0.4, fontFace: FONT, fontSize: 11, color: C.warn });
      break;
    }
    case 'unserSpiel': {
      const top = 1.45;
      const topH = 2.75;
      const botY = top + topH + 0.2;
      const botH = H - 0.55 - botY;
      card(s, 0.5, top, 6.1, topH, 'Rahmen');
      s.addText(
        slide.facts.flatMap((f) => [{ text: `${f.label}: `, options: { bold: true, color: C.green } }, ...fvRuns(f.value, { color: C.text }), { text: '', options: { breakLine: true } }]),
        { x: 0.7, y: top + 0.45, w: 5.7, h: topH - 0.55, fontFace: FONT, fontSize: 13, valign: 'top', paraSpaceAfter: 6 },
      );
      card(s, 6.85, top, 6.0, topH, 'Zeitplan', true);
      if (slide.schedule.length) {
        const rows: PptxGenJS.TableRow[] = slide.schedule.map((it) => [
          { text: it.time.flag === 'offen' ? 'offen' : it.time.text, options: { bold: true, color: it.time.flag === 'offen' ? 'FCD34D' : C.lime } },
          { text: it.label + (it.note ? ` (${it.note})` : '') + (it.time.flag === 'trainer' ? ' · geändert' : ''), options: { color: C.white } },
        ]);
        const rh = Math.min(0.32, (topH - 0.5) / slide.schedule.length);
        s.addTable(rows, { x: 7.05, y: top + 0.42, w: 5.6, colW: [1.5, 4.1], fontFace: FONT, fontSize: 11, fill: { color: C.green }, border: { type: 'solid', pt: 0.5, color: C.green2 }, rowH: rh, margin: 0.03, valign: 'middle' });
      }
      if (slide.scheduleOpen.length) s.addText(slide.scheduleOpen.join(' '), { x: 7.05, y: top + topH - 0.45, w: 5.6, h: 0.4, fontFace: FONT, fontSize: 9.5, color: 'FCD34D', valign: 'top' });
      card(s, 0.5, botY, 6.1, botH, 'Direkte Duelle');
      if (slide.h2h.length) {
        const rows: PptxGenJS.TableRow[] = [[th('Saison'), th('Datum'), th('Wettbewerb'), th('Ort'), th('Ergebnis')]];
        slide.h2h.slice(0, 5).forEach((g) => rows.push([g.season, g.date, g.competition, g.match, g.result].map((t, i) => ({ text: t, options: { bold: i === 4 } }))));
        s.addTable(rows, { ...tableOpts(0.65, botY + 0.42, 5.8, [0.8, 1.0, 1.9, 0.9, 1.2], 9.5), rowH: 0.3 });
      } else s.addText(slide.h2hNote, { x: 0.7, y: botY + 0.45, w: 5.7, h: 0.4, fontFace: FONT, fontSize: 11, color: C.muted });
      card(s, 6.85, botY, 6.0, botH, 'Spielkleidung');
      if (slide.kit.images.length) {
        const n = slide.kit.images.length;
        const cw = 5.6 / n;
        slide.kit.images.forEach((im, i) => {
          const x = 7.05 + i * cw;
          const data = imageData(im.src);
          if (data) fitImage(s, data, x + 0.1, botY + 0.4, cw - 0.2, botH - 1.0, `${im.part} ${im.text}`, true);
          s.addText([{ text: im.part, options: { bold: true, color: C.green, breakLine: true } }, { text: im.text, options: { color: C.muted } }], { x, y: botY + botH - 0.6, w: cw, h: 0.5, fontFace: FONT, fontSize: 10, align: 'center', valign: 'middle' });
        });
      } else s.addText(fvRuns(slide.kit.label, { color: C.text, fontSize: 16 }), { x: 7.05, y: botY + 0.5, w: 5.6, h: 0.6, fontFace: FONT });
      break;
    }
    case 'gegnerForm':
    case 'unsereForm': {
      card(s, 0.5, 1.45, 6.9, 2.95, 'Letzte fünf Ligaspiele');
      if (slide.last5.length) {
        const rows: PptxGenJS.TableRow[] = [[th('Datum'), th(''), th('Gegner'), th('H/A'), th('Erg.'), th('')]];
        slide.last5.forEach((r) =>
          rows.push([
            { text: r.date },
            { text: '' },
            { text: r.opponent, options: { align: 'left' } },
            { text: r.ha },
            { text: r.result, options: { bold: true } },
            { text: r.outcome, options: { bold: true, color: C.white, fill: { color: r.outcome === 'S' ? '2E7D32' : r.outcome === 'U' ? '8A8F87' : C.red } } },
          ]),
        );
        const rh = 0.42;
        s.addTable(rows, { ...tableOpts(0.65, 1.85, 6.6, [0.85, 0.5, 3.2, 0.6, 0.85, 0.6], 11), rowH: rh });
        slide.last5.forEach((r, i) => {
          const data = imageData(r.crest);
          if (data) fitImage(s, data, 0.65 + 0.85 + 0.1, 1.85 + (i + 1) * rh + 0.06, 0.3, 0.3, `Wappen ${r.opponent}`);
        });
      } else s.addText(slide.last5Note, { x: 0.7, y: 1.9, w: 6.4, h: 0.35, fontFace: FONT, fontSize: 11, color: C.muted });
      card(s, 0.5, 4.6, 6.9, 2.25, 'Bilanz in der Liga');
      if (slide.records.length) {
        const rows: PptxGenJS.TableRow[] = [[th(''), th('Sp.'), th('S'), th('U'), th('N'), th('Tore'), th('Diff.')]];
        slide.records.forEach((r) => rows.push([{ text: r.label, options: { bold: true, align: 'left' } }, ...[r.played, r.won, r.drawn, r.lost, r.goals, r.diff].map((t) => ({ text: t }))]));
        s.addTable(rows, { ...tableOpts(0.65, 5.0, 6.6, [1.6, 0.7, 0.7, 0.7, 0.7, 1.2, 1.0], 12), rowH: 0.4 });
      }
      if (slide.recordsNote) s.addText(fvRuns(slide.recordsNote, { fontSize: 10, color: C.muted }), { x: 0.7, y: 6.35, w: 6.5, h: 0.4, fontFace: FONT });
      label(s, 7.7, 1.35, 5.15, 'Fakten');
      const n = Math.max(slide.facts.length, 1);
      const fh = Math.min(0.62, (5.15 - (n - 1) * 0.1) / n);
      slide.facts.forEach((f, i) => pill(s, 7.7, 1.7 + i * (fh + 0.1), 5.15, fh, fvRuns(f, { color: C.text }), 12));
      if (!slide.facts.length) s.addText('Keine weiteren Fakten.', { x: 7.7, y: 1.75, w: 5, h: 0.4, fontFace: FONT, fontSize: 11, color: C.muted });
      break;
    }
    case 'gegnerGefahr': {
      const n = Math.max(slide.players.length, 1);
      const w = (W - 1 - (n - 1) * 0.25) / n;
      slide.players.forEach((pl, i) => {
        const x = 0.5 + i * (w + 0.25);
        card(s, x, 1.45, w, 5.4);
        s.addShape('rect', { x, y: 1.45, w, h: 0.1, fill: { color: C.lime }, line: { color: C.lime } });
        avatar(s, x + 0.2, 1.7, 1.15, pl.photo?.url, pl.initials, pl.name);
        if (pl.mvp !== undefined) {
          s.addShape('roundRect', { x: x + w - 1.15, y: 2.0, w: 0.95, h: 0.62, rectRadius: 0.08, fill: { color: C.green }, line: { color: C.green } });
          s.addText([{ text: `${pl.mvp} %`, options: { fontSize: 15, bold: true, breakLine: true } }, { text: 'MVP', options: { fontSize: 8 } }], { x: x + w - 1.15, y: 2.0, w: 0.95, h: 0.62, fontFace: FONT, color: C.white, align: 'center', valign: 'middle' });
        }
        s.addText(pl.name, { x: x + 0.2, y: 2.95, w: w - 0.4, h: 0.4, fontFace: FONT, fontSize: 17, bold: true, color: C.green, valign: 'middle', fit: 'shrink' });
        s.addText(pl.meta, { x: x + 0.2, y: 3.32, w: w - 0.4, h: 0.28, fontFace: FONT, fontSize: 10.5, color: C.muted });
        let y = 3.7;
        if (pl.coachNote) {
          pill(s, x + 0.15, y, w - 0.3, 0.95, [{ text: pl.coachNote, options: { bold: true, color: C.green } }], 11, C.lime, 'EEF9D4');
          y += 1.05;
        }
        for (const r of pl.reasons.slice(0, 4)) {
          if (y > 6.3) break;
          pill(s, x + 0.15, y, w - 0.3, 0.5, r, 10.5, '', C.light);
          y += 0.58;
        }
      });
      if (slide.note) s.addText(slide.note, { x: 0.5, y: 6.9, w: W - 1, h: 0.2, fontFace: FONT, fontSize: 9, color: C.warn, italic: true });
      break;
    }
    case 'gegnerAuffaelligkeiten': {
      const k = slide.kpis.slice(0, 7);
      const kn = Math.max(k.length, 1);
      const kw = (W - 1 - (kn - 1) * 0.15) / kn;
      k.forEach((kp, i) => {
        const x = 0.5 + i * (kw + 0.15);
        card(s, x, 1.4, kw, 1.05);
        s.addText(kp.value, { x, y: 1.43, w: kw, h: 0.55, fontFace: FONT, fontSize: 24, bold: true, color: C.green, align: 'center', valign: 'middle' });
        s.addText(kp.label, { x: x + 0.05, y: 1.95, w: kw - 0.1, h: 0.45, fontFace: FONT, fontSize: 9.5, color: C.text, align: 'center', valign: 'middle', fit: 'shrink' });
      });
      if (!k.length) s.addText('Keine Kennzahlen – Ergebnisdaten fehlen [offen]', { x: 0.5, y: 1.6, w: 8, h: 0.4, fontFace: FONT, fontSize: 13, color: C.warn });
      card(s, 0.5, 2.65, 6.6, 4.2, 'Tore nach Spielphasen');
      if (slide.phases.length) {
        s.addChart(
          'bar',
          [
            { name: 'Tore', labels: slide.phases.map((p) => p.label), values: slide.phases.map((p) => p.goalsFor) },
            { name: 'Gegentore', labels: slide.phases.map((p) => p.label), values: slide.phases.map((p) => p.goalsAgainst) },
          ],
          {
            x: 0.65, y: 3.0, w: 6.3, h: 3.45, barDir: 'col', barGapWidthPct: 60, chartColors: [C.green2, 'E08A83'],
            showValue: true, dataLabelFontSize: 9, dataLabelColor: C.text, catAxisLabelFontSize: 10, valAxisHidden: true, valGridLine: { style: 'none' },
            showLegend: true, legendPos: 'b', legendFontSize: 9, fontFace: FONT,
          },
        );
        s.addText(`Minuten · ${slide.phasesBasis}`, { x: 0.7, y: 6.45, w: 6.2, h: 0.3, fontFace: FONT, fontSize: 9, color: C.muted });
      } else s.addText('Keine Spielberichte mit Torminuten vorhanden.', { x: 0.7, y: 3.1, w: 6.2, h: 0.4, fontFace: FONT, fontSize: 11, color: C.muted });
      label(s, 7.35, 2.6, 5.5, 'Wichtige Statistiken');
      const pn = Math.max(slide.keyStats.length, 1);
      const ph = Math.min(0.55, (3.85 - (pn - 1) * 0.07) / pn);
      slide.keyStats.forEach((t, i) => pill(s, 7.35, 2.95 + i * (ph + 0.07), 5.5, ph, t, 11));
      break;
    }
    case 'soSpieltGegner': {
      // Spielphasenmodell: Kreislauf aus vier Phasen um einen Mittelpunkt.
      s.addText([{ text: `${slide.formationLabel.toUpperCase()}  `, options: { bold: true, color: C.green2, fontSize: 9.5 } }, ...fvRuns(slide.formation, { color: C.text, fontSize: 12 })], { x: 0.5, y: 1.35, w: 7.5, h: 0.35, fontFace: FONT, valign: 'middle' });
      if (slide.absences) s.addText([{ text: `${slide.absencesLabel.toUpperCase()}  `, options: { bold: true, color: C.green2, fontSize: 9.5 } }, ...fvRuns(slide.absences, { color: C.muted, fontSize: 11 })], { x: 8.1, y: 1.35, w: 4.75, h: 0.35, fontFace: FONT, valign: 'middle', align: 'right' });
      const order = ['ballbesitz', 'ballverlust', 'ballgewinn', 'gegnerBall'] as const;
      const pw = (W - 1 - 0.2) / 2;
      const phH = 1.55;
      order.forEach((k, i) => {
        const p = slide.phases.find((x) => x.key === k)!;
        const x = 0.5 + (i % 2) * (pw + 0.2);
        const y = 1.8 + Math.floor(i / 2) * (phH + 0.15);
        const possession = k === 'ballbesitz' || k === 'gegnerBall';
        s.addShape('roundRect', { x, y, w: pw, h: phH, rectRadius: 0.08, fill: { color: C.white }, line: { color: possession ? C.green : C.lime, width: 1.5 } });
        s.addShape('rect', { x, y, w: pw, h: 0.38, fill: { color: possession ? C.green : C.lime }, line: { color: possession ? C.green : C.lime } });
        const left = i % 2 === 0;
        s.addText([{ text: p.label, options: { bold: true, fontSize: 12.5, color: possession ? C.white : C.green } }, { text: `   ${p.sub}`, options: { fontSize: 9.5, color: possession ? C.lime : C.green2 } }], { x: x + (left ? 0.15 : 0.75), y, w: pw - 0.9, h: 0.38, fontFace: FONT, valign: 'middle' });
        s.addText(fvRuns(p.value, { color: C.text }), { x: x + (left ? 0.15 : 0.75), y: y + 0.42, w: pw - 0.9, h: phH - 0.48, fontFace: FONT, fontSize: 11.5, valign: 'top', fit: 'shrink' });
      });
      const cx = W / 2;
      const cy = 1.8 + phH + 0.075;
      s.addShape('ellipse', { x: cx - 0.6, y: cy - 0.6, w: 1.2, h: 1.2, fill: { color: C.green }, line: { color: C.light, width: 4 } });
      s.addText('Spiel-\nphasen', { x: cx - 0.6, y: cy - 0.6, w: 1.2, h: 1.2, fontFace: FONT, fontSize: 11, bold: true, color: C.lime, align: 'center', valign: 'middle' });
      const ey = 1.8 + 2 * phH + 0.3 + 0.1;
      const ew = (W - 1 - 2 * 0.2) / 3;
      slide.extras.forEach((e, i) => {
        const x = 0.5 + i * (ew + 0.2);
        card(s, x, ey, ew, H - 0.55 - ey, e.label);
        s.addText(fvRuns(e.value, { color: C.text }), { x: x + 0.2, y: ey + 0.38, w: ew - 0.4, h: H - 0.55 - ey - 0.42, fontFace: FONT, fontSize: 11.5, valign: 'top', fit: 'shrink' });
      });
      break;
    }
    case 'kader': {
      const cardH = 0.72;
      const sq = (c: SquadCard, x: number, y: number, w: number, dark = false) => {
        s.addShape('roundRect', { x, y, w, h: cardH, rectRadius: 0.06, fill: { color: dark ? C.green : C.white }, line: { color: dark ? C.green : C.line, width: 0.5 } });
        avatar(s, x + 0.08, y + 0.08, 0.56, c.photo, c.initials, c.name);
        s.addText(
          [{ text: c.name, options: { bold: true, fontSize: 11, color: dark ? C.white : C.text, breakLine: Boolean(c.meta) } }, ...(c.meta ? [{ text: c.meta, options: { fontSize: 8.5, color: dark ? C.lime : C.muted } }] : [])],
          { x: x + 0.72, y, w: w - 0.8, h: cardH, fontFace: FONT, valign: 'middle', fit: 'shrink' },
        );
      };
      const empty = (x: number, y: number, w: number, text: string) => {
        s.addShape('roundRect', { x, y, w, h: cardH, rectRadius: 0.06, fill: { color: C.light }, line: { color: C.line, width: 0.75, dashType: 'dash' } });
        s.addText(text, { x: x + 0.72, y, w: w - 0.8, h: cardH, fontFace: FONT, fontSize: 11, color: C.muted, valign: 'middle' });
        s.addShape('ellipse', { x: x + 0.08, y: y + 0.08, w: 0.56, h: 0.56, fill: { color: 'EEF9D4' }, line: { color: C.lime, width: 1 } });
      };
      const colGk = 0.5;
      const gkW = 2.3;
      const fieldX = 3.0;
      const fieldW = 7.4;
      const coachX = 10.6;
      const coachW = 2.25;
      label(s, colGk, 1.35, gkW, 'Tor');
      label(s, fieldX, 1.35, fieldW, 'Feldspieler');
      label(s, coachX, 1.35, coachW, 'Trainerteam');
      const y0 = 1.7;
      const step = cardH + 0.12;
      slide.goalkeepers.forEach((c, i) => sq(c, colGk, y0 + i * step, gkW));
      for (let i = 0; i < slide.placeholders.goalkeepers; i++) empty(colGk, y0 + (slide.goalkeepers.length + i) * step, gkW, 'Torwart');
      const fw = (fieldW - 2 * 0.12) / 3;
      const field = [...slide.players.map((c) => ({ c })), ...Array.from({ length: slide.placeholders.players }, () => ({ c: null as SquadCard | null }))];
      field.forEach((f, i) => {
        const x = fieldX + (i % 3) * (fw + 0.12);
        const y = y0 + Math.floor(i / 3) * step;
        if (f.c) sq(f.c, x, y, fw);
        else empty(x, y, fw, slide.placeholders.playerLabel);
      });
      slide.coaches.forEach((c, i) => sq(c, coachX, y0 + i * step, coachW, true));
      for (let i = 0; i < slide.placeholders.coaches; i++) empty(coachX, y0 + (slide.coaches.length + i) * step, coachW, 'Trainer');
      if (!slide.count) s.addText('Kader offen – Platzhalter für 2 Torhüter, 16 Feldspieler und 2 Trainer.', { x: 0.5, y: 6.55, w: W - 1, h: 0.3, fontFace: FONT, fontSize: 10, color: C.warn });
      else if (slide.note) s.addText(slide.note, { x: 0.5, y: 6.55, w: W - 1, h: 0.3, fontFace: FONT, fontSize: 10, color: C.muted });
      break;
    }
    case 'auftrag': {
      slide.messages.forEach((m, i) => {
        const x = 0.5 + i * 4.15;
        card(s, x, 1.5, 3.95, 2.6);
        s.addText(String(i + 1), { x: x + 0.2, y: 1.6, w: 0.8, h: 0.7, fontFace: FONT, fontSize: 30, bold: true, color: C.lime });
        s.addText(fvRuns(m.headline, { bold: true, fontSize: 17, color: C.green }), { x: x + 0.2, y: 2.25, w: 3.55, h: 0.75, fontFace: FONT, valign: 'top' });
        s.addText(m.text || ' ', { x: x + 0.2, y: 3.0, w: 3.55, h: 1.0, fontFace: FONT, fontSize: 12, color: C.text, valign: 'top' });
      });
      s.addShape('rect', { x: 0.5, y: 4.35, w: W - 1, h: 1.25, fill: { color: C.black }, line: { color: C.black } });
      s.addText(fvRuns(slide.motto, { bold: true, color: C.white, fontSize: 30 }), { x: 0.7, y: 4.4, w: W - 1.4, h: 1.15, fontFace: FONT, align: 'center', valign: 'middle' });
      if (slide.mantras.length) {
        s.addText(slide.mantras.map((m, i) => ({ text: m, options: { breakLine: i < slide.mantras.length - 1 } })), { x: 0.5, y: 5.75, w: W - 1, h: 1.0, fontFace: FONT, fontSize: 15, color: C.green, align: 'center', valign: 'top', paraSpaceAfter: 4 });
      }
      break;
    }
  }
}

export function buildPptx(content: DossierContent, photos: PhotoMap = new Map()): PptxGenJS {
  const p = new PptxGenJS();
  p.layout = 'LAYOUT_WIDE';
  p.author = content.meta.teamName;
  p.company = 'Coach.AI (Vorschau)';
  p.title = `Spieltagsdossier ${content.meta.matchLabel}`;
  p.subject = `${content.meta.competition} · ${content.meta.dateLabel}`;
  IMAGES = photos;
  for (const slide of content.slides) addSlide(p, slide, content);
  return p;
}

export function pptxFileName(content: DossierContent, version?: number): string {
  const base = `Dossier_${content.meta.matchLabel}_${content.meta.dateLabel}${version ? `_V${version}` : ''}`;
  // ASCII-sichere Dateinamen: manche Browser verwerfen Umlaute im download-Attribut.
  const ascii = base
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9_.-]+/g, '_')
    .replace(/_+/g, '_');
  return `${ascii}.pptx`;
}

export async function downloadPptx(content: DossierContent, version?: number): Promise<string> {
  const name = pptxFileName(content, version);
  const raw = (await buildPptx(content, await loadPhotos(content)).write({ outputType: 'blob' })) as Blob;
  const blob = new Blob([raw], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  const result = await saveFile(name, blob);
  if (result === 'declined') throw new Error('Download abgelehnt');
  return name;
}

/** Alle Bildadressen des Dossiers, die noch keine eingebetteten Daten sind (Wappen, Spielerfotos). */
export function imageUrls(content: DossierContent): string[] {
  const urls = new Set<string>();
  const add = (u: string | undefined) => {
    if (u && /^https?:/.test(u)) urls.add(u);
  };
  add(content.meta.crests.home);
  add(content.meta.crests.away);
  for (const sl of content.slides) {
    if (sl.key === 'gegnerGefahr') for (const pl of sl.players) add(pl.photo?.url);
    if (sl.key === 'gegnerForm' || sl.key === 'unsereForm') for (const r of sl.last5) add(r.crest);
    if (sl.key === 'kader') for (const c of [...sl.goalkeepers, ...sl.players, ...sl.coaches]) add(c.photo);
  }
  return [...urls];
}

/**
 * Lädt Wappen und Fotos als Data-URL über den lokalen Dienst (FuPa erlaubt dem Browser kein direktes Auslesen).
 * Ohne Dienst oder bei Fehlern bleibt es bei Initialen bzw. ohne Wappen.
 */
export async function loadPhotos(content: DossierContent, fetchImpl: typeof fetch = fetch): Promise<PhotoMap> {
  const out: PhotoMap = new Map();
  await Promise.all(
    imageUrls(content).map(async (url) => {
      try {
        const res = await fetchImpl(`/datenquelle/fussballde/api/coachai/fupa/foto?url=${encodeURIComponent(url)}`);
        if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) return;
        const blob = await res.blob();
        const data = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => reject(r.error);
          r.readAsDataURL(blob);
        });
        out.set(url, data);
      } catch {
        /* Initialen statt Foto */
      }
    }),
  );
  return out;
}
