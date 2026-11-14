import { useState } from 'react';
import { ruleBasedAssistant } from '../../ai/textAssistant';
import { REFERENCE_MATCH_ID } from '../../data/seed';
import { now } from '../../domain/factory';
import { questionProgress, questionsFor, SECTIONS, type QuestionDef, type QuestionStatus } from '../../domain/questionnaire';
import { effectivePhaseModel } from '../../domain/dossierOptions';
import { computeAwaySchedule, computeHomeSchedule, isValidTime } from '../../domain/time';
import type { Answer, AnswerState, Match, Preparation, QuestionId, TeamProfile } from '../../domain/types';
import { insertExampleAnswers, updatePrep } from '../../state/actions';
import { useStore } from '../../state/store';
import { Badge, Card, ConfirmAction, Field, Notice, ProgressBar, speechSupported, TextArea, TextInput } from '../components';
import { SquadEditor } from '../SquadEditor';
import { TravelInput } from './DataTab';
import { DossierOptionsCard } from './DossierOptionsCard';

const STATUS_TONE: Record<QuestionStatus, 'ok' | 'warn' | 'info'> = { erledigt: 'ok', offen: 'warn', übernommen: 'info' };

export function QuestionnaireTab({ match, team }: { match: Match; team: TeamProfile }) {
  const { state, update, saveStatus } = useStore();
  const prep = state.preparations[match.id];
  const progress = questionProgress(team, match, prep);
  const done = progress.filter((p) => p.status === 'erledigt').length;
  const [onlyOpen, setOnlyOpen] = useState(false);
  const statusOf = (id: QuestionId) => progress.find((p) => p.id === id)!;

  return (
    <div className="stack">
      <Card>
        <div className="q-top">
          <ProgressBar value={done} total={progress.length} label="Fragen erledigt" />
          <div className="row gap wrap">
            <label className="check">
              <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
              Nur offene und zu bestätigende Fragen zeigen
            </label>
            <span className={`save-pill ${saveStatus}`}>{saveStatus === 'speichert' ? 'Speichert …' : saveStatus === 'fehler' ? 'Speichern fehlgeschlagen' : 'Automatisch gespeichert'}</span>
          </div>
        </div>
        <p className="muted small">
          Bereits bekannte Angaben sind übernommen. „Nicht bekannt“ ist eine gültige Antwort. {speechSupported() ? 'Diktat über das Mikrofonsymbol nutzt die Spracherkennung Ihres Browsers.' : 'Für Diktat können Sie die Diktierfunktion Ihrer Tastatur nutzen.'}
        </p>
        {match.id === REFERENCE_MATCH_ID && (
          <Notice tone="demo" title="Historischer Referenzfall">
            Sie können fiktive Beispielantworten einsetzen, um den Ablauf schnell zu sehen. Sie werden als „Beispielangabe“ gekennzeichnet und gelten nur für diesen Fall.{' '}
            <ConfirmAction
              className="btn btn-small"
              label="Beispielantworten einsetzen"
              confirmLabel="Vorhandene Antworten überschreiben? Erneut tippen"
              skip={Object.keys(prep.answers).length === 0}
              onConfirm={() => update((s) => insertExampleAnswers(s, match.id))}
            />
          </Notice>
        )}
      </Card>

      <DossierOptionsCard match={match} team={team} prep={prep} />

      {SECTIONS.map((sec) => ({ sec, all: questionsFor(match, effectivePhaseModel(team, prep)).filter((q) => q.section === sec.id) }))
        .filter((x) => x.all.length)
        .map(({ sec, all }, si) => {
        const qs = all.filter((q) => !onlyOpen || statusOf(q.id).status !== 'erledigt');
        if (!qs.length) return null;
        return (
          <section key={sec.id} className="q-section">
            <h2 className="q-section-title">
              <span className="q-section-letter">{String.fromCharCode(65 + si)}</span> {sec.title}
            </h2>
            <p className="muted">{sec.intro}</p>
            {qs.map((q) => (
              <QuestionCard key={q.id} q={q} status={statusOf(q.id).status} summary={statusOf(q.id).summary} match={match} team={team} prep={prep} />
            ))}
          </section>
        );
      })}
      {onlyOpen && progress.every((p) => p.status === 'erledigt') && <Notice tone="ok">Alle Fragen sind beantwortet.</Notice>}
    </div>
  );
}

function QuestionCard({ q, status, summary, match, team, prep }: { q: QuestionDef; status: QuestionStatus; summary: string; match: Match; team: TeamProfile; prep: Preparation }) {
  const { update } = useStore();
  const setPrep = (fn: (p: Preparation) => void) => update((s) => updatePrep(s, match.id, fn));
  const ans = prep.answers[q.id];
  const setAnswer = (patch: Partial<Answer>) =>
    setPrep((p) => {
      const prev = p.answers[q.id] ?? { state: 'offen' as AnswerState, text: '', updatedAt: now(), origin: 'trainer' as const };
      p.answers[q.id] = { ...prev, ...patch, updatedAt: now(), origin: 'trainer' };
    });

  return (
    <article className={`q-card status-${status}`} id={q.id}>
      <header className="q-head">
        <span className="q-num">{q.number}</span>
        <div className="q-title">
          <h3>{q.title}</h3>
          {q.help && <p className="muted small">{q.help}</p>}
        </div>
        <Badge tone={STATUS_TONE[status]}>{status}</Badge>
      </header>
      {ans?.origin === 'beispiel' && <p className="small demo-note">Beispielantwort (fiktiv) – überschreiben Sie sie mit Ihrer Beobachtung.</p>}
      <div className="q-body">
        {q.kind === 'text' && <TextAnswer q={q} ans={ans} setAnswer={setAnswer} />}
        {q.kind === 'players' && <PlayersAnswer q={q} ans={ans} setAnswer={setAnswer} prep={prep} setPrep={setPrep} />}
        {q.kind === 'organisation' && <OrganisationAnswer match={match} team={team} prep={prep} setPrep={setPrep} ans={ans} setAnswer={setAnswer} />}
        {q.kind === 'kit' && <KitAnswer prep={prep} setPrep={setPrep} ans={ans} setAnswer={setAnswer} summary={summary} />}
        {q.kind === 'squad' && <SquadAnswer team={team} prep={prep} setPrep={setPrep} />}
        {q.kind === 'layout' && <LayoutAnswer team={team} prep={prep} setPrep={setPrep} ans={ans} setAnswer={setAnswer} />}
        {q.kind === 'mission' && <MissionAnswer prep={prep} setPrep={setPrep} />}
        {q.kind === 'motto' && <MottoAnswer prep={prep} setPrep={setPrep} />}
        {q.id === 'q10_ablauf' && <ScheduleAnswer match={match} team={team} prep={prep} setPrep={setPrep} ans={ans} setAnswer={setAnswer} />}
      </div>
    </article>
  );
}

type SetAnswer = (patch: Partial<Answer>) => void;
type SetPrep = (fn: (p: Preparation) => void) => void;

function TextAnswer({ q, ans, setAnswer }: { q: QuestionDef; ans: Answer | undefined; setAnswer: SetAnswer }) {
  if (q.id === 'q10_ablauf') return null;
  const unknown = ans?.state === 'nicht_bekannt';
  return (
    <>
      {!unknown && (
        <TextArea label="Ihre Beobachtung" value={ans?.text ?? ''} placeholder={q.placeholder} dictation onChange={(v) => setAnswer({ text: v, state: v.trim() ? 'beantwortet' : 'offen' })} />
      )}
      <div className="row gap wrap">
        {q.allowUnknown && (
          <button type="button" className={`btn btn-small ${unknown ? 'is-on' : ''}`} aria-pressed={unknown} onClick={() => setAnswer({ state: unknown ? (ans?.text.trim() ? 'beantwortet' : 'offen') : 'nicht_bekannt' })}>
            {unknown ? '✓ Nicht bekannt – rückgängig' : 'Nicht bekannt'}
          </button>
        )}
      </div>
    </>
  );
}

function PlayersAnswer({ q, ans, setAnswer, prep, setPrep }: { q: QuestionDef; ans: Answer | undefined; setAnswer: SetAnswer; prep: Preparation; setPrep: SetPrep }) {
  const candidates = prep.dataBlocks.gegenspieler.value?.candidates.filter((c) => c.evidence.length) ?? [];
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  return (
    <>
      {candidates.length > 0 ? (
        <div className="cand-list">
          <p className="small muted">Vorschläge aus belegten Daten ({prep.dataBlocks.gegenspieler.provenance.sources.map((s) => s.label).join(', ')}):</p>
          {candidates.map((c) => {
            const hint = prep.playerHints.find((h) => h.candidateId === c.id);
            return (
              <div key={c.id} className={`cand ${hint ? 'is-on' : ''}`}>
                <div>
                  <strong>{c.name}</strong> <span className="muted small">{[c.number && `#${c.number}`, c.position].filter(Boolean).join(' · ')}</span>
                  <div className="small">{c.evidence.map((e) => e.text).join(' · ')}</div>
                </div>
                {hint ? (
                  <>
                    <input className="input" aria-label={`Trainerhinweis zu ${c.name}`} placeholder="Warum wichtig? (Trainerhinweis)" value={hint.reason} onChange={(e) => setPrep((p) => (p.playerHints = p.playerHints.map((h) => (h.candidateId === c.id ? { ...h, reason: e.target.value } : h))))} />
                    <button className="btn btn-small" onClick={() => setPrep((p) => (p.playerHints = p.playerHints.filter((h) => h.candidateId !== c.id)))}>
                      Hinweis entfernen
                    </button>
                  </>
                ) : (
                  <button className="btn btn-small" onClick={() => setPrep((p) => p.playerHints.push({ candidateId: c.id, name: c.name, reason: '' }))}>
                    Trainerhinweis ergänzen
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="small muted">Keine belegten Spielerdaten vorhanden. Eigene Hinweise sind möglich; es werden keine Spieler erfunden.</p>
      )}
      {prep.playerHints.map((h, idx) =>
        h.candidateId ? null : (
          <div key={idx} className="cand is-on">
            <div>
              <strong>{h.name}</strong> <span className="muted small">Trainerhinweis</span>
              <div className="small">{h.reason}</div>
            </div>
            <button className="btn btn-small" onClick={() => setPrep((p) => (p.playerHints = p.playerHints.filter((_, j) => j !== idx)))}>
              Entfernen
            </button>
          </div>
        ),
      )}
      <div className="form-grid">
        <TextInput label="Weiterer Spieler (Name/Nummer)" value={name} onChange={setName} />
        <TextInput label="Warum wichtig?" value={reason} onChange={setReason} />
      </div>
      <div className="row gap wrap">
        <button
          className="btn btn-small"
          disabled={!name.trim()}
          onClick={() => {
            setPrep((p) => p.playerHints.push({ candidateId: null, name: name.trim(), reason: reason.trim() }));
            setName('');
            setReason('');
          }}
        >
          + Hinweis hinzufügen
        </button>
        {q.allowUnknown && (
          <button className={`btn btn-small ${ans?.state === 'nicht_bekannt' ? 'is-on' : ''}`} onClick={() => setAnswer({ state: ans?.state === 'nicht_bekannt' ? 'offen' : 'nicht_bekannt' })}>
            {ans?.state === 'nicht_bekannt' ? '✓ Nicht bekannt – rückgängig' : 'Nicht bekannt'}
          </button>
        )}
      </div>
    </>
  );
}

function OrganisationAnswer({ match, team, prep, setPrep, ans, setAnswer }: { match: Match; team: TeamProfile; prep: Preparation; setPrep: SetPrep; ans: Answer | undefined; setAnswer: SetAnswer }) {
  const org = prep.organisation;
  const venue = org.venueOverride;
  return (
    <>
      {!match.isHome && <TravelInput match={match} />}
      <div className="row gap wrap">
        <button className={`btn btn-small ${ans?.state === 'keine_abweichung' ? 'is-on' : ''}`} onClick={() => setAnswer({ state: ans?.state === 'keine_abweichung' ? 'offen' : 'keine_abweichung' })}>
          {ans?.state === 'keine_abweichung' ? '✓ Keine Abweichung bei Spielort und Zeitmuster' : 'Keine Abweichung bei Spielort und Zeitmuster'}
        </button>
      </div>
      <details className="details" open={Boolean(venue) || Boolean(org.meetingOverride)}>
        <summary>Abweichung eintragen</summary>
        <div className="form-grid">
          <TextInput
            label="Abweichender Spielort"
            value={venue?.name ?? ''}
            placeholder={(match.venue ?? (match.isHome ? team.homeVenue : null))?.name ?? ''}
            onChange={(v) =>
              setPrep((p) => {
                p.organisation.venueOverride = v.trim() ? { name: v, address: p.organisation.venueOverride?.address ?? '' } : null;
                p.answers.q9_abweichungen = { state: 'beantwortet', text: v.trim() ? `Spielort: ${v}` : '', updatedAt: now(), origin: 'trainer' };
              })
            }
          />
          <TextInput
            label="Abweichende Treffpunktzeit"
            type="time"
            value={org.meetingOverride ?? ''}
            onChange={(v) =>
              setPrep((p) => {
                p.organisation.meetingOverride = isValidTime(v) ? v : null;
                p.answers.q9_abweichungen = { state: 'beantwortet', text: v ? `Treffpunkt: ${v}` : '', updatedAt: now(), origin: 'trainer' };
              })
            }
          />
        </div>
      </details>
    </>
  );
}

function ScheduleAnswer({ match, team, prep, setPrep, ans, setAnswer }: { match: Match; team: TeamProfile; prep: Preparation; setPrep: SetPrep; ans: Answer | undefined; setAnswer: SetAnswer }) {
  if (!match.kickoff) return <Notice tone="warn">Anstoßzeit fehlt – der Ablauf kann noch nicht berechnet werden.</Notice>;
  const sched = match.isHome
    ? computeHomeSchedule(match.kickoff, team.schedule.home, null, prep.organisation)
    : computeAwaySchedule(
        match.kickoff,
        prep.organisation.departurePointOverride?.trim() ? { ...team.schedule.away, departurePoint: prep.organisation.departurePointOverride.trim() } : team.schedule.away,
        prep.organisation.travelMinutes,
        prep.organisation,
      );
  const blocks = match.isHome ? team.schedule.home.blocks : team.schedule.away.blocks;
  return (
    <>
      <ul className="sched">
        {sched.items.map((it) => {
          const isBlock = blocks.some((b) => b.id === it.id);
          const o = prep.organisation.blockOverrides[it.id];
          return (
            <li key={it.id} className={it.start ? '' : 'is-open'}>
              <span className="sched-time num">{it.start ? (it.end ? `${it.start}–${it.end}` : it.start) : 'offen'}</span>
              <span className="sched-label">
                {it.label}
                {it.overridden && <Badge tone="info">geändert</Badge>}
                {it.openReason && <small className="open"> · {it.openReason}</small>}
              </span>
              {isBlock && (
                <details className="sched-edit">
                  <summary>Ändern</summary>
                  <div className="row gap">
                    <input className="input" type="time" aria-label={`${it.label} Beginn`} value={o?.start ?? it.start ?? ''} onChange={(e) => setPrep((p) => (p.organisation.blockOverrides[it.id] = { start: e.target.value, end: o?.end ?? it.end ?? '' }))} />
                    <input className="input" type="time" aria-label={`${it.label} Ende`} value={o?.end ?? it.end ?? ''} onChange={(e) => setPrep((p) => (p.organisation.blockOverrides[it.id] = { start: o?.start ?? it.start ?? '', end: e.target.value }))} />
                    {o && (
                      <button className="btn btn-small" onClick={() => setPrep((p) => delete p.organisation.blockOverrides[it.id])}>
                        Zurücksetzen
                      </button>
                    )}
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ul>
      {sched.open.map((o) => (
        <p key={o} className="issue">
          {o}
        </p>
      ))}
      <div className="row gap wrap">
        <button className={`btn btn-small ${ans?.state === 'keine_abweichung' ? 'is-on' : ''}`} onClick={() => setAnswer({ state: ans?.state === 'keine_abweichung' ? 'offen' : 'keine_abweichung', text: '' })}>
          {ans?.state === 'keine_abweichung' ? '✓ Berechneten Ablauf verwenden' : 'Berechneten Ablauf verwenden'}
        </button>
        {Object.keys(prep.organisation.blockOverrides).length > 0 && (
          <button className={`btn btn-small ${ans?.state === 'beantwortet' ? 'is-on' : ''}`} onClick={() => setAnswer({ state: 'beantwortet', text: 'Ausdrücklich genannte Zeitänderungen übernommen' })}>
            Änderungen bestätigen
          </button>
        )}
      </div>
    </>
  );
}

function KitAnswer({ prep, setPrep, ans, setAnswer, summary }: { prep: Preparation; setPrep: SetPrep; ans: Answer | undefined; setAnswer: SetAnswer; summary: string }) {
  const kit = prep.organisation.kit ?? { shirt: '', shorts: '', socks: '' };
  const setKit = (patch: Partial<typeof kit>) =>
    setPrep((p) => {
      p.organisation.kit = { ...kit, ...patch };
      p.answers.q11_kleidung = { state: 'beantwortet', text: 'Kombination angepasst', updatedAt: now(), origin: 'trainer' };
    });
  const confirmed = ans && ans.state !== 'offen';
  return (
    <>
      <div className="form-grid three">
        <TextInput label="Trikot" value={kit.shirt} onChange={(v) => setKit({ shirt: v })} />
        <TextInput label="Hose" value={kit.shorts} onChange={(v) => setKit({ shorts: v })} />
        <TextInput label="Stutzen" value={kit.socks} onChange={(v) => setKit({ socks: v })} />
      </div>
      {!confirmed && prep.organisation.kit && (
        <button className="btn btn-small" onClick={() => setAnswer({ state: 'beantwortet', text: 'Vorausgefüllte Kombination bestätigt' })}>
          Vorausgefüllte Kombination bestätigen
        </button>
      )}
      {confirmed && <p className="small muted">{summary}</p>}
      <TextArea label="Weitere organisatorische Besonderheiten" value={prep.organisation.notes} rows={2} dictation onChange={(v) => setPrep((p) => (p.organisation.notes = v))} />
    </>
  );
}

function SquadAnswer({ team, prep, setPrep }: { team: TeamProfile; prep: Preparation; setPrep: SetPrep }) {
  const [editing, setEditing] = useState(false);
  const squad = prep.squad;
  const originLabel = !squad ? '' : squad.origin.kind === 'ersteingabe' ? 'Ersteingabe' : squad.origin.label;
  return (
    <>
      {squad && squad.players.length > 0 ? (
        <p className="small">
          <strong>{squad.players.length} Spieler</strong> · übernommen aus: {originLabel}
          {prep.squadReviewed && <Badge tone="ok">vom Trainer geprüft</Badge>}
        </p>
      ) : team.lastConfirmedSquad ? (
        <button
          className="btn"
          onClick={() =>
            setPrep((p) => {
              p.squad = structuredClone(team.lastConfirmedSquad);
            })
          }
        >
          Zuletzt bestätigten Kader übernehmen
        </button>
      ) : (
        <Notice tone="info">Noch kein bestätigter Kader vorhanden – bitte erstmalig erfassen.</Notice>
      )}
      {!editing && squad && squad.players.length > 0 && (
        <ul className="squad-preview">
          {squad.players.map((p) => (
            <li key={p.id}>
              <span className="num">{p.number}</span> {p.name} <span className="muted small">{p.position}</span>
            </li>
          ))}
        </ul>
      )}
      {(editing || !squad || squad.players.length === 0) && (
        <SquadEditor
          players={squad?.players ?? []}
          onChange={(players) =>
            setPrep((p) => {
              p.squad = { players, note: p.squad?.note ?? '', ...(p.squad?.coaches ? { coaches: p.squad.coaches } : {}), confirmedAt: null, origin: p.squad?.origin ?? { kind: 'ersteingabe' } };
              p.squadReviewed = true;
            })
          }
        />
      )}
      <div className="row gap wrap">
        {squad && squad.players.length > 0 && (
          <button className="btn btn-small" onClick={() => setEditing(!editing)}>
            {editing ? 'Bearbeitung schließen' : 'Kader bearbeiten'}
          </button>
        )}
        {squad && squad.players.length > 0 && !prep.squadReviewed && (
          <button className="btn btn-small btn-outline" onClick={() => setPrep((p) => (p.squadReviewed = true))}>
            Kader unverändert übernehmen
          </button>
        )}
      </div>
      {squad && (
        <TextInput
          label="Offene Kaderplätze (z. B. für Spieler aus der 2. Mannschaft)"
          inputMode="numeric"
          value={squad.openSlots?.count ? String(squad.openSlots.count) : ''}
          placeholder="0"
          onChange={(v) =>
            setPrep((p) => {
              if (!p.squad) return;
              const count = Math.max(0, Math.min(6, Number(v.replace(/\D/g, '')) || 0));
              if (count) p.squad.openSlots = { count, label: p.squad.openSlots?.label || 'Spieler 2. Mannschaft' };
              else delete p.squad.openSlots;
            })
          }
        />
      )}
      {squad && (
        <TextInput
          label="Trainerteam (durch Komma getrennt)"
          value={(squad.coaches ?? []).join(', ')}
          placeholder="z. B. Manuel Viehmann, Thorsten Klemann"
          hint="Fotos und Rollen kommen – soweit vorhanden – aus dem FuPa-Kader."
          onChange={(v) => setPrep((p) => p.squad && (p.squad.coaches = v.split(',').map((x) => x.trimStart())))}
        />
      )}
      {squad && (
        <TextInput label="Hinweis zum Kader (optional)" value={squad.note ?? ''} onChange={(v) => setPrep((p) => p.squad && (p.squad.note = v))} />
      )}
    </>
  );
}

function LayoutAnswer({ team, prep, setPrep, ans, setAnswer }: { team: TeamProfile; prep: Preparation; setPrep: SetPrep; ans: Answer | undefined; setAnswer: SetAnswer }) {
  return (
    <>
      <p className="small">
        Vorlage: <strong>{team.template.name}</strong> ({team.template.slides.length} Seiten). Ausgabe als PPTX und PDF (Druckansicht).
      </p>
      <div className="row gap wrap">
        <button className={`btn btn-small ${ans?.state === 'keine_abweichung' ? 'is-on' : ''}`} onClick={() => setAnswer({ state: ans?.state === 'keine_abweichung' ? 'offen' : 'keine_abweichung', text: '' })}>
          {ans?.state === 'keine_abweichung' ? '✓ Vorlage unverändert verwenden' : 'Vorlage unverändert verwenden'}
        </button>
      </div>
      <TextArea
        label="Abweichende Wünsche"
        value={prep.layoutWish}
        rows={2}
        hint="Wird festgehalten. Seiten ein- und ausblenden können Sie unter „Mannschaft → Dossiervorlage“; weitere Layoutwünsche setzt die Vorschau nicht automatisch um."
        onChange={(v) =>
          setPrep((p) => {
            p.layoutWish = v;
            p.answers.q13_layout = { state: v.trim() ? 'beantwortet' : 'offen', text: v, updatedAt: now(), origin: 'trainer' };
          })
        }
      />
    </>
  );
}

function MissionAnswer({ prep, setPrep }: { prep: Preparation; setPrep: SetPrep }) {
  const [busy, setBusy] = useState<number | null>(null);
  const setMsg = (i: number, patch: Partial<Preparation['mission']['messages'][number]>) =>
    setPrep((p) => {
      p.mission.messages[i] = { ...p.mission.messages[i], ...patch };
      p.mission.origin = 'trainer';
    });
  return (
    <div className="missions">
      {prep.mission.messages.map((m, i) => (
        <fieldset key={i} className="mission">
          <legend>Botschaft {i + 1}</legend>
          <TextArea label="In Ihren Worten" value={m.coachRaw} rows={2} dictation onChange={(v) => setMsg(i, { coachRaw: v })} placeholder="Was sollen die Jungs mitnehmen?" />
          <button
            className="btn btn-small"
            disabled={!m.coachRaw.trim() || busy === i}
            title={ruleBasedAssistant.label}
            onClick={async () => {
              setBusy(i);
              const d = await ruleBasedAssistant.draftMessage(m.coachRaw);
              setMsg(i, { headline: d.headline, text: d.text });
              setBusy(null);
            }}
          >
            Überschrift und Satz aus meinem Text übernehmen (regelbasiert, keine KI)
          </button>
          <div className="form-grid">
            <TextInput label="Überschrift" value={m.headline} onChange={(v) => setMsg(i, { headline: v })} />
            <TextInput label="Begleitsatz" value={m.text} onChange={(v) => setMsg(i, { text: v })} />
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function MottoAnswer({ prep, setPrep }: { prep: Preparation; setPrep: SetPrep }) {
  const m = prep.mission;
  const mantras = [...m.mantras, '', '', ''].slice(0, 3);
  return (
    <>
      <TextInput label="Leitmotiv (schwarzer Kasten)" value={m.motto} onChange={(v) => setPrep((p) => ((p.mission.motto = v), (p.mission.origin = 'trainer')))} />
      <Field label="Merksätze (zwei oder drei)">
        <div className="stack-sm">
          {mantras.map((x, i) => (
            <input
              key={i}
              className="input"
              aria-label={`Merksatz ${i + 1}`}
              disabled={m.mantrasWaived}
              value={x}
              onChange={(e) =>
                setPrep((p) => {
                  const next = [...p.mission.mantras, '', '', ''].slice(0, 3);
                  next[i] = e.target.value;
                  p.mission.mantras = next;
                })
              }
            />
          ))}
        </div>
      </Field>
      <label className="check">
        <input type="checkbox" checked={m.mantrasWaived} onChange={(e) => setPrep((p) => (p.mission.mantrasWaived = e.target.checked))} />
        Merksätze entfallen
      </label>
    </>
  );
}
