import { splitMessage } from '../../ai/textAssistant';
import type { KitCombination, Player, Preparation, QuestionId, SquadSnapshot, TeamProfile } from '../../domain/types';

/**
 * Das Dossier läuft als Reiter in der Spielvorbereitung der Teamzentrale (eingebettet, gleiche Adresse).
 * Die Einträge des Trainers kommen von dort und haben Vorrang: Gegnerbeobachtung, Plan, Auftrag, Kleidung, Kader.
 */
const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
/** Läuft das Dossier als Reiter in der Teamzentrale? */
export const eingebettet = typeof window !== 'undefined' && window.self !== window.top;
/** Kennung des Spiels in der Teamzentrale, z. B. g2026-11-22. */
export const tzSpiel = q.get('tz');
/** Direkt zum Abschluss springen („Spieltagsdossier abschließen“ in der Teamzentrale). */
export const zumAbschluss = q.get('schritt') === 'abschluss';

export interface TzVorbereitung {
  antworten: Record<string, string>;
  botschaften: string;
  leitmotiv: string;
  merksaetze: string;
  kleidung: string;
  kader: { name: string; nr: string; pos: string }[];
  fahrzeit: number;
}

/** Holt die Einträge aus der umgebenden Teamzentrale (nur gleiche Adresse, sonst null). */
export function ausTeamzentrale(): TzVorbereitung | null {
  if (!eingebettet || !tzSpiel) return null;
  try {
    const f = (window.parent as unknown as { __11planVorbereitung?: (id: string) => TzVorbereitung | null }).__11planVorbereitung;
    return typeof f === 'function' ? f(tzSpiel) : null;
  } catch { return null; }
}

/** Meldet der Teamzentrale, dass das Dossier abgeschlossen bzw. wieder geöffnet wurde. */
export function anTeamzentrale(typ: 'abgeschlossen' | 'geoeffnet', version?: number) {
  if (!eingebettet || !tzSpiel) return;
  try { window.parent.postMessage({ typ: `11plan-dossier-${typ}`, spiel: tzSpiel, version: version ?? null }, window.location.origin); } catch { /* ohne Teamzentrale nichts zu melden */ }
}

const falten = (t: string) => t.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const zeilen = (t: string) => t.split(/\n+/).map((x) => x.replace(/^\s*(?:\d+\s*[.):]|[-–•*])\s*/, '').trim()).filter(Boolean);

/** „1. … 2. … 3. …“ in einer Zeile oder je Zeile eine Botschaft. */
export function botschaftenTeilen(t: string): string[] {
  const z = zeilen(t);
  if (z.length === 1) {
    const teile = t.split(/(?:^|\s)\d\s*[.)]\s+/).map((x) => x.trim()).filter(Boolean);
    if (teile.length > 1) return teile.slice(0, 3);
  }
  return z.slice(0, 3);
}

/** „Trikot weiß, Hose schwarz, Stutzen weiß“ → Kleidung; null, wenn nichts erkennbar. */
export function kleidungLesen(t: string): KitCombination | null {
  const teil = (wort: string) => (new RegExp(`${wort}[:\\s]+([^,;.\\n]+)`, 'i').exec(t)?.[1] ?? '').trim();
  const k = { shirt: teil('Trikots?'), shorts: teil('Hosen?'), socks: teil('Stutzen') };
  return k.shirt || k.shorts || k.socks ? k : null;
}

function kader(team: TeamProfile, prep: Preparation, liste: TzVorbereitung['kader']): SquadSnapshot {
  const bekannt = [...(prep.squad?.players ?? []), ...(team.lastConfirmedSquad?.players ?? [])];
  const players: Player[] = liste.map((x) => {
    const b = bekannt.find((p) => falten(p.name) === falten(x.name));
    const tw = /torw|^tw\b/i.test(x.pos);
    return b
      ? { ...b, name: x.name, number: b.number || x.nr || undefined, isGoalkeeper: b.isGoalkeeper || tw }
      : { id: `tz-${falten(x.name).replace(/ /g, '-')}`, name: x.name, number: x.nr || undefined, position: x.pos || undefined, isGoalkeeper: tw };
  });
  return {
    players,
    note: prep.squad?.note,
    coaches: prep.squad?.coaches ?? team.lastConfirmedSquad?.coaches,
    openSlots: prep.squad?.openSlots,
    confirmedAt: null,
    origin: { kind: 'ersteingabe' },
  };
}

/** Legt die Einträge der Teamzentrale über die Vorbereitung dieses Dossiers. Leere Felder ändern nichts. */
export function uebernehmen(prep: Preparation, team: TeamProfile, isHome: boolean, d: TzVorbereitung, jetzt: string) {
  for (const [id, text] of Object.entries(d.antworten || {})) {
    if (!text?.trim()) continue;
    prep.answers[id as QuestionId] = { state: 'beantwortet', text: text.trim(), updatedAt: jetzt, origin: 'trainer' };
  }
  const b = botschaftenTeilen(d.botschaften || '');
  if (b.length) {
    const alt = prep.mission.messages;
    prep.mission.messages = [0, 1, 2].map((i) => {
      const raw = b[i] ?? '';
      if (alt[i] && alt[i].coachRaw.trim() === raw && (alt[i].headline || alt[i].text)) return alt[i];
      const m = splitMessage(raw);
      return { coachRaw: raw, headline: m.headline, text: m.text };
    }) as Preparation['mission']['messages'];
    prep.mission.origin = 'trainer';
  }
  if (d.leitmotiv?.trim()) prep.mission.motto = d.leitmotiv.trim();
  const ms = zeilen(d.merksaetze || '');
  if (ms.length) { prep.mission.mantras = ms; prep.mission.mantrasWaived = false; }
  else if (d.leitmotiv?.trim() && !prep.mission.mantras.some((m) => m.trim())) prep.mission.mantrasWaived = true;

  const k = kleidungLesen(d.kleidung || '');
  if (k) {
    const profil = isHome ? team.kits.home : team.kits.away;
    const gleich = profil && [['shirt', 'shirt'], ['shorts', 'shorts'], ['socks', 'socks']].every(([a]) => falten(profil[a as keyof KitCombination] as string || '') === falten(k[a as 'shirt']));
    prep.organisation.kit = gleich ? structuredClone(profil) : k;
    prep.answers.q11_kleidung = { state: 'beantwortet', text: d.kleidung.trim(), updatedAt: jetzt, origin: 'trainer' };
  }
  if (d.kader?.length) {
    prep.squad = kader(team, prep, d.kader);
    prep.squadReviewed = true;
  }
  prep.updatedAt = jetzt;
}
