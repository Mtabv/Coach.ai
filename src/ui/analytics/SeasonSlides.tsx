import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BIN_LABELS, lateVerdict, type HalfState, type Res, type SeasonReport, type Split } from '../../analytics/report';
import type { SeasonData } from '../../analytics/types';

/** Farben für Tore/Gegentore: mit dem Palettenprüfer (CVD, Kontrast auf Weiß) validiert. */
export const C_FOR = '#2f8f62';
export const C_AGAINST = '#c95f24';

const f2 = (v: number) => v.toFixed(2).replace('.', ',');
const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
const dmy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const lastName = (n: string) => n.split(' ').slice(-1)[0];

export const SEASON_SLIDE_TITLES = ['Titel', 'Die Saison in Zahlen', 'Wann fallen die Tore?', 'Halbzeit und Endstand', 'Gegen wen?', 'Wer trifft, wer spielt?', 'Was die Daten nahelegen'];

export interface SeasonCtx {
  data: SeasonData;
  /** Wettbewerb laut Mannschaftsprofil (kürzer als der Staffelname von fussball.de). */
  competition: string;
  r: SeasonReport;
  teamName: string;
  shortName: string;
}

/** Eine Seite des Saisonreports, 1280×720, auf die verfügbare Breite skaliert. */
export function ScaledSeasonSlide({ index, ctx, fixed = false }: { index: number; ctx: SeasonCtx; fixed?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (fixed || !ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 1280));
    ro.observe(el);
    setScale(el.clientWidth / 1280);
    return () => ro.disconnect();
  }, [fixed]);
  const slide = <SeasonSlide index={index} ctx={ctx} />;
  if (fixed) return slide;
  return (
    <div className="slide-frame" ref={ref} style={{ height: 720 * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 1280, height: 720 }}>{slide}</div>
    </div>
  );
}

export function SeasonSlide({ index, ctx }: { index: number; ctx: SeasonCtx }) {
  switch (index) {
    case 0:
      return <TitleSlide ctx={ctx} />;
    case 1:
      return <OverviewSlide ctx={ctx} />;
    case 2:
      return <MinutesSlide ctx={ctx} />;
    case 3:
      return <HalftimeSlide ctx={ctx} />;
    case 4:
      return <OpponentsSlide ctx={ctx} />;
    case 5:
      return <PlayersSlide ctx={ctx} />;
    default:
      return <HintsSlide ctx={ctx} />;
  }
}

function Frame({ ctx, n, title, foot, children, bodyClass = '' }: { ctx: SeasonCtx; n: number; title: string; foot: string; children: ReactNode; bodyClass?: string }) {
  return (
    <div className="slide an-slide">
      <div className="s-head">
        <div className="s-accent" />
        <div>
          <div className="s-kicker">
            {ctx.shortName} · Saisonblick · {n}
          </div>
          <h3 className="s-title">{title}</h3>
        </div>
        <div className="an-crest">
          {ctx.data.crest && <img src={ctx.data.crest} alt="" referrerPolicy="no-referrer" />}
          <span className="s-num">{n + 1}</span>
        </div>
      </div>
      <div className={`s-body an-body ${bodyClass}`}>{children}</div>
      <div className="s-foot">{foot}</div>
    </div>
  );
}

const srcFoot = (ctx: SeasonCtx) =>
  `Quelle: fussball.de – Tabelle und ${ctx.r.n} Spielberichte${ctx.competition ? ` (${ctx.competition})` : ''}, ${ctx.r.withGoals} davon mit vollständigen Torminuten · abgerufen am ${dmy(ctx.data.fetchedAt.slice(0, 10))}`;

function TitleSlide({ ctx }: { ctx: SeasonCtx }) {
  const { r, data } = ctx;
  return (
    <div className="slide an-slide an-title">
      <div className="an-title-wrap">
        <div className="an-t-kicker">{ctx.shortName.toUpperCase()} · SAISONBLICK</div>
        <div className="an-t-sub">
          {ctx.competition || 'Liga'} · Saison {data.season} · {r.n} Ligaspiele{r.n ? ` vom ${dm(r.games[0].date)} bis ${dmy(r.games[r.n - 1].date)}` : ''}
        </div>
        <div className="an-t-team">
          {data.crest && <img src={data.crest} alt="" referrerPolicy="no-referrer" />}
          <span>{ctx.teamName}</span>
        </div>
        <div className="an-t-toc">
          {SEASON_SLIDE_TITLES.slice(1).map((t, i) => (
            <span key={t}>
              {i + 1} {t}
            </span>
          ))}
        </div>
      </div>
      <div className="an-t-note">Saison-Zwischenreport · nur gezählte Werte, keine Schätzungen · Stand {dmy(data.until)}</div>
    </div>
  );
}

function OverviewSlide({ ctx }: { ctx: SeasonCtx }) {
  const { r, data } = ctx;
  const lg = r.leagueGoalsPerGame;
  const ha = (label: string, x: SeasonData['homeRow']) =>
    x && (
      <div className="s-box">
        <div className="s-box-title">{label}</div>
        <div className="an-ha">
          <b>{x.points} Pkt.</b> aus {x.games} Spielen · {x.won} S {x.draw} U {x.lost} N · {x.goalsFor}:{x.goalsAgainst} Tore · Platz {x.place} der {label === 'Heim' ? 'Heimtabelle' : 'Auswärtstabelle'}
        </div>
      </div>
    );
  return (
    <Frame ctx={ctx} n={1} title="Die Saison in Zahlen" foot={srcFoot(ctx)} bodyClass="an-spread">
      <div className="an-tiles">
        <div className="an-tile dark">
          <div className="an-tl">Tabellenplatz</div>
          <div className="an-tv">{r.ownRow ? `${r.ownRow.place}.` : '–'}</div>
          <div className="an-ts">von {r.teamsInLeague} · Stand heute</div>
        </div>
        <div className="an-tile">
          <div className="an-tl">Punkte</div>
          <div className="an-tv">{r.points}</div>
          <div className="an-ts">
            {r.record.S} S · {r.record.U} U · {r.record.N} N{r.n ? ` · ${f2(r.points / r.n)} pro Spiel` : ''}
          </div>
        </div>
        <div className="an-tile">
          <div className="an-tl">Tore pro Spiel</div>
          <div className="an-tv" style={{ color: C_FOR }}>{r.n ? f2(r.goalsFor / r.n) : '–'}</div>
          <div className="an-ts">
            {r.goalsFor} Tore{lg !== null ? ` · Ligaschnitt ${f2(lg)}` : ''}
          </div>
        </div>
        <div className="an-tile">
          <div className="an-tl">Gegentore pro Spiel</div>
          <div className="an-tv" style={{ color: C_AGAINST }}>{r.n ? f2(r.goalsAgainst / r.n) : '–'}</div>
          <div className="an-ts">
            {r.goalsAgainst} Gegentore{lg !== null ? ` · Ligaschnitt ${f2(lg)}` : ''}
          </div>
        </div>
      </div>
      <div className="s-box">
        <div className="s-box-title">Alle {r.n} Ligaspiele</div>
        <div className="an-strip" style={{ gridTemplateColumns: `repeat(${Math.max(r.n, 10)}, 1fr)` }}>
          {r.games.map((g) => (
            <div key={g.id} className={`an-g an-g-${g.res}`}>
              <div className="an-gd">{dm(g.date)}</div>
              <div className="an-gr">{g.res}</div>
              <div className="an-gs">
                {g.goalsFor}:{g.goalsAgainst}
              </div>
              <div className="an-go">
                {g.home ? 'H' : 'A'} · {g.opponent}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="an-two">
        {ha('Heim', data.homeRow)}
        {ha('Auswärts', data.awayRow)}
      </div>
    </Frame>
  );
}

function MinutesChart({ r }: { r: SeasonReport }) {
  const W = 760, H = 330, PADL = 34, PADB = 34, TOP = 16, bw = 30;
  const mx = Math.max(1, ...r.binsFor, ...r.binsAgainst, ...(r.leagueBins ?? []));
  const step = mx > 12 ? 5 : mx > 6 ? 4 : 2;
  const ymax = (Math.floor(mx / step) + 1) * step;
  const gw = (W - PADL) / 6;
  const sy = (v: number) => TOP + (H - TOP - PADB) * (1 - v / ymax);
  const ticks: number[] = [];
  for (let v = 0; v <= ymax; v += step) ticks.push(v);
  const bar = (x: number, v: number, col: string) => {
    const y = sy(v), b = sy(0);
    const rr = Math.min(4, b - y);
    return <path d={`M${x},${b} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + bw - rr} Q${x + bw},${y} ${x + bw},${y + rr} V${b} Z`} fill={col} />;
  };
  const hx = PADL + gw * 3;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="an-chart" role="img" aria-label="Tore und Gegentore je 15 Minuten">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PADL} x2={W} y1={sy(v)} y2={sy(v)} stroke="#e3ebe5" />
          <text x={PADL - 8} y={sy(v) + 4} className="an-ax" textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {BIN_LABELS.map((l, i) => {
        const cx = PADL + gw * i + gw / 2;
        const vals = [r.binsFor[i], r.binsAgainst[i]];
        const xs = vals.map((_, j) => cx - bw - 1 + j * (bw + 2));
        const line = r.leagueBins ? sy(r.leagueBins[i]) : null;
        // Zahl über der Säule; läge sie auf der Ligaschnitt-Linie, rückt sie über die Linie.
        const labelY = (v: number) => {
          const ly = sy(v) - 6;
          return line !== null && line > ly - 15 && line < ly + 5 ? line - 6 : ly;
        };
        return (
          <g key={l}>
            {vals.map((v, j) => (
              <g key={`b${j}`}>
                {v > 0 && bar(xs[j], v, j === 0 ? C_FOR : C_AGAINST)}
                <title>{`${l}: ${v} ${j === 0 ? 'Tore' : 'Gegentore'}`}</title>
              </g>
            ))}
            {line !== null && (
              <g>
                <line x1={cx - bw - 8} x2={cx + bw + 8} y1={line} y2={line} stroke="#14211b" strokeWidth={2} strokeDasharray="5 3" />
                <title>{`${l}: Ligaschnitt ${r.leagueBins![i].toFixed(1).replace('.', ',')}`}</title>
              </g>
            )}
            {vals.map((v, j) => (
              <text key={`t${j}`} x={xs[j] + bw / 2} y={labelY(v)} className="an-vl" textAnchor="middle">
                {v}
              </text>
            ))}
            <text x={cx} y={H - 12} className="an-ax" textAnchor="middle">
              {l}
            </text>
          </g>
        );
      })}
      <line x1={PADL} x2={W} y1={sy(0)} y2={sy(0)} stroke="#9fb3a6" />
      <line x1={hx} x2={hx} y1={TOP} y2={sy(0)} stroke="#9fb3a6" strokeDasharray="4 4" />
      <text x={hx + 6} y={TOP + 10} className="an-ax">
        Halbzeit
      </text>
    </svg>
  );
}

function MinutesSlide({ ctx }: { ctx: SeasonCtx }) {
  const { r } = ctx;
  const ga = r.binsAgainst.reduce((s, v) => s + v, 0);
  const gf = r.binsFor.reduce((s, v) => s + v, 0);
  const lateFor = r.binsFor[4] + r.binsFor[5];
  const lateShareLeague = r.leagueShares ? r.leagueShares[5] : null;
  const expectedLate = ga * (lateShareLeague ?? 1 / 6);
  const verdict = lateVerdict(r.binsAgainst[5], expectedLate);
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  return (
    <Frame ctx={ctx} n={2} title="Wann fallen die Tore?" foot={`${srcFoot(ctx)} · nur Spiele mit vollständigem Spielbericht`} bodyClass="an-row">
      <div className="s-box an-chartbox">
        <div className="an-legend">
          <span>
            <i style={{ background: C_FOR }} />
            Tore ({gf})
          </span>
          <span>
            <i style={{ background: C_AGAINST }} />
            Gegentore ({ga})
          </span>
          {r.leagueBins && (
            <span>
              <i className="an-dash" />
              Ligaschnitt
            </span>
          )}
          <span className="an-muted">
            je 15 Min. · {r.withGoals} Spiele{r.leagueBins ? ` · Ligaschnitt aus ${r.leagueGamesWithGoals} Ligaspielen, auf ${r.withGoals} Spiele gerechnet` : ''}
          </span>
        </div>
        <MinutesChart r={r} />
      </div>
      <div className="an-side">
        <div className="s-box an-insight">
          <div className="s-box-title">Gegentore</div>
          <div className="an-big">{ga === 0 ? 'keine' : verdict === 'häufung' ? 'Häufung am Ende' : verdict === 'leicht' ? 'am Ende etwas mehr' : 'kein Einbruch am Ende'}</div>
          {ga > 0 && (
            <div>
              In der Schlussphase {r.binsAgainst[5]} von {ga} Gegentoren ({pct(r.binsAgainst[5] / ga)})
              {lateShareLeague !== null ? `, in der Liga fallen ${pct(lateShareLeague)} aller Tore ab der 76. Minute.` : '.'}{' '}
              {verdict === 'häufung' ? 'Deutlich mehr als zu erwarten.' : verdict === 'leicht' ? 'Etwas mehr als zu erwarten, aber noch kein belastbares Muster.' : 'Ein „Einbruch am Ende“ zeigt sich nicht.'}
            </div>
          )}
        </div>
        <div className="s-box an-insight">
          <div className="s-box-title">Eigene Tore</div>
          <div className="an-big">
            {lateFor} von {gf} nach der 60.
          </div>
          <div>In der ersten Halbzeit {r.binsFor[0] + r.binsFor[1] + r.binsFor[2]} Tore.</div>
        </div>
        {r.halves && (
          <div className="s-box an-insight">
            <div className="s-box-title">Halbzeiten</div>
            <div>
              1. Halbzeit <b>{r.halves.first.join(':')}</b> · 2. Halbzeit <b>{r.halves.second.join(':')}</b>
            </div>
          </div>
        )}
      </div>
    </Frame>
  );
}

const RES: Res[] = ['S', 'U', 'N'];
const HS: HalfState[] = ['Führung', 'Remis', 'Rückstand'];
const sumR = (x: Record<Res, number>) => x.S + x.U + x.N;

function HalftimeSlide({ ctx }: { ctx: SeasonCtx }) {
  const { r } = ctx;
  const behind = r.halfMatrix['Rückstand'];
  const lead = r.halfMatrix['Führung'];
  const fg = (k: 'wir' | 'gegner') => `${sumR(r.firstGoal[k])} Spiele · ${r.firstGoal[k].S} S ${r.firstGoal[k].U} U ${r.firstGoal[k].N} N`;
  return (
    <Frame ctx={ctx} n={3} title="Halbzeit und Endstand" foot={srcFoot(ctx)} bodyClass="an-row">
      <div className="s-box an-mbox">
        <table className="an-mat">
          <thead>
            <tr>
              <th />
              <th>Spiele</th>
              <th>Sieg</th>
              <th>Remis</th>
              <th>Niederlage</th>
            </tr>
          </thead>
          <tbody>
            {HS.map((k) => (
              <tr key={k}>
                <th>{k} zur Pause</th>
                <td className="an-n">{sumR(r.halfMatrix[k])}</td>
                {RES.map((x) => (
                  <td key={x} className={`an-c an-c-${x}${r.halfMatrix[k][x] === 0 ? ' an-z' : ''}`}>
                    {r.halfMatrix[k][x]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="an-muted an-small">Halbzeitstand aus den Torminuten der Spielberichte.</div>
      </div>
      <div className="an-side">
        <div className="s-box s-box-dark an-insight">
          <div className="s-box-title">Nach Rückstand zur Pause</div>
          <div className="an-big">
            {behind.S * 3 + behind.U} Punkte aus {sumR(behind)} Spielen
          </div>
          <div>
            {behind.S} S · {behind.U} U · {behind.N} N
          </div>
        </div>
        <div className="s-box an-insight">
          <div className="s-box-title">Führung zur Pause</div>
          <div>
            {sumR(lead)} Spiele, {lead.S} gewonnen.
            {r.lostLeads.length > 0 && <> Nicht gehalten: {r.lostLeads.map((g) => `${g.opponent} (${g.halftime!.join(':')} → ${g.goalsFor}:${g.goalsAgainst})`).join(', ')}.</>}
          </div>
        </div>
        <div className="s-box an-insight">
          <div className="s-box-title">Erstes Tor</div>
          <div>
            Wir treffen zuerst: {fg('wir')}
            <br />
            Gegner trifft zuerst: {fg('gegner')}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function OppCol({ title, s, note }: { title: string; s: Split; note: string }) {
  return (
    <div className="an-col">
      <div className="s-box">
        <div className="s-box-title">{title}</div>
        <div className="an-tv an-tv-m">
          {s.points} <small>Pkt. aus {s.games.length} Spielen</small>
        </div>
        <div className="an-ts">
          {s.games.length ? f2(s.points / s.games.length) : '–'} Punkte pro Spiel · {s.goalsFor}:{s.goalsAgainst} Tore
        </div>
        <div className="an-muted an-small">{note}</div>
      </div>
      <div className="s-box an-ollist">
        {[...s.games]
          .sort((a, b) => (a.oppPlace ?? 99) - (b.oppPlace ?? 99) || a.date.localeCompare(b.date))
          .map((g) => (
            <div key={g.id} className="an-ol">
              <span className={`an-r an-r-${g.res}`}>{g.res}</span>
              {g.oppPlace}. {g.opponent}
              <b>
                {g.goalsFor}:{g.goalsAgainst}
              </b>
              <em>{g.home ? 'H' : 'A'}</em>
            </div>
          ))}
      </div>
    </div>
  );
}

function OpponentsSlide({ ctx }: { ctx: SeasonCtx }) {
  const { r } = ctx;
  return (
    <Frame ctx={ctx} n={4} title="Gegen wen holen wir Punkte?" foot={`${srcFoot(ctx)} · Tabellenplatz der Gegner: Stand heute`} bodyClass="an-row">
      <OppCol title={`Gegen die obere Hälfte (Platz 1–${r.topCut})`} s={r.vsTop} note="Tabellenplatz des Gegners: Stand heute" />
      <OppCol title={`Gegen die untere Hälfte (Platz ${r.topCut + 1}–${r.teamsInLeague})`} s={r.vsBottom} note="Die direkten Konkurrenten" />
    </Frame>
  );
}

/** Spielerfoto; lädt das Bild nicht (Quelle offline, Bild gelöscht), bleibt der neutrale Kreis. */
function Photo({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="an-noimg" />;
  return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

function PlayerRow({ name, v, max, photo, suffix }: { name: string; v: number; max: number; photo?: string; suffix?: string }) {
  return (
    <div className="an-pr">
      <Photo src={photo} />
      <div className="an-pn">{name}</div>
      <div className="an-pb">
        <div style={{ width: `${Math.round((v / Math.max(1, max)) * 100)}%` }} />
      </div>
      <div className="an-pv">
        {v}
        {suffix && <small> {suffix}</small>}
      </div>
    </div>
  );
}

function PlayersSlide({ ctx }: { ctx: SeasonCtx }) {
  const { r, data } = ctx;
  const sc = r.scorers.slice(0, 6);
  const st = r.starters.slice(0, 6);
  return (
    <Frame ctx={ctx} n={5} title="Wer trifft, wer spielt?" foot="Quelle: fussball.de-Spielberichte (Torschützen, Startelf) · Fotos: FuPa, fehlende von fussball.de · Einsatzminuten nicht auswertbar, da der Spielbericht Auswechslungen nicht nennt" bodyClass="an-row">
      <div className="s-box an-col">
        <div className="s-box-title">Torschützen</div>
        {sc.map((p) => (
          <PlayerRow key={p.name} name={p.name} v={p.goals} max={sc[0].goals} photo={data.photos[p.name]} />
        ))}
        {sc.length > 0 && (
          <div className="an-muted an-small">
            {sc[0].goals} von {r.goalsFor} Toren erzielt {sc[0].name} ({Math.round((sc[0].goals / Math.max(1, r.goalsFor)) * 100)} %), {r.scorers.length} verschiedene Torschützen · Jokertore: {r.jokerGoals.length}
            {r.jokerGoals.length > 0 && ` – ${r.jokerGoals.map((j) => `${lastName(j.name)} (${j.game.opponent})`).join(', ')}`}
          </div>
        )}
      </div>
      <div className="s-box an-col">
        <div className="s-box-title">Startelf-Einsätze</div>
        {st.map((p) => (
          <PlayerRow key={p.name} name={p.name} v={p.starts} max={r.withLineup} photo={data.photos[p.name]} suffix={`/ ${r.withLineup}`} />
        ))}
        {r.withLineup > 0 && (
          <div className="an-muted an-small">
            {r.starters.length} verschiedene Spieler in der Startelf{r.avgChanges !== null ? ` · im Schnitt ${f2(r.avgChanges)} Wechsel in der Startelf von Spiel zu Spiel` : ''}
          </div>
        )}
      </div>
    </Frame>
  );
}

function HintsSlide({ ctx }: { ctx: SeasonCtx }) {
  const { r } = ctx;
  return (
    <Frame ctx={ctx} n={6} title="Was die Daten nahelegen" foot={`Grundlage: ${r.n} Ligaspiele · Grenzen: keine Schüsse, kein Ballbesitz, keine Laufdaten; kleine Stichprobe – Hinweise, keine Beweise`}>
      {r.hints.length ? (
        <div className="an-hints">
          {r.hints.map((h, i) => (
            <div key={h.id} className="s-box an-hint">
              <div className="an-hn">{i + 1}</div>
              <div>
                <b>{h.title}</b> {h.text}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="s-box an-hint">Noch zu wenige Spiele für belastbare Hinweise. Ab etwa acht Ligaspielen mit Spielbericht erscheinen hier Auffälligkeiten.</div>
      )}
      <div className="an-note">
        Das sind Hinweise aus gezählten Daten, keine Bewertung. Richtig aussagekräftig wird der Saisonblick, wenn die Nachbereitungen dazukommen: Bewertung der Spielphasen je Spiel, Spielerbewertungen und gesetzte Trainingsschwerpunkte.
      </div>
    </Frame>
  );
}
