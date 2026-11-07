import { useEffect, useMemo, useState } from 'react';
import { loadSeasonData } from '../../analytics/fetch';
import { buildSeasonReport } from '../../analytics/report';
import type { SeasonData } from '../../analytics/types';
import { FdUnavailableError } from '../../data/fussballDe/api';
import { berlinDateTime } from '../../data/fussballDe/mapping';
import { ownFussballDeTeamId } from '../../data/fussballDe/provider';
import { formatTimestamp } from '../../domain/time';
import type { TeamProfile } from '../../domain/types';
import { isEmbeddedHost } from '../../export/hostBridge';
import { href } from '../../router';
import { useStore } from '../../state/store';
import { Card, Notice } from '../components';
import { ScaledSeasonSlide, SEASON_SLIDE_TITLES } from '../analytics/SeasonSlides';

const today = () => berlinDateTime(new Date().toISOString())!.date;

function useSeason(): { team: TeamProfile | undefined; data: SeasonData | undefined } {
  const { state } = useStore();
  const team = state.teams.find((t) => t.id === state.activeTeamId) ?? state.teams[0];
  return { team, data: team ? state.analytics?.[team.id] : undefined };
}

export function AnalyticsPage() {
  const { update } = useStore();
  const { team, data } = useSeason();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const report = useMemo(() => (data ? buildSeasonReport(data) : null), [data]);

  if (!team) return <div className="page"><Notice>Bitte zuerst eine Mannschaft anlegen.</Notice></div>;
  const hasLink = Boolean(ownFussballDeTeamId(team));

  const load = async () => {
    setError(null);
    setBusy('Verbindung zum Datendienst …');
    try {
      const d = await loadSeasonData(team, today(), setBusy);
      update((s) => {
        s.analytics = { ...(s.analytics ?? {}), [team.id]: d };
      });
      setIdx(0);
    } catch (e) {
      setError(e instanceof FdUnavailableError ? `${e.message} Der bisher geladene Stand bleibt erhalten.` : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const ctx = report && data ? { data, r: report, teamName: team.name, shortName: team.shortName || team.name, competition: team.competition || data.competition || '' } : null;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1>Saison-Zwischenreport</h1>
          <p className="muted">Auswertung aller bisherigen Ligaspiele von {team.name}: Tabelle, Torminuten, Halbzeitstände, Gegnerstärke, Torschützen und Startelf. Nur gezählte Werte aus fussball.de, Fotos von FuPa.</p>
        </div>
      </div>

      <Card
        title="Datenstand"
        actions={
          <div className="row gap">
            <button type="button" className="btn btn-primary" onClick={load} disabled={Boolean(busy) || !hasLink}>
              {data ? 'Aktualisieren' : 'Saisondaten laden'}
            </button>
            {data && (
              <a className="btn" href={href({ name: 'analyticsDruck' })} target={isEmbeddedHost() ? undefined : '_blank'} rel="noreferrer">
                Druckansicht / PDF
              </a>
            )}
          </div>
        }
      >
        {!hasLink && <Notice tone="warn">Im Mannschaftsprofil fehlt der Link zur Mannschaftsseite auf fussball.de.</Notice>}
        {busy && <p className="muted" role="status">{busy}</p>}
        {error && <Notice tone="danger">{error}</Notice>}
        {data && report ? (
          <p className="muted small">
            Stand {formatTimestamp(data.fetchedAt)} · {report.n} Ligaspiele{report.n ? ` bis ${report.games[report.n - 1].date.split('-').reverse().join('.')}` : ''} · {report.withGoals} mit vollständigen Torminuten, {report.withLineup} mit Aufstellung · {data.sources.join(' · ')}
          </p>
        ) : (
          !busy && <p className="muted">Noch nicht geladen. Für den Ligavergleich werden alle Spielberichte der Liga gelesen: beim ersten Mal einige Minuten, danach deutlich schneller. Das Ergebnis wird im Browser gespeichert.</p>
        )}
      </Card>

      {ctx && (
        <>
          <nav className="slide-tabs" aria-label="Seiten des Saisonreports">
            {SEASON_SLIDE_TITLES.map((t, i) => (
              <button key={t} className={`slide-tab ${i === idx ? 'is-active' : ''}`} onClick={() => setIdx(i)} aria-current={i === idx ? 'page' : undefined}>
                <span className="num">{i + 1}</span>
                <span className="slide-tab-l">{t}</span>
              </button>
            ))}
          </nav>
          <div className="an-preview">
            <ScaledSeasonSlide index={idx} ctx={ctx} />
          </div>
        </>
      )}
    </div>
  );
}

/** Druckansicht des Saisonreports (16:9), „Als PDF speichern“ im Druckdialog. */
export function AnalyticsPrintPage() {
  const { team, data } = useSeason();
  const report = useMemo(() => (data ? buildSeasonReport(data) : null), [data]);
  useEffect(() => {
    document.body.classList.add('print-mode');
    return () => document.body.classList.remove('print-mode');
  }, []);
  if (!team || !data || !report) return <p style={{ padding: 24 }}>Noch kein Saisonreport geladen.</p>;
  const ctx = { data, r: report, teamName: team.name, shortName: team.shortName || team.name, competition: team.competition || data.competition || '' };
  return (
    <div className="print-root">
      <div className="print-toolbar no-print">
        <div>
          <strong>Druckansicht</strong> · Saison-Zwischenreport {team.name}
          <div className="small">
            {isEmbeddedHost() ? 'In dieser eingebetteten Vorschau ist der Druckdialog gesperrt.' : 'Im Druckdialog „Als PDF speichern“ wählen, Querformat und Ränder „Keine“. Hintergrundgrafiken aktivieren.'}
          </div>
        </div>
        <div className="row gap">
          <button className="btn btn-primary" disabled={isEmbeddedHost()} onClick={() => window.print()}>
            Als PDF speichern / Drucken
          </button>
          <a className="btn" href={href({ name: 'analytics' })}>
            Zurück
          </a>
        </div>
      </div>
      {SEASON_SLIDE_TITLES.map((t, i) => (
        <div key={t} className="print-page">
          <ScaledSeasonSlide index={i} ctx={ctx} fixed />
        </div>
      ))}
    </div>
  );
}
