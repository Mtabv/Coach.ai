import { formatDate } from '../../domain/time';
import { href, type Route } from '../../router';
import { useStore } from '../../state/store';
import { Badge, DemoBadge, Notice } from '../components';
import { DataTab } from '../match/DataTab';
import { DossierTab } from '../match/DossierTab';
import { ExportTab } from '../match/ExportTab';
import { QuestionnaireTab } from '../match/QuestionnaireTab';
import { eingebettet } from '../zugang/vorbereitung';
import { useDatenImRahmen } from '../zugang/datenLaden';
import type { Match, TeamProfile } from '../../domain/types';

/** Eingebettet: Daten laden selbst und zeigt, ob gerade geladen wird. */
function DatenImRahmen({ match, team }: { match: Match; team: TeamProfile }) {
  const { laeuft, fortschritt, fehler } = useDatenImRahmen(match, team);
  if (laeuft) return <Notice tone="info" title="Daten von fussball.de und FuPa werden geladen …">{fortschritt ?? 'Das dauert etwa eine halbe Minute.'}</Notice>;
  if (fehler) return <Notice tone="warn" title="Daten konnten nicht geladen werden">{fehler} – im Schritt „Daten“ erneut versuchen.</Notice>;
  return null;
}

const TABS: { tab: Extract<Route, { name: 'spiel' }>['tab']; label: string; short: string }[] = [
  { tab: 'daten', label: 'Datenbasis prüfen', short: 'Daten' },
  { tab: 'fragebogen', label: 'Trainerfragebogen', short: 'Fragebogen' },
  { tab: 'dossier', label: 'Dossier prüfen & bearbeiten', short: 'Dossier' },
  { tab: 'export', label: 'Bestätigen & exportieren', short: 'Export' },
];

/** Als Reiter in der Teamzentrale: Die Fragen beantwortet der Trainer dort in der Gegnervorbereitung. */
const TABS_EINGEBETTET: typeof TABS = [
  { tab: 'daten', label: 'Daten von fussball.de laden', short: 'Daten' },
  { tab: 'dossier', label: 'Folien ansehen und anpassen', short: 'Folien' },
  { tab: 'export', label: 'Abschließen und exportieren', short: 'Abschluss' },
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
  const tabs = eingebettet ? TABS_EINGEBETTET : TABS;
  const idx = tabs.findIndex((t) => t.tab === tab);

  return (
    <div className="page">
      {!eingebettet && <div className="ws-head">
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
      </div>}
      {eingebettet && <DatenImRahmen match={match} team={team} />}
      <nav className="stepper" aria-label="Arbeitsschritte">
        {tabs.map((t, i) => (
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
      {tab === 'fragebogen' && !eingebettet && <QuestionnaireTab match={match} team={team} />}
      {tab === 'dossier' && <DossierTab match={match} team={team} />}
      {tab === 'export' && <ExportTab match={match} team={team} />}
      <div className="ws-next">
        {idx > 0 && (
          <a className="btn btn-ghost" href={href({ name: 'spiel', matchId, tab: tabs[idx - 1].tab })}>
            ← {tabs[idx - 1].short}
          </a>
        )}
        <span />
        {idx < tabs.length - 1 && (
          <a className="btn btn-primary" href={href({ name: 'spiel', matchId, tab: tabs[idx + 1].tab })}>
            Weiter: {tabs[idx + 1].label} →
          </a>
        )}
      </div>
    </div>
  );
}
