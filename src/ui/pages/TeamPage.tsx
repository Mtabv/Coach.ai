import { useState } from 'react';
import { ALL_SLIDES, createTeam, now, uid } from '../../domain/factory';
import { computeAwaySchedule, computeHomeSchedule, formatTimestamp } from '../../domain/time';
import type { KitCombination, TeamProfile, TimeBlockTemplate } from '../../domain/types';
import { href, navigate } from '../../router';
import { useStore } from '../../state/store';
import { Badge, Card, DemoBadge, Field, Notice, Segmented, TextArea, TextInput } from '../components';
import { SOURCE_PRIORITY_FIELDS, sourcePriorityOf } from '../../domain/sourcePriority';
import { SquadEditor } from '../SquadEditor';

const SLIDE_NAMES: Record<string, string> = {
  titel: 'Titelseite',
  inhalt: 'Was euch erwartet',
  spieltag: 'Der Spieltag',
  unserSpiel: 'Unser Spiel',
  gegnerForm: 'Der Gegner · Form',
  gegnerGefahr: 'Der Gegner · Gefahr',
  gegnerAuffaelligkeiten: 'Der Gegner · Auffälligkeiten',
  soSpieltGegner: 'So spielt der Gegner',
  unsereForm: 'Unsere Form',
  kader: 'Unser Kader',
  auftrag: 'Unser Auftrag',
};

export function NewTeamPage() {
  const { update } = useStore();
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [club, setClub] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [competition, setCompetition] = useState('');
  const [season, setSeason] = useState('');
  const create = () => {
    const team = createTeam({ name: name.trim(), shortName: shortName.trim(), club: club.trim() || name.trim(), ageGroup, competition, season });
    update((s) => {
      s.teams.push(team);
      s.activeTeamId = team.id;
    });
    navigate({ name: 'mannschaft' });
  };
  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <p className="eyebrow">Mannschaft einrichten</p>
          <h1>Neue Mannschaft</h1>
          <p className="muted">Jede Mannschaft erhält eigene Standards. Zeitmuster, Kleidung und Kader legen Sie im nächsten Schritt fest.</p>
        </div>
      </div>
      <Card>
        <div className="form-grid">
          <TextInput label="Mannschaftsname" value={name} onChange={setName} required placeholder="z. B. SV Musterstadt II" />
          <TextInput label="Kurzname für Folien" value={shortName} onChange={setShortName} placeholder="z. B. SVM" />
          <TextInput label="Verein" value={club} onChange={setClub} />
          <TextInput label="Altersklasse" value={ageGroup} onChange={setAgeGroup} placeholder="z. B. Herren, U19" />
          <TextInput label="Wettbewerb" value={competition} onChange={setCompetition} placeholder="z. B. Kreisoberliga" />
          <TextInput label="Saison" value={season} onChange={setSeason} placeholder="z. B. 2026/27" />
        </div>
        <div className="row gap wrap">
          <button className="btn btn-primary" disabled={!name.trim()} onClick={create}>
            Mannschaft anlegen
          </button>
          <a className="btn btn-ghost" href={href({ name: 'mannschaft' })}>
            Abbrechen
          </a>
        </div>
      </Card>
    </div>
  );
}

export function TeamPage() {
  const { state, update } = useStore();
  const team = state.teams.find((t) => t.id === state.activeTeamId) ?? state.teams[0];
  if (!team) {
    navigate({ name: 'neueMannschaft' });
    return null;
  }
  const set = (fn: (t: TeamProfile) => void) =>
    update((s) => {
      const t = s.teams.find((x) => x.id === team.id)!;
      fn(t);
      t.updatedAt = now();
    });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Mannschaft einrichten</p>
          <h1>{team.name}</h1>
          <p className="muted">Einmalige Einrichtung. Änderungen werden automatisch gespeichert und wirken nur auf neue bzw. noch nicht bestätigte Dossiers.</p>
        </div>
        <div className="row gap wrap">
          {team.isDemo && <DemoBadge>Demo-Mannschaft</DemoBadge>}
          <a className="btn" href={href({ name: 'neueMannschaft' })}>
            + Weitere Mannschaft
          </a>
        </div>
      </div>

      {team.isDemo && (
        <Notice tone="demo" title="Demo-Mannschaft">
          Organisatorische Zeitmuster entsprechen den vorgegebenen Standards der TSG Wilhelmshöhe. Spielort, Spielkleidung und Kader sind Beispielangaben und als solche gekennzeichnet.
        </Notice>
      )}

      <div className="two-col">
        <Card title="Stammdaten">
          <div className="form-grid">
            <TextInput label="Mannschaftsname" value={team.name} onChange={(v) => set((t) => (t.name = v))} />
            <TextInput label="Kurzname für Folien" value={team.shortName} onChange={(v) => set((t) => (t.shortName = v))} />
            <TextInput label="Verein" value={team.club} onChange={(v) => set((t) => (t.club = v))} />
            <TextInput label="Altersklasse" value={team.ageGroup} onChange={(v) => set((t) => (t.ageGroup = v))} />
            <TextInput label="Wettbewerb" value={team.competition} onChange={(v) => set((t) => (t.competition = v))} />
            <TextInput label="Saison" value={team.season} onChange={(v) => set((t) => (t.season = v))} />
          </div>
          <p className="muted small">Zeitzone: Europe/Berlin (fest)</p>
          <div className="form-grid three">
            {(
              [
                ['promotion', 'Aufsteiger'],
                ['promotionPlayoff', 'Aufstiegsrelegation'],
                ['relegation', 'Absteiger'],
              ] as const
            ).map(([key, lbl]) => (
              <TextInput
                key={key}
                label={lbl}
                inputMode="numeric"
                value={team.leagueZones ? String(team.leagueZones[key]) : ''}
                onChange={(v) =>
                  set((t) => {
                    const n = Math.max(0, Math.min(9, Number(v.replace(/\D/g, '')) || 0));
                    t.leagueZones = { ...(t.leagueZones ?? { promotion: 0, promotionPlayoff: 0, relegation: 0 }), [key]: n };
                  })
                }
              />
            ))}
          </div>
          <p className="muted small">Plätze für die farbige Markierung der Tabelle (liefert fussball.de nicht mit).</p>
        </Card>

        <Card title="Links und Heimspielort">
          {team.links.map((l, i) => (
            <TextInput
              key={i}
              label={`Mannschaftsseite ${l.kind}`}
              type="url"
              inputMode="url"
              value={l.url}
              placeholder="https://…"
              onChange={(v) => set((t) => (t.links[i].url = v))}
              hint={l.kind === 'fussball.de' ? 'Mannschaftsseite mit „team-id“ im Link. Wird für den Abruf über den lokalen Dienst genutzt.' : l.kind === 'FuPa' ? 'Optional, z. B. https://www.fupa.net/team/… – sonst findet Coach.AI die Mannschaft über den Vereinsnamen.' : undefined}
            />
          ))}
          <div className="field">
            <span className="field-label">Vereinswappen (optional)</span>
            <div className="row gap wrap kit-image">
              {team.crest ? <img src={team.crest} alt="Wappen" /> : <span className="muted small">Kein eigenes Wappen – es wird das Wappen von FuPa verwendet.</span>}
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || file.size > 1_500_000) return;
                  const data = await new Promise<string>((res) => {
                    const r = new FileReader();
                    r.onload = () => res(String(r.result));
                    r.readAsDataURL(file);
                  });
                  set((t) => (t.crest = data));
                }}
              />
              {team.crest && (
                <button type="button" className="btn btn-ghost btn-small" onClick={() => set((t) => delete t.crest)}>
                  Wappen entfernen
                </button>
              )}
            </div>
            <span className="muted small">Erscheint oben rechts auf jeder Folie. Am besten PNG mit transparentem Hintergrund.</span>
          </div>
          <TextInput label="Heimspielort" value={team.homeVenue.name} onChange={(v) => set((t) => (t.homeVenue.name = v))} />
          <TextInput label="Adresse" value={team.homeVenue.address ?? ''} onChange={(v) => set((t) => (t.homeVenue.address = v))} />
        </Card>
      </div>

      <Card title="Datenquellen bei doppelten Angaben">
        <p className="muted small">
          Liefern fussball.de und FuPa beide einen Wert, gilt die hier gewählte Quelle. Die andere wird nur genutzt, wenn die gewählte keinen Wert hat. Angaben aus dem Trainerinterview haben immer Vorrang.
        </p>
        <div className="source-prio">
          {SOURCE_PRIORITY_FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <span className="field-label">{f.label}</span>
              <Segmented
                label={`Quelle für ${f.label}`}
                value={sourcePriorityOf(team)[f.key]}
                onChange={(v) => set((t) => (t.sourcePriority = { ...sourcePriorityOf(t), [f.key]: v }))}
                options={[
                  { value: 'fussball.de', label: 'fussball.de' },
                  { value: 'FuPa', label: 'FuPa' },
                ]}
              />
              <span className="muted small">{f.hint}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="two-col">
        <ScheduleEditor
          title="Zeitmuster Heimspiele"
          blocks={team.schedule.home.blocks}
          onBlocks={(b) => set((t) => (t.schedule.home.blocks = b))}
          extra={
            <OffsetInput label="Treffpunkt (Minuten vor Anstoß)" value={team.schedule.home.meetingOffsetMin} onChange={(v) => set((t) => (t.schedule.home.meetingOffsetMin = v))} />
          }
          preview={computeHomeSchedule('19:00', team.schedule.home, team.homeVenue.name, { blockOverrides: {}, meetingOverride: null })}
        />
        <ScheduleEditor
          title="Zeitmuster Auswärtsspiele"
          blocks={team.schedule.away.blocks}
          onBlocks={(b) => set((t) => (t.schedule.away.blocks = b))}
          extra={
            <>
              <OffsetInput label="Ankunft (Minuten vor Anstoß)" value={team.schedule.away.arrivalOffsetMin} onChange={(v) => set((t) => (t.schedule.away.arrivalOffsetMin = v))} />
              <OffsetInput label="Treffpunkt (Minuten vor Abfahrt)" value={team.schedule.away.meetingBeforeDepartureMin === null ? null : -team.schedule.away.meetingBeforeDepartureMin} onChange={(v) => set((t) => (t.schedule.away.meetingBeforeDepartureMin = v === null ? null : Math.abs(v)))} />
              <TextInput label="Abfahrtstreffpunkt" value={team.schedule.away.departurePoint} onChange={(v) => set((t) => (t.schedule.away.departurePoint = v))} />
              <p className="muted small">Abfahrt = Ankunft minus aktuelle Fahrzeit der jeweiligen Fahrt. Fahrzeiten früherer Gegner werden nie übertragen.</p>
            </>
          }
          preview={computeAwaySchedule('15:00', team.schedule.away, null, { blockOverrides: {}, meetingOverride: null })}
          previewNote="Vorschau für Anstoß 15:00 ohne Fahrzeit"
        />
      </div>

      <div className="two-col">
        <Card title="Spielkleidung">
          <KitEditor label="Heim" kit={team.kits.home} onChange={(k) => set((t) => (t.kits.home = k))} />
          <KitEditor label="Auswärts" kit={team.kits.away} onChange={(k) => set((t) => (t.kits.away = k))} />
          <TextArea label="Hinweise" value={team.kits.notes ?? ''} onChange={(v) => set((t) => (t.kits.notes = v))} rows={2} />
        </Card>

        <Card title="Spielidee und Grundordnung (optional)">
          <p className="muted">Nur als ausdrückliche Eingabe des Trainers. Coach.AI entwickelt keine eigene Spielidee.</p>
          <TextArea
            label="Spielidee (Trainereingabe)"
            value={team.gameIdea?.text ?? ''}
            onChange={(v) => set((t) => (t.gameIdea = v.trim() ? { text: v, enteredBy: 'trainer', enteredAt: now() } : null))}
            rows={3}
          />
          <TextInput
            label="Grundordnung (Trainereingabe)"
            value={team.formation?.text ?? ''}
            onChange={(v) => set((t) => (t.formation = v.trim() ? { text: v, enteredBy: 'trainer', enteredAt: now() } : null))}
          />
        </Card>
      </div>

      <div className="two-col">
        <Card title="Dossiervorlage">
          <p>
            <strong>{team.template.name}</strong>{' '}
            {team.template.confirmedAt ? <Badge tone="ok">bestätigt {formatTimestamp(team.template.confirmedAt)}</Badge> : <Badge tone="warn">noch nicht bestätigt</Badge>}
          </p>
          <ol className="template-list">
            {ALL_SLIDES.map((k) => (
              <li key={k}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={team.template.slides.includes(k)}
                    disabled={k === 'titel' || k === 'auftrag'}
                    onChange={(e) =>
                      set((t) => {
                        const on = e.target.checked;
                        t.template.slides = ALL_SLIDES.filter((x) => (x === k ? on : t.template.slides.includes(x)));
                        t.template.confirmedAt = null;
                      })
                    }
                  />
                  {k === 'unsereForm' ? `${team.shortName} · Unsere Form` : SLIDE_NAMES[k]}
                </label>
              </li>
            ))}
          </ol>
          <p className="muted small">Die Vorlage gilt als bestätigt, sobald ein Dossier mit ihr bestätigt wird.</p>
        </Card>

        <Card title="Zuletzt bestätigter Kader">
          {team.lastConfirmedSquad ? (
            <p className="muted">
              {team.lastConfirmedSquad.players.length} Spieler · {team.lastConfirmedSquad.origin.kind === 'ersteingabe' ? 'Ersteingabe' : team.lastConfirmedSquad.origin.label} · Stand {formatTimestamp(team.lastConfirmedSquad.confirmedAt)}
            </p>
          ) : (
            <p className="muted">Noch kein bestätigter Kader. Erfassen Sie ihn hier oder im Fragebogen eines Spiels.</p>
          )}
          <SquadEditor
            players={team.lastConfirmedSquad?.players ?? []}
            onChange={(players) =>
              set((t) => {
                t.lastConfirmedSquad = { players, note: t.lastConfirmedSquad?.note ?? '', confirmedAt: now(), origin: { kind: 'ersteingabe' } };
              })
            }
          />
          <p className="muted small">Änderungen hier gelten für künftig angelegte Spiele. Bereits begonnene Vorbereitungen behalten ihren Kader.</p>
        </Card>
      </div>
    </div>
  );
}

function OffsetInput({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <Field label={label}>
      <input
        className="input input-num"
        inputMode="numeric"
        value={value === null ? '' : String(Math.abs(value))}
        placeholder="–"
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          onChange(Number.isFinite(n) ? -Math.abs(n) : null);
        }}
      />
    </Field>
  );
}

function ScheduleEditor({ title, blocks, onBlocks, extra, preview, previewNote = 'Vorschau für Anstoß 19:00' }: {
  title: string;
  blocks: TimeBlockTemplate[];
  onBlocks: (b: TimeBlockTemplate[]) => void;
  extra: React.ReactNode;
  preview: ReturnType<typeof computeHomeSchedule>;
  previewNote?: string;
}) {
  const setB = (i: number, patch: Partial<TimeBlockTemplate>) => onBlocks(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <Card title={title}>
      <div className="form-grid">{extra}</div>
      <p className="field-label">Programmpunkte (Minuten vor Anstoß)</p>
      {blocks.length === 0 && <p className="muted">Noch kein Zeitmuster. Ohne Zeitmuster bleibt der Ablauf im Dossier offen.</p>}
      <ul className="block-list">
        {blocks.map((b, i) => (
          <li key={b.id} className="block-row">
            <input className="input" aria-label="Bezeichnung" value={b.label} onChange={(e) => setB(i, { label: e.target.value })} />
            <span className="block-range">
              <span>−</span>
              <input className="input input-num" inputMode="numeric" aria-label="Beginn in Minuten vor Anstoß" value={Math.abs(b.startOffsetMin)} onChange={(e) => setB(i, { startOffsetMin: -Math.abs(parseInt(e.target.value || '0', 10)) })} />
              <span>bis −</span>
              <input className="input input-num" inputMode="numeric" aria-label="Ende in Minuten vor Anstoß" value={Math.abs(b.endOffsetMin)} onChange={(e) => setB(i, { endOffsetMin: -Math.abs(parseInt(e.target.value || '0', 10)) })} />
            </span>
            <button type="button" className="btn btn-icon btn-danger-ghost" aria-label={`${b.label} entfernen`} onClick={() => onBlocks(blocks.filter((_, j) => j !== i))}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn" onClick={() => onBlocks([...blocks, { id: uid('blk'), label: 'Neuer Programmpunkt', startOffsetMin: -30, endOffsetMin: -10, kind: 'sonstiges' }])}>
        + Programmpunkt
      </button>
      <details className="details">
        <summary>{previewNote}</summary>
        <ul className="sched-preview">
          {preview.items.map((it) => (
            <li key={it.id}>
              <span className="num">{it.start ? (it.end ? `${it.start}–${it.end}` : it.start) : 'offen'}</span> {it.label}
            </li>
          ))}
        </ul>
        {preview.open.map((o) => (
          <p key={o} className="muted small">
            {o}
          </p>
        ))}
      </details>
    </Card>
  );
}

function KitEditor({ label, kit, onChange }: { label: string; kit: KitCombination | null; onChange: (k: KitCombination | null) => void }) {
  const k = kit ?? { shirt: '', shorts: '', socks: '' };
  const set = (patch: Partial<KitCombination>) => {
    const next = { ...k, ...patch };
    onChange(next.shirt || next.shorts || next.socks ? next : null);
  };
  return (
    <fieldset className="kit">
      <legend>{label}</legend>
      <div className="form-grid three">
        <TextInput label="Trikot" value={k.shirt} onChange={(v) => set({ shirt: v })} />
        <TextInput label="Hose" value={k.shorts} onChange={(v) => set({ shorts: v })} />
        <TextInput label="Stutzen" value={k.socks} onChange={(v) => set({ socks: v })} />
      </div>
      <div className="form-grid three kit-images">
        {(['shirt', 'shorts', 'socks'] as const).map((part) => {
          const src = k.images?.[part];
          return (
            <label key={part} className="kit-image">
              {src ? <img src={src} alt="" /> : <span className="muted small">Kein Bild</span>}
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || file.size > 1_500_000) return;
                  const data = await new Promise<string>((res) => {
                    const r = new FileReader();
                    r.onload = () => res(String(r.result));
                    r.readAsDataURL(file);
                  });
                  set({ images: { ...k.images, [part]: data } });
                }}
              />
              {src && (
                <button type="button" className="btn btn-ghost btn-small" onClick={() => set({ images: { ...k.images, [part]: undefined } })}>
                  Bild entfernen
                </button>
              )}
            </label>
          );
        })}
      </div>
      <p className="muted small">Bilder (PNG/JPEG, höchstens 1,5 MB) erscheinen auf der Folie „Unser Spiel“.</p>
    </fieldset>
  );
}
