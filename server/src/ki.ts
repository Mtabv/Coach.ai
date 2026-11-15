import Anthropic from '@anthropic-ai/sdk';

/**
 * KI-Verteilung: Ein diktierter Text wird auf die Felder einer Maske verteilt (z. B. „Übung erfassen“).
 * Nur der Text geht an Anthropic, nie die Tonaufnahme. Der Schlüssel steht nur in der .env auf dem Server.
 * Es wird nichts gespeichert; der Trainer prüft die vorausgefüllten Felder und speichert selbst.
 */
export const KI_MODELL = 'claude-sonnet-5-5';

export interface KiFeld {
  /** Kennung des Feldes, z. B. „aufbau“. */
  key: string;
  /** Beschriftung, wie der Trainer sie sieht, z. B. „Aufbau“. */
  label: string;
  /** Kurze Erklärung, was hineingehört. */
  hinweis?: string;
  /** Auswahlfeld: nur einer dieser Werte (oder leer). */
  optionen?: { wert: string; label: string }[];
}

export interface KiAnfrage {
  maske: string;
  text: string;
  felder: KiFeld[];
  /** Zusätzlicher Rahmen, z. B. Spielernamen für die Schreibweise. */
  kontext?: string;
}

export class KiFehler extends Error { constructor(public status: number, message: string) { super(message); } }

const SYSTEM = `Du bist Assistent im Trainerteam einer Amateur-Fußballmannschaft (Herren, Gruppenliga). Ein Trainer hat frei gesprochen; der Text kommt aus einer automatischen Spracherkennung. Deine Aufgabe: den Text auf die Felder einer Eingabemaske verteilen.

Regeln:
- Verwende nur, was der Trainer gesagt hat. Erfinde nichts dazu, ergänze keine eigenen Ideen, Übungen, Zahlen oder Coachingpunkte.
- Was zu einem Feld nicht gesagt wurde, bleibt leer ("").
- Behalte die Worte des Trainers bei. Entferne nur Füllwörter („äh“, „also“, „sozusagen“), Wiederholungen und Selbstkorrekturen. Schreibe vollständige, knappe Sätze; Aufzählungen als Zeilen mit „- “.
- Korrigiere offensichtliche Erkennungsfehler bei Fußballbegriffen und Namen (z. B. „Sechzehner“, „Gegenpressing“, „Halbraum“), wenn der Sinn eindeutig ist.
- Bei Auswahlfeldern nimm genau einen der erlaubten Werte, wenn er klar passt, sonst "".
- Jeder Satz gehört in höchstens ein Feld. Wenn unklar ist, wohin etwas gehört, nimm das naheliegendste Feld.
- Antworte auf Deutsch.`;

function pruefen(a: KiAnfrage) {
  if (typeof a.text !== 'string' || !a.text.trim()) throw new KiFehler(400, 'Kein Text.');
  if (a.text.length > 12000) throw new KiFehler(413, 'Der Text ist zu lang.');
  if (!Array.isArray(a.felder) || !a.felder.length || a.felder.length > 40) throw new KiFehler(400, 'Felder fehlen.');
  for (const f of a.felder) {
    if (!f || typeof f.key !== 'string' || !/^[a-z][a-z0-9_]{0,30}$/.test(f.key)) throw new KiFehler(400, 'Ungültiges Feld.');
    if (typeof f.label !== 'string' || f.label.length > 80) throw new KiFehler(400, 'Ungültiges Feld.');
    if (f.hinweis !== undefined && (typeof f.hinweis !== 'string' || f.hinweis.length > 300)) throw new KiFehler(400, 'Ungültiges Feld.');
    if (f.optionen !== undefined && (!Array.isArray(f.optionen) || f.optionen.length > 60 || f.optionen.some((o) => typeof o?.wert !== 'string' || typeof o?.label !== 'string' || o.wert.length > 60 || o.label.length > 120))) throw new KiFehler(400, 'Ungültige Auswahl.');
  }
  if (a.kontext !== undefined && (typeof a.kontext !== 'string' || a.kontext.length > 3000)) throw new KiFehler(400, 'Ungültiger Kontext.');
}

/** JSON-Schema der Antwort: genau die Felder der Maske, alle Pflicht, Auswahlfelder als Liste erlaubter Werte. */
export function schemaFuer(felder: KiFeld[]) {
  const properties: Record<string, unknown> = {};
  for (const f of felder) properties[f.key] = f.optionen ? { type: 'string', enum: ['', ...new Set(f.optionen.map((o) => o.wert))] } : { type: 'string' };
  return { type: 'object', properties, required: felder.map((f) => f.key), additionalProperties: false };
}

function auftrag(a: KiAnfrage): string {
  const zeilen = a.felder.map((f) => {
    const opt = f.optionen ? ` Erlaubte Werte: ${f.optionen.map((o) => `"${o.wert}" (${o.label})`).join(', ')}.` : '';
    return `- ${f.key}: ${f.label}${f.hinweis ? ` – ${f.hinweis}` : ''}.${opt}`;
  });
  return `Maske: ${a.maske}\n\nFelder:\n${zeilen.join('\n')}\n\n${a.kontext ? `Hinweise zur Schreibweise: ${a.kontext}\n\n` : ''}Gesprochener Text des Trainers:\n"""\n${a.text.trim()}\n"""`;
}

export function kiDienst(apiKey: string, baseURL?: string) {
  const client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}), maxRetries: 2, timeout: 90_000 });
  return async function verteilen(a: KiAnfrage): Promise<Record<string, string>> {
    pruefen(a);
    let r: Anthropic.Message;
    try {
      r = await client.messages.create({
        model: KI_MODELL,
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: 'user', content: auftrag(a) }],
        // Einfache Zuordnung: wenig Nachdenken genügt und hält die Kosten bei rund einem Cent.
        output_config: { effort: 'low', format: { type: 'json_schema', schema: schemaFuer(a.felder) } },
      });
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new KiFehler(503, 'Der API-Schlüssel von Anthropic ist ungültig. Bitte in deploy/.env prüfen.');
      if (e instanceof Anthropic.PermissionDeniedError) throw new KiFehler(503, 'Anthropic hat die Anfrage abgelehnt (Berechtigung). Bitte das Konto prüfen.');
      if (e instanceof Anthropic.RateLimitError) throw new KiFehler(429, 'Zu viele KI-Anfragen gerade. Bitte in einer Minute erneut.');
      if (e instanceof Anthropic.BadRequestError) throw new KiFehler(502, 'Anthropic hat die Anfrage nicht angenommen. Oft ist das Guthaben aufgebraucht oder das Monatslimit erreicht – bitte in der Konsole prüfen.');
      if (e instanceof Anthropic.APIError) throw new KiFehler(502, 'Die KI ist gerade nicht erreichbar. Bitte später erneut.');
      throw new KiFehler(502, 'Die KI ist gerade nicht erreichbar. Bitte später erneut.');
    }
    if (r.stop_reason === 'refusal') throw new KiFehler(422, 'Die KI hat diesen Text nicht verarbeitet.');
    if (r.stop_reason === 'max_tokens') throw new KiFehler(422, 'Der Text war zu lang für eine Verteilung. Bitte in kürzeren Teilen diktieren.');
    const text = r.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('');
    let roh: unknown;
    try { roh = JSON.parse(text); } catch { throw new KiFehler(502, 'Die Antwort der KI war unvollständig. Bitte erneut versuchen.'); }
    if (!roh || typeof roh !== 'object') throw new KiFehler(502, 'Die Antwort der KI war unvollständig. Bitte erneut versuchen.');
    // Nur bekannte Felder, nur Text, Auswahlfelder nur mit erlaubten Werten.
    const out: Record<string, string> = {};
    for (const f of a.felder) {
      const v = (roh as Record<string, unknown>)[f.key];
      const s = typeof v === 'string' ? v.trim() : '';
      out[f.key] = f.optionen && s && !f.optionen.some((o) => o.wert === s) ? '' : s;
    }
    return out;
  };
}
