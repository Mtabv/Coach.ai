import { describe, expect, it } from 'vitest';
import { computeAwaySchedule, computeHomeSchedule, formatDate } from './time';
import { lastLeagueGames, seasonSummary } from './stats';
import { analyzeTable, evaluateBlocks } from './dataQuality';
import { demoTeam, initialState, referenceMatch, REFERENCE_MATCH_ID } from '../data/seed';
import { demoProvider } from '../data/demoProvider';
import { demoResultsBaunatal, demoResultsTsg, BAUNATAL, TSG } from '../data/demoData';
import { addMatch, applyProviderResult, confirmDossier, ensureDraft, insertExampleAnswers, setOverride, updatePrep } from '../state/actions';
import { createMatch } from './factory';
import { buildDossier } from '../dossier/build';
import { applyOverrides } from '../dossier/overrides';
import { canConfirm, confirmationChecks } from './checks';
import { questionProgress } from './questionnaire';
import { selectKeyPlayers } from './players';
import { splitMessage } from '../ai/textAssistant';
import type { AppState } from './types';

const noOrg = { blockOverrides: {}, meetingOverride: null };

describe('Zeitberechnung', () => {
  const team = demoTeam();
  it('berechnet Heimspiel-Ablauf relativ zum Anstoß', () => {
    const r = computeHomeSchedule('19:00', team.schedule.home, 'Heimplatz', noOrg);
    expect(r.meetingTime).toBe('17:20');
    const byLabel = Object.fromEntries(r.items.map((i) => [i.label, `${i.start}-${i.end}`]));
    expect(byLabel['Zusätzlicher Puffer']).toBe('17:20-17:30');
    expect(byLabel['Ankommen']).toBe('17:30-17:45');
    expect(byLabel['Umziehen']).toBe('17:45-18:00');
    expect(byLabel['Traineransprache']).toBe('18:00-18:20');
    expect(byLabel['Warmmachen']).toBe('18:20-18:50');
    expect(byLabel['Kabine und spielfertig machen']).toBe('18:50-19:00');
    expect(r.open).toEqual([]);
  });

  it('berechnet Auswärtsspiel mit Fahrzeit', () => {
    const r = computeAwaySchedule('15:00', team.schedule.away, 40, noOrg);
    const by = Object.fromEntries(r.items.map((i) => [i.id, i]));
    expect(by.ankunft.start).toBe('13:25');
    expect(r.departureTime).toBe('12:45');
    expect(r.meetingTime).toBe('12:35');
    expect(r.meetingPlace).toBe('Stockwiesen');
    expect(by['a-ankommen'].start + '-' + by['a-ankommen'].end).toBe('13:25-13:40');
    expect(by['a-umziehen'].start + '-' + by['a-umziehen'].end).toBe('13:40-14:00');
    expect(by['a-ansprache'].start).toBe('14:00');
    expect(by['a-kabine'].end).toBe('15:00');
  });

  it('lässt Abfahrt und Treffpunkt ohne Fahrzeit offen, zeigt aber übrige Punkte', () => {
    const r = computeAwaySchedule('15:00', team.schedule.away, null, noOrg);
    expect(r.departureTime).toBeNull();
    expect(r.meetingTime).toBeNull();
    expect(r.open.join(' ')).toMatch(/Fahrzeit/);
    const by = Object.fromEntries(r.items.map((i) => [i.id, i]));
    expect(by.ankunft.start).toBe('13:25');
    expect(by['a-warm'].start).toBe('14:20');
  });

  it('berücksichtigt ausdrückliche Änderungen', () => {
    const r = computeHomeSchedule('19:00', team.schedule.home, null, { blockOverrides: { 'h-warm': { start: '18:15', end: '18:50' } }, meetingOverride: '17:00' });
    expect(r.meetingTime).toBe('17:00');
    expect(r.items.find((i) => i.id === 'h-warm')?.overridden).toBe(true);
  });

  it('formatiert Datum mit Wochentag', () => {
    expect(formatDate('2026-10-23', { weekday: true })).toBe('Freitag, 23.10.2026');
  });
});

describe('Statistik', () => {
  it('letzte fünf Ligaspiele ohne Pokal- und Testspiele', () => {
    const l5 = lastLeagueGames(TSG, demoResultsTsg(), '2026-10-23');
    expect(l5.map((r) => r.matchday)).toEqual([13, 12, 11, 10, 9]);
    expect(l5.every((r) => r.competitionType === 'liga')).toBe(true);
  });
  it('Saisonbilanz und Heim/Auswärts', () => {
    const s = seasonSummary(BAUNATAL, demoResultsBaunatal(), '2026-10-23');
    expect([s.all.won, s.all.drawn, s.all.lost, s.all.goalsFor, s.all.goalsAgainst]).toEqual([7, 4, 2, 26, 15]);
    expect([s.away.won, s.away.drawn, s.away.lost]).toEqual([4, 1, 2]);
    expect(s.otherCompetitions).toHaveLength(1);
  });
});

async function loadedState(): Promise<AppState> {
  const s = initialState();
  const res = await demoProvider.fetch(s.teams[0], s.matches[0]);
  applyProviderResult(s, REFERENCE_MATCH_ID, res);
  return s;
}

describe('Datenprüfung', () => {
  it('erkennt widersprüchliche Tabellenwerte und veraltete Quelle', async () => {
    const s = await loadedState();
    const a = analyzeTable(s.preparations[REFERENCE_MATCH_ID].dataBlocks.tabelle, referenceMatch());
    expect(a.staleSources.map((x) => x.id)).toEqual(['demo-vereinsportal']);
    const c = a.conflicts.filter((x) => !x.resolution);
    expect(c).toHaveLength(1);
    expect(c[0].subject).toBe(BAUNATAL);
    expect(c[0].values.map((v) => v.value).sort()).toEqual(['24', '25']);
    // Punktabzug (Talheim) ist plausibel und kein Konflikt
    expect(a.conflicts.some((x) => x.subject === 'FSV Talheim-Nord')).toBe(false);
    const row = a.rows.find((r) => r.team === BAUNATAL)!;
    expect(row.unresolved).toContain('points');
  });

  it('Auflösung durch Trainer übernimmt gewählten Wert', async () => {
    const s = await loadedState();
    const blk = s.preparations[REFERENCE_MATCH_ID].dataBlocks.tabelle;
    blk.resolutions = { [`tabelle:${BAUNATAL.toLowerCase()}:points`]: { sourceId: 'demo-ergebnisdienst', resolvedAt: 'x' } };
    const a = analyzeTable(blk, referenceMatch());
    expect(a.rows.find((r) => r.team === BAUNATAL)!.points).toBe(25);
    expect(a.rows.find((r) => r.team === BAUNATAL)!.unresolved).toEqual([]);
  });

  it('widersprüchliche Werte gelangen nicht als Fakt in das Dossier', async () => {
    const s = await loadedState();
    const d = buildDossier(s.teams[0], s.matches[0], s.preparations[REFERENCE_MATCH_ID]);
    const slide = d.slides.find((x) => x.key === 'spieltag') as Extract<typeof d.slides[number], { key: 'spieltag' }>;
    const line = slide.table.find((l) => l.team === BAUNATAL)!;
    expect(line.points.flag).toBe('widersprüchlich');
  });

  it('fehlende Daten werden als fehlend erkannt', () => {
    const s = initialState();
    const ev = evaluateBlocks(s.teams[0], s.matches[0], s.preparations[REFERENCE_MATCH_ID]);
    expect(ev.find((e) => e.key === 'tabelle')!.status).toBe('fehlend');
    expect(ev.find((e) => e.key === 'begegnung')!.status).toBe('vorhanden');
  });
});

describe('Fragebogen und neue Begegnungen', () => {
  it('fehlende Gegnerbeobachtungen bleiben offen und erscheinen als offen im Dossier', async () => {
    const s = await loadedState();
    const prog = questionProgress(s.teams[0], s.matches[0], s.preparations[REFERENCE_MATCH_ID]);
    expect(prog.find((p) => p.id === 'q2_aufbau')!.status).toBe('offen');
    const d = buildDossier(s.teams[0], s.matches[0], s.preparations[REFERENCE_MATCH_ID]);
    const obs = d.slides.find((x) => x.key === 'soSpieltGegner') as Extract<typeof d.slides[number], { key: 'soSpieltGegner' }>;
    expect(obs.phases.every((p) => p.value.flag === 'offen')).toBe(true);
  });

  it('neue Begegnung übernimmt keine Antworten oder Botschaften des Beispielfalls', async () => {
    const s = await loadedState();
    insertExampleAnswers(s, REFERENCE_MATCH_ID);
    const m = createMatch(s.teams[0].id, {
      opponent: 'SV Grünau', competition: 'Gruppenliga Kassel 2', competitionType: 'liga', matchday: 15,
      date: '2026-10-30', kickoff: '15:00', isHome: false, venue: { name: 'Sportplatz Grünau' },
    });
    addMatch(s, m);
    const p = s.preparations[m.id];
    expect(p.answers).toEqual({});
    expect(p.playerHints).toEqual([]);
    expect(p.mission.motto).toBe('');
    expect(p.mission.messages.every((x) => !x.headline && !x.text)).toBe(true);
    expect(p.organisation.travelMinutes).toBeNull();
    // Kader wird aus letztem bestätigtem Kader übernommen
    expect(p.squad?.players.length).toBe(18);
    expect(() => insertExampleAnswers(s, m.id)).toThrow();
    const res = await demoProvider.fetch(s.teams[0], m);
    expect(Object.keys(res.blocks)).toHaveLength(0);
    // Auswärts ohne Fahrzeit: Treffpunkt offen
    const d = buildDossier(s.teams[0], m, p);
    const our = d.slides.find((x) => x.key === 'unserSpiel') as Extract<typeof d.slides[number], { key: 'unserSpiel' }>;
    expect(our.facts.find((f) => f.label === 'Treffpunkt')!.value.flag).toBe('offen');
  });

  it('Gegenspieler: Trainerhinweis zuerst, keine erzwungenen vier', () => {
    const sel = selectKeyPlayers(
      [{ id: 'a', name: 'A', evidence: [{ text: 'x', sourceId: 's' }], goals: 1 }, { id: 'b', name: 'B', evidence: [] }],
      [{ candidateId: null, name: 'Z', reason: 'schnell' }],
    );
    expect(sel.map((p) => p.name)).toEqual(['Z', 'A']);
  });

  it('regelbasierte Übernahme erfindet keine Inhalte', () => {
    const r = splitMessage('Zweite Bälle gehören uns – wir sind als Erste da');
    expect(r.headline).toBe('Zweite Bälle gehören uns');
    expect(r.text).toBe('Wir sind als Erste da.');
  });
});

describe('Bestätigung und Versionen', () => {
  it('blockiert Bestätigung ohne Botschaften, erlaubt Entwürfe', async () => {
    const s = await loadedState();
    const checks = confirmationChecks(s.teams[0], s.matches[0], s.preparations[REFERENCE_MATCH_ID]);
    expect(canConfirm(checks)).toBe(false);
    const d = ensureDraft(s, REFERENCE_MATCH_ID);
    expect(d.status).toBe('entwurf');
  });

  it('bestätigte Version bleibt bei späteren Änderungen unverändert', async () => {
    const s = await loadedState();
    insertExampleAnswers(s, REFERENCE_MATCH_ID);
    const draft = ensureDraft(s, REFERENCE_MATCH_ID);
    setOverride(s, draft.id, 'auftrag.footnote', 'Eigene Notiz');
    const checks = confirmationChecks(s.teams[0], s.matches[0], s.preparations[REFERENCE_MATCH_ID]);
    expect(canConfirm(checks)).toBe(true);
    const confirmed = confirmDossier(s, draft.id, []);
    const frozenJson = JSON.stringify(confirmed.frozen);
    // spätere Änderungen an Profil und Vorbereitung
    updatePrep(s, REFERENCE_MATCH_ID, (p) => { p.mission.motto = 'Neues Motto'; });
    s.teams[0].name = 'Umbenannt';
    expect(JSON.stringify(s.dossiers.find((x) => x.id === confirmed.id)!.frozen)).toBe(frozenJson);
    expect(() => setOverride(s, confirmed.id, 'auftrag.footnote', 'x')).toThrow();
    // neue Version startet als Entwurf mit V2
    const v2 = ensureDraft(s, REFERENCE_MATCH_ID);
    expect(v2.version).toBe(2);
    expect(s.teams[0].lastConfirmedSquad?.origin.kind).toBe('dossier');
  });

  it('Überschreibungen behalten Konfliktmarkierungen', async () => {
    const s = await loadedState();
    const d = buildDossier(s.teams[0], s.matches[0], s.preparations[REFERENCE_MATCH_ID]);
    const o = applyOverrides(d, { 'soSpieltGegner.phases.0.value.text': '4-4-2' });
    const obs = o.slides.find((x) => x.key === 'soSpieltGegner') as Extract<typeof d.slides[number], { key: 'soSpieltGegner' }>;
    expect(obs.phases[0].value).toEqual({ text: '4-4-2', flag: 'trainer' });
    expect(d.slides).toHaveLength(11);
  });
});
