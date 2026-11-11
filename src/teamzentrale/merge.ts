/**
 * Drei-Wege-Abgleich für die Teamzentrale.
 *
 * `basis` ist der gemeinsame Ausgangsstand, `meins` und `fremd` sind zwei Weiterentwicklungen davon
 * (zum Beispiel die Änderungen von zwei Trainern, oder: eigene Eingaben gegenüber neuen Daten von fussball.de).
 * Was nur auf einer Seite geändert wurde, wird übernommen. Listen mit `id` werden Eintrag für Eintrag
 * abgeglichen. Nur wenn beide Seiten genau dieselbe Stelle unterschiedlich geändert haben, gewinnt `meins`.
 */
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const isObj = (v: unknown): v is Record<string, Json> => !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const hasIds = (a: unknown): a is { id: string }[] =>
  Array.isArray(a) && a.length > 0 && a.every((x) => isObj(x) && (typeof x.id === 'string' || typeof x.id === 'number'));

const FEHLT = Symbol('fehlt');
type Wert = Json | typeof FEHLT;

export function merge3(basis: Wert, meins: Wert, fremd: Wert): Wert {
  if (same(meins, basis)) return fremd;
  if (same(fremd, basis)) return meins;
  if (same(meins, fremd)) return meins;
  if (meins === FEHLT || fremd === FEHLT) return meins; // gelöscht gegen geändert: eigene Sicht gewinnt
  if (isObj(meins) && isObj(fremd)) {
    const b = isObj(basis) ? basis : {};
    const out: Record<string, Json> = {};
    for (const k of new Set([...Object.keys(fremd), ...Object.keys(meins)])) {
      const v = merge3(k in b ? b[k] : FEHLT, k in meins ? meins[k] : FEHLT, k in fremd ? fremd[k] : FEHLT);
      if (v !== FEHLT) out[k] = v;
    }
    return out;
  }
  if ((hasIds(meins) || (Array.isArray(meins) && meins.length === 0)) && (hasIds(fremd) || (Array.isArray(fremd) && fremd.length === 0)) && (hasIds(meins) || hasIds(fremd))) {
    const key = (x: { id: string }) => String(x.id);
    const b = new Map((hasIds(basis) ? basis : []).map((x) => [key(x), x as Json]));
    const m = new Map((meins as { id: string }[]).map((x) => [key(x), x as Json]));
    const f = new Map((fremd as { id: string }[]).map((x) => [key(x), x as Json]));
    const order = [...f.keys(), ...[...m.keys()].filter((k) => !f.has(k))];
    const out: Json[] = [];
    for (const k of order) {
      const v = merge3(b.has(k) ? b.get(k)! : FEHLT, m.has(k) ? m.get(k)! : FEHLT, f.has(k) ? f.get(k)! : FEHLT);
      if (v !== FEHLT) out.push(v);
    }
    return out;
  }
  return meins;
}

export function abgleichen<T>(basis: T, meins: T, fremd: T): T {
  return merge3(basis as Json, meins as Json, fremd as Json) as T;
}
