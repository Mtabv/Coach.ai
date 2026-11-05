import { now } from '../../domain/factory';
import type { Match, TeamProfile } from '../../domain/types';
import type { MatchDataProvider, ProviderFetchOptions, ProviderResult } from '../provider';
import { extractTeamId, fdApi, FdUnavailableError, type FdGame, type FdGameDetail, type FdLiga, type FdMatchday } from './api';
import { berlinDateTime, categoryOf, cleanName, competitionTypeOf, findOpponentInTable, mapToBlocks, pickClubTeam, seasonOf, seasonRange, teamNameFromGames, type FdBundle } from './mapping';

export function ownFussballDeTeamId(team: TeamProfile): string | null {
  return extractTeamId(team.links.find((l) => l.kind === 'fussball.de')?.url);
}

/** Wie viele frühere Saisons für direkte Duelle durchsucht werden. */
const HISTORY_SEASONS = 5;
/** Wie viele letzte Ligaspiele des Gegners für Aufstellungen ausgewertet werden. */
const LINEUP_GAMES = 5;

type Opp = { id: string; name: string; via: string };

/** Gegner ermitteln: Link in der Begegnung → Tabelle der eigenen Liga → Vereinssuche auf fussball.de. */
export async function resolveOpponent(match: Match, liga: FdLiga | null, ownId: string, f?: typeof fetch): Promise<Opp | null> {
  const linked = extractTeamId(match.opponentFussballDe);
  if (linked) return { id: linked, name: match.opponent, via: 'Link in der Begegnung' };
  const inTable = findOpponentInTable(liga, match.opponent, ownId);
  if (inTable) return { ...inTable, via: 'Tabelle der eigenen Liga' };
  const category = categoryOf(liga?.staffel_name ?? null);
  if (!category) return null;
  const query = cleanName(match.opponent).replace(/\s+(I{1,3}|IV|[2-9])$/i, '');
  let clubs = await fdApi.sucheVerein(query, f).catch(() => []);
  if (!clubs.length) {
    const longest = query.split(/\s+/).sort((a, b) => b.length - a.length)[0];
    if (longest && longest.length >= 4 && longest !== query) clubs = await fdApi.sucheVerein(longest, f).catch(() => []);
  }
  for (const club of clubs.slice(0, 3)) {
    const teams = await fdApi.vereinsTeams(club.id, f).catch(() => []);
    const hit = pickClubTeam(teams, match.opponent, category);
    if (hit) return { ...hit, via: 'Vereinssuche auf fussball.de' };
  }
  return null;
}

/** Sucht den Spieltag, an dem beide Mannschaften gegeneinander spielen (ab erwartetem Spieltag). */
export async function findMatchday(staffel: string, ownId: string, oppId: string, guesses: (number | null | undefined)[], f?: typeof fetch): Promise<FdMatchday | null> {
  const tried = new Set<number>();
  const order: number[] = [];
  // Abwechselnd um alle Vermutungen herum suchen (Trainerangabe, Spiele laut Tabelle + 1).
  for (const d of [0, 1, -1, 2, -2, 3]) for (const g of guesses) if (g && g > 0) order.push(g + d);
  for (const n of order) {
    if (n < 1 || n > 60 || tried.has(n)) continue;
    if (tried.size >= 8) break;
    tried.add(n);
    const md = await fdApi.spieltag(staffel, n, f);
    if (md.games.some((g) => [g.home_team_id, g.away_team_id].includes(ownId) && [g.home_team_id, g.away_team_id].includes(oppId))) return md;
  }
  return null;
}

/**
 * Datenanbieter über den lokal betriebenen fussball.de-Dienst (inoffiziell).
 * Läuft nur mit dem Vite-Entwicklungsserver, der Anfragen samt Schlüssel an den Dienst weiterleitet.
 * Abruf nur auf ausdrücklichen Klick – keine Hintergrundabfragen.
 */
export const fussballDeProvider: MatchDataProvider = {
  id: 'fussballde-inoffiziell',
  label: 'fussball.de (inoffiziell, über lokalen Dienst)',
  kind: 'live',
  actionLabel: 'Daten von fussball.de laden',

  supports(team: TeamProfile, match: Match) {
    return !match.isHistoricalReference && ownFussballDeTeamId(team) !== null;
  },

  async fetch(team: TeamProfile, match: Match, options: ProviderFetchOptions = {}): Promise<ProviderResult> {
    const f = options.fetchImpl;
    const progress = options.onProgress ?? (() => {});
    const ownId = ownFussballDeTeamId(team);
    if (!ownId) return { blocks: {}, messages: ['Kein fussball.de-Link der eigenen Mannschaft im Mannschaftsprofil.'] };
    const retrievedAt = now();
    const refDate = match.date ?? retrievedAt.slice(0, 10);
    const notes: string[] = [];
    try {
      progress('Tabelle, Torjäger und Heim-/Auswärtstabelle werden geladen …');
      const liga = await fdApi.liga(ownId, f).catch((e) => {
        if (e instanceof FdUnavailableError) throw e;
        notes.push(`Tabelle nicht abrufbar: ${(e as Error).message}`);
        return null;
      });

      progress('Gegner wird auf fussball.de gesucht …');
      const opp = await resolveOpponent(match, liga, ownId, f);

      progress('Spielpläne, Spieltag und frühere Saisons werden geladen …');
      const season = seasonRange(refDate);
      const ownRow = liga?.table.find((r) => r.team_id === ownId);
      const historyRanges = Array.from({ length: HISTORY_SEASONS }, (_, i) => seasonRange(refDate, i + 1));
      const [ownSeason, oppSeason, historyResults, matchday] = await Promise.all([
        fdApi.saison(ownId, season.von, season.bis, f),
        opp ? fdApi.saison(opp.id, season.von, season.bis, f).catch((e) => (notes.push(`Spielplan des Gegners nicht abrufbar: ${(e as Error).message}`), null)) : Promise.resolve(null),
        Promise.allSettled(historyRanges.map((r) => fdApi.saison(ownId, r.von, r.bis, f))),
        opp && liga?.staffel_id && match.competitionType === 'liga'
          ? findMatchday(liga.staffel_id, ownId, opp.id, [match.matchday, ownRow?.games != null ? ownRow.games + 1 : null], f).catch(() => null)
          : Promise.resolve(null),
      ]);
      const history: FdGame[] = [];
      const historySeasons: string[] = [];
      historyResults.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          history.push(...r.value);
          historySeasons.push(seasonOf(historyRanges[i].von));
        }
      });
      if (historySeasons.length < HISTORY_SEASONS) notes.push('Frühere Saisons nur teilweise abrufbar – direkte Duelle können unvollständig sein.');

      let lineups: FdGameDetail[] = [];
      if (opp && oppSeason) {
        progress('Aufstellungen und Torschützen der letzten Gegnerspiele werden geladen …');
        const oppName = cleanName(liga?.table.find((r) => r.team_id === opp.id)?.team ?? teamNameFromGames(oppSeason) ?? opp.name);
        const recent = oppSeason
          .filter((g) => competitionTypeOf(g.competition) === 'liga' && /^\d+$/.test(String(g.home_score ?? '')) && (berlinDateTime(g.datetime_utc)?.date ?? '') < refDate)
          .filter((g) => (g.home_team_id || g.away_team_id ? [g.home_team_id, g.away_team_id].includes(opp.id) : [g.home_team, g.away_team].some((n) => cleanName(n) === oppName)))
          .sort((a, b) => (a.datetime_utc < b.datetime_utc ? 1 : -1))
          .slice(0, LINEUP_GAMES);
        if (recent.length) {
          lineups = await fdApi.aufstellungen(recent.map((g) => g.id).filter((id) => /^[A-Za-z0-9]{16,48}$/.test(id)), f).catch((e) => (notes.push(`Aufstellungen nicht abrufbar: ${(e as Error).message}`), []));
          const order = new Map(recent.map((g, i) => [g.id, i]));
          lineups.sort((a, b) => (order.get(a.game_id) ?? 99) - (order.get(b.game_id) ?? 99));
        }
      }

      const bundle: FdBundle = { liga, ownId, opp, ownSeason, oppSeason, history, historySeasons, matchday, lineups, retrievedAt };
      const { blocks, messages } = mapToBlocks(team, match, bundle);
      return { blocks, messages: ['Daten von fussball.de geladen (inoffiziell ausgelesen). Bitte Datenstand und Zuordnung prüfen.', ...messages, ...notes] };
    } catch (e) {
      if (e instanceof FdUnavailableError) {
        return { blocks: {}, messages: [e.message, 'Anleitung: docs/fussballde-anbindung.md. Ohne den lokalen Dienst bleiben die Angaben offen.'] };
      }
      return { blocks: {}, messages: [`Abruf fehlgeschlagen: ${(e as Error).message}`] };
    }
  },
};
