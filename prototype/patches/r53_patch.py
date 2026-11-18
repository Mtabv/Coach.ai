import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Spieler-Start: in der Wochenübersicht nur anzeigen (dabei / nicht dabei), absagen nur über „Abwesenheit eintragen“ ----
rep("""    if (r === 'nein') return `<span class="pw-ant"><span class="pill grey">nicht dabei</span>${spaet ? '' : `<button class="btn ghost small" data-reply="${e.id}" data-v="ja">doch dabei</button>`}</span>`;
    return `<span class="pw-ant"><span class="pill ok">dabei</span>${spaet ? '' : `<button class="btn ghost small" data-reply="${e.id}" data-v="nein">absagen</button>`}</span>`; };""",
    """    if (r === 'nein') return `<span class="pw-ant"><span class="pill grey">nicht dabei</span></span>`;
    return `<span class="pw-ant"><span class="pill ok">dabei</span></span>`; };""")
rep("""${status(e)}</div>${absage(e)}${spaetHinweis(e)}`).join('')}""", """${status(e)}</div>`).join('')}""")
rep("""<b>Schnell erledigt</b>""", """<b>Schnell erledigt</b><span class="note">Du kannst nicht? Trag einfach eine Abwesenheit ein – für alle Termine in dem Zeitraum giltst du dann als „nicht dabei“.</span>""")

# ---- Spieler-Kalender: ab heute (immer sichtbar, grün umrandet), alle kommenden Termine, scrollbar, ohne Trainingsinhalt ----
rep("""    kalender: () => zeitraumDienste(MON, addDays(MON, 13))""", """    kalender: () => pvKalender(),
    kalenderAlt: () => zeitraumDienste(MON, addDays(MON, 13))""")
rep("function pvStart(me) {", """function pvKalender() {
  const sichtbar = () => true; // alle Termine, auch die ohne Rückmeldung
  const letzter = events.reduce((m, e) => e.date > m ? e.date : m, TODAY);
  const tage = [];
  for (let x = TODAY; x <= letzter; x = addDays(x, 1)) if (x === TODAY || events.some(e => e.date === x && sichtbar(e))) tage.push(x);
  const abw = (iso) => absences.some(a => a.pid === ME && a.from <= iso && iso <= a.to);
  const pill = e => (e.type === 'tr' || e.type === 'gm') ? (abw(e.date) || absences.some(a => a.pid === ME && a.src === e.id) ? '<span class="pill grey">nicht dabei</span>' : '<span class="pill ok">dabei</span>') : '';
  return `<div class="pw-liste">${tage.map(iso => {
    const evs = events.filter(e => e.date === iso && sichtbar(e)).sort((a, b) => a.time.localeCompare(b.time));
    const ds = duties.filter(d => dienstOk(d) && dienstTage(d).includes(iso));
    return `<div class="pw-ktag ${iso === TODAY ? 'heute' : ''}"><div class="pw-kdatum"><b>${iso === TODAY ? 'Heute' : wochentag(iso)}</b><span class="note">${iso === TODAY ? wochentag(iso) + ', ' : ''}${fmt(iso)}</span></div>
      ${evs.map(e => `<div class="pw-ev t-${e.type}"><span class="pw-zeit">${e.time}</span><span>${e.type === 'gm' ? gameTitle(e) + (e.res ? ` (${e.res})` : '') : e.type === 'ev' ? esc(e.title) : 'Training'}<span class="note"> · ${esc(String(e.place || '').replace('Sportplatz ', ''))}</span></span>${pill(e)}</div>`).join('')}
      ${ds.map(d => `<div class="pw-ganz ${d.who.includes(ME) ? 'mein' : ''}"><span>${d.who.includes(ME) ? '★ ' : ''}${dienstText(d)}</span></div>`).join('')}
      ${!evs.length && !ds.length ? '<span class="note">Heute steht nichts an.</span>' : ''}</div>`; }).join('')}</div>`;
}
function pvStart(me) {""")

# ---- Spiel: Zeitplan, Kleidung, Fakten, darunter das Dossier als PDF (wenn freigegeben) ----
rep("""        <span>${facts.opp.slice(0,2).map(f=>'• '+esc(factText(f))).join('<br>')}</span><button class="btn ghost small" style="justify-self:start">Dossier ansehen</button></div>`:''}""",
    """        ${(REAL.facts && REAL.facts.opp || []).length ? `<b style="margin-top:6px">Fakten zu ${esc(ng.opp)}</b><ul class="flist pw-fakten">${REAL.facts.opp.map(f => `<li>${esc(f[0])}${f[1] ? `<small>${f[1]}</small>` : ''}</li>`).join('')}</ul>` : ''}
        <b style="margin-top:6px">Spieltagsdossier</b><div class="dossier-pdf" data-gid="${ng.id}" data-modus="ansehen"><span class="note">Wird geladen …</span></div></div>`:''}""")
rep("""    spiel: () => `${pv.vorbereitung?`""", """    spiel: () => `${pv.vorbereitung && ng?`""")
rep("""      ${pv.nachbereitung?`<div class="pt"><span class="note">Letztes Spiel""", """      ${pv.nachbereitung && lg?`<div class="pt"><span class="note">Letztes Spiel""")

# ---- Trainer: im Dossier-Reiter das PDF für die Spieler freigeben ----
rep("""  <div class="q dossierq" id="dossier-status">${dossierStatus(g)}</div>""", """  <div class="q dossierq" id="dossier-status">${dossierStatus(g)}</div>
  <div class="card"><div class="row between"><b>Für die Spieler freigeben</b><span class="note">erscheint in der Spieler-App unter „Spiel“</span></div><div class="dossier-pdf" data-gid="${g.id}" data-modus="freigeben"><span class="note">Wird geladen …</span></div></div>""")

# ---- Analytics für Spieler: keine Fragen an die Mannschaft, nur Fakten; keine Spielphasen, Noten oder Gespräche ----
rep("function askBox(key, list, label='Frage von 11Plan') {\n  list = list.filter(Boolean); if (!list.length) return '';",
    """let ALS_SPIELER = false;
/** Für Spieler: nur der Fakt, ohne die Frage am Ende. */
const nurFakt = t => String(t).split(/(?<=[.?!])\\s+/).filter(x => !/\\?$/.test(x.trim())).join(' ').trim();
function askBox(key, list, label='Frage von 11Plan') {
  list = list.filter(Boolean); if (ALS_SPIELER) { list = list.map(nurFakt).filter(Boolean); label = 'Fakt'; } if (!list.length) return '';""")
rep("""<button class="ib" data-reask="${key}" title="Neue Frage" aria-label="Neue Frage">""", """<button class="ib" data-reask="${key}" title="${ALS_SPIELER ? 'Neuer Fakt' : 'Neue Frage'}" aria-label="${ALS_SPIELER ? 'Neuer Fakt' : 'Neue Frage'}">""")
rep("""  <div class="card"><h3>Spielphasen im Verlauf</h3><p class="sub">Entsteht aus euren Nachbereitungen. Bisher ist noch kein Spiel nachbereitet.</p></div>""",
    """  ${ALS_SPIELER ? '' : `<div class="card"><h3>Spielphasen im Verlauf</h3><p class="sub">Entsteht aus euren Nachbereitungen. Bisher ist noch kein Spiel nachbereitet.</p></div>`}""")
rep("""${tile(p.assists??0,'Vorlagen','ganze Saison, FuPa')}${tile('–','Ø Note','noch keine Nachbereitung')}</div>""",
    """${tile(p.assists??0,'Vorlagen','ganze Saison, FuPa')}${ALS_SPIELER ? '' : tile('–','Ø Note','noch keine Nachbereitung')}</div>""")
rep("""  <div class="card"><div class="row between"><h3>Gespräche</h3>""", """  ${ALS_SPIELER ? '' : `<div class="card"><div class="row between"><h3>Gespräche</h3>""")
rep("""  <div class="card"><h3>Noten im Verlauf</h3><p class="sub">Entsteht aus den Spielernoten in den Nachbereitungen. Bisher gibt es noch keine.</p></div>`;""",
    """  <div class="card"><h3>Noten im Verlauf</h3><p class="sub">Entsteht aus den Spielernoten in den Nachbereitungen. Bisher gibt es noch keine.</p></div>`}`;""")
rep("""      <div class="phone-ana">${(state.pvAna||'team')==='team' && pv.analyticsTeam ? anaTeam() : (()=>{""",
    """      <div class="phone-ana">${(() => { ALS_SPIELER = true; try { return (state.pvAna||'team')==='team' && pv.analyticsTeam ? anaTeam() : (()=>{""")
rep("""state.anaPlayer = keep; return h; })()}</div>`,""", """state.anaPlayer = keep; return h; })(); } finally { ALS_SPIELER = false; } })()}</div>`,""")

# ---- Tabelle: Punkte direkt nach den Spielen, ohne Scrollen sichtbar ----
rep("""<th class="num">Sp.</th><th class="num">S</th><th class="num">U</th><th class="num">N</th><th class="num">Tore</th><th class="num">Diff.</th><th class="num">Pkt.</th>""",
    """<th class="num">Sp.</th><th class="num">Pkt.</th><th class="num">S</th><th class="num">U</th><th class="num">N</th><th class="num">Tore</th><th class="num">Diff.</th>""")
rep("""<td class="num">${r.sp}</td><td class="num">${r.s}</td><td class="num">${r.u}</td><td class="num">${r.n}</td><td class="num">${r.gf}:${r.ga}</td><td class="num">${r.gf-r.ga>0?'+':''}${r.gf-r.ga}</td><td class="num"><b>${r.pts}</b></td>""",
    """<td class="num">${r.sp}</td><td class="num"><b>${r.pts}</b></td><td class="num">${r.s}</td><td class="num">${r.u}</td><td class="num">${r.n}</td><td class="num">${r.gf}:${r.ga}</td><td class="num">${r.gf-r.ga>0?'+':''}${r.gf-r.ga}</td>""")

rep("</style>\n</head>", """.pw-liste { display: grid; gap: 8px; max-height: 70vh; overflow-y: auto; overscroll-behavior: contain; padding: 2px; }
.pw-ktag { display: grid; gap: 6px; border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; }
.pw-ktag.heute { border: 2px solid #86efac; box-shadow: 0 0 0 3px color-mix(in srgb, #86efac 15%, transparent); }
.pw-kdatum { display: flex; gap: 8px; align-items: baseline; }
.pw-fakten { margin: 0; }
.dossier-pdf { display: grid; gap: 6px; }
.dossier-pdf .row { flex-wrap: wrap; gap: 6px; }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
