import { matchProgress } from '../../domain/progress';
import { formatDate, formatTimestamp } from '../../domain/time';
import type { Match } from '../../domain/types';
import { href } from '../../router';
import { useStore } from '../../state/store';
import { Badge, Card, DemoBadge, Notice, ProgressBar } from '../components';

export function StartPage() {
  const { state, update } = useStore();
  const team = state.teams.find((t) => t.id === state.activeTeamId) ?? state.teams[0];
  if (!team) {
    return (
      <Card title="Willkommen">
        <p>Legen Sie zuerst eine Mannschaft an.</p>
        <a className="btn btn-primary" href={href({ name: 'neueMannschaft' })}>
          Mannschaft einrichten
        </a>
      </Card>
    );
  }
  const matches = state.matches
    .filter((m) => m.teamId === team.id)
    .sort((a, b) => Number(a.isHistoricalReference) - Number(b.isHistoricalReference) || (b.date ?? '').localeCompare(a.date ?? ''));
  const selectedId = state.selectedMatch?.[team.id] ?? matches[0]?.id;
  const selected = matches.find((m) => m.id === selectedId) ?? matches[0];
  const others = matches.filter((m) => m.id !== selected?.id);
  const archive = state.dossiers.filter((d) => d.teamId === team.id && d.status === 'bestätigt').sort((a, b) => (b.confirmedAt ?? '').localeCompare(a.confirmedAt ?? ''));

  const select = (m: Match) =>
    update((s) => {
      s.selectedMatch = { ...(s.selectedMatch ?? {}), [team.id]: m.id };
    });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Spieltagsübersicht</p>
          <h1>{team.name}</h1>
          <p className="muted">
            {[team.ageGroup, team.competition, team.season && `Saison ${team.season}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <a className="btn btn-primary" href={href({ name: 'neuesSpiel' })}>
          + Neue Begegnung
        </a>
      </div>

      {selected ? <MatchCard match={selected} featured /> : <Notice>Noch keine Begegnung angelegt.</Notice>}

      {others.length > 0 && (
        <Card title="Weitere Begegnungen">
          <ul className="match-list">
            {others.map((m) => (
              <li key={m.id}>
                <MatchRow match={m} onSelect={() => select(m)} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Archiv bisheriger Dossiers" actions={<a className="btn btn-ghost" href={href({ name: 'archiv' })}>Alle ansehen</a>}>
        {archive.length === 0 ? (
          <p className="muted">Noch keine bestätigten Dossiers. Bestätigte Versionen erscheinen hier und bleiben unverändert erhalten.</p>
        ) : (
          <ul className="archive-list">
            {archive.slice(0, 5).map((d) => (
              <li key={d.id}>
                <a href={href({ name: 'archivDossier', dossierId: d.id })} className="archive-item">
                  <span>
                    <strong>{d.frozen?.meta.matchLabel}</strong>
                    <small>
                      {d.frozen?.meta.competition} · {d.frozen?.meta.dateLabel}
                    </small>
                  </span>
                  <span className="archive-meta">
                    <Badge tone="ok">V{d.version} bestätigt</Badge>
                    <small>{formatTimestamp(d.confirmedAt)}</small>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function MatchRow({ match, onSelect }: { match: Match; onSelect: () => void }) {
  const { state } = useStore();
  const team = state.teams.find((t) => t.id === match.teamId)!;
  const p = matchProgress(team, match, state.preparations[match.id], state.dossiers);
  return (
    <div className="match-row">
      <button type="button" className="match-row-main" onClick={onSelect}>
        <strong>
          {match.isHome ? `${team.shortName} – ${match.opponent}` : `${match.opponent} – ${team.shortName}`}
        </strong>
        <small>
          {formatDate(match.date) || 'Datum offen'} · {match.kickoff ?? 'Uhrzeit offen'} · {match.isHome ? 'Heim' : 'Auswärts'}
        </small>
      </button>
      <div className="row gap wrap">
        {match.isHistoricalReference && <Badge tone="dark">Historische Referenz</Badge>}
        <Badge tone={p.stage === 'bestätigt' ? 'ok' : p.started ? 'info' : 'neutral'}>{p.stage}</Badge>
        <a className="btn btn-small" href={href({ name: 'spiel', matchId: match.id, tab: 'daten' })}>
          Öffnen
        </a>
      </div>
    </div>
  );
}

export function MatchCard({ match, featured = false }: { match: Match; featured?: boolean }) {
  const { state } = useStore();
  const team = state.teams.find((t) => t.id === match.teamId)!;
  const prep = state.preparations[match.id];
  const p = matchProgress(team, match, prep, state.dossiers);
  const home = match.isHome ? team.name : match.opponent;
  const away = match.isHome ? match.opponent : team.name;
  const lastDossier = p.draft ?? p.confirmed[0];
  const resumeTab = !prep.dataLoadedAt && !p.started ? 'daten' : p.draft ? 'dossier' : Object.keys(prep.answers).length ? 'fragebogen' : 'daten';

  return (
    <section className={`match-card ${featured ? 'is-featured' : ''}`} aria-label="Ausgewählte Begegnung">
      <div className="match-card-top">
        <div className="row gap wrap">
          <span className="eyebrow light">{featured ? 'Ausgewählte Begegnung' : 'Begegnung'}</span>
          {match.isHistoricalReference && (
            <Badge tone="lime">
              Historische Referenz · kein kommendes Spiel
            </Badge>
          )}
          {match.isDemo && <DemoBadge>Beispieldaten</DemoBadge>}
        </div>
        <h2 className="match-title">
          <span>{home}</span>
          <span className="vs">–</span>
          <span>{away}</span>
        </h2>
        <div className="match-meta">
          <span>
            {match.competition || 'Wettbewerb offen'}
            {match.matchday ? ` · ${match.matchday}. Spieltag` : ''}
          </span>
          <span>{match.date ? formatDate(match.date, { weekday: true }) : 'Datum offen'}</span>
          <span>{match.kickoff ? `${match.kickoff} Uhr` : 'Uhrzeit offen'}</span>
          <span>{match.isHome ? 'Heimspiel' : 'Auswärtsspiel'}</span>
        </div>
      </div>
      <div className="match-card-body">
        <div className="match-progress">
          <div className="stage">
            <span className="muted">Bearbeitungsstand</span>
            <strong>{p.stage}</strong>
          </div>
          <ProgressBar value={p.dataReady} total={p.dataTotal} label="Datenbasis vorhanden" />
          <ProgressBar value={p.questionsDone} total={p.questionsTotal} label="Fragebogen erledigt" />
        </div>
        <div className="match-open">
          <span className="muted">Offene Angaben</span>
          {p.openItems.length === 0 ? (
            <p>Keine offenen Angaben.</p>
          ) : (
            <ul className="open-list">
              {p.openItems.slice(0, 5).map((o) => (
                <li key={o}>{o}</li>
              ))}
              {p.openItems.length > 5 && <li className="muted">… und {p.openItems.length - 5} weitere</li>}
            </ul>
          )}
        </div>
      </div>
      <div className="match-actions">
        {!p.started ? (
          <a className="btn btn-primary" href={href({ name: 'spiel', matchId: match.id, tab: 'daten' })}>
            Vorbereitung starten
          </a>
        ) : (
          <a className="btn btn-primary" href={href({ name: 'spiel', matchId: match.id, tab: resumeTab })}>
            Fortsetzen
          </a>
        )}
        <a className="btn" href={href({ name: 'spiel', matchId: match.id, tab: 'dossier' })}>
          Dossier ansehen
        </a>
        {lastDossier && lastDossier.status === 'bestätigt' && (
          <a className="btn btn-ghost" href={href({ name: 'archivDossier', dossierId: lastDossier.id })}>
            Bestätigte Version V{lastDossier.version}
          </a>
        )}
      </div>
    </section>
  );
}
