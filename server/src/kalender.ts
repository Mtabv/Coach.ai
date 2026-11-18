import { abwesendAm, dienstTage, dienstTitel, type Daten } from './rollen.js';

/**
 * Kalender-Abo (iCal/ICS): Trainings, Spiele, Termine und Dienste zum Einbinden in Apple-, Google- oder
 * Outlook-Kalender. Der Kalender ruft die Adresse selbst regelmäßig ab; der Zugang ist ein geheimer Link je Person.
 * Enthält nur, was auch in der Spieler-App steht – keine Trainingsinhalte, Noten oder Gespräche.
 */
type Obj = Record<string, unknown>;
const arr = <T = Obj>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const isObj = (v: unknown): v is Obj => Object.prototype.toString.call(v) === '[object Object]';

/** Ortszeit Berlin (Datum + Uhrzeit) in UTC umrechnen, Sommer- und Winterzeit eingeschlossen. */
export function berlinNachUtc(iso: string, zeit: string): Date {
  const [y, mo, d] = iso.split('-').map(Number), [h, mi] = (zeit || '00:00').split(':').map(Number);
  const wunsch = Date.UTC(y, mo - 1, d, h || 0, mi || 0);
  let t = wunsch;
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    const alsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
    t += wunsch - alsUtc;
  }
  return new Date(t);
}

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const tag = (iso: string) => iso.replace(/-/g, '');
const plusTag = (iso: string) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const text = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** Zeilen über 75 Bytes umbrechen (Vorgabe des iCal-Formats). */
function falten(z: string): string {
  const b = Buffer.from(z, 'utf8');
  if (b.length <= 75) return z;
  const teile: string[] = []; let rest = z;
  while (Buffer.byteLength(rest, 'utf8') > 75) {
    let n = 0, i = 0;
    for (const c of rest) { const l = Buffer.byteLength(c, 'utf8'); if (n + l > (teile.length ? 74 : 75)) break; n += l; i += c.length; }
    teile.push(rest.slice(0, i)); rest = rest.slice(i);
  }
  teile.push(rest);
  return teile.join('\r\n ');
}

/** Ergebnis aus unserer Sicht (gespeichert ist es als Heim:Gast), z. B. „ (0:8, Niederlage)“. */
function ergebnis(e: Obj): string {
  const m = /^(\d+):(\d+)$/.exec(String(e.res || '').trim()); if (!m) return '';
  const [wir, sie] = e.home ? [+m[1], +m[2]] : [+m[2], +m[1]];
  return ` (${wir}:${sie}, ${wir > sie ? 'Sieg' : wir < sie ? 'Niederlage' : 'Unentschieden'})`;
}

export interface KalenderOptionen {
  /** Spieler: eigene Abwesenheiten werden markiert, eigene Dienste hervorgehoben. */
  pid?: string | null;
  name: string;
  jetzt?: Date;
  /** Wie weit zurück (Tage). */
  zurueck?: number;
}

export function kalenderIcs(daten: Daten, o: KalenderOptionen): string {
  const jetzt = o.jetzt ?? new Date(), stempel = utc(jetzt);
  const ab = new Date(jetzt.getTime() - (o.zurueck ?? 60) * 86400e3).toISOString().slice(0, 10);
  const texte = isObj(daten.state) && isObj(daten.state.texts) ? daten.state.texts as Obj : {};
  const z: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//11Plan//Kalender//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(o.name)}`, 'X-WR-TIMEZONE:Europe/Berlin', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  const nichtDabei = (e: Obj) => !!o.pid && (abwesendAm(daten, o.pid, String(e.date)) || arr(daten.absences).some((a) => a.pid === o.pid && a.src === e.id));

  for (const e of arr(daten.events)) {
    if (typeof e.date !== 'string' || e.date < ab || typeof e.time !== 'string') continue;
    const start = berlinNachUtc(e.date, e.time);
    const min = Number(e.dur) || (e.type === 'gm' ? 120 : e.type === 'tr' ? 90 : 60);
    let titel = e.type === 'tr' ? 'Training' : e.type === 'gm' ? `${e.home ? 'Heimspiel gegen' : 'Auswärtsspiel bei'} ${String(e.opp || 'Gegner')}${ergebnis(e)}` : String(e.title || 'Termin');
    if ((e.type === 'tr' || e.type === 'gm') && nichtDabei(e)) titel += ' – nicht dabei';
    const info: string[] = [];
    if (e.type === 'gm') {
      if (e.comp) info.push(String(e.comp));
      info.push(`Anstoß ${e.time} Uhr`);
      const treff = String(texte[`treffpunkt-${e.id}`] ?? '').trim();
      info.push(`Treffpunkt: ${treff || 'offen'}`);
      const kleidung = String(texte[`kleidung-${e.id}`] ?? '').trim();
      if (kleidung) info.push(`Kleidung: ${kleidung}`);
    }
    z.push('BEGIN:VEVENT', `UID:${String(e.id)}@11plan`, `DTSTAMP:${stempel}`, `DTSTART:${utc(start)}`, `DTEND:${utc(new Date(start.getTime() + min * 60e3))}`,
      `SUMMARY:${text(titel)}`);
    if (e.place) z.push(`LOCATION:${text(String(e.place))}`);
    if (info.length) z.push(`DESCRIPTION:${text(info.join('\n'))}`);
    z.push('END:VEVENT');
  }

  // Dienste als ganztägige Einträge an den Tagen, an denen sie anfallen
  const namen = isObj(daten.kaderNamen) ? daten.kaderNamen as Record<string, string> : {};
  for (const d of arr(daten.duties)) {
    const wer = arr<string>(d.who), mein = !!o.pid && wer.includes(o.pid);
    for (const iso of dienstTage(daten, d)) {
      if (iso < ab) continue;
      z.push('BEGIN:VEVENT', `UID:${String(d.id)}-${iso}@11plan`, `DTSTAMP:${stempel}`, `DTSTART;VALUE=DATE:${tag(iso)}`, `DTEND;VALUE=DATE:${tag(plusTag(iso))}`,
        `SUMMARY:${text(`${mein ? '★ ' : ''}${dienstTitel(d)}: ${wer.map((p) => namen[p] || '').filter(Boolean).join(', ') || 'noch niemand'}`)}`,
        'TRANSP:TRANSPARENT', 'END:VEVENT');
    }
  }
  z.push('END:VCALENDAR');
  return z.map(falten).join('\r\n') + '\r\n';
}
