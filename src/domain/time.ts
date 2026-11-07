import type {
  AwayScheduleTemplate,
  HomeScheduleTemplate,
  LocalDate,
  LocalTime,
  OrganisationInput,
  TimeBlockTemplate,
} from './types';

/**
 * Deterministische Zeitberechnung. Alle Zeiten sind Wandzeit in Europe/Berlin.
 * Rechnen erfolgt in Minuten relativ zum Anstoß, damit keine Zeitzonen-
 * oder Sommerzeitumrechnung des Browsers die Ergebnisse verfälscht.
 */

export function parseTime(t: LocalTime): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) throw new Error(`Ungültige Uhrzeit: ${t}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`Ungültige Uhrzeit: ${t}`);
  return h * 60 + min;
}

export function isValidTime(t: string | null | undefined): t is LocalTime {
  if (!t) return false;
  try {
    parseTime(t);
    return true;
  } catch {
    return false;
  }
}

export function formatMinutes(total: number): LocalTime {
  const norm = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutes(t: LocalTime, delta: number): LocalTime {
  return formatMinutes(parseTime(t) + delta);
}

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export function isValidDate(d: string | null | undefined): d is LocalDate {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === day;
}

export function weekday(d: LocalDate): string {
  const [y, m, day] = d.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
}

export function formatDate(d: LocalDate | null, opts: { weekday?: boolean } = {}): string {
  if (!isValidDate(d)) return '';
  const [y, m, day] = d.split('-');
  const base = `${day}.${m}.${y}`;
  return opts.weekday ? `${weekday(d)}, ${base}` : base;
}

export function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return '–';
  const dt = new Date(ts);
  if (Number.isNaN(dt.getTime())) return '–';
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
}

// ---------------------------------------------------------------------------
// Ablaufplan
// ---------------------------------------------------------------------------

export interface ScheduleItem {
  id: string;
  label: string;
  /** null = nicht berechenbar (z. B. fehlende Fahrzeit). */
  start: LocalTime | null;
  end: LocalTime | null;
  kind: 'treffpunkt' | 'abfahrt' | 'ankunft' | 'block' | 'anstoss';
  /** Ausdrücklich vom Trainer geändert. */
  overridden?: boolean;
  openReason?: string;
  /** Schritt ohne feste Uhrzeit („danach“). */
  untimed?: boolean;
}

export interface ScheduleResult {
  items: ScheduleItem[];
  meetingTime: LocalTime | null;
  meetingPlace: string | null;
  departureTime: LocalTime | null;
  open: string[];
}

function blockItems(
  kickoff: number,
  blocks: TimeBlockTemplate[],
  overrides: OrganisationInput['blockOverrides'],
): ScheduleItem[] {
  return [...blocks]
    .sort((a, b) => a.startOffsetMin - b.startOffsetMin)
    .map((b) => {
      const o = overrides[b.id];
      if (b.untimed && !o) return { id: b.id, label: b.label, start: null, end: null, kind: 'block' as const, untimed: true };
      const start = o ? o.start : formatMinutes(kickoff + b.startOffsetMin);
      const end = o ? o.end : formatMinutes(kickoff + b.endOffsetMin);
      return {
        id: b.id,
        label: b.label,
        start,
        // Zeitpunkt statt Zeitraum, wenn Beginn = Ende (z. B. „ab 13:15 Kabine“).
        end: end === start ? null : end,
        kind: 'block' as const,
        overridden: Boolean(o),
      };
    });
}

export function computeHomeSchedule(
  kickoff: LocalTime,
  tpl: HomeScheduleTemplate,
  venueName: string | null,
  org: Pick<OrganisationInput, 'blockOverrides' | 'meetingOverride'>,
): ScheduleResult {
  const k = parseTime(kickoff);
  const open: string[] = [];
  let meeting: LocalTime | null = null;
  if (org.meetingOverride) meeting = org.meetingOverride;
  else if (tpl.meetingOffsetMin !== null) meeting = formatMinutes(k + tpl.meetingOffsetMin);
  else open.push('Kein Treffpunkt-Zeitmuster für Heimspiele hinterlegt.');
  if (tpl.blocks.length === 0) open.push('Kein Zeitmuster für Heimspiele hinterlegt.');

  const items: ScheduleItem[] = [];
  items.push({
    id: 'treffpunkt',
    label: 'Treffpunkt',
    start: meeting,
    end: null,
    kind: 'treffpunkt',
    overridden: Boolean(org.meetingOverride),
    openReason: meeting ? undefined : 'Zeitmuster fehlt',
  });
  items.push(...blockItems(k, tpl.blocks, org.blockOverrides));
  items.push({ id: 'anstoss', label: 'Anstoß', start: kickoff, end: null, kind: 'anstoss' });
  return { items, meetingTime: meeting, meetingPlace: venueName, departureTime: null, open };
}

export function computeAwaySchedule(
  kickoff: LocalTime,
  tpl: AwayScheduleTemplate,
  travelMinutes: number | null,
  org: Pick<OrganisationInput, 'blockOverrides' | 'meetingOverride'>,
): ScheduleResult {
  const k = parseTime(kickoff);
  const open: string[] = [];
  const arrival = tpl.arrivalOffsetMin !== null ? k + tpl.arrivalOffsetMin : null;
  if (arrival === null) open.push('Kein Ankunfts-Zeitmuster für Auswärtsspiele hinterlegt.');

  let departure: number | null = null;
  let meeting: LocalTime | null = null;
  const travelOk = travelMinutes !== null && Number.isFinite(travelMinutes) && travelMinutes > 0;
  if (!travelOk) {
    open.push('Fahrzeit für diese Fahrt fehlt – Abfahrt und Treffpunkt bleiben offen.');
  } else if (arrival !== null) {
    departure = arrival - (travelMinutes as number);
    if (tpl.meetingBeforeDepartureMin !== null) meeting = formatMinutes(departure - tpl.meetingBeforeDepartureMin);
  }
  if (org.meetingOverride) meeting = org.meetingOverride;

  const items: ScheduleItem[] = [
    {
      id: 'treffpunkt',
      label: `Treffpunkt${tpl.departurePoint ? ` (${tpl.departurePoint})` : ''}`,
      start: meeting,
      end: null,
      kind: 'treffpunkt',
      overridden: Boolean(org.meetingOverride),
      openReason: meeting ? undefined : 'Fahrzeit fehlt',
    },
    {
      id: 'abfahrt',
      label: 'Abfahrt',
      start: departure !== null ? formatMinutes(departure) : null,
      end: null,
      kind: 'abfahrt',
      openReason: departure !== null ? undefined : 'Fahrzeit fehlt',
    },
    {
      id: 'ankunft',
      label: 'Ankunft am Spielort',
      start: arrival !== null ? formatMinutes(arrival) : null,
      end: null,
      kind: 'ankunft',
    },
    ...blockItems(k, tpl.blocks, org.blockOverrides),
    { id: 'anstoss', label: 'Anstoß', start: kickoff, end: null, kind: 'anstoss' },
  ];
  return {
    items,
    meetingTime: meeting,
    meetingPlace: tpl.departurePoint || null,
    departureTime: departure !== null ? formatMinutes(departure) : null,
    open,
  };
}
