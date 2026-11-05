import { formatDate } from '../../domain/time';
import { href, type Route } from '../../router';
import { useStore } from '../../state/store';
import { Badge, DemoBadge, Notice } from '../components';
import { DataTab } from '../match/DataTab';
import { DossierTab } from '../match/DossierTab';
import { ExportTab } from '../match/ExportTab';
import { QuestionnaireTab } from '../match/QuestionnaireTab';

const TABS: { tab: Extract<Route, { name: 'spiel' }>['tab']; label: string; short: string }[] = [
  { tab: 'daten', label: 'Datenbasis prüfen', short: 'Daten' },
  { tab: 'fragebogen', label: 'Trainerfragebogen', short: 'Fragebogen' },
  { tab: 'dossier', label: 'Dossier prüfen & bearbeiten', short: 'Dossier' },
  { tab: 'export', label: 'Bestätigen & exportieren', short: 'Export' },
];

export function MatchWorkspace({ matchId, tab }: { matchId: string; tab: Extract<Route, { name: 'spiel' }>['tab'] }) {
  const { state } = useStore();
  const match = state.matches.find((m) => m.id === matchId);
  if (!match) {
    return (
      <div className="page">
        <Notice tone="warn" title="Begegnung nicht gefunden">
          Diese Begegnung existiert nicht mehr. <a href={href({ name: 'start' })}>Zur Übersicht</a>
        </Notice>
      </div>
    );
  }
  const team = state.teams.find((t) => t.id === match.teamId)!;
  const home = match.isHome ? team.name : match.opponent;
  const away = match.isHome ? match.opponent : team.name;
  const idx = TABS.findIndex((t) => t.tab === tab);

  return (
    <div className="page">
      <div className="ws-head">
        <a className="back" href={href({ name: 'start' })}>
          ← Spieltagsübersicht
        </a>
        <div className="ws-title">
          <h1>
            {home} – {away}
          </h1>
          <div className="row gap wrap">
            {match.isHistoricalReference && <Badge tone="dark">Historische Referenz</Badge>}
            {match.isDemo && <DemoBadge />}
            <span className="muted">
              {match.competition}
              {match.matchday ? ` · ${match.matchday}. Spieltag` : ''} · {match.date ? formatDate(match.date, { weekday: true }) : 'Datum offen'} · {match.kickoff ? `${match.kickoff} Uhr` : 'Uhrzeit offen'} · {match.isHome ? 'Heim' : 'Auswärts'}
            </span>
          </div>
        </div>
      </div>
      <nav className="stepper" aria-label="Arbeitsschritte">
        {TABS.map((t, i) => (
          <a key={t.tab} href={href({ name: 'spiel', matchId, tab: t.tab })} className={`step ${t.tab === tab ? 'is-active' : ''} ${i < idx ? 'is-done' : ''}`} aria-current={t.tab === tab ? 'step' : undefined}>
            <span className="step-n">{i + 1}</span>
            <span className="step-l">
              <span className="long">{t.label}</span>
              <span className="short">{t.short}</span>
            </span>
          </a>
        ))}
      </nav>
      {tab === 'daten' && <DataTab match={match} team={team} />}
      {tab === 'fragebogen' && <QuestionnaireTab match={match} team={team} />}
      {tab === 'dossier' && <DossierTab match={match} team={team} />}
      {tab === 'export' && <ExportTab match={match} team={team} />}
      <div className="ws-next">
        {idx > 0 && (
          <a className="btn btn-ghost" href={href({ name: 'spiel', matchId, tab: TABS[idx - 1].tab })}>
            ← {TABS[idx - 1].short}
          </a>
        )}
        <span />
        {idx < TABS.length - 1 && (
          <a className="btn btn-primary" href={href({ name: 'spiel', matchId, tab: TABS[idx + 1].tab })}>
            Weiter: {TABS[idx + 1].label} →
          </a>
        )}
      </div>
    </div>
  );
}
