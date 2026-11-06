import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Flagged } from '../components';
import type { DossierContent, FV, Slide, SquadCard } from '../../dossier/model';

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
  const { home, away } = content.meta.crests;
  return (
    <div className="s-head">
      <div className="s-accent" />
      <div>
        <div className="s-kicker">{slide.kicker}</div>
        <h3 className="s-title">{slide.title}</h3>
      </div>
      {(home || away) && (
        <div className="s-crests" aria-label="Wappen der Spielpaarung">
          {home ? <img src={home} alt="Wappen Heim" referrerPolicy="no-referrer" /> : <span />}
          {away ? <img src={away} alt="Wappen Gast" referrerPolicy="no-referrer" /> : <span />}
        </div>
      )}
    </div>
  );
}

/** Fußzeile: nur Quellen (und kurze Hinweise wie Punktabzüge), Foliennummer unten rechts. */
function Foot({ slide, content }: { slide: Slide; content: DossierContent }) {
  const parts: string[] = [];
  const src = [...new Set(slide.sources)];
  if (src.length) parts.push(`${src.length > 1 ? 'Quellen' : 'Quelle'}: ${src.join(' · ')}`);
  if (slide.footnote) parts.push(slide.footnote);
  if (content.meta.containsDemoData) parts.push('Enthält Beispieldaten (fiktiv)');
  return (
    <div className="s-foot">
      <span className="s-foot-text">{parts.join('   |   ')}</span>
      <span className="s-num">
        {slide.number}/{content.slides.length}
      </span>
    </div>
  );
}

const Avatar = ({ photo, initials, name, size }: { photo?: string; initials: string; name: string; size: number }) =>
  photo ? (
    <img className="s-avatar" src={photo} alt={`Foto ${name}`} style={{ width: size, height: size }} loading="eager" referrerPolicy="no-referrer" />
  ) : (
    <div className="s-avatar s-avatar-initials" style={{ width: size, height: size, fontSize: size * 0.34 }} aria-hidden="true">
      {initials}
    </div>
  );

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
          {f.value.href ? (
            <a className="s-link" href={f.value.href} target="_blank" rel="noopener noreferrer">
              <Flagged v={f.value} />
            </a>
          ) : (
            <Flagged v={f.value} />
          )}
        </dd>
      </div>
    ))}
  </dl>
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
            {slide.venue.href ? (
              <a className="s-link" href={slide.venue.href} target="_blank" rel="noopener noreferrer">
                <Flagged v={slide.venue} /> ↗
              </a>
            ) : (
              <Flagged v={slide.venue} />
            )}
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
                    <th>Mannschaft</th>
                    <th>Sp.</th>
                    <th>S-U-N</th>
                    <th>Tore</th>
                    <th>Diff.</th>
                    <th>Pkt.</th>
                  </tr>
                </thead>
                <tbody>
                  {slide.table.map((r) => (
                    <tr key={r.team} className={[r.highlight ? `hl-${r.highlight}` : '', r.zone ? `zone-${r.zone}` : ''].join(' ')}>
                      <td>{r.rank}</td>
                      <td className="l">{r.team}</td>
                      <td>{r.played}</td>
                      <td>{r.record}</td>
                      <td>{r.goals}</td>
                      <td>{r.diff}</td>
                      <td>
                        <strong>
                          <Flagged v={r.points} />
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="s-open">Tabelle liegt nicht vor (offen)</p>
            )}
            <div className="s-zone-legend">
              {slide.zones.map((z) => (
                <span key={z.zone} className={`s-zone-key zone-${z.zone}`}>
                  {z.label}
                </span>
              ))}
              {slide.tableStatus.flag !== 'ok' && (
                <span className="s-status">
                  <Flagged v={slide.tableStatus} />
                </span>
              )}
            </div>
          </div>
          <div className="s-pair-col">
            <div className="s-box-title">Weitere Paarungen</div>
            {slide.pairings.length ? (
              <div className="s-pair-list">
                {slide.pairings.map((p, i) => (
                  <div key={i} className={`s-pair ${p.highlight ? 'hl' : ''}`}>
                    <div className="s-pair-when">{[p.day, p.time].filter(Boolean).join(' · ')}</div>
                    <div className="s-pair-teams">
                      {p.home} – {p.away}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="s-open">Keine Paarungen vorhanden (offen)</p>
            )}
          </div>
        </div>
      );
    case 'unserSpiel':
      return (
        <div className="s-grid s-match-grid">
          <Box title="Rahmen">
            <Facts items={slide.facts} />
          </Box>
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
          <Box title="Direkte Duelle">
            {slide.h2h.length ? (
              <table className="s-table s-table-small">
                <thead>
                  <tr>
                    <th>Saison</th>
                    <th>Datum</th>
                    <th>Wettbewerb</th>
                    <th>Ort</th>
                    <th>Ergebnis</th>
                  </tr>
                </thead>
                <tbody>
                  {slide.h2h.slice(0, 5).map((g, i) => (
                    <tr key={i}>
                      <td>{g.season}</td>
                      <td>{g.date}</td>
                      <td>{g.competition}</td>
                      <td>{g.match}</td>
                      <td>
                        <strong>{g.result}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="s-muted">{slide.h2hNote}</p>
            )}
          </Box>
          <Box title="Spielkleidung">
            {slide.kit.images.length ? (
              <div className="s-kit">
                {slide.kit.images.map((im) => (
                  <figure key={im.part}>
                    <img src={im.src} alt={`${im.part} ${im.text}`} />
                    <figcaption>
                      <strong>{im.part}</strong> {im.text}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="s-kit-text">
                <Flagged v={slide.kit.label} />
              </p>
            )}
          </Box>
        </div>
      );
    case 'gegnerForm':
    case 'unsereForm':
      return (
        <div className="s-grid s-grid-form">
          <div className="s-stack">
            <Box title="Letzte fünf Ligaspiele">
              {slide.last5.length ? (
                <table className="s-table s-table-form">
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th />
                      <th>Gegner</th>
                      <th>H/A</th>
                      <th>Erg.</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {slide.last5.map((r, i) => (
                      <tr key={i}>
                        <td>{r.date}</td>
                        <td className="s-crest-cell">{r.crest ? <img src={r.crest} alt="" referrerPolicy="no-referrer" /> : null}</td>
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
              ) : (
                <p className="s-muted">{slide.last5Note}</p>
              )}
            </Box>
            <Box title="Bilanz in der Liga">
              {slide.records.length > 0 && (
                <table className="s-table s-table-form">
                  <thead>
                    <tr>
                      <th />
                      <th>Sp.</th>
                      <th>S</th>
                      <th>U</th>
                      <th>N</th>
                      <th>Tore</th>
                      <th>Diff.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slide.records.map((r) => (
                      <tr key={r.label} className={r.flag !== 'ok' ? 'is-flag' : ''}>
                        <td className="l">
                          <strong>{r.label}</strong>
                        </td>
                        <td>{r.played}</td>
                        <td>{r.won}</td>
                        <td>{r.drawn}</td>
                        <td>{r.lost}</td>
                        <td>{r.goals}</td>
                        <td>{r.diff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {slide.recordsNote && (
                <p className="s-muted">
                  <Flagged v={slide.recordsNote} />
                </p>
              )}
            </Box>
          </div>
          <div className="s-facts-col">
            <div className="s-box-title">Fakten</div>
            {slide.facts.length ? (
              slide.facts.map((f, i) => (
                <div key={i} className="s-fact" title={f.note}>
                  <Flagged v={f} />
                </div>
              ))
            ) : (
              <p className="s-muted">Keine weiteren Fakten.</p>
            )}
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
                  <Avatar photo={p.photo?.url} initials={p.initials} name={p.name} size={104} />
                  {p.mvp !== undefined && (
                    <div className="s-player-mvp" title="FuPa-MVP-Wert">
                      <strong>{p.mvp} %</strong>
                      <span>MVP</span>
                    </div>
                  )}
                </div>
                <div>
                  <div className="s-player-name">{p.name}</div>
                  <div className="s-player-meta">{p.meta}</div>
                </div>
                {p.coachNote && <p className="s-coach">{p.coachNote}</p>}
                <div className="s-reasons">
                  {p.reasons.map((r, j) => (
                    <div key={j} className="s-reason">
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {slide.note && <p className="s-open">{slide.note}</p>}
          {slide.legend && <p className="s-legend">{slide.legend}</p>}
        </div>
      );
    case 'gegnerAuffaelligkeiten': {
      const max = Math.max(1, ...slide.phases.map((p) => Math.max(p.goalsFor, p.goalsAgainst)));
      return (
        <div className="s-stack">
          {slide.kpis.length ? (
            <div className="s-kpis" style={{ gridTemplateColumns: `repeat(${Math.min(slide.kpis.length, 7)}, 1fr)` }}>
              {slide.kpis.slice(0, 7).map((k) => (
                <div key={k.label} className="s-kpi">
                  <div className="s-kpi-v">{k.value}</div>
                  <div>{k.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="s-open">Keine Kennzahlen – Ergebnisdaten fehlen (offen)</p>
          )}
          <div className="s-grid s-grid-profile">
            <Box title="Tore nach Spielphasen">
              {slide.phases.length ? (
                <>
                  <div className="s-phases">
                    {slide.phases.map((p) => (
                      <div key={p.label} className="s-phase">
                        <div className="s-phase-bars">
                          <div className="s-bar s-bar-for" style={{ height: `${(p.goalsFor / max) * 100}%` }}>
                            <span>{p.goalsFor}</span>
                          </div>
                          <div className="s-bar s-bar-against" style={{ height: `${(p.goalsAgainst / max) * 100}%` }}>
                            <span>{p.goalsAgainst}</span>
                          </div>
                        </div>
                        <div className="s-phase-label">{p.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="s-phase-legend">
                    <span className="s-key s-key-for">Tore</span>
                    <span className="s-key s-key-against">Gegentore</span>
                    <span>Minuten · {slide.phasesBasis}</span>
                  </div>
                </>
              ) : (
                <p className="s-muted">Keine Spielberichte mit Torminuten vorhanden.</p>
              )}
            </Box>
            <div className="s-facts-col">
              <div className="s-box-title">Wichtige Statistiken</div>
              {slide.keyStats.length ? (
                slide.keyStats.map((t, i) => (
                  <div key={i} className="s-fact">
                    {t}
                  </div>
                ))
              ) : (
                <p className="s-muted">Keine Statistiken vorhanden.</p>
              )}
            </div>
          </div>
        </div>
      );
    }
    case 'soSpieltGegner': {
      const ph = Object.fromEntries(slide.phases.map((p) => [p.key, p]));
      const phase = (k: 'ballbesitz' | 'ballverlust' | 'gegnerBall' | 'ballgewinn') => {
        const p = ph[k];
        return (
          <div className={`s-phase-box s-phase-${k}`}>
            <div className="s-phase-title">{p.label}</div>
            <div className="s-phase-sub">{p.sub}</div>
            <p>
              <Flagged v={p.value} />
            </p>
          </div>
        );
      };
      return (
        <div className="s-model">
          <div className="s-model-top">
            <span className="s-chip">
              <strong>Grundordnung</strong> <Flagged v={slide.formation} />
            </span>
            {slide.absences && (
              <span className="s-chip s-chip-muted">
                <strong>Ausfälle</strong> <Flagged v={slide.absences} />
              </span>
            )}
          </div>
          <div className="s-model-cycle">
            {phase('ballbesitz')}
            {phase('ballverlust')}
            {phase('ballgewinn')}
            {phase('gegnerBall')}
            <div className="s-model-hub" aria-hidden="true">
              <span>Spiel&shy;phasen</span>
            </div>
          </div>
          <div className="s-model-extras">
            {slide.extras.map((x) => (
              <Box key={x.label} title={x.label}>
                <p>
                  <Flagged v={x.value} />
                </p>
              </Box>
            ))}
          </div>
        </div>
      );
    }
    case 'kader': {
      const card = (c: SquadCard, k: string) => (
        <div key={k} className="s-sq-card">
          <Avatar photo={c.photo} initials={c.initials} name={c.name} size={58} />
          <div>
            <div className="s-sq-name">{c.name}</div>
            {c.meta && <div className="s-sq-meta">{c.meta}</div>}
          </div>
        </div>
      );
      const dummy = (n: number, label: string) =>
        Array.from({ length: n }, (_, i) => (
          <div key={`d${label}${i}`} className="s-sq-card is-empty">
            <div className="s-avatar s-avatar-initials" style={{ width: 58, height: 58 }} />
            <div className="s-sq-name">{label}</div>
          </div>
        ));
      return (
        <div className="s-squad-grid">
          <div className="s-sq-col">
            <div className="s-box-title">Tor</div>
            {slide.goalkeepers.map((c, i) => card(c, `g${i}`))}
            {dummy(slide.placeholders.goalkeepers, 'Torwart')}
          </div>
          <div className="s-sq-col">
            <div className="s-box-title">Feldspieler</div>
            <div className="s-sq-field">
              {slide.players.map((c, i) => card(c, `p${i}`))}
              {dummy(slide.placeholders.players, slide.placeholders.playerLabel)}
            </div>
          </div>
          <div className="s-sq-col s-sq-coaches">
            <div className="s-box-title">Trainerteam</div>
            {slide.coaches.map((c, i) => card(c, `c${i}`))}
            {dummy(slide.placeholders.coaches, 'Trainer')}
          </div>
          {(slide.note || !slide.count) && (
            <p className="s-muted s-sq-note">
              {slide.count ? slide.note : 'Kader offen – Platzhalter für 2 Torhüter, 16 Feldspieler und 2 Trainer.'}
            </p>
          )}
        </div>
      );
    }
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
