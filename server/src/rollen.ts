/**
 * Rollen in der Teamzentrale: Was Betreuer und Spieler vom gemeinsamen Dokument sehen und ändern dürfen.
 *
 * Das Dokument „teamzentrale“ hat die Form { basis, daten }. `daten` enthält die gespeicherten Listen der
 * Teamzentrale (events, duties, absences, talks, …), `state` (Eingaben wie Noten und Texte) und `kaderNamen`.
 *
 * - Trainer: alles.
 * - Betreuer: Termine, Dienste, Kader, Anwesenheit, Abwesenheiten, Fahrgemeinschaften, Training nur ansehen.
 *   Keine Noten, Bewertungen, Gespräche, Spieltagsvorbereitung oder -nachbereitung.
 * - Spieler: nur die Spielersicht. Eigene Abwesenheiten mit Grund, bei anderen nur „abwesend“;
 *   Änderungen ausschließlich über einzelne Aktionen (siehe `spielerAktion`).
 */
type Obj = Record<string, unknown>;
export type Daten = Obj & { state?: Obj };

const isObj = (v: unknown): v is Obj => Object.prototype.toString.call(v) === '[object Object]';
const kopie = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? null));
const arr = <T = Obj>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const nur = (o: unknown, keys: string[]): Obj => { const out: Obj = {}; if (isObj(o)) for (const k of keys) if (k in o) out[k] = kopie(o[k]); return out; };

// ---------------------------------------------------------------- Betreuer

/** Listen, die der Betreuer sieht (Rest ist trainerintern). */
const BETREUER_LISTEN = ['absences', 'settings', 'blocks', 'exercises', 'exNotes', 'unitNotes', 'units', 'events', 'GAMES', 'duties', 'EXD', 'principles', 'planHistory'];
/** Teile von state, die der Betreuer sieht. */
const BETREUER_STATE = ['att', 'guests', 'rides', 'notices', 'squad', 'released', 'plan', 'travel', 'autoUmgelegt', 'pv', 'review', 'trRating', 'kitPhoto', 'imgs'];
/** Davon darf der Betreuer ändern: */
const BETREUER_SCHREIBT_LISTEN = ['absences', 'events', 'duties'];
const BETREUER_SCHREIBT_STATE = ['att', 'guests', 'rides', 'notices', 'squad', 'autoUmgelegt'];
/** Felder eines Termins, die nur Trainer ändern (Trainingsplanung). */
const PLANUNG = ['unit', 'ex', 'focus'];

const erlaubteTexte = (k: string) => /^(kleidung|zeitplan)-/.test(k);

export function betreuerSicht(daten: Daten): Daten {
  const out: Daten = nur(daten, [...BETREUER_LISTEN, 'kaderNamen']);
  const st = isObj(daten.state) ? daten.state : {};
  out.state = nur(st, BETREUER_STATE);
  if (isObj(st.texts)) out.state.texts = Object.fromEntries(Object.entries(st.texts).filter(([k]) => erlaubteTexte(k)));
  return out;
}

/** Änderungen des Betreuers in den vollständigen Stand übernehmen – nur die erlaubten Teile. */
export function betreuerUebernehmen(voll: Daten, vomBetreuer: Daten): Daten {
  const out = kopie(voll);
  for (const k of BETREUER_SCHREIBT_LISTEN) {
    if (!(k in vomBetreuer)) continue;
    if (k === 'events') {
      const alt = new Map(arr(voll.events).map((e) => [String(e.id), e]));
      out.events = arr(vomBetreuer.events).map((e) => {
        const a = alt.get(String(e.id)), n: Obj = { ...e };
        for (const f of PLANUNG) { if (a && f in a) n[f] = a[f]; else delete n[f]; }
        return n;
      });
    } else out[k] = kopie(vomBetreuer[k]);
  }
  out.state = isObj(out.state) ? out.state : {};
  const st = isObj(vomBetreuer.state) ? vomBetreuer.state : {};
  for (const k of BETREUER_SCHREIBT_STATE) if (k in st) out.state[k] = kopie(st[k]);
  return out;
}

// ---------------------------------------------------------------- Spieler

export function spielerSicht(daten: Daten, pid: string): Daten {
  const out: Daten = nur(daten, ['settings', 'events', 'units', 'principles', 'duties', 'GAMES', 'kaderNamen', 'facts']);
  // Abwesenheiten: eigene vollständig, bei anderen nur dass jemand fehlt (für „wer ist da“ beim Dienst abgeben)
  out.absences = arr(daten.absences).map((a) => (a.pid === pid ? kopie(a) : { pid: a.pid, from: a.from, to: a.to, why: 'abwesend', ...(a.src ? { src: a.src } : {}) }));
  const st = isObj(daten.state) ? daten.state : {};
  out.state = nur(st, ['pv', 'rides', 'plan', 'travel', 'released', 'kitPhoto']);
  out.state.notices = arr(st.notices).filter((n) => n.to === pid);
  if (isObj(st.texts)) out.state.texts = Object.fromEntries(Object.entries(st.texts).filter(([k]) => erlaubteTexte(k)));
  // Trainer-Anwesenheit: nur die eigenen Einträge
  if (isObj(st.att)) out.state.att = Object.fromEntries(Object.entries(st.att).map(([eid, m]) => [eid, isObj(m) && pid in m ? { [pid]: m[pid] } : {}]));
  return out;
}

// ---------------------------------------------------------------- Hilfen für Dienste und Abwesenheiten

const plusTage = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const tagMonat = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
export const dienstTitel = (d: Obj) => String(d.title || 'Dienst').split(' (')[0];

/** Wann: „Woche 16.11.–22.11.“ bzw. „Fr 20.11., 19:00“. */
export function dienstWann(daten: Daten, d: Obj): string {
  if (d.ev) {
    const e = arr(daten.events).find((x) => x.id === d.ev);
    if (!e) return 'Termin entfällt';
    const wt = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(`${e.date}T12:00:00Z`).getUTCDay()];
    return `${wt} ${tagMonat(String(e.date))}, ${e.time}`;
  }
  return `${d.from === d.to ? '' : 'Woche '}${tagMonat(String(d.from))}${d.from === d.to ? '' : '–' + tagMonat(String(d.to))}`;
}

/** Tage, an denen ein Dienst anfällt: Termin-Dienste am Termin, Zeitraum-Dienste an Trainings- und Spieltagen. */
export function dienstTage(daten: Daten, d: Obj): string[] {
  const events = arr(daten.events);
  if (d.ev) { const e = events.find((x) => x.id === d.ev); return e ? [String(e.date)] : []; }
  if (typeof d.from !== 'string' || typeof d.to !== 'string') return [];
  const out: string[] = [];
  for (let x = d.from; x <= d.to; x = plusTage(x, 1)) if (events.some((e) => e.date === x && (e.type === 'tr' || e.type === 'gm'))) out.push(x);
  return out;
}

export const abwesendAm = (daten: Daten, pid: string, iso: string) =>
  arr(daten.absences).some((a) => a.pid === pid && String(a.from) <= iso && iso <= String(a.to));

export function mitteilen(daten: Daten, an: string, text: string, now = new Date()) {
  daten.state = isObj(daten.state) ? daten.state : {};
  const l = arr<Obj>(daten.state.notices);
  l.push({ id: 'n' + now.getTime() + Math.random().toString(36).slice(2, 6), to: an, text, at: now.toISOString() });
  daten.state.notices = l;
}

/** Neue Mitteilungen zwischen zwei Ständen (für Push). */
export function neueMitteilungen(vorher: Daten | null, nachher: Daten): { to: string; text: string }[] {
  const alt = new Set(arr(vorher?.state?.notices).map((n) => n.id));
  return arr(nachher.state?.notices).filter((n) => !alt.has(n.id)).map((n) => ({ to: String(n.to), text: String(n.text) }));
}

const name = (daten: Daten, pid: string) => (isObj(daten.kaderNamen) ? String(daten.kaderNamen[pid] ?? '') : '') || 'Ein Mitspieler';
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// ---------------------------------------------------------------- Aktionen der Spieler

export class AktionsFehler extends Error {}

/**
 * Eine Aktion eines Spielers auf den vollständigen Stand anwenden. Nur das Eigene lässt sich ändern;
 * Dienst übergeben und Mitfahrer aufnehmen betrifft andere nur durch Zuweisung (mit Mitteilung).
 */
export function spielerAktion(voll: Daten, pid: string, a: Obj, now = new Date()): Daten {
  const d = kopie(voll);
  d.state = isObj(d.state) ? d.state : {};
  const st = d.state;
  const s = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const datum = (v: unknown) => { const x = s(v, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(x)) throw new AktionsFehler('Ungültiges Datum.'); return x; };
  const absences = arr(d.absences); d.absences = absences;
  const duties = arr(d.duties); d.duties = duties;
  const ev = (id: unknown) => { const e = arr(d.events).find((x) => x.id === id); if (!e) throw new AktionsFehler('Termin nicht gefunden.'); return e; };
  const dienst = (id: unknown) => { const x = duties.find((y) => y.id === id); if (!x) throw new AktionsFehler('Dienst nicht gefunden.'); x.who = arr<string>(x.who); return x as Obj & { who: string[] }; };
  const fahrten = (gid: unknown) => { const g = s(gid, 80); if (!g) throw new AktionsFehler('Spiel fehlt.'); st.rides = isObj(st.rides) ? st.rides : {}; const r = st.rides as Obj; const f = isObj(r[g]) ? r[g] as Obj : (r[g] = { fahrer: [], suche: [] }) as Obj; f.fahrer = arr(f.fahrer); f.suche = arr(f.suche); return f as { fahrer: (Obj & { mit: string[] })[]; suche: string[] }; };
  const kader = isObj(d.kaderNamen) ? Object.keys(d.kaderNamen) : [];
  const imKader = (x: string) => kader.includes(x);

  switch (a.typ) {
    case 'zusage': {
      const e = ev(a.eid);
      for (let i = absences.length - 1; i >= 0; i--) if (absences[i].pid === pid && absences[i].src === e.id) absences.splice(i, 1);
      if (isObj(st.att) && isObj(st.att[String(e.id)]) && isObj((st.att[String(e.id)] as Obj)[pid])) delete (st.att[String(e.id)] as Obj)[pid];
      break;
    }
    case 'absage': {
      const e = ev(a.eid), why = s(a.why, 60), note = s(a.note, 200);
      if (!why) throw new AktionsFehler('Bitte einen Grund wählen.');
      for (let i = absences.length - 1; i >= 0; i--) if (absences[i].pid === pid && absences[i].src === e.id) absences.splice(i, 1);
      absences.push({ pid, from: e.date, to: e.date, why: why + (note ? `: ${note}` : ''), src: e.id });
      break;
    }
    case 'abwesenheit': {
      let from = datum(a.from), to = a.to ? datum(a.to) : from; if (to < from) [from, to] = [to, from];
      const why = s(a.why, 60) || 'ohne Angabe', note = s(a.note, 200);
      absences.push({ pid, from, to, why: why + (note ? `: ${note}` : '') });
      break;
    }
    case 'abwesenheitWeg': {
      const i = absences.findIndex((x) => x.pid === pid && !x.src && x.from === a.from && x.to === a.to && x.why === a.why);
      if (i >= 0) absences.splice(i, 1);
      break;
    }
    case 'dienstNehmen': {
      const x = dienst(a.did);
      if (!x.who.includes(pid) && x.who.length < Number(x.slots || 1)) x.who.push(pid);
      break;
    }
    case 'dienstAustragen': { const x = dienst(a.did); x.who = x.who.filter((y) => y !== pid); break; }
    case 'dienstAbgeben': {
      const x = dienst(a.did), an = s(a.an, 80);
      if (!x.who.includes(pid)) throw new AktionsFehler('Das ist nicht dein Dienst.');
      if (!imKader(an) || an === pid || x.who.includes(an)) throw new AktionsFehler('Diesen Spieler kannst du nicht wählen.');
      x.who = x.who.map((y) => (y === pid ? an : y));
      mitteilen(d, an, `${esc(name(d, pid))} hat dir einen Dienst übergeben: <b>${esc(dienstTitel(x))}</b>, ${esc(dienstWann(d, x))}.`, now);
      break;
    }
    case 'fahrtAnbieten': {
      const f = fahrten(a.gid);
      f.suche = f.suche.filter((y) => y !== pid);
      if (!f.fahrer.some((y) => y.pid === pid)) f.fahrer.push({ pid, plaetze: Math.min(8, Math.max(1, Number(a.plaetze) || 1)), ab: s(a.ab, 120), mit: [] });
      break;
    }
    case 'fahrtSuchen': { const f = fahrten(a.gid); if (!f.suche.includes(pid)) f.suche.push(pid); break; }
    case 'fahrtMitnehmen': {
      const f = fahrten(a.gid), ich = f.fahrer.find((y) => y.pid === pid), mit = s(a.mit, 80);
      if (!ich) throw new AktionsFehler('Du bietest keine Fahrt an.');
      ich.mit = arr<string>(ich.mit);
      if (!f.suche.includes(mit) || ich.mit.includes(mit) || ich.mit.length >= Number(ich.plaetze || 1)) throw new AktionsFehler('Das geht gerade nicht.');
      ich.mit.push(mit);
      const g = arr(d.events).find((e) => e.id === a.gid);
      mitteilen(d, mit, `Fahrgemeinschaft: Du fährst bei <b>${esc(name(d, pid))}</b> mit${g ? ` (${esc(String(g.opp || ''))}, ${tagMonat(String(g.date))})` : ''}${ich.ab ? ` · Abfahrt ${esc(String(ich.ab))}` : ''}.`, now);
      break;
    }
    case 'fahrtEntfernen': { const f = fahrten(a.gid), ich = f.fahrer.find((y) => y.pid === pid); if (ich) ich.mit = arr<string>(ich.mit).filter((y) => y !== a.mit); break; }
    case 'fahrtZurueck': {
      const f = fahrten(a.gid), ich = f.fahrer.find((y) => y.pid === pid);
      for (const m of arr<string>(ich?.mit)) mitteilen(d, m, `Fahrgemeinschaft: ${esc(name(d, pid))} fährt doch nicht – bitte neu suchen.`, now);
      f.fahrer = f.fahrer.filter((y) => y.pid !== pid);
      break;
    }
    case 'fahrtVerlassen': { const f = fahrten(a.gid); f.suche = f.suche.filter((y) => y !== pid); for (const y of f.fahrer) y.mit = arr<string>(y.mit).filter((z) => z !== pid); break; }
    case 'mitteilungOk': { st.notices = arr(st.notices).filter((n) => !(n.id === a.id && n.to === pid)); break; }
    default: throw new AktionsFehler('Unbekannte Aktion.');
  }
  return d;
}

// ---------------------------------------------------------------- Zeitplan: Dienste um 15 und 17 Uhr

/** 15 Uhr: Erinnerungen an die heutigen Dienste (Push), mit Hinweis, wenn jemand nicht da ist. */
export function dienstErinnerungen(daten: Daten, heute: string): { to: string; text: string }[] {
  const out: { to: string; text: string }[] = [];
  for (const d of arr(daten.duties)) {
    if (!dienstTage(daten, d).includes(heute)) continue;
    for (const pid of arr<string>(d.who)) {
      out.push(abwesendAm(daten, pid, heute)
        ? { to: pid, text: `Achtung, heute ${dienstTitel(d)}: Du bist nicht da und hast ihn noch nicht umgelegt. Bitte jetzt abgeben – sonst wird er um 17 Uhr automatisch vergeben.` }
        : { to: pid, text: `Denk dran: Du hast heute ${dienstTitel(d)}.` });
    }
  }
  return out;
}

/**
 * 17 Uhr: Dienste von Abwesenden an einen zufälligen anwesenden Spieler übergeben (für Dienst und Tag fest).
 * Ergänzt Mitteilungen an beide; gibt den geänderten Stand zurück oder null, wenn nichts zu tun war.
 */
export function dienstUmlegen(daten: Daten, heute: string, now = new Date()): Daten | null {
  const d = kopie(daten);
  d.state = isObj(d.state) ? d.state : {};
  const erledigt = (isObj(d.state.autoUmgelegt) ? d.state.autoUmgelegt : (d.state.autoUmgelegt = {})) as Obj;
  const kader = isObj(d.kaderNamen) ? Object.keys(d.kaderNamen).sort() : [];
  let geaendert = false;
  for (const x of arr(d.duties)) {
    if (!dienstTage(d, x).includes(heute)) continue;
    x.who = arr<string>(x.who);
    for (const alt of (x.who as string[]).filter((p) => abwesendAm(d, p, heute))) {
      const k = `${x.id}|${heute}|${alt}`;
      if (erledigt[k]) continue;
      const frei = kader.filter((p) => !(x.who as string[]).includes(p) && !abwesendAm(d, p, heute));
      if (!frei.length) continue;
      let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      const neu = frei[h % frei.length];
      x.who = (x.who as string[]).map((p) => (p === alt ? neu : p));
      erledigt[k] = { neu, am: now.toISOString(), von: 'server' };
      mitteilen(d, neu, `Dir wurde für heute automatisch der <b>${esc(dienstTitel(x))}</b> zugewiesen, weil ${esc(name(d, alt))} nicht da ist.`, now);
      mitteilen(d, alt, `Dein <b>${esc(dienstTitel(x))}</b> für heute wurde automatisch an ${esc(name(d, neu))} übergeben, weil du abwesend bist.`, now);
      geaendert = true;
    }
  }
  return geaendert ? d : null;
}
