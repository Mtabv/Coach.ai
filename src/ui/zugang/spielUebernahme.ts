import { useEffect } from 'react';
import { createMatch } from '../../domain/factory';
import type { CompetitionType } from '../../domain/types';
import { navigate } from '../../router';
import { addMatch } from '../../state/actions';
import { useStore } from '../../state/store';
import { updatePrep } from '../../state/actions';
import { now } from '../../domain/factory';
import { ausTeamzentrale, uebernehmen, zumAbschluss } from './vorbereitung';

/**
 * Öffnet die Teamzentrale „Dossier als PDF“, kommen die Spieldaten in der Adresse mit
 * (?dossier=1&gegner=…&datum=…). Dann wird das Spiel hier gesucht oder angelegt und direkt geöffnet.
 */
export function useSpielAusTeamzentrale() {
  const { state, update } = useStore();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const gegner = q.get('gegner'), datum = q.get('datum');
    if (!gegner || !datum) return;
    window.history.replaceState(null, '', '/?dossier=1' + window.location.hash);
    /** Einträge aus der Spielvorbereitung der Teamzentrale übernehmen (nur als Reiter dort). */
    const tz = ausTeamzentrale();
    const vorbereitungSetzen = (s: Parameters<Parameters<typeof update>[0]>[0], id: string, home: boolean) => {
      const t = s.teams.find((x) => x.id === team.id);
      if (tz && t && s.preparations[id]) updatePrep(s, id, (p) => uebernehmen(p, t, home, tz, now()));
    };
    // Eingebettet lädt das Dossier die Daten selbst; ohne Teamzentrale bleibt der erste Schritt „Daten“.
    const schritt = (_id: string) => zumAbschluss ? 'export' as const : tz ? 'dossier' as const : 'daten' as const;
    const team = state.teams.find((t) => t.id === state.activeTeamId) ?? state.teams[0];
    if (!team) return;
    const vorhanden = state.matches.find((m) => m.teamId === team.id && m.date === datum && m.opponent === gegner);
    const fahrzeit = parseInt(q.get('fahrzeit') ?? '', 10);
    /** Fahrzeit aus der Teamzentrale (OpenStreetMap), solange der Trainer keine eigene eingetragen hat. */
    const fahrzeitSetzen = (s: { preparations: Record<string, { organisation: { travelMinutes: number | null; travelSource: 'trainer' | 'verifiziert' | 'osm' | null } }> }, id: string) => {
      const org = s.preparations[id]?.organisation;
      if (!org || !(fahrzeit > 0) || (org.travelMinutes && org.travelSource !== 'osm')) return;
      org.travelMinutes = fahrzeit;
      org.travelSource = 'osm';
    };
    if (vorhanden) {
      update((s) => { s.selectedMatch = { ...(s.selectedMatch ?? {}), [team.id]: vorhanden.id }; fahrzeitSetzen(s, vorhanden.id); vorbereitungSetzen(s, vorhanden.id, vorhanden.isHome); });
      navigate({ name: 'spiel', matchId: vorhanden.id, tab: schritt(vorhanden.id) });
      return;
    }
    const art = q.get('art');
    const wettbewerb = q.get('wettbewerb') ?? '';
    const md = parseInt((/(\d+)\.\s*Spieltag/.exec(wettbewerb) || [])[1] ?? '', 10);
    const adresse = q.get('adresse') ?? '';
    // Die Teamzentrale liefert den Spielort von fussball.de oft als „Name, Straße, PLZ Ort“: Adresse abtrennen.
    let ort = q.get('ort');
    if (ort && adresse && ort.endsWith(adresse)) ort = ort.slice(0, -adresse.length).replace(/[,\s]+$/, '') || ort;
    const m = createMatch(team.id, {
      opponent: gegner,
      competition: wettbewerb.replace(/,?\s*\d+\.\s*Spieltag/, '').trim() || team.competition || '',
      competitionType: (art === 'pokal' || art === 'test' ? art : 'liga') as CompetitionType,
      matchday: Number.isFinite(md) ? md : null,
      date: datum,
      kickoff: q.get('anstoss') || null,
      isHome: q.get('heim') === '1',
      venue: ort ? { name: ort, address: adresse } : null,
    });
    update((s) => {
      addMatch(s, m);
      s.selectedMatch = { ...(s.selectedMatch ?? {}), [team.id]: m.id };
      if (!m.isHome) fahrzeitSetzen(s, m.id);
      vorbereitungSetzen(s, m.id, m.isHome);
    });
    navigate({ name: 'spiel', matchId: m.id, tab: schritt(m.id) });
    // nur einmal beim Öffnen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
