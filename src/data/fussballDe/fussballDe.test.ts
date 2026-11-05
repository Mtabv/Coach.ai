import { describe, expect, it } from 'vitest';
import { demoTeam } from '../seed';
import { createMatch } from '../../domain/factory';
import { createPreparation } from '../../domain/factory';
import { analyzeTable, evaluateBlocks } from '../../domain/dataQuality';
import { lastLeagueGames } from '../../domain/stats';
import { buildDossier } from '../../dossier/build';
import { berlinDateTime, cleanName, competitionTypeOf, mapTable, mapToBlocks, nameSimilarity, sameTeam } from './mapping';
import { extractTeamId } from './api';
import { fussballDeProvider } from './provider';
import { ownNext, ownPrev, oppPrev, table } from './__fixtures__/sample';

function setup(opponentLink = 'https://www.fussball.de/mannschaft/x/-/saison/2627/team-id/011MIEXAMPLEOPP0000000VS54898DL') {
  const team = demoTeam();
  team.links = [{ kind: 'fussball.de', url: 'https://www.fussball.de/mannschaft/tsg/-/saison/2627/team-id/011MIEXAMPLEOWN0000000VS54898DL' }, { kind: 'FuPa', url: '' }];
  const match = createMatch(team.id, {
    opponent: 'GSV Eintracht Baunatal', competition: 'Gruppenliga Kassel 2', competitionType: 'liga', matchday: 14,
    date: '2026-10-23', kickoff: '19:00', isHome: true, venue: null, opponentFussballDe: opponentLink,
  });
  return { team, match };
}

describe('fussball.de-Anbindung (inoffiziell)', () => {
  it('liest Team-IDs aus Links', () => {
    expect(extractTeamId('https://www.fussball.de/mannschaft/a/-/saison/2627/team-id/011MIC9NDS000000VTVG0001VTR8C1K7')).toBe('011MIC9NDS000000VTVG0001VTR8C1K7');
    expect(extractTeamId('https://www.fussball.de/verein/xyz')).toBeNull();
  });

  it('wandelt Zeit nach Europe/Berlin und erkennt Wettbewerbsart', () => {
    expect(berlinDateTime('2026-10-23T17:00:00Z')).toEqual({ date: '2026-10-23', time: '19:00' });
    expect(berlinDateTime('2026-11-06T18:00:00Z')).toEqual({ date: '2026-11-06', time: '19:00' });
    expect(competitionTypeOf('Kreispokal')).toBe('pokal');
    expect(competitionTypeOf('Freundschaftsspiel')).toBe('test');
    expect(competitionTypeOf('Gruppenliga')).toBe('liga');
    expect(nameSimilarity('GSV Eintr. Baunatal', 'GSV Eintracht Baunatal')).toBeGreaterThanOrEqual(0.5);
  });

  it('gleicht reale fussball.de-Schreibweisen ab (Abkürzungen, unsichtbare Zeichen)', () => {
    expect(cleanName('SG Hombressen/\u200bUdenhausen')).toBe('SG Hombressen/Udenhausen');
    expect(sameTeam('GSV Eintr.Baunatal', 'GSV Eintracht Baunatal')).toBe(true);
    expect(sameTeam('SV Türkgücü KS', 'SV Türkgücü Kassel')).toBe(true);
    expect(sameTeam('TSG Sandershausen', 'TSG Wilhelmshöhe')).toBe(false);
    expect(sameTeam('TSV Wolfsanger', 'TSV Rothwesten')).toBe(false);
    const row = (place: number, team: string) => ({ place, team, games: 1, won: 1, draw: 0, lost: 0, goal: '1 : 0', goal_difference: 1, points: 3 });
    const rows = mapTable({ entries: [row(1, 'TSG Sandershausen'), row(2, 'GSV Eintr.Baunatal'), row(3, 'TSG Wilhelmshöhe')] }, [
      { from: null, to: 'TSG Wilhelmshöhe', fallbackMatch: 'TSG Wilhelmshöhe' },
      { from: null, to: 'GSV Eintracht Baunatal', fallbackMatch: 'GSV Eintracht Baunatal' },
    ]);
    expect(rows.map((r) => r.team)).toEqual(['TSG Sandershausen', 'GSV Eintracht Baunatal', 'TSG Wilhelmshöhe']);
  });

  it('erzeugt Datenblöcke ohne erfundene Werte', () => {
    const { team, match } = setup();
    const { blocks } = mapToBlocks(team, match, { ownTable: table, ownPrev, ownNext, oppPrev, retrievedAt: '2026-10-21T10:00:00Z' });
    // Ergebnisse auf kanonische Namen umgestellt, Spiel ohne Ergebnis ausgelassen
    const own = blocks.ergebnisseEigene!.value!.results;
    expect(own).toHaveLength(7);
    const l5 = lastLeagueGames(team.name, own, match.date);
    expect(l5.map((r) => `${r.outcome} ${r.goalsFor}:${r.goalsAgainst}`)).toEqual(['N 3:6', 'N 0:3', 'S 2:1', 'N 1:6', 'N 0:8']);
    const opp = blocks.ergebnisseGegner!.value!.results;
    expect(lastLeagueGames(match.opponent, opp, match.date).map((r) => r.outcome)).toEqual(['S', 'N', 'S', 'U']);
    // Tabelle: Namen zugeordnet, kein Punktabzug erfunden
    const rows = blocks.tabelle!.value!.snapshots[0].rows;
    expect(rows.find((r) => r.team === team.name)?.points).toBe(10);
    expect(rows.find((r) => r.team === match.opponent)?.points).toBe(33);
    expect(rows.every((r) => r.pointDeduction === null)).toBe(true);
    expect(blocks.tabelle!.value!.snapshots[0].source.asOfRank).toBe(13);
    // Direkte Duelle aus beiden Listen, ohne Dubletten
    expect(blocks.direkteDuelle!.value!.games).toHaveLength(1);
    expect(blocks.direkteDuelle!.value!.games[0].season).toBe('2025/26');
    // Ansetzung stimmt überein
    expect(blocks.begegnung!.value!.confirmedFromSource).toBe(true);
    expect(blocks.begegnung!.value!.sourceFixture?.venue).toMatch(/Schulstraße/);
    // Keine Spieltagspaarungen oder Gegenspieler erfunden
    expect(blocks.spieltag).toBeUndefined();
    expect(blocks.gegenspieler).toBeUndefined();
  });

  it('markiert abweichende Ansetzung als widersprüchlich', () => {
    const { team, match } = setup();
    match.kickoff = '18:30';
    const prep = createPreparation(team, match);
    const { blocks } = mapToBlocks(team, match, { ownTable: table, ownPrev, ownNext, oppPrev, retrievedAt: 'x' });
    Object.assign(prep.dataBlocks, blocks);
    const ev = evaluateBlocks(team, match, prep).find((e) => e.key === 'begegnung')!;
    expect(ev.status).toBe('widersprüchlich');
    expect(ev.issues.join(' ')).toMatch(/Anstoß laut fussball\.de.*19:00.*18:30/);
    expect(analyzeTable(prep.dataBlocks.tabelle, match).conflicts.filter((c) => !c.resolution)).toHaveLength(0);
  });

  it('unvollständige Ergebnisliste: Saisonbilanz laut Tabelle, Heim/Auswärts offen', () => {
    const { team, match } = setup();
    const prep = createPreparation(team, match);
    Object.assign(prep.dataBlocks, mapToBlocks(team, match, { ownTable: table, ownPrev, ownNext, oppPrev, retrievedAt: 'x' }).blocks);
    const d = buildDossier(team, match, prep);
    const form = d.slides.find((x) => x.key === 'gegnerForm') as Extract<typeof d.slides[number], { key: 'gegnerForm' }>;
    expect(form.records[0]).toEqual({ label: 'Saisonbilanz (Liga, laut Tabelle)', value: { text: '11S 0U 2N · 42:16 Tore', flag: 'ok' } });
    expect(form.records[1].value.flag).toBe('offen');
    const facts = form.facts.map((f) => f.text).join(' | ');
    expect(facts).not.toMatch(/in dieser Saison ohne Niederlage/);
    expect(facts).not.toMatch(/Seit 4 Ligaspielen/);
    const ev = evaluateBlocks(team, match, prep).find((e) => e.key === 'ergebnisseGegner')!;
    expect(ev.issues.join(' ')).toMatch(/unvollständig: 4 von 13/);
  });

  it('ohne Gegner-Link bleiben Gegnerdaten fehlend', () => {
    const { team, match } = setup('');
    const { blocks, messages } = mapToBlocks(team, match, { ownTable: table, ownPrev, ownNext, oppPrev: null, retrievedAt: 'x' });
    expect(blocks.ergebnisseGegner).toBeUndefined();
    expect(messages.join(' ')).toMatch(/Kein fussball\.de-Link des Gegners/);
  });

  it('meldet einen nicht laufenden lokalen Dienst verständlich', async () => {
    const { team, match } = setup();
    const failing = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const res = await fussballDeProvider.fetch(team, match, failing);
    expect(res.blocks).toEqual({});
    expect(res.messages[0]).toMatch(/nicht erreichbar/);
  });

  it('nutzt den Anbieter nicht für den historischen Referenzfall', () => {
    const { team, match } = setup();
    expect(fussballDeProvider.supports(team, match)).toBe(true);
    expect(fussballDeProvider.supports(team, { ...match, isHistoricalReference: true })).toBe(false);
  });
});
