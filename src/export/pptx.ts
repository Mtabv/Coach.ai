import PptxGenJS from 'pptxgenjs';
import { saveFile } from './hostBridge';
import { FLAG_LABEL, type DossierContent, type FV, type Slide } from '../dossier/model';

/**
 * Echter, editierbarer PPTX-Export. Texte und Tabellen sind native PowerPoint-Objekte
 * (Textfelder, Tabellen, Formen). Einzige Bilder: Spielerfotos auf der Gefahr-Folie, sofern vorab geladen.
 */

/** Spielerfotos als Data-URL (Adresse → Bild). Fehlt ein Foto, erscheinen Initialen. */
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
  const runs: TextRun[] = [{ text: v.text, options: { ...base, color: v.flag === 'offen' ? C.warn : v.flag === 'widersprüchlich' ? C.red : base.color } }];
  if (v.flag !== 'ok' && v.flag !== 'trainer') {
    runs.push({ text: `  [${FLAG_LABEL[v.flag]}]`, options: { ...base, fontSize: Math.max(9, (base.fontSize ?? 14) - 4), color: flagColor(v.flag), bold: false, italic: true } });
  }
  return runs;
}

function fvText(v: FV): string {
  return v.flag === 'ok' || v.flag === 'trainer' ? v.text : `${v.text} [${FLAG_LABEL[v.flag]}]`;
}

function header(s: PSlide, slide: Slide, content: DossierContent) {
  s.background = { color: C.light };
  s.addShape('rect', { x: 0, y: 0, w: W, h: 0.12, fill: { color: C.green }, line: { color: C.green } });
  s.addShape('rect', { x: 0.5, y: 0.45, w: 0.12, h: 0.75, fill: { color: C.lime }, line: { color: C.lime } });
  s.addText(slide.kicker.toUpperCase(), { x: 0.75, y: 0.38, w: 9, h: 0.35, fontFace: FONT, fontSize: 11, bold: true, color: C.green2, charSpacing: 1 });
  s.addText(slide.title, { x: 0.75, y: 0.68, w: 10.5, h: 0.6, fontFace: FONT, fontSize: 28, bold: true, color: C.green });
  s.addText(`${slide.number}/${content.slides.length}`, { x: W - 1.5, y: 0.45, w: 1, h: 0.4, fontFace: FONT, fontSize: 11, color: C.muted, align: 'right' });
  const foot: string[] = [];
  if (slide.sources.length) foot.push(`Quellen: ${[...new Set(slide.sources)].join(' · ')}`);
  if (slide.footnote) foot.push(slide.footnote);
  if (content.meta.containsDemoData) foot.push('Enthält Beispieldaten (fiktiv)');
  s.addText(foot.join('   |   '), { x: 0.5, y: H - 0.5, w: W - 1, h: 0.35, fontFace: FONT, fontSize: 8.5, color: C.muted });
}

function card(s: PSlide, x: number, y: number, w: number, h: number, title?: string, dark = false) {
  s.addShape('roundRect', { x, y, w, h, rectRadius: 0.08, fill: { color: dark ? C.green : C.white }, line: { color: dark ? C.green : C.line, width: 0.75 } });
  if (title) s.addText(title.toUpperCase(), { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: dark ? C.lime : C.green2, charSpacing: 1 });
}

const th = (t: string): PptxGenJS.TableCell => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.green }, fontSize: 10 } });

function tableOpts(x: number, y: number, w: number, colW: number[], fontSize = 10): PptxGenJS.TableProps {
  return { x, y, w, colW, fontFace: FONT, fontSize, color: C.text, border: { type: 'solid', pt: 0.5, color: C.line }, fill: { color: C.white }, margin: 0.04, rowH: 0.26 };
}

function addSlide(p: PptxGenJS, slide: Slide, content: DossierContent, photos: PhotoMap) {
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
      const rows: PptxGenJS.TableRow[] = [[th('Pl.'), th('Mannschaft'), th('Sp.'), th('S-U-N'), th('Tore'), th('Diff.'), th('Pkt.')]];
      for (const r of slide.table) {
        const fill = r.highlight === 'own' ? 'E8F8C4' : r.highlight === 'opp' ? 'E3ECE6' : C.white;
        const o = { fill: { color: fill }, bold: Boolean(r.highlight) };
        rows.push([
          { text: r.rank, options: o },
          { text: r.team + (r.deduction ? ` (${r.deduction} Abzug)` : ''), options: o },
          { text: r.played, options: { ...o, align: 'center' } },
          { text: r.record, options: { ...o, align: 'center' } },
          { text: r.goals, options: { ...o, align: 'center' } },
          { text: r.diff, options: { ...o, align: 'center' } },
          { text: fvText(r.points), options: { ...o, align: 'center', color: r.points.flag === 'widersprüchlich' ? C.red : C.text } },
        ]);
      }
      if (slide.table.length) s.addTable(rows, { ...tableOpts(0.5, 1.5, 7.9, [0.45, 3.35, 0.5, 0.9, 0.8, 0.6, 1.3], 9), rowH: 0.29 });
      else s.addText('Tabelle liegt nicht vor [offen]', { x: 0.5, y: 1.6, w: 7.9, h: 0.5, fontFace: FONT, fontSize: 14, color: C.warn });
      s.addText(fvRuns(slide.tableStatus, { fontSize: 10, color: C.muted }), { x: 0.5, y: 6.55, w: 7.9, h: 0.3, fontFace: FONT });
      card(s, 8.7, 1.5, 4.15, 5.3, 'Spieltagspaarungen');
      if (slide.pairings.length) {
        s.addText(
          slide.pairings.flatMap((pp) => [
            { text: `${pp.home} – ${pp.away}`, options: { bold: pp.highlight, color: pp.highlight ? C.green : C.text, fontSize: 11, breakLine: true } },
            { text: pp.when || ' ', options: { fontSize: 9, color: C.muted, breakLine: true } },
          ]),
          { x: 8.9, y: 1.9, w: 3.8, h: 4.8, fontFace: FONT, valign: 'top', paraSpaceAfter: 2 },
        );
      } else s.addText('Keine Paarungen vorhanden [offen]', { x: 8.9, y: 1.95, w: 3.8, h: 0.4, fontFace: FONT, fontSize: 11, color: C.warn });
      break;
    }
    case 'unserSpiel': {
      card(s, 0.5, 1.5, 6.1, 3.0, 'Rahmen');
      s.addText(
        slide.facts.flatMap((f) => [{ text: `${f.label}: `, options: { bold: true, color: C.green } }, ...fvRuns(f.value, { color: C.text }), { text: '', options: { breakLine: true } }]),
        { x: 0.7, y: 1.85, w: 5.7, h: 2.55, fontFace: FONT, fontSize: 12, valign: 'top', paraSpaceAfter: 5 },
      );
      card(s, 0.5, 4.65, 6.1, 2.2, 'Direkte Duelle');
      if (slide.h2h.length) {
        const rows: PptxGenJS.TableRow[] = [[th('Saison'), th('Datum'), th('Wettbewerb'), th('Begegnung'), th('Erg.')]];
        slide.h2h.slice(0, 5).forEach((g) => rows.push([g.season, g.date, g.competition, g.match, g.result].map((t) => ({ text: t }))));
        s.addTable(rows, tableOpts(0.65, 5.0, 5.8, [0.75, 0.95, 1.35, 2.25, 0.5], 8.5));
      } else s.addText(slide.h2hNote, { x: 0.7, y: 5.05, w: 5.7, h: 0.4, fontFace: FONT, fontSize: 11, color: C.muted });
      card(s, 6.85, 1.5, 6.0, 5.35, 'Zeitplan', true);
      if (slide.schedule.length) {
        const rows: PptxGenJS.TableRow[] = slide.schedule.map((it) => [
          { text: it.time.flag === 'offen' ? 'offen' : it.time.text, options: { bold: true, color: it.time.flag === 'offen' ? 'FCD34D' : C.lime } },
          { text: it.label + (it.note ? ` (${it.note})` : '') + (it.time.flag === 'trainer' ? ' · geändert' : ''), options: { color: C.white } },
        ]);
        s.addTable(rows, { x: 7.05, y: 1.95, w: 5.6, colW: [1.6, 4.0], fontFace: FONT, fontSize: 12, fill: { color: C.green }, border: { type: 'solid', pt: 0.5, color: C.green2 }, rowH: 0.36, margin: 0.05 });
      }
      if (slide.scheduleOpen.length) s.addText(slide.scheduleOpen.join(' '), { x: 7.05, y: 6.15, w: 5.6, h: 0.6, fontFace: FONT, fontSize: 10, color: 'FCD34D', valign: 'top' });
      break;
    }
    case 'gegnerForm':
    case 'unsereForm': {
      card(s, 0.5, 1.5, 6.6, 3.7, 'Letzte fünf Ligaspiele');
      if (slide.last5.length) {
        const rows: PptxGenJS.TableRow[] = [[th('Datum'), th('Gegner'), th('H/A'), th('Erg.'), th('')]];
        slide.last5.forEach((r) =>
          rows.push([
            { text: r.date },
            { text: r.opponent },
            { text: r.ha, options: { align: 'center' } },
            { text: r.result, options: { align: 'center', bold: true } },
            { text: r.outcome, options: { align: 'center', bold: true, color: C.white, fill: { color: r.outcome === 'S' ? '2E7D32' : r.outcome === 'U' ? '8A8F87' : C.red } } },
          ]),
        );
        s.addTable(rows, { ...tableOpts(0.7, 1.9, 6.2, [0.9, 3.2, 0.6, 0.8, 0.7], 11), rowH: 0.42 });
      }
      s.addText(slide.last5Note, { x: 0.7, y: 4.7, w: 6.2, h: 0.35, fontFace: FONT, fontSize: 10, color: C.muted, italic: true });
      card(s, 7.35, 1.5, 5.5, 2.1, 'Bilanzen');
      s.addText(
        slide.records.flatMap((r) => [{ text: `${r.label}: `, options: { bold: true, color: C.green } }, ...fvRuns(r.value, { color: C.text }), { text: '', options: { breakLine: true } }]),
        { x: 7.55, y: 1.85, w: 5.1, h: 1.7, fontFace: FONT, fontSize: 12, valign: 'top', paraSpaceAfter: 4 },
      );
      card(s, 7.35, 3.75, 5.5, 3.1, 'Belegte Fakten');
      s.addText(
        slide.facts.length
          ? slide.facts.flatMap((f) => [...fvRuns(f, { color: C.text, bullet: true } as PptxGenJS.TextPropsOptions), { text: '', options: { breakLine: true } }])
          : [{ text: 'Keine weiteren belegten Fakten.', options: { color: C.muted } }],
        { x: 7.55, y: 4.1, w: 5.1, h: 2.7, fontFace: FONT, fontSize: 11, valign: 'top', paraSpaceAfter: 3 },
      );
      card(s, 0.5, 5.35, 6.6, 1.5);
      s.addText(slide.teamName, { x: 0.7, y: 5.5, w: 6.2, h: 0.5, fontFace: FONT, fontSize: 18, bold: true, color: C.green });
      s.addText(slide.last5.map((r) => r.outcome).join('  ') || '–', { x: 0.7, y: 6.0, w: 6.2, h: 0.6, fontFace: FONT, fontSize: 22, bold: true, color: C.green2, charSpacing: 2 });
      break;
    }
    case 'gegnerGefahr': {
      const n = Math.max(slide.players.length, 1);
      const w = (W - 1 - (n - 1) * 0.25) / n;
      slide.players.forEach((pl, i) => {
        const x = 0.5 + i * (w + 0.25);
        card(s, x, 1.5, w, 5.3);
        s.addShape('rect', { x, y: 1.5, w, h: 0.12, fill: { color: C.lime }, line: { color: C.lime } });
        const ps = 1.0;
        const data = pl.photo ? photos.get(pl.photo.url) : undefined;
        if (data) s.addImage({ data, x: x + 0.2, y: 1.75, w: ps, h: ps, rounding: true, altText: `Foto ${pl.name} (${pl.photo!.credit})` });
        else {
          s.addShape('ellipse', { x: x + 0.2, y: 1.75, w: ps, h: ps, fill: { color: 'EEF9D4' }, line: { color: C.lime, width: 2 } });
          s.addText(pl.initials, { x: x + 0.2, y: 1.75, w: ps, h: ps, fontFace: FONT, fontSize: 22, bold: true, color: C.green, align: 'center', valign: 'middle' });
        }
        if (pl.mvp !== undefined) {
          s.addShape('roundRect', { x: x + w - 1.15, y: 2.1, w: 0.95, h: 0.62, rectRadius: 0.08, fill: { color: C.green }, line: { color: C.green } });
          s.addText([{ text: `${pl.mvp} %`, options: { fontSize: 15, bold: true, breakLine: true } }, { text: 'MVP', options: { fontSize: 8 } }], { x: x + w - 1.15, y: 2.1, w: 0.95, h: 0.62, fontFace: FONT, color: C.white, align: 'center', valign: 'middle' });
        }
        s.addText(pl.name, { x: x + 0.2, y: 2.85, w: w - 0.4, h: 0.5, fontFace: FONT, fontSize: 17, bold: true, color: C.green, valign: 'top' });
        s.addText(pl.meta, { x: x + 0.2, y: 3.3, w: w - 0.4, h: 0.3, fontFace: FONT, fontSize: 10.5, color: C.muted });
        const runs: TextRun[] = pl.reasons.map((r) => ({ text: r, options: { bullet: true, breakLine: true } }));
        if (pl.coachNote) runs.push({ text: `Trainerhinweis: ${pl.coachNote}`, options: { bold: true, color: C.green2, breakLine: true } });
        s.addText(runs.length ? runs : [{ text: 'Keine Belege', options: { color: C.muted } }], { x: x + 0.2, y: 3.65, w: w - 0.4, h: 3.0, fontFace: FONT, fontSize: 11, color: C.text, valign: 'top', paraSpaceAfter: 3 });
      });
      const below = [slide.note, slide.legend].filter(Boolean).join(' ');
      if (below) s.addText(below, { x: 0.5, y: slide.players.length ? 6.82 : 1.6, w: W - 1, h: 0.2, fontFace: FONT, fontSize: 8.5, color: slide.note ? C.warn : C.muted, italic: Boolean(slide.note) });
      break;
    }
    case 'gegnerAuffaelligkeiten': {
      const k = slide.kpis.slice(0, 7);
      const kw = (W - 1 - (Math.min(k.length, 4) - 1) * 0.2) / Math.min(Math.max(k.length, 1), 4);
      k.forEach((kp, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 0.5 + col * (kw + 0.2);
        const y = 1.5 + row * 1.45;
        card(s, x, y, kw, 1.3);
        s.addText(kp.value, { x: x + 0.2, y: y + 0.1, w: kw - 0.4, h: 0.6, fontFace: FONT, fontSize: 26, bold: true, color: C.green });
        s.addText([{ text: kp.label, options: { breakLine: true, color: C.text } }, { text: kp.basis, options: { color: C.muted, fontSize: 9 } }], { x: x + 0.2, y: y + 0.7, w: kw - 0.4, h: 0.55, fontFace: FONT, fontSize: 10.5, valign: 'top' });
      });
      if (!k.length) s.addText('Keine Kennzahlen – Ergebnisdaten fehlen [offen]', { x: 0.5, y: 1.6, w: 8, h: 0.4, fontFace: FONT, fontSize: 13, color: C.warn });
      card(s, 0.5, 4.5, 6.1, 2.35, 'Mannschaftsprofil (aus Daten)');
      s.addText(slide.profile.flatMap((f) => [...fvRuns(f, { color: C.text, bullet: true } as PptxGenJS.TextPropsOptions), { text: '', options: { breakLine: true } }]), { x: 0.7, y: 4.85, w: 5.7, h: 1.9, fontFace: FONT, fontSize: 12, valign: 'top' });
      card(s, 6.85, 4.5, 6.0, 2.35, 'Belegte Besonderheiten');
      s.addText(
        slide.facts.length ? slide.facts.flatMap((f) => [...fvRuns(f, { color: C.text, bullet: true } as PptxGenJS.TextPropsOptions), { text: '', options: { breakLine: true } }]) : [{ text: 'Keine belegten Besonderheiten.', options: { color: C.muted } }],
        { x: 7.05, y: 4.85, w: 5.6, h: 1.9, fontFace: FONT, fontSize: 12, valign: 'top' },
      );
      break;
    }
    case 'soSpieltGegner': {
      slide.phases.forEach((ph, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 0.5 + col * 6.25;
        const y = 1.5 + row * 1.33;
        card(s, x, y, 6.0, 1.2, ph.label);
        s.addText(fvRuns(ph.value, { color: C.text }), { x: x + 0.2, y: y + 0.42, w: 5.6, h: 0.75, fontFace: FONT, fontSize: 11.5, valign: 'top', fit: 'shrink' });
      });
      break;
    }
    case 'kader': {
      const groups = slide.groups.length ? slide.groups : [{ label: 'Kader', players: [] as string[] }];
      const gw = (W - 1 - (groups.length - 1) * 0.25) / groups.length;
      groups.forEach((g, i) => {
        const x = 0.5 + i * (gw + 0.25);
        card(s, x, 1.5, gw, 4.6, g.label);
        s.addText(g.players.length ? g.players.map((p) => ({ text: p, options: { breakLine: true } })) : [{ text: 'Keine Spieler erfasst', options: { color: C.warn } }], { x: x + 0.2, y: 1.9, w: gw - 0.4, h: 4.1, fontFace: FONT, fontSize: 13, color: C.text, valign: 'top', paraSpaceAfter: 4 });
      });
      s.addText([{ text: `${slide.count} Spieler · ${slide.origin}`, options: { breakLine: Boolean(slide.note) } }, ...(slide.note ? [{ text: slide.note }] : [])], { x: 0.5, y: 6.2, w: W - 1, h: 0.6, fontFace: FONT, fontSize: 11, color: C.muted, valign: 'top' });
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
  for (const slide of content.slides) addSlide(p, slide, content, photos);
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

/**
 * Lädt die Spielerfotos der Gefahr-Folie als Data-URL über den lokalen Dienst (FuPa erlaubt dem Browser
 * kein direktes Auslesen). Ohne Dienst oder bei Fehlern bleibt es bei Initialen.
 */
export async function loadPhotos(content: DossierContent, fetchImpl: typeof fetch = fetch): Promise<PhotoMap> {
  const urls = new Set<string>();
  for (const sl of content.slides) if (sl.key === 'gegnerGefahr') for (const pl of sl.players) if (pl.photo) urls.add(pl.photo.url);
  const out: PhotoMap = new Map();
  await Promise.all(
    [...urls].map(async (url) => {
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
