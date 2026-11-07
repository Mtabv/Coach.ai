import { describe, expect, it } from 'vitest';
import { buildDossier } from '../dossier/build';
import type { ObservationSlide } from '../dossier/model';
import { initialState, REFERENCE_MATCH_ID } from '../data/seed';
import { migrate } from '../storage/storage';
import { effectiveSlides } from './dossierOptions';
import { questionProgress, questionsFor } from './questionnaire';
import type { Answer } from './types';

const ans = (text: string): Answer => ({ state: 'beantwortet', text, updatedAt: '2026-11-07T10:00:00Z', origin: 'trainer' });

describe('Aufbau des Dossiers je Spiel', () => {
  it('Phasenmodell „beides“: zwei Folien mit getrennten Antworten, Inhalt und Nummern passen', () => {
    const s = initialState();
    const team = s.teams[0];
    const match = s.matches[0];
    const prep = s.preparations[REFERENCE_MATCH_ID];
    prep.answers.q2_aufbau = ans('Gegner baut lang auf');
    prep.answers.u2_ballbesitz = ans('Wir bauen flach über die Sechser auf');
    prep.answers.u6_standards = ans('Ecken auf den ersten Pfosten');
    prep.dossierOptions = { phaseModel: 'beides' };
    const d = buildDossier(team, match, prep);
    const keys = d.slides.map((x) => x.key);
    expect(keys.indexOf('soSpielenWir')).toBe(keys.indexOf('soSpieltGegner') + 1);
    expect(d.slides.map((x) => x.number)).toEqual(d.slides.map((_, i) => i + 1));
    const opp = d.slides.find((x) => x.key === 'soSpieltGegner') as ObservationSlide;
    const own = d.slides.find((x) => x.key === 'soSpielenWir') as ObservationSlide;
    expect(opp.phases[0].value.text).toBe('Gegner baut lang auf');
    expect(own.phases[0].value.text).toBe('Wir bauen flach über die Sechser auf');
    // Stärken/Verwundbarkeit stehen bei „beides“ nur auf der Gegnerfolie.
    expect(own.extras.map((x) => x.label)).toEqual(['Unsere Standards']);
    const toc = d.slides.find((x) => x.key === 'inhalt');
    if (toc?.key !== 'inhalt') throw new Error('Inhalt fehlt');
    expect(toc.items.map((x) => x.title)).toEqual(expect.arrayContaining(['So spielt der Gegner', 'So spielen wir']));
  });

  it('Spiel überschreibt das Profil: nur „So spielen wir“, ohne Kader', () => {
    const s = initialState();
    const team = { ...s.teams[0], phaseModel: 'gegner' as const };
    const prep = { ...s.preparations[REFERENCE_MATCH_ID], dossierOptions: { phaseModel: 'eigene' as const, slides: effectiveSlides(team).filter((k) => k !== 'kader') } };
    const keys = effectiveSlides(team, prep);
    expect(keys).toContain('soSpielenWir');
    expect(keys).not.toContain('soSpieltGegner');
    expect(keys).not.toContain('kader');
    expect(effectiveSlides(team)).toContain('kader');
  });

  it('Fragebogen fragt nur die Phasen ab, die im Dossier erscheinen, fortlaufend nummeriert', () => {
    const s = initialState();
    const m = s.matches[0];
    const ids = (pm: 'gegner' | 'eigene' | 'beides') => questionsFor(m, pm).map((q) => q.id);
    expect(ids('gegner')).not.toContain('u2_ballbesitz');
    expect(ids('eigene')).not.toContain('q2_aufbau');
    expect(ids('eigene')).toContain('q5_staerken');
    expect(ids('beides')).toEqual(expect.arrayContaining(['q2_aufbau', 'u2_ballbesitz']));
    expect(questionsFor(m, 'beides').map((q) => q.number)).toEqual(questionsFor(m, 'beides').map((_, i) => i + 1));
    const prep = { ...s.preparations[REFERENCE_MATCH_ID], dossierOptions: { phaseModel: 'beides' as const } };
    expect(questionProgress(s.teams[0], m, prep).map((p) => p.id)).toContain('u5_ballgewinn');
  });

  it('übernimmt alte „So spielen wir“-Antworten in die neuen Fragen', () => {
    const s = initialState();
    s.teams[0].phaseModel = 'eigene';
    const prep = s.preparations[REFERENCE_MATCH_ID];
    prep.answers = { q1_grundordnung: ans('4-2-3-1'), q4_umschalten: ans('schnell nach vorn'), q5_staerken: ans('Standards') };
    migrate(s);
    expect(prep.answers.u1_grundordnung?.text).toBe('4-2-3-1');
    expect(prep.answers.u5_ballgewinn?.text).toBe('schnell nach vorn');
    expect(prep.answers.q1_grundordnung).toBeUndefined();
    expect(prep.answers.q5_staerken?.text).toBe('Standards');
  });
});
