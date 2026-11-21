import { describe, expect, it } from 'vitest';
import { createMatch, createPreparation, createTeam } from '../../domain/factory';
import { missionComplete, mottoComplete } from '../../domain/questionnaire';
import { botschaftenTeilen, kleidungLesen, uebernehmen } from './vorbereitung';

describe('Übernahme aus der Spielvorbereitung der Teamzentrale', () => {
  const team = createTeam({ name: 'Testteam' });
  team.kits.away = { shirt: 'weiß', shorts: 'schwarz', socks: 'weiß', images: { shirt: 'data:x' } };
  const match = createMatch(team.id, { opponent: 'Gegner', competition: 'Liga', competitionType: 'liga', matchday: 1, date: '2026-11-22', kickoff: '14:30', isHome: false, venue: null });

  it('teilt Botschaften je Zeile oder nummeriert', () => {
    expect(botschaftenTeilen('Mitte dicht\nVerschieben\nKommunikation')).toEqual(['Mitte dicht', 'Verschieben', 'Kommunikation']);
    expect(botschaftenTeilen('1. Mitte dicht 2. Verschieben 3) Reden')).toEqual(['Mitte dicht', 'Verschieben', 'Reden']);
  });

  it('liest die Kleidung', () => {
    expect(kleidungLesen('Trikot weiß, Hose schwarz, Stutzen weiß')).toEqual({ shirt: 'weiß', shorts: 'schwarz', socks: 'weiß' });
    expect(kleidungLesen('wie immer')).toBeNull();
    expect(kleidungLesen('Schwarzes Trikot, weiße Hose, schwarze Stutzen')).toEqual({ shirt: 'schwarz', shorts: 'weiß', socks: 'schwarz' });
    expect(kleidungLesen('Wir spielen im schwarzen Trikot mit weißer Hose und schwarzen Stutzen.')).toEqual({ shirt: 'schwarz', shorts: 'weiß', socks: 'schwarz' });
    expect(kleidungLesen('Trikot schwarz und Hose weiss, Stutzen schwarz')).toEqual({ shirt: 'schwarz', shorts: 'weiß', socks: 'schwarz' });
  });

  it('übernimmt Antworten, Auftrag, Kleidung und Kader; leere Felder ändern nichts', () => {
    const prep = createPreparation(team, match);
    prep.answers.q2_aufbau = { state: 'beantwortet', text: 'alt', updatedAt: '', origin: 'trainer' };
    uebernehmen(prep, team, false, {
      antworten: { q1_grundordnung: '4-2-3-1', q2_aufbau: '' },
      botschaften: 'Mitte dicht – nichts durch die Mitte\nVerschieben\nKommunikation',
      leitmotiv: 'Aufwand ist gleich Ertrag', merksaetze: '',
      kleidung: 'Trikot Weiß, Hose schwarz, Stutzen weiß',
      kader: [{ name: 'Max Muster', nr: '1', pos: 'Torwart' }, { name: 'Gast Spieler', nr: '', pos: '2. Mannschaft' }],
      fahrzeit: 25,
    }, '2026-11-15T20:00:00Z');
    expect(prep.answers.q1_grundordnung?.text).toBe('4-2-3-1');
    expect(prep.answers.q2_aufbau?.text).toBe('alt');
    expect(prep.mission.messages[0].headline).toBe('Mitte dicht');
    expect(missionComplete(prep)).toBe(true);
    expect(mottoComplete(prep)).toBe(true);
    expect(prep.organisation.kit?.images?.shirt).toBe('data:x');
    expect(prep.squad?.players.map((p) => p.name)).toEqual(['Max Muster', 'Gast Spieler']);
    expect(prep.squad?.players[0].isGoalkeeper).toBe(true);
    expect(prep.squadReviewed).toBe(true);
  });
});
