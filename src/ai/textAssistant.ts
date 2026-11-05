/**
 * Austauschbare Schnittstelle für spätere KI-Funktionen (sprachliche Verdichtung, Einordnung).
 *
 * Regeln für jede Implementierung:
 * - Keine Zahlen erfinden: Kennzahlen kommen ausschließlich aus src/domain.
 * - Keine Trainerabsichten erfinden: Botschaften werden nur aus dem Trainertext formuliert.
 * - Das Ergebnis wird dem Trainer immer zur Bearbeitung vorgelegt.
 *
 * In der Vorschau gibt es nur die regelbasierte Übernahme – sie ist ausdrücklich KEINE KI.
 * Eine echte KI-Anbindung gehört später auf einen Server (keine Schlüssel im Frontend).
 */
export interface MessageDraft {
  headline: string;
  text: string;
  method: string;
}

export interface TextAssistant {
  id: string;
  label: string;
  isAI: boolean;
  draftMessage(coachText: string): Promise<MessageDraft>;
}

/** Regelbasiert: erster Satz bzw. erster Teil vor Gedankenstrich/Doppelpunkt wird zur Überschrift. */
export const ruleBasedAssistant: TextAssistant = {
  id: 'regelbasiert',
  label: 'Regelbasierte Textübernahme (keine KI)',
  isAI: false,
  async draftMessage(coachText: string): Promise<MessageDraft> {
    return splitMessage(coachText);
  },
};

export function splitMessage(coachText: string): MessageDraft {
  const raw = coachText.replace(/\s+/g, ' ').trim();
  if (!raw) return { headline: '', text: '', method: ruleBasedAssistant.label };
  const sep = /\s[–—-]\s|:\s|\.\s|!\s|\?\s/.exec(raw);
  let headline = sep ? raw.slice(0, sep.index) : raw;
  let rest = sep ? raw.slice(sep.index + sep[0].length) : '';
  const words = headline.split(' ');
  if (words.length > 7) {
    headline = words.slice(0, 6).join(' ') + ' …';
    rest = raw;
  }
  headline = headline.replace(/[.!?:]+$/, '');
  let text = rest.trim();
  if (text) text = text.charAt(0).toUpperCase() + text.slice(1);
  if (text && !/[.!?…)]$/.test(text)) text += '.';
  return { headline, text, method: ruleBasedAssistant.label };
}
