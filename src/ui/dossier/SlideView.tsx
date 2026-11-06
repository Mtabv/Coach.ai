import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Flagged } from '../components';
import type { DossierContent, FV, Slide } from '../../dossier/model';

/** Rendert eine Dossierseite im Format 16:9 (1280×720), skaliert auf die verfügbare Breite. */
export function ScaledSlide({ slide, content, fixed = false }: { slide: Slide; content: DossierContent; fixed?: boolean }) {
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
  if (fixed) return <SlideCanvas slide={slide} content={content} />;
  return (
    <div className="slide-frame" ref={ref} style={{ height: 720 * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 1280, height: 720 }}>
        <SlideCanvas slide={slide} content={content} />
      </div>
    </div>
  );
}

function Head({ slide, content }: { slide: Slide; content: DossierContent }) {
  return (
    <div className="s-head">
      <div className="s-accent" />
      <div>
        <div className="s-kicker">{slide.kicker}</div>
        <h3 className="s-title">{slide.title}</h3>
      </div>
      <div className="s-num">
        {slide.number}/{content.slides.length}
      </div>
    </div>
  );
}

function Foot({ slide, content }: { slide: Slide; content: DossierContent }) {
  const parts: string[] = [];
  if (slide.sources.length) parts.push(`Quellen: ${[...new Set(slide.sources)].join(' · ')}`);
  if (slide.footnote) parts.push(slide.footnote);
  if (content.meta.containsDemoData) parts.push('Enthält Beispieldaten (fiktiv)');
  return <div className="s-foot">{parts.join('   |   ')}</div>;
}

function Box({ title, children, dark = false, className = '' }: { title?: string; children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <div className={`s-box ${dark ? 's-box-dark' : ''} ${className}`}>
      {title && <div className="s-box-title">{title}</div>}
      {children}
    </div>
  );
}

const Facts = ({ items }: { items: { label: string; value: FV }[] }) => (
  <dl className="s-facts">
    {items.map((f) => (
      <div key={f.label}>
        <dt>{f.label}</dt>
        <dd>
          <Flagged v={f.value} />
        </dd>
      </div>
    ))}
  </dl>
);

const Bullets = ({ items, empty }: { items: FV[]; empty: string }) =>
  items.length ? (
    <ul className="s-list">
      {items.map((f, i) => (
        <li key={i} title={f.note}>
          <Flagged v={f} />
        </li>
      ))}
    </ul>
  ) : (
    <p className="s-muted">{empty}</p>
  );

export function SlideCanvas({ slide, content }: { slide: Slide; content: DossierContent }) {
  if (slide.key === 'titel') {
    return (
      <div className="slide slide-title">
        <div className="st-kicker">{slide.kicker}</div>
        <div className="st-sub">{slide.title}</div>
        <div className="st-team">{slide.home}</div>
        <div className="st-vs">gegen</div>
        <div className="st-team">{slide.away}</div>
        <div className="st-meta">
          <div>
            {slide.competition} · {slide.matchdayLabel}
          </div>
          <div>
            <Flagged v={slide.dateLabel} /> · <Flagged v={slide.timeLabel} />
          </div>
          <div>
            <Flagged v={slide.venue} />
          </div>
        </div>
        {content.meta.containsDemoData && <div className="st-demo">Enthält Beispieldaten (fiktiv)</div>}
        <div className="st-bar" />
      </div>
    );
  }

  return (
    <div className="slide">
      <Head slide={slide} content={content} />
      <div className="s-body">{renderBody(slide)}</div>
      <Foot slide={slide} content={content} />
    </div>
  );
}

function renderBody(slide: Slide): ReactNode {
  switch (slide.key) {
    case 'titel':
      return null;
    case 'inhalt':
      return (
        <div className="s-toc">
          {slide.items.map((it) => (
            <div key={it.number} className="s-toc-item">
              <span className="s-toc-num">{String(it.number).padStart(2, '0')}</span>
              <div>
                <strong>{it.title}</strong>
                <span>{it.text}</span>
              </div>
            </div>
          ))}
        </div>
      );
    case 'spieltag':
      return (
        <div className="s-grid s-grid-table">
          <div>
            {slide.table.length ? (
              <table className="s-table s-table-compact">
                <thead>
                  <tr>
                    <th>Pl.</th>
                    <th className="l">Mannschaft</th>
                    <th>Sp.</th>
                    <th>S-U-N</th>
                    <th>Tore</th>
                    <th>Diff.</th>
                    <th>Pkt.</th>
                  </tr>
                </thead>
                <tbody>
                  {slide.table.map((r) => (
                    <tr key={r.team} className={r.highlight ? `hl-${r.highlight}` : ''}>
                      <td>{r.rank}</td>
                      <td className="l">
                        {r.team}
                        {r.deduction && <span className="s-ded"> {r.deduction} Abzug</span>}
                      </td>
                      <td>{r.played}</td>
                      <td>{r.record}</td>
                      <td>{r.goals}</td>
                      <td>{r.diff}</td>
                      <td>
                        <Flagged v={r.points} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="s-open">Tabelle liegt nicht vor (offen)</p>
            )}
            <div className="s-status">
              <Flagged v={slide.tableStatus} />
            </div>
          </div>
          <Box title="Spieltagspaarungen">
            {slide.pairings.length ? (
              <ul className="s-pairings">
                {slide.pairings.map((p, i) => (
                  <li key={i} className={p.highlight ? 'hl' : ''}>
                    <span>
                      {p.home} – {p.away}
                    </span>
                    <small>{p.when}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="s-open">Keine Paarungen vorhanden (offen)</p>
            )}
          </Box>
        </div>
      );
    case 'unserSpiel':
      return (
        <div className="s-grid s-grid-2">
          <div className="s-stack">
            <Box title="Rahmen">
              <Facts items={slide.facts} />
            </Box>
            <Box title="Direkte Duelle">
              {slide.h2h.length ? (
                <table className="s-table s-table-small">
                  <thead>
                    <tr>
                      <th className="l">Saison</th>
                      <th className="l">Datum</th>
                      <th className="l">Wettbewerb</th>
                      <th className="l">Begegnung</th>
                      <th>Erg.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slide.h2h.slice(0, 5).map((g, i) => (
                      <tr key={i}>
                        <td className="l">{g.season}</td>
                        <td className="l">{g.date}</td>
                        <td className="l">{g.competition}</td>
                        <td className="l">{g.match}</td>
                        <td>{g.result}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="s-muted">{slide.h2hNote}</p>
              )}
            </Box>
          </div>
          <Box title="Zeitplan" dark>
            {slide.schedule.length > 0 && (
              <ul className="s-schedule">
                {slide.schedule.map((it, i) => (
                  <li key={i}>
                    <span className={`t ${it.time.flag === 'offen' ? 'open' : ''}`}>{it.time.flag === 'offen' ? 'offen' : it.time.text}</span>
                    <span>
                      {it.label}
                      {it.note && <small> ({it.note})</small>}
                      {it.time.flag === 'trainer' && <small> · geändert</small>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {slide.scheduleOpen.length > 0 && <p className="s-sched-open">{slide.scheduleOpen.join(' ')}</p>}
          </Box>
        </div>
      );
    case 'gegnerForm':
    case 'unsereForm':
      return (
        <div className="s-grid s-grid-2">
          <div className="s-stack">
            <Box title="Letzte fünf Ligaspiele">
              {slide.last5.length ? (
                <table className="s-table">
                  <thead>
                    <tr>
                      <th className="l">Datum</th>
                      <th className="l">Gegner</th>
                      <th>H/A</th>
                      <th>Erg.</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {slide.last5.map((r, i) => (
                      <tr key={i}>
                        <td className="l">{r.date}</td>
                        <td className="l">{r.opponent}</td>
                        <td>{r.ha}</td>
                        <td>
                          <strong>{r.result}</strong>
                        </td>
                        <td>
                          <span className={`s-out s-out-${r.outcome}`}>{r.outcome}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              <p className="s-muted s-italic">{slide.last5Note}</p>
            </Box>
            <Box>
              <div className="s-team-strip">
                <strong>{slide.teamName}</strong>
                <span className="s-strip">
                  {slide.last5.map((r, i) => (
                    <span key={i} className={`s-out s-out-${r.outcome}`}>
                      {r.outcome}
                    </span>
                  ))}
                </span>
              </div>
            </Box>
          </div>
          <div className="s-stack">
            <Box title="Bilanzen">
              <Facts items={slide.records} />
            </Box>
            <Box title="Belegte Fakten">
              <Bullets items={slide.facts} empty="Keine weiteren belegten Fakten." />
            </Box>
          </div>
        </div>
      );
    case 'gegnerGefahr':
      return (
        <div>
          <div className="s-players" style={{ gridTemplateColumns: `repeat(${Math.max(slide.players.length, 1)}, 1fr)` }}>
            {slide.players.map((p, i) => (
              <div key={i} className="s-player">
                <div className="s-player-head">
                  {p.photo ? (
                    <img className="s-player-photo" src={p.photo.url} alt={`Foto ${p.name}`} title={`Foto: ${p.photo.credit}`} loading="eager" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="s-player-photo s-player-initials" aria-hidden="true">
                      {p.initials}
                    </div>
                  )}
                  {p.mvp !== undefined && (
                    <div className="s-player-mvp" title="FuPa-MVP-Wert">
                      <strong>{p.mvp} %</strong>
                      <span>MVP</span>
                    </div>
                  )}
                </div>
                <div className="s-player-name">{p.name}</div>
                <div className="s-muted">{p.meta}</div>
                <ul className="s-list">
                  {p.reasons.map((r, j) => (
                    <li key={j}>{r}</li>
                  ))}
                </ul>
                {p.coachNote && (
                  <p className="s-coach">
                    <strong>Trainerhinweis:</strong> {p.coachNote}
                  </p>
                )}
              </div>
            ))}
          </div>
          {slide.note && <p className="s-open">{slide.note}</p>}
          {slide.legend && <p className="s-legend">{slide.legend}</p>}
        </div>
      );
    case 'gegnerAuffaelligkeiten':
      return (
        <div className="s-stack">
          {slide.kpis.length ? (
            <div className="s-kpis">
              {slide.kpis.slice(0, 7).map((k) => (
                <div key={k.label} className="s-kpi">
                  <div className="s-kpi-v">{k.value}</div>
                  <div>{k.label}</div>
                  <small>{k.basis}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="s-open">Keine Kennzahlen – Ergebnisdaten fehlen (offen)</p>
          )}
          <div className="s-grid s-grid-2">
            <Box title="Mannschaftsprofil (aus Daten)">
              <Bullets items={slide.profile} empty="–" />
            </Box>
            <Box title="Belegte Besonderheiten">
              <Bullets items={slide.facts} empty="Keine belegten Besonderheiten." />
            </Box>
          </div>
        </div>
      );
    case 'soSpieltGegner':
      return (
        <div className="s-obs">
          {slide.phases.map((p) => (
            <Box key={p.label} title={p.label}>
              <p>
                <Flagged v={p.value} />
              </p>
            </Box>
          ))}
        </div>
      );
    case 'kader':
      return (
        <div>
          <div className="s-squad" style={{ gridTemplateColumns: `repeat(${Math.max(slide.groups.length, 1)}, 1fr)` }}>
            {slide.groups.length ? (
              slide.groups.map((g) => (
                <Box key={g.label} title={g.label}>
                  <ul className="s-plain">
                    {g.players.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </Box>
              ))
            ) : (
              <Box title="Kader">
                <p className="s-open">Keine Spieler erfasst (offen)</p>
              </Box>
            )}
          </div>
          <p className="s-muted">
            {slide.count} Spieler · {slide.origin}
            {slide.note && <> · {slide.note}</>}
          </p>
        </div>
      );
    case 'auftrag':
      return (
        <div className="s-stack">
          <div className="s-missions">
            {slide.messages.map((m, i) => (
              <div key={i} className="s-mission">
                <div className="s-mission-n">{i + 1}</div>
                <div className="s-mission-h">
                  <Flagged v={m.headline} />
                </div>
                <p>{m.text}</p>
              </div>
            ))}
          </div>
          <div className="s-motto">
            <Flagged v={slide.motto} />
          </div>
          {slide.mantras.length > 0 && (
            <div className="s-mantras">
              {slide.mantras.map((m) => (
                <div key={m}>{m}</div>
              ))}
            </div>
          )}
        </div>
      );
  }
}

/** Sammelt alle gekennzeichneten (ungesicherten) Werte einer Seite. */
export function slideIssues(slide: Slide): FV[] {
  const out: FV[] = [];
  const walk = (x: unknown) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(walk);
    const o = x as Record<string, unknown>;
    if (typeof o.text === 'string' && typeof o.flag === 'string') {
      if (['offen', 'widersprüchlich', 'veraltet'].includes(o.flag)) out.push(o as unknown as FV);
      return;
    }
    Object.values(o).forEach(walk);
  };
  walk(slide);
  return out;
}
