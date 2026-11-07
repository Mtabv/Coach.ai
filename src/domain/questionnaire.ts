import { effectivePhaseModel, showsOpponentPhases, showsOwnPhases } from './dossierOptions';
import type { Answer, Match, PhaseModel, Preparation, QuestionId, TeamProfile } from './types';

/**
 * Fachlicher Trainerfragebogen. Die Fragen sind Daten, die Logik zur Anzeige
 * (adaptiv: nur Offenes und tatsächliche Änderungen) ist hier gekapselt.
 */

export type SectionId = 'A' | 'E' | 'B' | 'C' | 'D';

export const SECTIONS: { id: SectionId; title: string; intro: string }[] = [
  { id: 'A', title: 'Gegnerbeobachtung', intro: 'Ihre eigenen Beobachtungen. Sie werden getrennt von statistischen Daten ausgegeben.' },
  { id: 'E', title: 'Unser Plan nach Spielphasen', intro: 'Wie wir in den vier Spielphasen spielen wollen – in Ihren Worten. Erscheint als Folie „So spielen wir“.' },
  { id: 'B', title: 'Organisation und Spielkleidung', intro: 'Zeiten werden aus dem gespeicherten Zeitmuster berechnet. Nur ausdrückliche Abweichungen eintragen.' },
  { id: 'C', title: 'Kader und Ausgabe', intro: 'Der zuletzt bestätigte Kader wird übernommen und bleibt editierbar.' },
  { id: 'D', title: 'Unser Auftrag', intro: 'Ihre Botschaften an die Mannschaft. Coach.AI ergänzt keine eigenen Botschaften.' },
];

export type QuestionKind = 'text' | 'organisation' | 'kit' | 'squad' | 'layout' | 'mission' | 'motto' | 'players';

export interface QuestionDef {
  id: QuestionId;
  section: SectionId;
  number: number;
  title: string;
  help?: string;
  kind: QuestionKind;
  placeholder?: string;
  /** Darf mit „Nicht bekannt“ beantwortet werden. */
  allowUnknown: boolean;
  /** Antwort ist gegnerspezifisch und darf nie in neue Spiele übernommen werden. */
  opponentSpecific: boolean;
  appliesTo?: (match: Match, phaseModel: PhaseModel) => boolean;
}

const opp = (_m: Match, pm: PhaseModel) => showsOpponentPhases(pm);
const own = (_m: Match, pm: PhaseModel) => showsOwnPhases(pm);

export const QUESTIONS: QuestionDef[] = [
  { id: 'q1_grundordnung', section: 'A', number: 1, kind: 'text', allowUnknown: true, opponentSpecific: true, appliesTo: opp,
    title: 'Welche Grundordnung(en) erwarten wir? Welche Wechsel sind zu beobachten?',
    placeholder: 'z. B. 4-2-3-1, im Ballbesitz 3-2-5 …' },
  { id: 'q2_aufbau', section: 'A', number: 2, kind: 'text', allowUnknown: true, opponentSpecific: true, appliesTo: opp,
    title: 'Wie baut der Gegner auf und erzeugt Chancen (eigener Ballbesitz)?',
    help: 'Zentrum, Breite, Halbfeld, Flanken, lange Bälle oder Tiefenläufe.' },
  { id: 'q3_verteidigung', section: 'A', number: 3, kind: 'text', allowUnknown: true, opponentSpecific: true, appliesTo: opp,
    title: 'Wie verteidigt und presst er (gegnerischer Ballbesitz)?',
    help: 'Höhe, Zuordnung, Auslöser und Verhalten bei überspieltem Pressing.' },
  { id: 'q4_umschalten', section: 'A', number: 4, kind: 'text', allowUnknown: true, opponentSpecific: true, appliesTo: opp,
    title: 'Wie schaltet er nach Ballgewinn um?',
    help: 'Spielphase „Umschalten nach Ballgewinn“ (offensives Umschalten).' },
  { id: 'q4b_ballverlust', section: 'A', number: 5, kind: 'text', allowUnknown: true, opponentSpecific: true, appliesTo: opp,
    title: 'Wie reagiert er nach Ballverlust?',
    help: 'Spielphase „Umschalten nach Ballverlust“: Gegenpressing oder Rückzug?' },
  { id: 'q5b_standards', section: 'A', number: 6, kind: 'text', allowUnknown: true, opponentSpecific: true, appliesTo: opp,
    title: 'Wie gefährlich ist er bei Standards?',
    help: 'Ecken, Freistöße, Einwürfe – offensiv und defensiv.' },
  { id: 'q5_staerken', section: 'A', number: 7, kind: 'text', allowUnknown: true, opponentSpecific: true,
    title: 'Was sind seine größten Stärken?' },
  { id: 'q6_verwundbar', section: 'A', number: 8, kind: 'text', allowUnknown: true, opponentSpecific: true,
    title: 'Wo ist er verwundbar?',
    help: 'Nur beobachtete gegnerische Schwächen beschreiben. Daraus wird kein Matchplan abgeleitet.' },
  { id: 'q7_schluesselspieler', section: 'A', number: 9, kind: 'players', allowUnknown: true, opponentSpecific: true,
    title: 'Welche Spieler sind besonders wichtig und warum?',
    help: 'Vorschläge stammen nur aus belegten Daten. Ihre Hinweise haben Vorrang. Bei dünner Datenlage werden keine vier Spieler erzwungen.' },
  { id: 'q8_ausfaelle', section: 'A', number: 10, kind: 'text', allowUnknown: true, opponentSpecific: true,
    title: 'Gibt es zuverlässig bekannte Ausfälle, Veränderungen oder besondere Beobachtungen?' },
  { id: 'u1_grundordnung', section: 'E', number: 11, kind: 'text', allowUnknown: true, opponentSpecific: true, appliesTo: own,
    title: 'Mit welcher Grundordnung starten wir?',
    placeholder: 'z. B. 4-2-3-1 mit zwei Sechsern …' },
  { id: 'u2_ballbesitz', section: 'E', number: 12, kind: 'text', allowUnknown: true, opponentSpecific: true, appliesTo: own,
    title: 'Eigener Ballbesitz: Wie bauen wir auf und kommen zu Chancen?' },
  { id: 'u3_ballverlust', section: 'E', number: 13, kind: 'text', allowUnknown: true, opponentSpecific: true, appliesTo: own,
    title: 'Umschalten nach Ballverlust: Was passiert sofort, wenn wir den Ball verlieren?',
    help: 'Gegenpressing oder zurückfallen?' },
  { id: 'u4_gegnerball', section: 'E', number: 14, kind: 'text', allowUnknown: true, opponentSpecific: true, appliesTo: own,
    title: 'Gegnerischer Ballbesitz: Wo laufen wir an, wie hoch stehen wir, wer presst?' },
  { id: 'u5_ballgewinn', section: 'E', number: 15, kind: 'text', allowUnknown: true, opponentSpecific: true, appliesTo: own,
    title: 'Umschalten nach Ballgewinn: Was ist der erste Gedanke – schnell nach vorn oder sichern?' },
  { id: 'u6_standards', section: 'E', number: 16, kind: 'text', allowUnknown: true, opponentSpecific: true, appliesTo: own,
    title: 'Unsere Standards: Worauf achten wir bei eigenen und gegnerischen Ecken und Freistößen?' },
  { id: 'q9_abweichungen', section: 'B', number: 11, kind: 'organisation', allowUnknown: false, opponentSpecific: true,
    title: 'Gibt es ausdrücklich neue Abweichungen von Spielort oder Zeitmuster?',
    help: 'Ohne Abweichung berechnet Coach.AI die Zeiten selbst. Bei Auswärtsspielen bitte die aktuelle Fahrzeit für genau diese Fahrt angeben.' },
  { id: 'q10_ablauf', section: 'B', number: 12, kind: 'text', allowUnknown: false, opponentSpecific: true,
    title: 'Berechneter Ablauf: Gibt es ausdrücklich genannte Änderungen?',
    help: 'Die Traineransprache wird nur als organisatorischer Zeitblock dargestellt.' },
  { id: 'q11_kleidung', section: 'B', number: 13, kind: 'kit', allowUnknown: false, opponentSpecific: true,
    title: 'Welche Kombination tragen wir: Trikot, Hose und Stutzen? Weitere organisatorische Besonderheiten?' },
  { id: 'q12_kader', section: 'C', number: 14, kind: 'squad', allowUnknown: false, opponentSpecific: false,
    title: 'Kader für dieses Spiel',
    help: 'Übernommen aus dem zuletzt bestätigten Dossier. Änderungen nur durch Ihre ausdrückliche Bearbeitung – keine Nominierung aus Online-Vereinskadern.' },
  { id: 'q13_layout', section: 'C', number: 15, kind: 'layout', allowUnknown: false, opponentSpecific: false,
    title: 'Gibt es abweichende Ausgabe- oder Layoutwünsche?',
    help: 'Sonst wird die zuletzt bestätigte Vorlage verwendet. Ausgabe: PPTX und PDF.' },
  { id: 'q14_auftrag', section: 'D', number: 16, kind: 'mission', allowUnknown: false, opponentSpecific: true,
    title: 'Was sollen die Jungs aus dem Dossier mitnehmen und in dieses Spiel tragen?',
    help: 'Drei Kernbotschaften in Ihren Worten. Überschriften und Begleitsätze formulieren Sie selbst oder übernehmen sie regelbasiert aus Ihrem Text.' },
  { id: 'q15_leitmotiv', section: 'D', number: 17, kind: 'motto', allowUnknown: false, opponentSpecific: true,
    title: 'Welches kurze Leitmotiv steht im schwarzen Kasten? Welche zwei oder drei Merksätze gehören darunter?' },
];

/** Fragen für dieses Spiel, in Abschnittsreihenfolge und fortlaufend nummeriert. */
export function questionsFor(match: Match, phaseModel: PhaseModel = 'gegner'): QuestionDef[] {
  const order = SECTIONS.map((x) => x.id);
  return QUESTIONS.filter((q) => (q.appliesTo ? q.appliesTo(match, phaseModel) : true))
    .sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section) || a.number - b.number)
    .map((q, i) => ({ ...q, number: i + 1 }));
}

export type QuestionStatus = 'erledigt' | 'offen' | 'übernommen';

export interface QuestionProgress {
  id: QuestionId;
  status: QuestionStatus;
  summary: string;
}

function answered(a: Answer | undefined): boolean {
  return Boolean(a && a.state !== 'offen' && (a.state !== 'beantwortet' || a.text.trim().length > 0));
}

export function missionComplete(prep: Preparation): boolean {
  return prep.mission.messages.every((m) => m.headline.trim() || m.text.trim());
}

export function mottoComplete(prep: Preparation): boolean {
  const mantrasOk = prep.mission.mantrasWaived || prep.mission.mantras.filter((m) => m.trim()).length >= 1;
  return Boolean(prep.mission.motto.trim()) && mantrasOk;
}

/** Bewertet jede Frage: bereits bekannt/übernommen, erledigt oder noch offen. */
export function questionProgress(team: TeamProfile, match: Match, prep: Preparation): QuestionProgress[] {
  return questionsFor(match, effectivePhaseModel(team, prep)).map((q) => {
    const a = prep.answers[q.id];
    switch (q.kind) {
      case 'organisation': {
        if (!match.isHome && prep.organisation.travelMinutes === null)
          return { id: q.id, status: 'offen', summary: 'Fahrzeit für diese Fahrt fehlt' };
        if (answered(a)) return { id: q.id, status: 'erledigt', summary: a!.state === 'keine_abweichung' ? 'Keine Abweichung' : a!.text };
        return { id: q.id, status: 'offen', summary: 'Abweichungen bestätigen oder „keine Abweichung“ wählen' };
      }
      case 'kit': {
        if (prep.organisation.kit && answered(a)) return { id: q.id, status: 'erledigt', summary: kitLabel(prep.organisation.kit) };
        if (prep.organisation.kit) return { id: q.id, status: 'übernommen', summary: `Vorausgefüllt: ${kitLabel(prep.organisation.kit)} – bitte bestätigen` };
        return { id: q.id, status: 'offen', summary: 'Spielkleidung fehlt' };
      }
      case 'squad': {
        if (prep.squadReviewed && prep.squad?.players.length) return { id: q.id, status: 'erledigt', summary: `${prep.squad.players.length} Spieler` };
        if (prep.squad?.players.length) return { id: q.id, status: 'übernommen', summary: `${prep.squad.players.length} Spieler aus „${originLabel(prep)}“` };
        return { id: q.id, status: 'offen', summary: team.lastConfirmedSquad ? 'Kader übernehmen' : 'Noch kein bestätigter Kader – Ersteingabe' };
      }
      case 'layout':
        if (answered(a)) return { id: q.id, status: 'erledigt', summary: a!.state === 'keine_abweichung' ? `Vorlage „${team.template.name}“` : a!.text };
        return { id: q.id, status: 'übernommen', summary: `Vorlage „${team.template.name}“ wird verwendet` };
      case 'mission':
        return missionComplete(prep)
          ? { id: q.id, status: 'erledigt', summary: prep.mission.messages.map((m) => m.headline || m.text).join(' · ') }
          : { id: q.id, status: 'offen', summary: `${prep.mission.messages.filter((m) => m.headline.trim() || m.text.trim()).length} von 3 Botschaften` };
      case 'motto':
        return mottoComplete(prep)
          ? { id: q.id, status: 'erledigt', summary: prep.mission.motto }
          : { id: q.id, status: 'offen', summary: prep.mission.motto.trim() ? 'Merksätze erfassen oder ausdrücklich abwählen' : 'Leitmotiv fehlt' };
      case 'players':
        if (answered(a) || prep.playerHints.length) return { id: q.id, status: 'erledigt', summary: a?.state === 'nicht_bekannt' ? 'Nicht bekannt' : `${prep.playerHints.length} Trainerhinweis(e)` };
        return { id: q.id, status: 'offen', summary: 'Hinweise ergänzen oder „Nicht bekannt“' };
      default:
        if (answered(a)) return { id: q.id, status: 'erledigt', summary: a!.state === 'nicht_bekannt' ? 'Nicht bekannt' : a!.text };
        return { id: q.id, status: 'offen', summary: 'Noch keine Beobachtung' };
    }
  });
}

export function kitLabel(k: { shirt: string; shorts: string; socks: string }): string {
  return `Trikot ${k.shirt || '–'} · Hose ${k.shorts || '–'} · Stutzen ${k.socks || '–'}`;
}

function originLabel(prep: Preparation): string {
  const o = prep.squad?.origin;
  if (!o) return '';
  if (o.kind === 'dossier' || o.kind === 'beispiel') return o.label;
  return 'Ersteingabe';
}
