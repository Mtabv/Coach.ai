import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)
def replace_fn(name, new):
    global s
    i = s.index(f'function {name}(')
    ends = [x for x in [s.find('\nfunction ', i+1), s.find('\n// ====', i+1), s.find('\nconst ', i+1), s.find('\nlet ', i+1)] if x != -1]
    s = s[:i] + new.strip('\n') + '\n' + s[min(ends)+1:]

# ---------- Wappen ----------
rep("function vUebung() {", r"""const crest = (name, cls='') => { const u = (REAL.crests||{})[name]; return u ? `<img class="crest ${cls}" src="${u}" alt="">` : `<span class="crest init ${cls}">${esc((name||'').replace(/^(SV|TSV|FC|SG|TSG|FSV|GSV|SC|VfB|TuS|FSC|Tuspo)\.?\s+/,'').slice(0,2))}</span>`; };
const gameTitleH = g => `<span class="gt">${g.home ? `${crest(REAL.team.name)}TSG <span class="dash">–</span> ${crest(g.opp)}${esc(g.opp)}` : `${crest(g.opp)}${esc(g.opp)} <span class="dash">–</span> ${crest(REAL.team.name)}TSG`}</span>`;
function vUebung() {""")
rep("<span class=\"gd-title\"><span class=\"comp k-${g.kind||'liga'}\">${g.comp}</span><b>${gameTitle(g)}</b></span>", "<span class=\"gd-title\"><span class=\"comp k-${g.kind||'liga'}\">${g.comp}</span><b>${gameTitleH(g)}</b></span>")
rep("<div class=\"head\"><div><h1>${gameTitle(g)}${g.res?` ${g.res}`:''}</h1>", "<div class=\"head\"><div><h1>${gameTitleH(g)}${g.res?` ${g.res}`:''}</h1>")
rep("<td><span class=\"comp k-${g.kind}\">${g.comp}</span> ${gameTitle(g)}</td>", "<td><span class=\"comp k-${g.kind}\">${g.comp}</span> ${gameTitleH(g)}</td>")
rep("<span class=\"t\">${e.time} Spiel${e.kind==='pokal'?' · Pokal':''}</span><span>${gameTitle(e)}</span>", "<span class=\"t\">${e.time} Spiel${e.kind==='pokal'?' · Pokal':''}</span><span>${gameTitleH(e)}</span>")
i = s.index("? `<a class=\"ev gm evlink"); j = s.index("<span>${gameTitle(e)}</span>", i)
s = s[:j] + "<span>${gameTitleH(e)}</span>" + s[j+len("<span>${gameTitle(e)}</span>"):]
rep("<td class=\"num\">${r.pl}</td><td>${esc(r.team)}</td>", "<td class=\"num\">${r.pl}</td><td><span class=\"tn\">${crest(r.team,'sm')}${esc(r.team)}</span></td>")
rep("<td class=\"num\">${x.pl}</td><td>${esc(x.team)}</td>", "<td class=\"num\">${x.pl}</td><td><span class=\"tn\">${crest(x.team,'sm')}${esc(x.team)}</span></td>")
# Eigenes Wappen in der Seitenleiste
rep("  state.game = REAL.next; state.post = lastPlayed.id;", "  const tEl = document.querySelector('.side .team'); if (tEl) tEl.innerHTML = `${crest(REAL.team.name,'own')}<span>TSG Wilhelmshöhe<br><small>1. Herren · ${esc(REAL.team.short)}</small></span>`;\n  state.game = REAL.next; state.post = lastPlayed.id;")

# ---------- Dashboard: Kästen mit Schnelleinstiegen statt Häkchenliste ----------
replace_fn('vDashboard', r'''
const SV = d => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  ball: SV('<circle cx="10" cy="10" r="7.5"/><path d="M10 6.5l3 2.2-1.1 3.6H8.1L7 8.7z"/>'), pen: SV('<path d="M13.5 3.5l3 3L8 15H5v-3z"/>'),
  cal: SV('<rect x="3" y="4.5" width="14" height="12" rx="1.5"/><path d="M3 8.5h14M7 3v3M13 3v3"/>'), run: SV('<circle cx="12" cy="4" r="1.6"/><path d="M8 18l2.5-5 2.5 2V19M6 10l3-3 3 1 2 3M10.5 13l-1-3"/>'),
  plus: SV('<path d="M10 4v12M4 10h12"/>'), shirt: SV('<path d="M7 3l-4 3 2 3 2-1v9h6V8l2 1 2-3-4-3c-.5 1.5-1.7 2-3 2s-2.5-.5-3-2z"/>'),
  clock: SV('<circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/>'), link: SV('<path d="M8.5 11.5l3-3M7 9l-2 2a3 3 0 004 4l2-2M13 11l2-2a3 3 0 00-4-4L9 7"/>'),
  chart: SV('<path d="M3 17h14M6 14V9M10 14V5M14 14v-3"/>'), doc: SV('<path d="M6 2.5h6l3 3V17.5H6z"/><path d="M12 2.5v3h3M8.5 10h4M8.5 13h4"/>'),
  car: SV('<path d="M4 13l1.5-4.5h9L16 13M3.5 13h13v3h-13z"/><circle cx="6.5" cy="16" r="1"/><circle cx="13.5" cy="16" r="1"/>'),
};
function dlink(href, title, sub, attrs='', icon='›', cls='') {
  return `<a class="dlink ${cls}" href="${href}" ${attrs}><span class="dl-ic">${icon}</span><span class="dl-tx"><b>${title}</b>${sub?`<small>${sub}</small>`:''}</span><span class="dl-go">›</span></a>`;
}
function vDashboard() {
  const nx = EV(REAL.next), after = games().filter(g=>!g.res && g.date > nx.date)[0], lp = games().filter(g=>g.res && g.post==='offen').pop();
  const wk = trainings().filter(t=>t.date>='2026-11-09' && t.date<='2026-11-22' && t.date>=TODAY);
  const short = wk.filter(t=>shortage(t).length);
  return `${demo}
  <div class="head"><div><h1>Dashboard</h1><p>KW 46 · 09.11. bis 15.11.2026 · Schwerpunkt (Beispiel): <b>${currentFocus.row}: ${currentFocus.title}</b></p></div><a class="btn ghost small" href="#kalender">Kalender öffnen</a></div>
  ${weekStrip('2026-11-09')}
  <div class="dgrid">
    <section class="card dbox"><h3>Spiel</h3>
      ${dlink('#spiel-vorbereitung', `${crest(nx.opp,'sm')}${esc(nx.opp)}`, `<b class="lbl">Spielvorbereitung</b> ${WD[dt(nx.date).getDay()]} ${fmt(nx.date)}, ${nx.time} Uhr · ${nx.home?'Heimspiel':'auswärts'} · Vorbereitung ${nx.prep}, Aufstellung offen`, `data-setgame="${nx.id}"`, I.ball, 'hot')}
      ${lp ? dlink('#spiel-nachbereitung', `${crest(lp.opp,'sm')}${esc(lp.opp)} ${lp.res}`, `<b class="lbl">Nachbereitung</b> ${fmt(lp.date)} · Fragebogen und Noten offen`, `data-setpost="${lp.id}"`, I.pen) : ''}
      ${after ? dlink('#spieltag', `${crest(after.opp,'sm')}${esc(after.opp)}`, `<b class="lbl">Danach</b> ${WD[dt(after.date).getDay()]} ${fmt(after.date)}, ${after.time} Uhr · ${after.comp}`, '', I.cal) : ''}</section>
    <section class="card dbox"><h3>Training</h3>
      ${wk.slice(0,3).map(t=>dlink('#einheit', `${DAYNAMES[dt(t.date).getDay()]}, ${fmt(t.date)} · ${t.time} Uhr`, t.unit ? esc(U(t.unit).name) : (t.ex&&t.ex.length ? `Eigene Zusammenstellung, ${t.ex.length} Übungen` : 'Einheit noch offen, jetzt planen'), `data-settrain="${t.id}"`, I.run, t.unit||(t.ex&&t.ex.length)?'':'hot')).join('')}
      ${short.map(t=>`<div class="warnbox">Zu wenige Spieler für den Plan am ${trLabel(t)}.</div>`).join('')}</section>
    <section class="card dbox"><h3>Schnelleinstieg</h3>
      ${dlink('#training', 'Übung erfassen', 'per Text oder Sprachnachricht, mit Skizze', 'data-ttabgo="uebungen"', I.plus)}
      ${dlink('#training', 'Trainingseinheit zusammenstellen', 'aus Übungen des Pools', 'data-ttabgo="einheiten"', I.plus)}
      ${dlink('#training', 'Periodisierung festlegen', 'Schwerpunkte für die nächsten Wochen', 'data-ttabgo="periode"', I.plus)}
      ${dlink('#philosophie', 'Spielphilosophie festlegen', 'Leitfragen und Prinzipien', '', I.plus)}</section>
    <section class="card dbox"><h3>Administratives</h3>
      ${dlink('#einstellungen', 'Auswärts- und Aufwärmkleidung hinterlegen', 'fehlt noch für das Dossier', 'data-settab="spieltag"', I.shirt)}
      ${dlink('#einstellungen', 'Trainingsdauer prüfen', 'angenommen: 90 Minuten', 'data-settab="training"', I.clock)}
      ${dlink('#spielersicht', 'Spieler-Links verschicken', 'damit Zu- und Absagen hier ankommen', '', I.link)}</section>
  </div>
  <section class="card"><h3>Nachrichten von Coach.AI</h3>
    <div class="msgs">
      ${dlink('#analytics', 'Saison-Zwischenbilanz nach 16 Spieltagen ist bereit', 'Tore, Gegentore je Viertelstunde, Spieler, Tabelle', '', I.chart, 'msg')}
      ${dlink('#spiel-nachbereitung', `Spielbericht geladen: ${esc(lp ? gameTitle(lp)+' '+lp.res : '')}`, `${lp?fmt(lp.date):''} · ${lp?(REAL.timeline[lp.id]||[]).length:0} Tore, ${lp?((REAL.lineups[lp.id]||{}).subs||[]).length:0} Wechsel. Nachbereitung starten?`, lp?`data-setpost="${lp.id}"`:'', I.doc, 'msg')}
      ${dlink('#analytics', `Tabelle aktualisiert: Platz ${REAL.tiles.place}, ${REAL.tiles.points} Punkte`, 'Stand 11.11.2026, von fussball.de', '', I.chart, 'msg')}
      ${(()=>{const rg=REAL.games.find(g=>g.id===REAL.next); return rg && rg.travel ? dlink('#spiel-vorbereitung', `Fahrzeit nach ${esc(rg.opp)}: ${rg.travel.min} Minuten`, `${de(rg.travel.km)} km ab ${esc(REAL.departure)}, OpenStreetMap. Treffpunkt im Zeitplan angepasst.`, `data-setgame="${rg.id}"`, I.car, 'msg') : '';})()}
    </div></section>
  <section class="card"><h3>Trainerteam</h3>
    <div class="row" style="flex-wrap:nowrap"><input type="text" id="cmt" placeholder="Kommentar oder Notiz für das Trainerteam" aria-label="Kommentar"><button class="btn small" data-comment="1">Senden</button></div>
    ${comments.length ? `<ul class="list">${comments.map(c=>`<li><span><b>${c.who}:</b> ${esc(c.text)}</span><span class="note" style="white-space:nowrap">${c.when}</span></li>`).join('')}</ul>` : '<p class="note" style="margin:0">Noch keine Notizen.</p>'}</section>`;
}
''')
rep("/* ---- Übungspool als Karten ---- */", """/* ---- Wappen und Dashboard ---- */
.crest { width: 22px; height: 22px; object-fit: contain; vertical-align: -5px; margin-right: 6px; flex: none; }
.crest.sm { width: 18px; height: 18px; vertical-align: -4px; margin-right: 5px; }
.crest.own { width: 44px; height: 52px; margin: 0; }
.crest.init { display: inline-grid; place-items: center; border-radius: 50%; background: var(--line); color: var(--muted); font: 700 10px/1 var(--body); text-transform: uppercase; }
.gt { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 0 2px; }
.gt .dash { margin: 0 6px; }
.tn { display: inline-flex; align-items: center; }
.side .team { display: flex; gap: 10px; align-items: center; }
.side .team small { color: var(--muted); }
.dgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
.dbox { gap: 8px; }
.dlink { display: grid; grid-template-columns: 34px minmax(0,1fr) auto; gap: 10px; align-items: center; padding: 9px 10px; border: 1px solid var(--line); border-radius: 8px; text-decoration: none; color: var(--ink); background: var(--panel); }
.dlink:hover { border-color: var(--accent); background: var(--accent-soft); }
.dlink.hot { border-left: 4px solid var(--warn); }
.dlink .dl-ic { width: 34px; height: 34px; border-radius: 8px; background: var(--bg); display: grid; place-items: center; color: var(--accent); }
.dlink .dl-ic svg { width: 20px; height: 20px; }
.dlink .dl-tx { display: grid; min-width: 0; }
.dlink .dl-tx > b { font-weight: 600; display: block; }
.dlink .dl-tx small { color: var(--muted); font-size: 13px; }
.dlink .lbl { display: block; color: var(--ink); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
.dlink .dl-go { color: var(--muted); font-size: 20px; }
.msgs { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 8px; }
.dlink.msg .dl-ic { background: var(--accent-soft); }
/* ---- Übungspool als Karten ---- */""")
open(p, 'w').write(s); print('ok')
