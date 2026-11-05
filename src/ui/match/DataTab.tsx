import { useState } from 'react';
import { providers } from '../../data/registry';
import { analyzeTable, evaluateBlocks, type BlockEvaluation } from '../../domain/dataQuality';
import { now } from '../../domain/factory';
import { lastLeagueGames, seasonSummary } from '../../domain/stats';
import { formatDate, formatTimestamp, isValidDate, isValidTime } from '../../domain/time';
import type { DataBlockKey, Match, Preparation, SourceRef, TeamProfile } from '../../domain/types';
import { applyProviderResult, deleteMatch, resetReferenceCase, updatePrep } from '../../state/actions';
import { useStore } from '../../state/store';
import { navigate } from '../../router';
import { Badge, Card, ConfirmAction, Field, Notice, Segmented, StatusBadge, TextArea, TextInput, useId } from '../components';

const LEGEND: { s: Parameters<typeof StatusBadge>[0]['status']; t: string }[] = [
  { s: 'vorhanden', t: 'Daten liegen vor, noch nicht geprüft' },
  { s: 'fehlend', t: 'Keine Daten – im Dossier als „offen“' },
  { s: 'veraltet', t: 'Fachlicher Datenstand älter als erwartet' },
  { s: 'widersprüchlich', t: 'Quellen widersprechen sich – nicht als Fakt ausgegeben' },
  { s: 'bestätigt', t: 'Vom Trainer geprüft' },
];

export function DataTab({ match, team }: { match: Match; team: TeamProfile }) {
  const { state, update } = useStore();
  const prep = state.preparations[match.id];
  const [messages, setMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const evals = evaluateBlocks(team, match, prep);
  const provider = providers.find((p) => p.supports(team, match));

  const load = async () => {
    if (!provider) return;
    setLoading(true);
    setMessages([]);
    const res = await provider.fetch(team, match, { onProgress: setProgress });
    update((s) => applyProviderResult(s, match.id, res));
    setMessages(res.messages);
    setProgress(null);
    setLoading(false);
  };

  return (
    <div className="stack">
      <Card
        title="Datenbasis"
        actions={
          provider ? (
            <button className="btn btn-primary" onClick={load} disabled={loading}>
              {loading ? 'Lädt …' : prep.dataLoadedAt ? (provider.kind === 'demo' ? 'Beispieldaten neu laden' : 'Daten neu laden') : provider.actionLabel}
            </button>
          ) : null
        }
      >
        {provider?.kind === 'demo' && (
          <Notice tone="demo" title="Demo-Datenanbieter">
            Für den historischen Referenzfall stehen feste, fiktive Beispieldaten bereit. Es findet keine Online-Recherche statt. Die Daten enthalten absichtlich einen Widerspruch und eine veraltete Quelle, um die Prüfung zu zeigen.
          </Notice>
        )}
        {provider?.kind === 'live' && (
          <Notice tone="info" title="fussball.de (inoffiziell ausgelesen)">
            Abruf über Ihren lokal laufenden fussball.de-Dienst – nur auf Klick, keine Hintergrundabfragen. Geladen werden Tabelle, Spielpläne, Spieltag, direkte Duelle, Torjäger und Aufstellungen; der Gegner wird über die Tabelle oder die Vereinssuche gefunden. Die Daten werden mit Quelle und Datenstand gekennzeichnet; bitte Zuordnung prüfen.
          </Notice>
        )}
        {!provider && (
          <Notice tone="info" title="Keine automatische Datenquelle">
            Hinterlegen Sie unter „Mannschaft“ den fussball.de-Link Ihrer Mannschaft, um Daten über den lokalen fussball.de-Dienst zu laden. Ohne Quelle bleiben fehlende Angaben sichtbar offen; je Datenblock ist eine manuelle Ergänzung möglich.
          </Notice>
        )}
        {loading && progress && (
          <p className="muted small" role="status" aria-live="polite">
            {progress}
          </p>
        )}
        {messages.map((m) => (
          <p key={m} className="muted small">
            {m}
          </p>
        ))}
        {prep.dataLoadedAt && <p className="muted small">Zuletzt in die Vorschau geladen: {formatTimestamp(prep.dataLoadedAt)} – ein neuer Abruf bedeutet nicht, dass die Daten fachlich aktuell sind.</p>}
        <div className="legend">
          {LEGEND.map((l) => (
            <span key={l.s} className="legend-item">
              <StatusBadge status={l.s} /> <small>{l.t}</small>
            </span>
          ))}
        </div>
      </Card>

      <MatchBasics match={match} team={team} evaluation={evals.find((e) => e.key === 'begegnung')!} />

      <div className="data-grid">
        {evals
          .filter((e) => e.key !== 'begegnung')
          .map((e) => (
            <BlockCard key={e.key} ev={e} match={match} team={team} />
          ))}
      </div>

      <Card title="Begegnung verwalten">
        {match.isHistoricalReference ? (
          <>
            <p className="muted">Setzt Daten, Antworten, Kader und Entwürfe des Referenzfalls zurück. Bestätigte Versionen im Archiv bleiben erhalten.</p>
            <ConfirmAction label="Referenzfall zurücksetzen" confirmLabel="Wirklich zurücksetzen? Erneut tippen" onConfirm={() => update((s) => resetReferenceCase(s))} />
          </>
        ) : (
          <>
            <p className="muted">Löscht diese Begegnung und ihren Entwurf. Bestätigte Versionen bleiben im Archiv.</p>
            <ConfirmAction
              label="Begegnung löschen"
              confirmLabel="Wirklich löschen? Erneut tippen"
              onConfirm={() => {
                update((s) => deleteMatch(s, match.id));
                navigate({ name: 'start' });
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
}

type SourceFixture = NonNullable<NonNullable<Preparation['dataBlocks']['begegnung']['value']>['sourceFixture']>;

/** Weicht die Ansetzung laut Quelle von der Spielanlage ab oder ergänzt fehlende Angaben? */
function fixtureDiffers(match: Match, sf: SourceFixture): boolean {
  return Boolean(
    (sf.date && sf.date !== match.date) ||
      (sf.kickoff && sf.kickoff !== match.kickoff) ||
      (sf.matchday && match.competitionType === 'liga' && sf.matchday !== match.matchday) ||
      (sf.competition && !match.competition.trim()) ||
      (sf.venue && !match.isHome && !match.venue?.name),
  );
}

/** „KR Kassel, Schulstr., 34131 Kassel“ → Name „KR Kassel“, Adresse „Schulstr., 34131 Kassel“. */
function splitVenue(v: string): { name: string; address: string } {
  const parts = v.split(',').map((x) => x.trim()).filter(Boolean);
  if (parts.length < 3) return { name: v, address: '' };
  return { name: parts.slice(0, -2).join(', '), address: parts.slice(-2).join(', ') };
}

function MatchBasics({ match, team, evaluation }: { match: Match; team: TeamProfile; evaluation: BlockEvaluation }) {
  const { update, state } = useStore();
  const prep = state.preparations[match.id];
  const [editing, setEditing] = useState(false);
  const setM = (fn: (m: Match) => void) => update((s) => fn(s.matches.find((x) => x.id === match.id)!));
  const venue = prep.organisation.venueOverride ?? match.venue ?? (match.isHome ? team.homeVenue : null);
  const blk = prep.dataBlocks.begegnung;
  const sf = blk.value?.sourceFixture;
  return (
    <Card
      title={
        <>
          Begegnung, Termin, Wettbewerb, Spielort <StatusBadge status={evaluation.status} />
        </>
      }
      actions={
        !match.isHistoricalReference && (
          <button className="btn btn-small" onClick={() => setEditing(!editing)}>
            {editing ? 'Fertig' : 'Bearbeiten'}
          </button>
        )
      }
    >
      {editing ? (
        <div className="form-grid three">
          <TextInput label="Gegner" value={match.opponent} onChange={(v) => setM((m) => (m.opponent = v))} />
          <TextInput label="Wettbewerb" value={match.competition} onChange={(v) => setM((m) => (m.competition = v))} />
          <TextInput label="Spieltag" value={match.matchday ? String(match.matchday) : ''} inputMode="numeric" onChange={(v) => setM((m) => (m.matchday = parseInt(v, 10) || null))} />
          <TextInput label="Datum" type="date" value={match.date ?? ''} onChange={(v) => setM((m) => (m.date = isValidDate(v) ? v : null))} />
          <TextInput label="Anstoß" type="time" value={match.kickoff ?? ''} onChange={(v) => setM((m) => (m.kickoff = isValidTime(v) ? v : null))} />
          <div className="field">
            <span className="field-label">Heim/Auswärts</span>
            <Segmented label="Heim oder auswärts" value={match.isHome ? 'h' : 'a'} onChange={(v) => setM((m) => (m.isHome = v === 'h'))} options={[{ value: 'h', label: 'Heim' }, { value: 'a', label: 'Auswärts' }]} />
          </div>
          <TextInput label="Spielort" value={match.venue?.name ?? ''} onChange={(v) => setM((m) => (m.venue = v ? { ...(m.venue ?? {}), name: v } : null))} placeholder={match.isHome ? team.homeVenue.name : ''} />
          <TextInput label="fussball.de-Link des Gegners" type="url" inputMode="url" value={match.opponentFussballDe ?? ''} placeholder="https://www.fussball.de/mannschaft/…/team-id/…" onChange={(v) => setM((m) => (m.opponentFussballDe = v.trim() || undefined))} />
        </div>
      ) : (
        <dl className="kv">
          <div>
            <dt>Begegnung</dt>
            <dd>{match.isHome ? `${team.name} – ${match.opponent}` : `${match.opponent} – ${team.name}`}</dd>
          </div>
          <div>
            <dt>Wettbewerb</dt>
            <dd>
              {match.competition || <em className="open">offen</em>}
              {match.matchday ? ` · ${match.matchday}. Spieltag` : ''} <Badge>{match.competitionType === 'liga' ? 'Liga' : match.competitionType === 'pokal' ? 'Pokal' : 'Test'}</Badge>
            </dd>
          </div>
          <div>
            <dt>Termin</dt>
            <dd>
              {match.date ? formatDate(match.date, { weekday: true }) : <em className="open">Datum offen</em>}, {match.kickoff ? `${match.kickoff} Uhr` : <em className="open">Uhrzeit offen</em>}
            </dd>
          </div>
          <div>
            <dt>Spielort</dt>
            <dd>{venue?.name ? venue.name : <em className="open">offen</em>}</dd>
          </div>
        </dl>
      )}
      <Sources sources={blk.provenance.sources} />
      {blk.provenance.note && <p className="muted small">{blk.provenance.note}</p>}
      {evaluation.issues.map((i) => (
        <p key={i} className="issue">
          {i}
        </p>
      ))}
      {sf?.venue && <p className="small">Spielort laut {sf.sourceLabel}: {sf.venue}</p>}
      {sf && !match.isHistoricalReference && fixtureDiffers(match, sf) && (
        <button
          className="btn btn-small"
          onClick={() =>
            setM((m) => {
              if (sf.date) m.date = sf.date;
              if (sf.kickoff) m.kickoff = sf.kickoff;
              if (sf.matchday && m.competitionType === 'liga') m.matchday = sf.matchday;
              if (sf.competition && !m.competition.trim()) m.competition = sf.competition;
              if (sf.venue && !m.isHome && !m.venue?.name) m.venue = splitVenue(sf.venue);
            })
          }
        >
          Angaben von fussball.de übernehmen
        </button>
      )}
      <ConfirmButton blockKey="begegnung" match={match} disabled={evaluation.status === 'fehlend'} />
    </Card>
  );
}

function Sources({ sources }: { sources: SourceRef[] }) {
  if (!sources.length) return <p className="muted small">Keine Quelle.</p>;
  return (
    <table className="src-table">
      <thead>
        <tr>
          <th>Quelle</th>
          <th>Fachlicher Datenstand</th>
          <th>Abruf/Erfassung</th>
        </tr>
      </thead>
      <tbody>
        {sources.map((s) => (
          <tr key={s.id}>
            <td>
              {s.label} {s.kind === 'demo' && <Badge tone="demo">Demo</Badge>}
            </td>
            <td>{s.asOf ?? '–'}</td>
            <td>{formatTimestamp(s.retrievedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ConfirmButton({ blockKey, match, disabled }: { blockKey: DataBlockKey; match: Match; disabled: boolean }) {
  const { state, update } = useStore();
  const blk = state.preparations[match.id].dataBlocks[blockKey];
  const confirmed = Boolean(blk.confirmedAt);
  return (
    <div className="row gap wrap">
      <button
        className={`btn btn-small ${confirmed ? '' : 'btn-outline'}`}
        disabled={disabled && !confirmed}
        onClick={() => update((s) => updatePrep(s, match.id, (p) => (p.dataBlocks[blockKey].confirmedAt = confirmed ? null : now())))}
      >
        {confirmed ? '✓ Geprüft – Bestätigung zurücknehmen' : 'Als geprüft bestätigen'}
      </button>
      {confirmed && <span className="muted small">bestätigt {formatTimestamp(blk.confirmedAt)}</span>}
    </div>
  );
}

function BlockCard({ ev, match, team }: { ev: BlockEvaluation; match: Match; team: TeamProfile }) {
  const { state, update } = useStore();
  const prep = state.preparations[match.id];
  const blk = prep.dataBlocks[ev.key];
  const setPrep = (fn: (p: typeof prep) => void) => update((s) => updatePrep(s, match.id, fn));

  if (ev.key === 'fahrzeit') {
    return (
      <Card title={<>{ev.label} <StatusBadge status={ev.status} /></>} className="block-card">
        <TravelInput match={match} />
        {ev.issues.map((i) => (
          <p key={i} className="issue">
            {i}
          </p>
        ))}
      </Card>
    );
  }

  const unresolved = ev.conflicts.filter((c) => !c.resolution).length;
  return (
    <Card title={<>{ev.label} <StatusBadge status={ev.status} /></>} className="block-card">
      <Sources sources={blk.provenance.sources} />
      {blk.provenance.note && <p className="muted small">{blk.provenance.note}</p>}
      {ev.issues.map((i) => (
        <p key={i} className="issue">
          {i}
        </p>
      ))}
      {ev.conflicts.length > 0 && (
        <div className="conflicts">
          <strong>Widersprüche</strong>
          {ev.conflicts.map((c) => (
            <fieldset key={c.id} className={`conflict ${c.resolution ? 'is-resolved' : ''}`}>
              <legend>{c.label}</legend>
              {c.values.map((v) => (
                <label key={v.sourceId} className="check">
                  <input
                    type="radio"
                    name={c.id}
                    checked={c.resolution?.sourceId === v.sourceId}
                    onChange={() => setPrep((p) => (p.dataBlocks.tabelle.resolutions = { ...(p.dataBlocks.tabelle.resolutions ?? {}), [c.id]: { sourceId: v.sourceId, resolvedAt: now() } }))}
                  />
                  <span>
                    <strong>{v.value}</strong> laut {v.sourceLabel}
                  </span>
                </label>
              ))}
              <label className="check">
                <input
                  type="radio"
                  name={c.id}
                  checked={!c.resolution}
                  onChange={() =>
                    setPrep((p) => {
                      const r = { ...(p.dataBlocks.tabelle.resolutions ?? {}) };
                      delete r[c.id];
                      p.dataBlocks.tabelle.resolutions = r;
                    })
                  }
                />
                <span>Ungeklärt lassen (im Dossier als „widersprüchlich“ markiert)</span>
              </label>
            </fieldset>
          ))}
        </div>
      )}
      <BlockPreview k={ev.key} match={match} team={team} />
      <TextArea
        label="Manuelle Ergänzung (Trainer)"
        value={blk.manualNote?.text ?? ''}
        rows={2}
        hint="Wird als Trainerangabe gekennzeichnet – getrennt von Quelldaten."
        onChange={(v) => setPrep((p) => (p.dataBlocks[ev.key].manualNote = v.trim() ? { text: v, enteredAt: now() } : undefined))}
      />
      <ConfirmButton blockKey={ev.key} match={match} disabled={ev.status === 'fehlend' || unresolved > 0} />
    </Card>
  );
}

function BlockPreview({ k, match, team }: { k: DataBlockKey; match: Match; team: TeamProfile }) {
  const { state } = useStore();
  const prep = state.preparations[match.id];
  const b = prep.dataBlocks;
  switch (k) {
    case 'tabelle': {
      const a = analyzeTable(b.tabelle, match);
      if (!a.primary) return null;
      return (
        <details className="details">
          <summary>Tabelle ansehen ({a.primary.source.label})</summary>
          <div className="scroll-x">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pl.</th>
                  <th className="l">Mannschaft</th>
                  <th>Sp.</th>
                  <th>S-U-N</th>
                  <th>Tore</th>
                  <th>Abzug</th>
                  <th>Pkt.</th>
                </tr>
              </thead>
              <tbody>
                {a.rows.map((r) => (
                  <tr key={r.team} className={r.unresolved.length ? 'row-conflict' : ''}>
                    <td>{r.rank}</td>
                    <td className="l">{r.team}</td>
                    <td>{r.played}</td>
                    <td>
                      {r.won}-{r.drawn}-{r.lost}
                    </td>
                    <td>
                      {r.goalsFor}:{r.goalsAgainst}
                    </td>
                    <td>{r.pointDeduction ? `−${r.pointDeduction}` : '–'}</td>
                    <td>{r.unresolved.includes('points') ? <span className="flag flag-widersprüchlich">{r.points} ⚠</span> : r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Tabellenpunkte werden wie angegeben übernommen und nicht aus Siegen und Remis abgeleitet. Punktabzüge sind eine eigene Angabe.</p>
        </details>
      );
    }
    case 'ergebnisseEigene':
    case 'ergebnisseGegner': {
      const v = b[k].value;
      if (!v) return null;
      const name = k === 'ergebnisseEigene' ? team.name : match.opponent;
      const l5 = lastLeagueGames(name, v.results, match.date);
      const s = seasonSummary(name, v.results, match.date);
      return (
        <details className="details">
          <summary>Ergebnisse ansehen ({v.results.length})</summary>
          <p className="small">
            <strong>Letzte fünf Ligaspiele:</strong> {l5.map((r) => `${r.outcome} ${r.goalsFor}:${r.goalsAgainst}`).join(' · ') || '–'}
          </p>
          <ul className="result-list">
            {[...v.results]
              .sort((x, y) => (x.date < y.date ? 1 : -1))
              .map((r, i) => (
                <li key={i} className={r.competitionType !== 'liga' ? 'is-other' : ''}>
                  <span className="num">{formatDate(r.date)}</span>
                  <Badge tone={r.competitionType === 'liga' ? 'neutral' : 'warn'}>{r.competitionType === 'liga' ? `Liga${r.matchday ? ` ${r.matchday}.` : ''}` : r.competitionLabel}</Badge>
                  <span>
                    {r.home} – {r.away} <strong>{r.goalsHome}:{r.goalsAway}</strong>
                  </span>
                </li>
              ))}
          </ul>
          <p className="muted small">
            Heim: {s.home.won}S {s.home.drawn}U {s.home.lost}N · Auswärts: {s.away.won}S {s.away.drawn}U {s.away.lost}N
          </p>
        </details>
      );
    }
    case 'spieltag':
      return b.spieltag.value ? (
        <details className="details">
          <summary>Paarungen ansehen ({b.spieltag.value.pairings.length})</summary>
          <ul className="plain">
            {b.spieltag.value.pairings.map((p, i) => (
              <li key={i}>
                {p.home} – {p.away} <span className="muted small">{p.date ? formatDate(p.date) : ''} {p.kickoff}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null;
    case 'direkteDuelle':
      return b.direkteDuelle.value ? (
        <details className="details">
          <summary>Direkte Duelle ansehen</summary>
          <ul className="plain">
            {b.direkteDuelle.value.games.map((g, i) => (
              <li key={i}>
                <Badge>{g.season}</Badge> {formatDate(g.date)} · {g.competitionLabel}: {g.home} – {g.away} <strong>{g.goalsHome}:{g.goalsAway}</strong>
              </li>
            ))}
          </ul>
        </details>
      ) : null;
    case 'gegenspieler':
      return b.gegenspieler.value ? (
        <details className="details">
          <summary>Kandidaten ansehen ({b.gegenspieler.value.candidates.length})</summary>
          <ul className="plain">
            {b.gegenspieler.value.candidates.map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong> {c.position && <span className="muted">· {c.position}</span>} — {c.evidence.length ? c.evidence.map((e) => e.text).join('; ') : <em className="open">keine Belege – wird nicht vorgeschlagen</em>}
              </li>
            ))}
          </ul>
        </details>
      ) : null;
    case 'gegnerFakten':
      return b.gegnerFakten.value ? (
        <ul className="plain small">
          {b.gegnerFakten.value.facts.map((f) => (
            <li key={f.id}>{f.text}</li>
          ))}
        </ul>
      ) : null;
    default:
      return null;
  }
}

export function TravelInput({ match }: { match: Match }) {
  const { state, update } = useStore();
  const org = state.preparations[match.id].organisation;
  const travelId = useId('fahrzeit');
  const setOrg = (fn: (o: typeof org) => void) => update((s) => updatePrep(s, match.id, (p) => fn(p.organisation)));
  return (
    <div className="form-grid">
      <Field label="Fahrzeit für genau diese Fahrt (Minuten)" htmlFor={travelId} hint="Nur aktuelle, verifizierte oder von Ihnen vorgegebene Fahrzeit. Ohne Angabe bleiben Abfahrt und Treffpunkt offen.">
        <input
          id={travelId}
          className="input input-num"
          inputMode="numeric"
          value={org.travelMinutes ?? ''}
          placeholder="z. B. 35"
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            setOrg((o) => {
              o.travelMinutes = Number.isFinite(n) && n > 0 ? n : null;
              if (o.travelMinutes !== null && !o.travelSource) o.travelSource = 'trainer';
              if (o.travelMinutes === null) o.travelSource = null;
            });
          }}
        />
      </Field>
      <div className="field">
        <span className="field-label">Herkunft der Fahrzeit</span>
        <Segmented
          label="Herkunft der Fahrzeit"
          value={org.travelSource ?? 'trainer'}
          onChange={(v) => setOrg((o) => (o.travelSource = v))}
          options={[
            { value: 'trainer', label: 'Trainerangabe' },
            { value: 'verifiziert', label: 'Selbst verifiziert' },
          ]}
        />
      </div>
    </div>
  );
}
