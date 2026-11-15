import { describe, expect, it } from 'vitest';
import { fupaCrests } from './mapping';
import type { TableRow } from '../../domain/types';

/** Gruppenliga Kassel 2, Stand Mitte November: FuPa ist einen Spieltag weiter als fussball.de, die Plätze weichen ab. */
const FD = ['TSG Sandershausen', 'GSV Eintr.Baunatal', 'FC Bosporus KS', 'SG Schauenburg', 'SV Kaufungen', 'FSC Lohfelden', 'SG Reinhardshagen', 'SG Hombressen/Udenhausen', 'TSV Hertingshausen', 'Tuspo Nieste', 'SV Türkgücü KS', 'FC Großalmerode', 'TSV Wolfsanger', 'SG Wettes/Breuna/Oberli', 'TSV Rothwesten', 'TSG Wilhelmshöhe'];
const FUPA = ['TSG Sandershausen', 'Eintracht Baunatal', 'SG Schauenburg', 'FSC 1924 Lohfelden', 'FC Bosporus Kassel', 'SV Kaufungen 07', 'SG Reinhardshagen', 'TSV Hertingshausen', 'SG Hombressen/Udenhausen', 'TSV Wolfsanger', 'Tuspo Nieste ', 'SV Türkgücü Kassel', 'FC Großalmerode', 'TSV Rothwesten', 'SG Wettesingen/Breuna/Oberlistingen', 'TSG Wilhelmshöhe'];

describe('Wappen von FuPa', () => {
  it('ordnet über den Namen zu, nicht über den Tabellenplatz', () => {
    const rows = FD.map((team, i) => ({ rank: i + 1, team, played: 16, won: i, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, pointDeduction: null }) as TableRow);
    const table = { rows: FUPA.map((team, i) => ({ rank: i + 1, team_slug: null, team, team_image: `bild:${team.trim()}`, matches: 17, wins: 17 - i, draws: 0, defeats: 0, goals_for: 0, goals_against: 0, points: 0, penalty_points: 0 })) };
    const c = fupaCrests(table as never, rows, new Map());
    expect(c['TSV Wolfsanger']).toBe('bild:TSV Wolfsanger');
    expect(c['Tuspo Nieste']).toBe('bild:Tuspo Nieste');
    expect(c['GSV Eintr.Baunatal']).toBe('bild:Eintracht Baunatal');
    expect(c['FC Bosporus KS']).toBe('bild:FC Bosporus Kassel');
    expect(c['FSC Lohfelden']).toBe('bild:FSC 1924 Lohfelden');
    expect(c['SV Kaufungen']).toBe('bild:SV Kaufungen 07');
    expect(c['SG Wettes/Breuna/Oberli']).toBe('bild:SG Wettesingen/Breuna/Oberlistingen');
    expect(c['SV Türkgücü KS']).toBe('bild:SV Türkgücü Kassel');
    expect(Object.keys(c).filter((k) => FD.includes(k)).length).toBe(16);
  });
});
