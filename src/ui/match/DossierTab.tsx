import { useEffect, useState } from 'react';
import { getPath } from '../../dossier/overrides';
import { FLAG_LABEL } from '../../dossier/model';
import { buildDossier } from '../../dossier/build';
import { formatTimestamp } from '../../domain/time';
import type { Match, Preparation, TeamProfile } from '../../domain/types';
import { href } from '../../router';
import { currentDraft, ensureDraft, setOverride, updatePrep } from '../../state/actions';
import { contentForDossier, editableFields } from '../../state/selectors';
import { useStore } from '../../state/store';
import { Badge, Card, Notice, TextArea, TextInput, Toast } from '../components';
import { ScaledSlide, slideIssues } from '../dossier/SlideView';
import { SquadEditor } from '../SquadEditor';
import { DossierOptionsCard } from './DossierOptionsCard';

export function DossierTab({ match, team }: { match: Match; team: TeamProfile }) {
  const { state, update } = useStore();
  const draft = currentDraft(state, match.id);
  const confirmed = state.dossiers.filter((d) => d.matchId === match.id && d.status === 'bestätigt').sort((a, b) => b.version - a.version);
  const [idx, setIdx] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  // Ohne bestätigte Version wird automatisch ein Entwurf angelegt.
  useEffect(() => {
    if (!draft && confirmed.length === 0) update((s) => void ensureDraft(s, match.id));
  }, [draft, confirmed.length, match.id, update]);

  if (!draft) {
    if (confirmed.length === 0) return <p className="muted">Entwurf wird angelegt …</p>;
    return (
      <Card title="Bestätigtes Dossier vorhanden">
        <p>
          Version V{confirmed[0].version} wurde am {formatTimestamp(confirmed[0].confirmedAt)} bestätigt und bleibt unverändert erhalten.
        </p>
        <div className="row gap wrap">
          <a className="btn" href={href({ name: 'archivDossier', dossierId: confirmed[0].id })}>
            Bestätigte Version öffnen
          </a>
          <button className="btn btn-primary" onClick={() => update((s) => void ensureDraft(s, match.id))}>
            Neue Version V{confirmed[0].version + 1} als Entwurf bearbeiten
          </button>
        </div>
      </Card>
    );
  }

  const content = contentForDossier(state, draft)!;
  const base = buildDossier(team, match, state.preparations[match.id]);
  const slide = content.slides[Math.min(idx, content.slides.length - 1)];
  const issues = slideIssues(slide);
  const allIssues = content.slides.reduce((n, s) => n + slideIssues(s).length, 0);
  const prep = state.preparations[match.id];
  const setPrep = (fn: (p: Preparation) => void) => update((s) => updatePrep(s, match.id, fn));

  return (
    <div className="dossier-ws">
      <div className="dossier-bar">
        <div className="row gap wrap">
          <Badge tone="info">Entwurf V{draft.version}</Badge>
          <span className="muted small">zuletzt geändert {formatTimestamp(draft.updatedAt)}</span>
          {allIssues > 0 ? <Badge tone="warn">{allIssues} markierte Lücken/Konflikte</Badge> : <Badge tone="ok">keine markierten Lücken</Badge>}
        </div>
        <div className="row gap wrap">
          <button
            className="btn"
            onClick={() => {
              update((s) => {
                const d = s.dossiers.find((x) => x.id === draft.id)!;
                d.updatedAt = new Date().toISOString();
              });
              setToast(`Entwurf V${draft.version} gespeichert`);
            }}
          >
            Entwurf speichern
          </button>
          <a className="btn btn-primary" href={href({ name: 'spiel', matchId: match.id, tab: 'export' })}>
            Prüfen & bestätigen
          </a>
        </div>
      </div>
      <details className="dossier-options">
        <summary>Aufbau dieses Dossiers: Spielphasenmodell und Folien</summary>
        <DossierOptionsCard match={match} team={team} prep={prep} />
      </details>

      <nav className="slide-tabs" aria-label="Dossierseiten">
        {content.slides.map((s, i) => {
          const n = slideIssues(s).length;
          return (
            <button key={s.key} className={`slide-tab ${i === idx ? 'is-active' : ''}`} onClick={() => setIdx(i)} aria-current={i === idx ? 'page' : undefined}>
              <span className="num">{s.number}</span>
              <span className="slide-tab-l">{s.key === 'titel' ? 'Titel' : s.title}</span>
              {n > 0 && <span className="dot" aria-label={`${n} Hinweise`} />}
            </button>
          );
        })}
      </nav>

      <div className="dossier-main">
        <div className="dossier-preview">
          <ScaledSlide slide={slide} content={content} />
          <div className="row gap between">
            <button className="btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
              ← Vorherige Seite
            </button>
            <span className="muted small">
              Seite {slide.number} von {content.slides.length}
            </span>
            <button className="btn" disabled={idx >= content.slides.length - 1} onClick={() => setIdx(idx + 1)}>
              Nächste Seite →
            </button>
          </div>
        </div>

        <aside className="dossier-side">
          <Card title="Hinweise auf dieser Seite">
            {issues.length === 0 ? (
              <p className="muted small">Keine offenen oder widersprüchlichen Angaben.</p>
            ) : (
              <ul className="issue-list">
                {issues.map((v, i) => (
                  <li key={i} className={`flag-${v.flag}`}>
                    <strong>{FLAG_LABEL[v.flag]}:</strong> {v.text}
                    {v.note && <small> – {v.note}</small>}
                  </li>
                ))}
              </ul>
            )}
            {issues.length > 0 && (
              <p className="small">
                Lücken schließen Sie in der <a href={href({ name: 'spiel', matchId: match.id, tab: 'daten' })}>Datenbasis</a> oder im <a href={href({ name: 'spiel', matchId: match.id, tab: 'fragebogen' })}>Fragebogen</a>.
              </p>
            )}
          </Card>

          {slide.key === 'auftrag' ? (
            <Card title="Unser Auftrag bearbeiten">
              <p className="muted small">Ausschließlich Ihre Botschaften. Änderungen gelten auch im Fragebogen.</p>
              {prep.mission.messages.map((m, i) => (
                <fieldset key={i} className="mission">
                  <legend>Botschaft {i + 1}</legend>
                  <TextInput label="Überschrift" value={m.headline} onChange={(v) => setPrep((p) => ((p.mission.messages[i].headline = v), (p.mission.origin = 'trainer')))} />
                  <TextArea label="Begleitsatz" rows={2} value={m.text} onChange={(v) => setPrep((p) => ((p.mission.messages[i].text = v), (p.mission.origin = 'trainer')))} />
                </fieldset>
              ))}
              <TextInput label="Leitmotiv" value={prep.mission.motto} onChange={(v) => setPrep((p) => ((p.mission.motto = v), (p.mission.origin = 'trainer')))} />
              {[0, 1, 2].map((i) => (
                <TextInput
                  key={i}
                  label={`Merksatz ${i + 1}`}
                  value={prep.mission.mantras[i] ?? ''}
                  onChange={(v) =>
                    setPrep((p) => {
                      const next = [...p.mission.mantras, '', '', ''].slice(0, 3);
                      next[i] = v;
                      p.mission.mantras = next;
                    })
                  }
                />
              ))}
              <label className="check">
                <input type="checkbox" checked={prep.mission.mantrasWaived} onChange={(e) => setPrep((p) => (p.mission.mantrasWaived = e.target.checked))} />
                Merksätze entfallen
              </label>
            </Card>
          ) : (
            <Card title="Texte dieser Seite bearbeiten">
              {editableFields(slide).map((f) => {
                const overridden = f.path in draft.overrides;
                const flagPath = f.path.replace(/\.text$/, '.flag');
                const isOpenPlaceholder = !overridden && f.path.endsWith('.value.text') && getPath(content, flagPath) === 'offen';
                const value = isOpenPlaceholder ? '' : (getPath(content, f.path) ?? '');
                const onChange = (v: string) => update((s) => setOverride(s, draft.id, f.path, v === (getPath(base, f.path) ?? '') || (v.trim() === '' && getPath(base, flagPath) === 'offen') ? null : v));
                return (
                  <div key={f.path} className="edit-field">
                    {f.multiline ? <TextArea label={f.label} value={value} rows={2} onChange={onChange} /> : <TextInput label={f.label} value={value} onChange={onChange} />}
                    {overridden && (
                      <button className="link-btn small" onClick={() => update((s) => setOverride(s, draft.id, f.path, null))}>
                        Änderung verwerfen
                      </button>
                    )}
                  </div>
                );
              })}
              <p className="muted small">Zahlen, Tabellen und Bilanzen sind nicht frei editierbar – sie werden aus der geprüften Datenbasis berechnet.</p>
            </Card>
          )}

          {slide.key === 'kader' && (
            <Card title="Kader bearbeiten">
              <SquadEditor
                players={prep.squad?.players ?? []}
                onChange={(players) =>
                  setPrep((p) => {
                    p.squad = { players, note: p.squad?.note ?? '', confirmedAt: null, origin: p.squad?.origin ?? { kind: 'ersteingabe' } };
                    p.squadReviewed = true;
                  })
                }
              />
            </Card>
          )}
          {match.isHistoricalReference && <Notice tone="demo">Historischer Referenzfall mit Beispieldaten.</Notice>}
        </aside>
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
