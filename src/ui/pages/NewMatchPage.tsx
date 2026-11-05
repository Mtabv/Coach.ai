import { useState } from 'react';
import { createMatch } from '../../domain/factory';
import { isValidDate, isValidTime } from '../../domain/time';
import type { CompetitionType } from '../../domain/types';
import { href, navigate } from '../../router';
import { addMatch } from '../../state/actions';
import { useStore } from '../../state/store';
import { Card, Notice, Segmented, TextInput } from '../components';

export function NewMatchPage() {
  const { state, update } = useStore();
  const team = state.teams.find((t) => t.id === state.activeTeamId) ?? state.teams[0];
  const [opponent, setOpponent] = useState('');
  const [competition, setCompetition] = useState(team?.competition ?? '');
  const [type, setType] = useState<CompetitionType>('liga');
  const [matchday, setMatchday] = useState('');
  const [date, setDate] = useState('');
  const [kickoff, setKickoff] = useState('');
  const [ha, setHa] = useState<'heim' | 'auswaerts'>('heim');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');

  if (!team) return null;
  const valid = opponent.trim().length > 0;

  const create = () => {
    const md = parseInt(matchday, 10);
    const m = createMatch(team.id, {
      opponent: opponent.trim(),
      competition: competition.trim(),
      competitionType: type,
      matchday: Number.isFinite(md) ? md : null,
      date: isValidDate(date) ? date : null,
      kickoff: isValidTime(kickoff) ? kickoff : null,
      isHome: ha === 'heim',
      venue: ha === 'heim' ? (venue.trim() ? { name: venue.trim(), address: address.trim() } : null) : venue.trim() ? { name: venue.trim(), address: address.trim() } : null,
    });
    update((s) => {
      addMatch(s, m);
      s.selectedMatch = { ...(s.selectedMatch ?? {}), [team.id]: m.id };
    });
    navigate({ name: 'spiel', matchId: m.id, tab: 'daten' });
  };

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <p className="eyebrow">Spiel anlegen</p>
          <h1>Neue Begegnung</h1>
          <p className="muted">{team.name}. Neue Begegnungen starten ohne Antworten oder Botschaften anderer Spiele. Der zuletzt bestätigte Kader wird übernommen.</p>
        </div>
      </div>
      <Card>
        <div className="form-grid">
          <TextInput label="Gegner" value={opponent} onChange={setOpponent} required />
          <TextInput label="Wettbewerb" value={competition} onChange={setCompetition} />
        </div>
        <div className="form-grid">
          <div className="field">
            <span className="field-label">Art des Spiels</span>
            <Segmented label="Art des Spiels" value={type} onChange={setType} options={[{ value: 'liga', label: 'Liga' }, { value: 'pokal', label: 'Pokal' }, { value: 'test', label: 'Test' }]} />
          </div>
          <div className="field">
            <span className="field-label">Heim oder auswärts</span>
            <Segmented label="Heim oder auswärts" value={ha} onChange={setHa} options={[{ value: 'heim', label: 'Heimspiel' }, { value: 'auswaerts', label: 'Auswärtsspiel' }]} />
          </div>
        </div>
        <div className="form-grid three">
          <TextInput label="Spieltag" value={matchday} onChange={setMatchday} inputMode="numeric" placeholder="z. B. 15" />
          <TextInput label="Datum" type="date" value={date} onChange={setDate} />
          <TextInput label="Anstoß" type="time" value={kickoff} onChange={setKickoff} />
        </div>
        <div className="form-grid">
          <TextInput label={ha === 'heim' ? 'Abweichender Spielort (leer = Heimspielort)' : 'Spielort'} value={venue} onChange={setVenue} placeholder={ha === 'heim' ? team.homeVenue.name : ''} />
          <TextInput label="Adresse" value={address} onChange={setAddress} />
        </div>
        {!date || !kickoff ? <Notice tone="warn">Datum und Anstoß können später ergänzt werden. Ohne sie bleibt der Zeitplan offen und das Dossier kann nicht bestätigt werden.</Notice> : null}
        <div className="row gap wrap">
          <button className="btn btn-primary" disabled={!valid} onClick={create}>
            Begegnung anlegen
          </button>
          <a className="btn btn-ghost" href={href({ name: 'start' })}>
            Abbrechen
          </a>
        </div>
      </Card>
    </div>
  );
}
