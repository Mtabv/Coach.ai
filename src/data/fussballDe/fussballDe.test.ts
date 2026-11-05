import { describe, expect, it } from 'vitest';
import { demoTeam } from '../seed';
import { createMatch, createPreparation } from '../../domain/factory';
import { analyzeTable, evaluateBlocks } from '../../domain/dataQuality';
import { lastLeagueGames } from '../../domain/stats';
import { buildDossier } from '../../dossier/build';
import type { Match } from '../../domain/types';
import { berlinDateTime, categoryOf, cleanName, competitionTypeOf, mapResults, nameSimilarity, pickClubTeam, sameTeam, seasonRange, teamMatcher } from './mapping';
import { extractTeamId } from './api';
import { fussballDeProvider } from './provider';
import { history, liga, lineups, matchday, OPP_ID, OWN_ID, oppSeason, ownSeason } from './__fixtures__/sample';

function setup(overrides: Partial<Parameters<typeof createMatch>[1]> = {}) {
  const team = demoTeam();
  team.links = [{ kind: 'fussball.de', url: `https://www.fussball.de/mannschaft/tsg/-/saison/2627/team-id/${OWN_ID}` }, { kind: 'FuPa', url: '' }];
  const match = createMatch(team.id, {
    opponent: 'GSV Eintracht Baunatal',
    competition: 'Gruppenliga Kassel 2',
    competitionType: 'liga',
    matchday: 14,
    date: '2026-10-23',
    kickoff: '19:00',
    isHome: true,
    venue: null,
    ...overrides,
  });
  return { team, match };
}

/** Nachgebauter lokaler Dienst: beantwortet die Pfade der Coach.AI-Erweiterung mit den Testdaten. */
function fakeService(log: string[] = []): typeof fetch {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  return (async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    const path = url.pathname.replace('/datenquelle/fussballde', '');
    log.push(path + url.search);
    if (path === `/api/coachai/team/${OWN_ID}/liga`) return json(liga);
    if (path === `/api/coachai/team/${OWN_ID}/saison`) {
      const von = url.searchParams.get('von');
      return json(von === '2026-07-01' ? ownSeason : von === '2024-07-01' ? history : []);
    }
    if (path === `/api/coachai/team/${OPP_ID}/saison`) return json(url.searchParams.get('von') === '2026-07-01' ? oppSeason : []);
    if (path === '/api/coachai/team/FREMD00000000000000000001/saison') return json([]);
    const md = /\/api\/coachai\/staffel\/[^/]+\/spieltag\/(\d+)/.exec(path);
    if (md) return json(Number(md[1]) === matchday.matchday ? matchday : { staffel_id: liga.staffel_id, matchday: Number(md[1]), games: [] });
    if (path === '/api/coachai/spiele/aufstellungen') {
      const ids = (url.searchParams.get('ids') ?? '').split(',');
      return json(lineups.filter((l) => ids.includes(l.game_id)));
    }
    if (path === '/api/search/clubs') return json([{ id: 'CLUB1', name: 'TSV Fremd' }]);
    if (path === '/api/club/CLUB1/teams')
      return json([
        { id: 'FREMDA00000000000000000001', name: 'A-Junioren - TSV Fremd' },
        { id: 'FREMD00000000000000000001', name: 'Herren - TSV Fremd' },
        { id: 'FREMD20000000000000000001', name: 'Herren - TSV Fremd II' },
      ]);
    return new Response('nicht gefunden', { status: 404 });
  }) as typeof fetch;
}

async function load(match: Match, team = setup().team) {
  const res = await fussballDeProvider.fetch(team, match, { fetchImpl: fakeService() });
  const prep = createPreparation(team, match);
  Object.assign(prep.dataBlocks, res.blocks);
  return { res, prep, team };
}

describe('fussball.de-Anbindung (inoffiziell)', () => {
  it('liest Team-IDs aus Links', () => {
    expect(extractTeamId('https://www.fussball.de/mannschaft/a/-/saison/2627/team-id/011MIC9NDS000000VTVG0001VTR8C1K7')).toBe('011MIC9NDS000000VTVG0001VTR8C1K7');
    expect(extractTeamId('https://www.fussball.de/verein/xyz')).toBeNull();
  });

  it('wandelt Zeit nach Europe/Berlin, erkennt Wettbewerbsart und Saison', () => {
    expect(berlinDateTime('2026-10-23T17:00:00Z')).toEqual({ date: '2026-10-23', time: '19:00' });
    expect(berlinDateTime('2026-11-06T18:00:00Z')).toEqual({ date: '2026-11-06', time: '19:00' });
    expect(competitionTypeOf('Kreispokal')).toBe('pokal');
    expect(competitionTypeOf('Kreisfreundschaftsspiele')).toBe('test');
    expect(competitionTypeOf('Gruppenliga')).toBe('liga');
    expect(seasonRange('2026-11-08')).toEqual({ von: '2026-07-01', bis: '2027-06-30' });
    expect(seasonRange('2027-03-01', 1)).toEqual({ von: '2025-07-01', bis: '2026-06-30' });
  });

  it('gleicht reale Schreibweisen ab und trennt erste von zweiten Mannschaften', () => {
    expect(cleanName('SG Hombressen/​Udenhausen')).toBe('SG Hombressen/Udenhausen');
    expect(cleanName('TSG Sandershausen II zg.')).toBe('TSG Sandershausen II');
    expect(sameTeam('GSV Eintr.Baunatal', 'GSV Eintracht Baunatal')).toBe(true);
    expect(sameTeam('SV Türkgücü KS', 'SV Türkgücü Kassel')).toBe(true);
    expect(sameTeam('TSG Sandershausen', 'TSG Wilhelmshöhe')).toBe(false);
    expect(sameTeam('TSG Sandershausen II zg.', 'TSG Sandershausen')).toBe(false);
    expect(nameSimilarity('TSV Fremd 2', 'TSV Fremd II')).toBe(1);
    expect(categoryOf('Gruppenliga - Region Kassel – Herren - 2026/2027')).toBe('Herren');
    expect(pickClubTeam([{ id: 'a', name: 'Herren - TSV Fremd II' }, { id: 'b', name: 'Herren - TSV Fremd' }], 'TSV Fremd', 'Herren')?.id).toBe('b');
  });

  it('zählt verlegte Spiele nicht doppelt und nicht als Ausfall', () => {
    const base = { id: 'SPIEL0000000000000001', competition: 'Gruppenliga', home_team: 'TSG Wilhelmshöhe', away_team: 'SV Kaufungen', home_team_id: OWN_ID, away_team_id: 'K' };
    const games = [
      { ...base, datetime_utc: '2026-09-01T17:00:00Z', home_score: null, away_score: null, status: '15.09.2026 19:00' },
      { ...base, datetime_utc: '2026-09-15T17:00:00Z', home_score: '2', away_score: '1' },
      { ...base, id: 'SPIEL0000000000000002', datetime_utc: '2026-09-20T13:00:00Z', home_score: null, away_score: null, status: 'Ausfall' },
    ];
    const { results, skipped } = mapResults(games, teamMatcher(OWN_ID, null), 'Wir', '2026-11-01');
    expect(results.map((r) => `${r.date} ${r.home} ${r.goalsHome}:${r.goalsAway}`)).toEqual(['2026-09-15 Wir 2:1']);
    expect(skipped).toBe(1);
  });

  it('lädt alle Datenblöcke und findet den Gegner ohne Link über die Tabelle', async () => {
    const { match } = setup();
    const { res, prep, team } = await load(match);
    const b = res.blocks;
    expect(res.messages.join(' ')).toMatch(/Gegner zugeordnet: „GSV Eintr\.Baunatal“ \(Tabelle der eigenen Liga\)/);

    // Ergebnisse der ganzen Saison, Namen kanonisch, verlegtes Spiel ausgelassen
    const own = b.ergebnisseEigene!.value!.results;
    expect(own).toHaveLength(5);
    expect(b.ergebnisseEigene!.provenance.note).toMatch(/\d Spiel\(e\) ohne gültiges Ergebnis/);
    expect(lastLeagueGames(team.name, own, match.date).map((r) => `${r.outcome} ${r.goalsFor}:${r.goalsAgainst}`)).toEqual(['N 0:4', 'N 0:3', 'S 3:1', 'U 2:2']);
    const opp = b.ergebnisseGegner!.value!.results;
    expect(lastLeagueGames(match.opponent, opp, match.date).map((r) => r.outcome)).toEqual(['N', 'S', 'S', 'S']);

    // Tabelle: Punktabzug nur dort errechnet, wo fussball.de auf Abzüge hinweist und die Bilanz es zeigt
    const rows = b.tabelle!.value!.snapshots[0].rows;
    expect(rows.find((r) => r.team === 'SV Kaufungen')?.pointDeduction).toBe(1);
    expect(rows.find((r) => r.team === team.name)?.pointDeduction).toBeNull();
    expect(rows.find((r) => r.team === match.opponent)?.rank).toBe(1);
    expect(b.tabelle!.provenance.note).toMatch(/SR-Pflichtsoll.*SV Kaufungen −1/);
    expect(analyzeTable(prep.dataBlocks.tabelle, match).conflicts.filter((c) => !c.resolution)).toHaveLength(0);

    // Spieltag gefunden (Trainerangabe 14 war falsch), Paarungen mit kanonischen Namen
    expect(b.spieltag!.value!.matchday).toBe(5);
    expect(b.spieltag!.value!.pairings[0]).toEqual({ home: team.name, away: match.opponent, date: '2026-10-23', kickoff: '19:00' });
    expect(b.begegnung!.value!.sourceFixture).toMatchObject({ date: '2026-10-23', kickoff: '19:00', matchday: 5, venue: expect.stringMatching(/Schulstr/) });
    const ev = evaluateBlocks(team, match, prep).find((e) => e.key === 'begegnung')!;
    expect(ev.status).toBe('widersprüchlich');
    expect(ev.issues.join(' ')).toMatch(/Spieltag laut fussball\.de.*5\..*14\./);

    // Direkte Duelle: laufende Saison + Vorsaison, zweite Mannschaft nicht mitgezählt
    const h2h = b.direkteDuelle!.value!.games;
    expect(h2h.map((g) => `${g.season} ${g.home}–${g.away} ${g.goalsHome}:${g.goalsAway}`)).toEqual([
      `2026/27 ${match.opponent}–${team.name} 3:0`,
      `2024/25 ${team.name}–${match.opponent} 1:1`,
    ]);

    // Gegenspieler: belegt durch Torjägerliste und Aufstellungen
    const cands = b.gegenspieler!.value!.candidates;
    const best = cands.find((c) => c.name === 'Hendrik Bestmann')!;
    expect(best.goals).toBe(5);
    expect(best.evidence.map((e) => e.text)).toEqual([
      '5 Saisontore in der Liga (Platz 1 der Torjägerliste)',
      '1 Tor in den letzten 2 Ligaspielen',
      'In der Startelf in 2 der letzten 2 Ligaspiele, davon 2× Kapitän',
    ]);
    expect(cands.find((c) => c.name === 'Tim Torwart')?.position).toBe('Torwart');
    expect(cands.some((c) => c.name === 'Max Muster')).toBe(false); // anderer Verein

    // Gegner-Fakten: Heimspiel → Auswärtstabelle des Gegners
    expect(b.gegnerFakten!.value!.facts.map((f) => f.text)).toEqual([
      'Auswärtstabelle: Platz 1 (1S 0U 1N, 3:2 Tore, 3 Punkte).',
      'Bester Torschütze: Hendrik Bestmann mit 5 Toren (Platz 1 der Liga).',
      'Trainer laut letztem Spielbericht: Andre Coach.',
    ]);

    // Dossier: Bilanz vollständig aus Ergebnissen, keine erfundenen Werte
    const d = buildDossier(team, match, prep);
    const form = d.slides.find((x) => x.key === 'gegnerForm') as Extract<(typeof d.slides)[number], { key: 'gegnerForm' }>;
    expect(form.records[0].label).toBe('Saisonbilanz (Liga)');
    expect(form.records[0].value.text).toMatch(/3S 0U 1N/);
    expect(form.facts.map((f) => f.text)).toContain('Trainer laut letztem Spielbericht: Andre Coach.');
  });

  it('meldet abweichenden Anstoß und bietet Übernahme an', async () => {
    const { match } = setup({ kickoff: '18:30', matchday: 5 });
    const { prep, team } = await load(match);
    const ev = evaluateBlocks(team, match, prep).find((e) => e.key === 'begegnung')!;
    expect(ev.status).toBe('widersprüchlich');
    expect(ev.issues.join(' ')).toMatch(/Anstoß laut fussball\.de.*19:00.*18:30/);
  });

  it('findet Gegner außerhalb der Liga über die Vereinssuche (erste Mannschaft)', async () => {
    const { match } = setup({ opponent: 'TSV Fremd', competitionType: 'pokal', matchday: null });
    const { res } = await load(match);
    expect(res.messages.join(' ')).toMatch(/Gegner zugeordnet: „TSV Fremd“ \(Vereinssuche auf fussball\.de\)/);
  });

  it('nutzt einen hinterlegten Gegner-Link vor der automatischen Suche', async () => {
    const { match } = setup({ opponent: 'Irgendwer', opponentFussballDe: `https://www.fussball.de/mannschaft/x/-/team-id/${OPP_ID}` });
    const { res } = await load(match);
    expect(res.messages.join(' ')).toMatch(/Link in der Begegnung/);
    expect(res.blocks.ergebnisseGegner?.value?.results.length).toBe(5);
  });

  it('meldet einen nicht laufenden lokalen Dienst verständlich', async () => {
    const { team, match } = setup();
    const failing = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const res = await fussballDeProvider.fetch(team, match, { fetchImpl: failing });
    expect(res.blocks).toEqual({});
    expect(res.messages[0]).toMatch(/nicht erreichbar/);
  });

  it('nutzt den Anbieter nicht für den historischen Referenzfall', () => {
    const { team, match } = setup();
    expect(fussballDeProvider.supports(team, match)).toBe(true);
    expect(fussballDeProvider.supports(team, { ...match, isHistoricalReference: true })).toBe(false);
  });
});
