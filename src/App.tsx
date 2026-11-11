import { href, useRoute } from './router';
import { useStore } from './state/store';
import { KontoMenue, Zugang, type Sitzung } from './ui/zugang/Zugang';
import { useSpielAusTeamzentrale } from './ui/zugang/spielUebernahme';
import { ConfirmAction } from './ui/components';
import { AnalyticsPage, AnalyticsPrintPage } from './ui/pages/AnalyticsPage';
import { ArchiveDossierPage, ArchivePage } from './ui/pages/ArchivePage';
import { MatchWorkspace } from './ui/pages/MatchWorkspace';
import { NewMatchPage } from './ui/pages/NewMatchPage';
import { PrintPage } from './ui/pages/PrintPage';
import { StartPage } from './ui/pages/StartPage';
import { NewTeamPage, TeamPage } from './ui/pages/TeamPage';

export default function App() {
  return (
    <Zugang>{(sitzung) => <Shell sitzung={sitzung} />}</Zugang>
  );
}

function Shell({ sitzung }: { sitzung: Sitzung | null }) {
  const route = useRoute();
  const { state, update, saveStatus, resetAll } = useStore();
  useSpielAusTeamzentrale();
  if (route.name === 'druck') return <PrintPage dossierId={route.dossierId} />;
  if (route.name === 'analyticsDruck') return <AnalyticsPrintPage />;

  const team = state.teams.find((t) => t.id === state.activeTeamId) ?? state.teams[0];
  const section = route.name === 'mannschaft' || route.name === 'neueMannschaft' ? 'mannschaft' : route.name === 'archiv' || route.name === 'archivDossier' ? 'archiv' : route.name === 'analytics' ? 'analytics' : 'start';

  return (
    <div className="app">
      {!sitzung && (
        <div className="preview-banner" role="note">
          Vorschau · lokale Speicherung im Browser · Beispieldaten sind gekennzeichnet · keine Online-Recherche
        </div>
      )}
      <header className="topbar">
        <a className="brand" href={href({ name: 'start' })} aria-label="11Plan Startseite">
          <span className="brand-mark" aria-hidden>
            <svg viewBox="0 0 32 32" width="28" height="28">
              <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
              <circle cx="16" cy="16" r="2.5" fill="currentColor" />
            </svg>
          </span>
          <span>
            11<span className="brand-dot">Plan</span>
          </span>
        </a>
        <nav className="mainnav" aria-label="Hauptnavigation">
          <a href={href({ name: 'start' })} className={section === 'start' ? 'is-active' : ''}>
            Spieltag
          </a>
          <a href={href({ name: 'mannschaft' })} className={section === 'mannschaft' ? 'is-active' : ''}>
            Mannschaft
          </a>
          <a href={href({ name: 'analytics' })} className={section === 'analytics' ? 'is-active' : ''}>
            Analytics
          </a>
          <a href={href({ name: 'archiv' })} className={section === 'archiv' ? 'is-active' : ''}>
            Archiv
          </a>
        </nav>
        <div className="topbar-right">
          {state.teams.length > 0 && (
            <select
              className="team-select"
              aria-label="Mannschaft wählen"
              value={team?.id}
              onChange={(e) =>
                update((s) => {
                  s.activeTeamId = e.target.value;
                })
              }
            >
              {state.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <span className={`save-dot ${saveStatus}`} title={saveStatus === 'gespeichert' ? (sitzung ? 'Auf dem Server gespeichert' : 'Lokal gespeichert') : saveStatus === 'speichert' ? 'Speichert …' : 'Speichern fehlgeschlagen'} aria-label={`Speicherstatus: ${saveStatus}`} />
          {sitzung && <KontoMenue sitzung={sitzung} />}
        </div>
      </header>
      <main className="main">
        {route.name === 'start' && <StartPage />}
        {route.name === 'mannschaft' && <TeamPage />}
        {route.name === 'neueMannschaft' && <NewTeamPage />}
        {route.name === 'neuesSpiel' && <NewMatchPage />}
        {route.name === 'spiel' && <MatchWorkspace key={route.matchId} matchId={route.matchId} tab={route.tab} />}
        {route.name === 'analytics' && <AnalyticsPage />}
        {route.name === 'archiv' && <ArchivePage />}
        {route.name === 'archivDossier' && <ArchiveDossierPage dossierId={route.dossierId} />}
      </main>
      <footer className="footer">
        <span>{sitzung ? '11Plan · Trainerteam · gemeinsamer Stand auf dem eigenen Server' : '11Plan · Vorschau 0.1 · Daten bleiben in diesem Browser'}</span>
        {!sitzung && <ConfirmAction
          className="link-btn"
          label="Vorschau vollständig zurücksetzen"
          confirmLabel="Alle Daten inkl. bestätigter Dossiers löschen? Erneut tippen"
          onConfirm={() => {
            resetAll();
            window.location.hash = '#/';
          }}
        />}
      </footer>
    </div>
  );
}
