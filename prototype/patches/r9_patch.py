import sys
p = sys.argv[1]
s = open(p).read()

def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

def replace_fn(name, new):
    global s
    i = s.index(f'function {name}(')
    ends = [x for x in [s.find('\nfunction ', i+1), s.find('\n// ====', i+1), s.find('\nconst ', i+1), s.find('\nlet ', i+1)] if x != -1]
    s = s[:i] + new.strip('\n') + '\n' + s[min(ends)+1:]

# ===================== Hilfen: Foto, Übungsdetails =====================
rep("// ======================= Kalender =======================", r"""const av = (p, cls='') => p && p.photo ? `<img class="av ${cls}" src="${p.photo}" alt="">` : `<span class="av ${cls} init">${p ? esc(p.name.split(' ').map(x=>x[0]).join('').slice(0,2)) : ''}</span>`;
const exLink = id => `<a href="#uebung" data-setex="${id}">${esc(X(id).name)}</a>`;
// Beispieltexte nach dem Muster Ziel, Aufbau, Ablauf, Coaching, Variationen
const EXD = {
  x1: ['Ballsicherheit unter Druck und sofortiges Umschalten nach Ballverlust.', 'Quadrat 20 × 20 m, fünf Spieler außen, zwei in der Mitte. Ein Minitor an jeder Seite außerhalb.', 'Außen spielen mit höchstens zwei Kontakten. Erobern die zwei Innenspieler den Ball, kontern sie auf ein Minitor. Wer den Ball verliert, geht in die Mitte.', 'Körperstellung offen, Pass in den richtigen Fuß, nach Ballverlust sofort Druck auf den Ball.', 'Ein Kontakt; Feld kleiner; drei Spieler in der Mitte.'],
  x2: ['Gegenpressing: den Ball innerhalb von fünf Sekunden zurückgewinnen.', 'Feld 40 × 30 m, zwei Teams mit je fünf Spielern, zwei neutrale Spieler für das ballbesitzende Team.', 'Spiel auf Ballbesitz. Nach Ballverlust zählt Rückeroberung innerhalb von fünf Sekunden doppelt. Durchgänge 4 × 4 Minuten.', 'Nächster Spieler attackiert den Ball, die anderen schließen die Passwege. Kompakt bleiben.', 'Tore auf beiden Grundlinien; Rückeroberung nur in der gegnerischen Hälfte zählt.'],
  x3: ['Flacher Spielaufbau gegen ein hohes Pressing.', 'Halbes Feld mit Tor. Torwart und vier Abwehrspieler gegen drei Pressingspieler. Zwei Dribbeltore an der Mittellinie.', 'Aufbau vom Torwart, Ziel ist ein Dribbling durch ein Tor an der Mittellinie. Ballgewinn der Pressingspieler endet mit Abschluss aufs Tor.', 'Breite und Tiefe im Aufbau, Torwart als freier Mann, Pass auf den freien Spieler statt in den Druck.', 'Vierter Pressingspieler; Sechser kommt dazu; Zeitlimit für den Aufbau.'],
  x4: ['Torabschluss nach Flanken aus verschiedenen Zonen.', 'Strafraum mit Tor, zwei Flügelzonen. Flankengeber außen, drei Angreifer im Zentrum.', 'Pass auf den Flügel, Flanke aus der Halbzone, vom Flügel oder als Rückpass von der Grundlinie. Angreifer laufen ersten Pfosten, zweiten Pfosten, Rückraum.', 'Timing der Läufe, nicht zu früh in den Strafraum, Flanke flach und scharf.', 'Ein Verteidiger dazu; Kopfball nur mit einem Kontakt.'],
  x5: ['Ecken gegen uns sicher verteidigen.', 'Strafraum mit Tor, vollständige Defensivaufstellung gegen Angreifer.', 'Ecken von beiden Seiten. Raumdeckung im Fünfmeterraum, drei Manndecker auf die Kopfballstärksten.', 'Erster Kontakt gehört uns, Ball weg aus der Zone, sofort herausrücken.', 'Kurze Ecke einbauen; zweiter Ball nach Abwehr.'],
  x6: ['Intensität und Ausdauer im Spiel gegen den Ball.', 'Feld 30 × 25 m mit zwei Toren, zwei Teams mit je vier Spielern, weitere Teams warten.', 'Vier Durchgänge zu vier Minuten, zwei Minuten aktive Pause.', 'Hohes Tempo, Zweikämpfe annehmen, Abstände halten.', 'Mit Torhütern; Wechselspieler an der Seitenlinie.'],
  x7: ['Schnelles Umschalten nach Ballgewinn in Überzahl.', 'Zwei Drittel des Feldes, ein Tor mit Torwart. Drei Angreifer gegen zwei Verteidiger.', 'Start mit Ballgewinn im Mittelfeld, Angriff innerhalb von zehn Sekunden abschließen. Danach Gegenangriff auf Minitore.', 'Erster Pass nach vorn, Breite nutzen, Abschluss suchen.', 'Zeitlimit acht Sekunden; ein Verteidiger läuft nach.'],
  x8: ['Spielnahe Anwendung des Schwerpunkts.', 'Ganzes Feld, 11 gegen 11 oder in der verfügbaren Anzahl.', 'Freies Spiel mit einer Aufgabe zum Schwerpunkt der Woche, zum Beispiel Tore nach Ballgewinn zählen doppelt.', 'Den Schwerpunkt im Spiel coachen, nicht jeden Fehler unterbrechen.', 'Mit Aufgabe je Mannschaftsteil; kürzere Spielzeiten.'],
  x9: ['Gemeinsames Anlaufen nach einem festen Auslöser.', 'Feld 50 × 40 m, zwei Teams mit je sechs Spielern, je ein Torwart.', 'Ein Rückpass zum Innenverteidiger löst das Pressing aus, alle schieben zusammen nach vorn.', 'Bogenlauf, Deckungsschatten nutzen, Nebenleute rücken nach.', 'Auslöser Pass auf den Außenverteidiger; Trainer gibt Rückpässe vor.'],
  x10: ['Passgenauigkeit mit Reaktion nach Ballverlust.', 'Passstern mit fünf Stationen, 25 × 25 m.', 'Passfolge im Stern, auf Zuruf geht der Passgeber sofort ins Gegenpressing gegen den nächsten Spieler.', 'Passschärfe, Anschlussaktion ohne Pause.', 'Linksfuß; zwei Bälle gleichzeitig.'],
};
function vUebung() {
  const e = X(state.exId) || exercises[0], d = EXD[e.id] || ['','','','',''];
  const used = units.filter(u=>u.ex.includes(e.id)), notes = exNotes[e.id] || [];
  const sec = (t, v) => `<div class="exsec"><h4>${t}</h4><p>${v ? esc(v) : '<span class="note">noch nicht beschrieben</span>'}</p></div>`;
  return `${demo}
  <div class="crumb"><a href="#training" data-ttabgo="uebungen">Übungspool</a> › ${esc(e.name)}</div>
  <div class="head"><div><h1>${esc(e.name)}</h1><div class="row" style="margin-top:6px"><span class="pill grey">${e.kind}</span>${e.pr?`<span class="pill">${PR(e.pr).phase}: ${PR(e.pr).name}</span>`:''}<span class="pill grey">${e.players} Spieler</span><span class="pill grey">${e.field}</span><span class="pill grey">${e.min} min</span><span class="pill warn">Beispiel</span></div></div>
    <button class="btn ghost small" data-flash="Bearbeiten: im Entwurf ohne Funktion.">Bearbeiten</button></div>
  ${flashBox()}
  <div class="grid g2" style="align-items:start"><div class="card">${sec('Ziel', d[0])}${sec('Aufbau', d[1])}${sec('Ablauf', d[2])}${sec('Coaching-Schwerpunkte', d[3])}${sec('Variationen', d[4])}</div>
    <div class="grid"><div class="card"><h3>Erfahrungen</h3>${notes.length ? `<ul class="list">${notes.map(n=>`<li><span>${fmt(n.date)} ${esc(n.text)}</span><span class="note">${esc(n.who)}</span></li>`).join('')}</ul>` : '<p class="sub">Noch keine. Sie entstehen, wenn ihr ein Training nachbereitet.</p>'}</div>
      <div class="card"><h3>Verwendet in Einheiten</h3>${used.length ? `<ul class="list">${used.map(u=>`<li><span>${esc(u.name)}</span></li>`).join('')}</ul>` : '<p class="sub">In keiner Einheit.</p>'}</div></div></div>`;
}
// ======================= Kalender =======================""")
rep("const R = {einheit:vEinheit,", "const R = {uebung:vUebung,einheit:vEinheit,")
rep("  const top = cur.startsWith('spiel-') ? 'spieltag' : cur === 'einheit' ? 'training' : cur;", "  const top = cur.startsWith('spiel-') ? 'spieltag' : (cur === 'einheit' || cur === 'uebung') ? 'training' : cur;")
rep("  if (d.settrain) state.trainEv = d.settrain;", "  if (d.settrain) state.trainEv = d.settrain;\n  if (d.setex) state.exId = d.setex;\n  if (d.ttabgo) state.trainTab = d.ttabgo;")
# Übungsnamen anklickbar
rep("const exList = u ? `<ol class=\"note exl\">${exl.map(id=>`<li>${X(id).name} (${X(id).min} min)", "const exList = u ? `<ol class=\"note exl\">${exl.map(id=>`<li>${exLink(id)} (${X(id).min} min)")
rep("        <small>${u.ex.map(id=>X(id).name).join(' → ')}</small></div>`;}).join('')}</div>`;}).join('')}</div>", "        <small>${u.ex.map(id=>exLink(id)).join(' → ')}</small></div>`;}).join('')}</div>`;}).join('')}</div>")
rep("${l.map(e=>`<tr><td><b>${e.name}</b><br>", "${l.map(e=>`<tr><td><b>${exLink(e.id)}</b><br>")
rep("<div><h4>${esc(name)}</h4>${id?", "<div><h4>${id?exLink(id):esc(name)}</h4>${id?")
# Formular „Übung erfassen“ nach dem Muster
rep("""    <div class="grid g3">
      <label class="fl" for="ue-o">Organisation und Ablauf<textarea id="ue-o" rows="3"></textarea></label>
      <label class="fl" for="ue-c">Coachingpunkte<textarea id="ue-c" rows="3"></textarea></label>
      <label class="fl" for="ue-v">So lief es, Varianten<textarea id="ue-v" rows="3"></textarea></label>
    </div></div>`;""", """    <div class="grid g3">
      <label class="fl" for="ue-s">Spieler<input id="ue-s" type="text" placeholder="z. B. 12"></label>
      <label class="fl" for="ue-f">Feld<input id="ue-f" type="text" placeholder="z. B. 40 × 30 m"></label>
      <label class="fl" for="ue-d">Dauer<input id="ue-d" type="text" placeholder="z. B. 20 min"></label>
    </div>
    <div class="grid g2">
      <label class="fl" for="ue-z">Ziel<textarea id="ue-z" rows="2"></textarea></label>
      <label class="fl" for="ue-a">Aufbau<textarea id="ue-a" rows="2" placeholder="Feld, Material, Teams"></textarea></label>
      <label class="fl" for="ue-b">Ablauf<textarea id="ue-b" rows="3"></textarea></label>
      <label class="fl" for="ue-c">Coaching-Schwerpunkte<textarea id="ue-c" rows="3"></textarea></label>
      <label class="fl" for="ue-v">Variationen<textarea id="ue-v" rows="2"></textarea></label>
    </div></div>`;""")

# ===================== Dashboard: Termine anklickbar =====================
replace_fn('weekStrip', r'''
function weekStrip(start) {
  const days = [0,1,2,3,4,5,6].map(i=>addDays(start,i));
  const cols = days.map(iso => events.some(e=>e.date===iso) ? 'minmax(0,1fr)' : '52px').join(' ');
  return `<div class="strip" style="grid-template-columns:${cols}">${days.map(iso=>{
    const evs = events.filter(e=>e.date===iso), abs = absentOn(iso);
    if (!evs.length) return `<div class="sday rest ${iso===TODAY?'today':''}"><b>${WD[dt(iso).getDay()]}</b><span class="note num">${fmt(iso)}</span></div>`;
    return `<div class="sday ${iso===TODAY?'today':''}"><b>${WD[dt(iso).getDay()]} ${fmt(iso)}</b>
      ${evs.map(e=>e.type==='ev' ? `<div class="ev xv"><span class="t">${e.time} ${esc(e.title)}</span></div>` : e.type==='gm'
        ? `<a class="ev gm evlink ${e.kind||''}" href="${e.res?'#spiel-nachbereitung':'#spiel-vorbereitung'}" ${e.res?`data-setpost="${e.id}"`:`data-setgame="${e.id}"`}><span class="t">${e.time} Spiel · ${e.comp.split(',')[0]} ›</span><span>${gameTitle(e)}</span>${e.res?`<span class="pill game" style="justify-self:start">${e.res}</span>`:availPill(iso,'gm')}</a>`
        : `<a class="ev tr evlink ${e.unit?'filled':''}" href="#einheit" data-settrain="${e.id}"><span class="t">${e.time} Training ›</span>${e.unit?`<span>${U(e.unit).name}</span><span class="note">${PR(U(e.unit).pr).phase}</span>`:`<span class="empty">Einheit offen, jetzt planen</span>`}${e.date>=TODAY?availPill(iso,'tr'):''}</a>`).join('')}
      ${abs.length && iso>=TODAY ? `<div class="abs"><b>fehlen:</b> ${abs.map(a=>P(a.pid).name.split(' ').slice(1).join(' ')).join(', ')}</div>` : ''}
    </div>`;}).join('')}</div>`;
}
''')

# ===================== Spieltag: nächstes Spiel + zwei, Rest aufklappbar, Pokal farbig =====================
rep("  return `<details class=\"gd ${isNext?'next':''}\" ${todo?'open':''}>", "  return `<details class=\"gd ${isNext?'next':''} k-${g.kind||'liga'}\" ${todo?'open':''}>")
rep("<span class=\"gd-title\"><span class=\"note\">${g.comp}</span><b>${gameTitle(g)}</b></span>", "<span class=\"gd-title\"><span class=\"comp k-${g.kind||'liga'}\">${g.comp}</span><b>${gameTitle(g)}</b></span>")
replace_fn('vSpieltag', r'''
function vSpieltag() {
  const up = games().filter(g=>!g.res), past = games().filter(g=>g.res).reverse(), nx = nextGame();
  const upShow = state.moreUp ? up : up.slice(0, 3), pastShow = state.morePast ? past : past.slice(0, 2);
  const more = (n, key, open) => n > 0 ? `<button class="morebtn" data-more="${key}">${open ? 'Weniger anzeigen' : `${n} weitere Spiele anzeigen`}</button>` : '';
  return `${demo}
  <div class="head"><div><h1>Spieltag</h1><p>Aufgeklappt ist, wo noch etwas zu tun ist.</p></div>
    <div class="legend"><span><i style="background:var(--accent)"></i>Liga</span><span><i style="background:var(--cup)"></i>Pokal</span><span><i style="background:var(--muted)"></i>Freundschaftsspiel</span></div></div>
  <h3 class="grp">Kommende Spiele</h3><div class="games">${upShow.map(g=>gameRow(g, g.id===nx.id)).join('')}${more(up.length-3, 'moreUp', state.moreUp)}</div>
  <h3 class="grp">Gespielt</h3><div class="games">${pastShow.map(g=>gameRow(g, false)).join('')}${more(past.length-2, 'morePast', state.morePast)}</div>`;
}
''')

# ===================== Kader: verständliche Spalten, sortierbar =====================
replace_fn('vKader', r'''
function vKader() {
  const K = state.kSort || {k:'pos', dir:1}, POSO = {TW:0, ABW:1, MF:2, ST:3};
  const val = {nr: p=>+p.nr||999, name: p=>p.name, pos: p=>POSO[p.pos]??9, games: p=>p.games, starts: p=>p.starts, goals: p=>p.goals, assists: p=>p.assists??0, grade: p=>p.grade??99};
  const list = [...players].sort((a,b)=>{ const x=val[K.k](a), y=val[K.k](b); return (x>y?1:x<y?-1:0)*K.dir || a.name.localeCompare(b.name); });
  const n = REAL.games.filter(g=>g.res && g.kind!=='test').length;
  const th = (k, l, num, title) => `<th class="${num?'num':''} sortable ${K.k===k?'on':''}" data-ksort="${k}" ${title?`title="${title}"`:''}>${l}${K.k===k?(K.dir>0?' ↑':' ↓'):''}</th>`;
  return `${demo}
  <div class="head"><div><h1>Kader</h1><p>${players.length} Spieler laut FuPa. Zahlen aus ${n} Pflichtspielen (fussball.de). Spaltenkopf antippen zum Sortieren.</p></div><button class="btn">Spieler anlegen</button></div>
  <div class="card scroll"><table class="ktab"><thead><tr>${th('nr','Nr.',true)}${th('name','Name')}${th('pos','Position')}${th('games','Im Kader',true,'im Spielberichtsbogen nominiert, Startelf und Bank')}${th('starts','Startelf',true)}${th('goals','Tore',true)}${th('assists','Vorlagen',true,'laut FuPa, ganze Saison')}${th('grade','Ø Note',true)}</tr></thead><tbody>
  ${list.map(p=>`<tr><td class="num">${p.nr}</td><td><span class="row" style="flex-wrap:nowrap;gap:8px">${av(p)}<b>${esc(p.name)}</b>${p.captain?' <span class="pill">C</span>':''}</span></td><td>${p.pos}</td><td class="num">${p.games}</td><td class="num">${p.starts}</td><td class="num">${p.goals}</td><td class="num">${p.assists??0}</td><td class="num">${p.grade!=null?de(p.grade):'–'}</td></tr>`).join('')}
  </tbody></table></div>
  <p class="note">Im Kader: wie oft im Spielberichtsbogen, also in der Startelf oder auf der Bank. Vorlagen kommen von FuPa und gelten für die ganze Saison.</p>`;
}
''')

# ===================== Analytics: Wettbewerbe auswählbar =====================
rep("// ======================= Analytics =======================", r"""// ======================= Analytics =======================
const COMPS = [['liga','Liga'],['pokal','Pokal'],['test','Freundschaftsspiele']];
const selGames = () => REAL.games.filter(g=>g.res && state.comp[g.kind]);
const compBox = () => `<div class="row compbox"><span class="note">Wettbewerbe:</span>${COMPS.map(([k,l])=>`<label class="row" for="cp-${k}"><input type="checkbox" id="cp-${k}" data-comp="${k}" ${state.comp[k]?'checked':''}> ${l} <span class="note">(${REAL.games.filter(g=>g.res&&g.kind===k).length})</span></label>`).join('')}</div>`;
function binOfMin(t, half) { const m = parseInt(t); if (half===1 && m>45) return 2; if (half===2 && m<=45) return 3; return Math.min(5, Math.max(0, Math.floor((m-1)/15))); }
function playerStats(gs) {
  const st = new Map(players.map(p=>[p.id, {games:0, starts:0, goals:0}]));
  for (const g of gs) { const lu = REAL.lineups[g.id]; if (lu) { lu.xi.forEach(n=>{const p=findPlayer(n); if (p) { st.get(p.id).games++; st.get(p.id).starts++; }}); lu.bench.forEach(n=>{const p=findPlayer(n); if (p) st.get(p.id).games++;}); }
    (REAL.timeline[g.id]||[]).filter(x=>x.own).forEach(x=>{const p=findPlayer(x.who); if (p) st.get(p.id).goals++;}); }
  return st;
}""")
replace_fn('anaTeam', r'''
function anaTeam() {
  const gs = selGames(), n = gs.length, bins = ['1–15','16–30','31–45','46–60','61–75','76–90'];
  if (!n) return compBox() + '<div class="card"><p class="sub">Kein Wettbewerb ausgewählt.</p></div>';
  const pts = gs.reduce((s,g)=>s+(g.gf>g.ga?3:g.gf===g.ga?1:0),0), gf = gs.reduce((s,g)=>s+g.gf,0), ga = gs.reduce((s,g)=>s+g.ga,0);
  const rec = {S:gs.filter(g=>g.gf>g.ga).length, U:gs.filter(g=>g.gf===g.ga).length, N:gs.filter(g=>g.gf<g.ga).length};
  const hp = gs.filter(g=>g.home), ap = gs.filter(g=>!g.home), P3 = l => l.reduce((s,g)=>s+(g.gf>g.ga?3:g.gf===g.ga?1:0),0);
  const bf = [0,0,0,0,0,0], ba = [0,0,0,0,0,0]; let full = 0;
  for (const g of gs) { const tl = REAL.timeline[g.id] || []; if (tl.length !== g.gf + g.ga) continue; full++; tl.forEach(x=>(x.own?bf:ba)[binOfMin(x.min, x.half)]++); }
  const lb = REAL.bins.league.map(v=>v / REAL.bins.full * full), T = REAL.tiles;
  const max = Math.max(1, ...bf, ...ba, ...lb);
  const tile = (v,l,c) => `<div class="tile"><div class="v">${v}</div><div class="c">${l}</div><div class="c">${c}</div></div>`;
  const pair = (own, col) => bins.map((b,i)=>`<div class="minibar"><span class="num">${b}</span><div class="pair"><div class="b1" style="width:${own[i]/max*100}%;background:${col}"></div><div class="b2" style="width:${lb[i]/max*100}%"></div></div><span class="num note">${own[i]} / ${de(lb[i])}</span></div>`).join('');
  const r = ba.map((v,i)=>lb[i]?v/lb[i]:0), bi = r.indexOf(Math.max(...r));
  return `${compBox()}
  <div class="tiles">
    ${tile(n,'Spiele',`${rec.S} S · ${rec.U} U · ${rec.N} N`)}${tile(de(pts/n,2),'Punkte pro Spiel',`Ligaschnitt: <b>${de(T.lppg,2)}</b>`)}${tile(de(gf/n,2),'Tore pro Spiel',`Ligaschnitt: <b>${de(T.lgpg,2)}</b>`)}${tile(de(ga/n,2),'Gegentore pro Spiel',`Ligaschnitt: <b>${de(T.lgpg,2)}</b>`)}
    ${tile(`${P3(hp)} / ${P3(ap)}`,'Punkte Heim / Auswärts',`aus ${hp.length} / ${ap.length} Spielen`)}${state.comp.liga?tile(T.place+'.','Tabellenplatz',`von ${T.teams}`):''}</div>
  <div class="grid g2">
    <div class="card"><h3>Wann fallen die Gegentore?</h3><p class="sub">${ba.reduce((a,b)=>a+b,0)} Gegentore aus ${full} Spielen mit vollständigem Bericht, grau der Ligaschnitt auf ${full} Spiele umgerechnet</p>
      ${pair(ba, 'var(--game)')}
      <div class="legend"><span><i style="background:var(--game)"></i>wir</span><span><i style="background:var(--muted);opacity:.5"></i>Ligaschnitt</span></div>
      ${full?`<div class="q">Im Verhältnis zum Ligaschnitt fallen die meisten Gegentore zwischen der ${bins[bi].replace('–','. und der ')}. Minute (${ba[bi]} gegenüber ${de(lb[bi])}). Liegt das eher an der Ordnung gegen den Ball oder am Umschalten nach Ballverlust?</div>`:''}</div>
    <div class="card"><h3>Wann fallen unsere Tore?</h3><p class="sub">${bf.reduce((a,b)=>a+b,0)} Tore aus ${full} Spielen, grau der Ligaschnitt</p>
      ${pair(bf, 'var(--accent)')}
      <div class="legend"><span><i style="background:var(--accent)"></i>wir</span><span><i style="background:var(--muted);opacity:.5"></i>Ligaschnitt</span></div></div>
  </div>
  <div class="card"><h3>Spielphasen im Verlauf</h3><p class="sub">Entsteht aus euren Nachbereitungen. Bisher ist noch kein Spiel nachbereitet.</p></div>
  <div class="card"><div class="row between"><h3>Tabelle ${esc(REAL.team.short)}</h3><span class="note">von fussball.de, Stand 11.11.2026${REAL.team.deduction?` · ${esc(REAL.team.deduction)}`:''}</span></div>${leagueTable(REAL.table)}
    <div class="legend"><span><i style="background:var(--accent)"></i>Aufstieg und Relegation</span><span><i style="background:var(--game)"></i>Abstieg</span><span>Form: letzte fünf Ligaspiele, das jüngste rechts</span></div></div>`;
}
''')
replace_fn('anaPlayer', r'''
function anaPlayer() {
  const p = P(state.anaPlayer), gs = selGames(), st = playerStats(gs).get(p.id);
  const tile = (v,l,c) => `<div class="tile"><div class="v">${v}</div><div class="c">${l}</div><div class="c">${c}</div></div>`;
  const rows = gs.filter(g=>{const lu=REAL.lineups[g.id]; return lu && [...lu.xi, ...lu.bench].some(n=>findPlayer(n)===p);}).reverse();
  return `${compBox()}<div class="row"><label class="row" for="anap">Spieler <select class="f" id="anap" style="width:auto">${players.map(x=>`<option value="${x.id}" ${x.id===p.id?'selected':''}>${x.nr?x.nr+' ':''}${x.name}</option>`).join('')}</select></label></div>
  <div class="row" style="align-items:center;gap:14px">${av(p,'big')}<div><h2>${esc(p.name)}</h2><span class="note">${p.pos}${p.captain?' · Kapitän':''}</span></div></div>
  <div class="tiles">${tile(st.games,'Im Kader',`von ${gs.length} Spielen`)}${tile(st.starts,'Startelf','')}${tile(st.goals,'Tore','')}${tile(p.assists??0,'Vorlagen','ganze Saison, FuPa')}${tile('–','Ø Note','noch keine Nachbereitung')}</div>
  <div class="card"><h3>Spiele</h3>${rows.length?`<div class="scroll"><table><tbody>${rows.map(g=>{const lu=REAL.lineups[g.id], xi=lu.xi.some(n=>findPlayer(n)===p), t=(REAL.timeline[g.id]||[]).filter(x=>x.own&&findPlayer(x.who)===p).length;
      return `<tr><td class="num">${fmt(g.date)}</td><td><span class="comp k-${g.kind}">${g.comp}</span> ${gameTitle(g)}</td><td><span class="pill game">${g.res}</span></td><td>${xi?'Startelf':'Bank'}</td><td>${t?`${t} Tor${t>1?'e':''}`:''}</td></tr>`;}).join('')}</tbody></table></div>`:'<p class="sub">In den ausgewählten Wettbewerben nicht im Spielberichtsbogen.</p>'}</div>
  <div class="card"><h3>Noten im Verlauf</h3><p class="sub">Entsteht aus den Spielernoten in den Nachbereitungen. Bisher gibt es noch keine.</p></div>`;
}
''')

# ===================== Spielvorbereitung neu gegliedert =====================
replace_fn('planRows', r'''
function travelOf(g) { const rg = REAL.games.find(x=>x.id===g.id); return state.travel[g.id] ?? (rg && rg.travel ? Math.ceil(rg.travel.min/5)*5 : 0); }
function planRows(g) {
  if (!state.plan[g.id]) {
    const rows = settings.flow[g.home?'heim':'auswärts'].map(([l,m]) => l.startsWith('Fahrt') ? [`Fahrt (${travelOf(g)} min)`, travelOf(g)] : [l,m]);
    state.plan[g.id] = flowTimes(rows, g.time).map(([t,l])=>[t,l]);
  }
  return state.plan[g.id];
}
''')
replace_fn('vVorbereitung', r'''
const QA = [['q1_grundordnung','Welche Grundordnung erwarten wir? Welche Wechsel sind zu beobachten?'],['q2_aufbau','Wie baut der Gegner auf und erzeugt Chancen?'],['q3_verteidigung','Wie verteidigt und presst er?'],
  ['q4_umschalten','Wie schaltet er nach Ballgewinn um?'],['q4b_ballverlust','Wie reagiert er nach Ballverlust?'],['q5b_standards','Wie gefährlich ist er bei Standards?'],['q5_staerken','Was sind seine größten Stärken?'],
  ['q6_verwundbar','Wo ist er verwundbar?'],['q7_schluesselspieler','Wer sind seine Schlüsselspieler?'],['q8_ausfaelle','Gibt es bekannte Ausfälle oder Besonderheiten?']];
const QE = [['u1_grundordnung','Mit welcher Grundordnung starten wir?'],['u2_ballbesitz','Eigener Ballbesitz: Wie bauen wir auf und kommen zu Chancen?'],['u3_ballverlust','Umschalten nach Ballverlust: Was passiert sofort?'],
  ['u4_gegnerball','Gegnerischer Ballbesitz: Wo laufen wir an, wie hoch stehen wir?'],['u5_ballgewinn','Umschalten nach Ballgewinn: Schnell nach vorn oder sichern?'],['u6_standards','Unsere Standards: Worauf achten wir?']];
function vVorbereitung() {
  const g = EV(state.game) && !EV(state.game).res ? EV(state.game) : nextGame(), RG = REAL.games.find(x=>x.id===g.id) || {};
  if (state.texts['kleidung-'+g.id] == null) state.texts['kleidung-'+g.id] = kitText(g);
  const isNext = g.id === REAL.next, src = t => `<span class="srcpill">${t}</span>`;
  const near = r => REAL.table.filter(x=>Math.abs(x.pl-r.pl)<=1), oppRow = REAL.table.find(x=>x.team===g.opp) || REAL.table.find(x=>x.opp);
  const tbl = [...new Map([...near(REAL.table.find(x=>x.own)), ...(oppRow?near(oppRow):[])].map(x=>[x.pl,x])).values()].sort((a,b)=>a.pl-b.pl);
  const plan = planRows(g), squad = state.squad[g.id] || (state.squad[g.id] = new Set(players.filter(p=>state.reply[g.id]==='ja' && p.id===ME).map(p=>p.id)));
  const qbox = (pre, list) => `<div class="grid g2">${list.map(([k,t])=>textBox(pre+k+'-'+g.id, t, isNext ? '' : 'noch offen')).join('')}</div>`;
  const parts = [
    ['s-spiel','Spiel und Treffpunkt', src('fussball.de, Einstellungen'), `<div class="grid g2 meet">
      <div class="fl"><span>Treffpunkt</span><b class="big">${plan[0][0]} Uhr · ${esc(plan[0][1])}</b><span class="note">errechnet: Anstoß minus Ablauf${g.home?'':' und Fahrzeit'} (Einstellungen › Spieltag)</span></div>
      <div class="fl"><span>Anstoß</span><b class="big">${['So','Mo','Di','Mi','Do','Fr','Sa'][dt(g.date).getDay()]} ${fmt(g.date)} · ${g.time} Uhr</b><span class="note">laut fussball.de</span></div>
      <div class="fl"><span>Spielort</span><b>${esc(RG.venue || g.place)}</b><span class="note">laut fussball.de</span></div>
      ${g.home ? '' : `<div class="fl"><label for="tv">Fahrzeit ab ${esc(REAL.departure)}</label><span class="row" style="flex-wrap:nowrap"><input id="tv" type="number" min="0" step="5" class="f" value="${travelOf(g)}" style="width:90px"> min</span>
        <span class="note">${RG.travel ? `Vorschlag: ${RG.travel.min} min für ${de(RG.travel.km)} km laut OpenStreetMap (OSRM), ohne Verkehr, auf 5 Minuten aufgerundet` : 'Kein Vorschlag gefunden, bitte eintragen.'}</span></div>`}</div>`],
    ['s-tabelle','Tabelle und Form', src('fussball.de'), `<div class="scroll"><table><thead><tr><th>Pl.</th><th>Mannschaft</th><th class="num">Sp.</th><th class="num">Pkt.</th><th title="letzte fünf Ligaspiele, das jüngste rechts">Form</th></tr></thead><tbody>${tbl.map(x=>`<tr ${x.own||x===oppRow?'style="font-weight:700"':''}><td class="num">${x.pl}</td><td>${esc(x.team)}</td><td class="num">${x.sp}</td><td class="num">${x.pts}</td><td class="note form">${x.form}</td></tr>`).join('')}</tbody></table></div><span class="note">Stand 11.11.2026</span>`],
    ['s-rahmen','Zeitplan und Kleidung', src('Einstellungen, änderbar'), `<div class="grid g2" style="align-items:start"><div class="tb"><div class="tbh"><span>Zeitplan</span><button class="btn ghost small" data-planadd="${g.id}">Zeile hinzufügen</button></div>
       <table class="plan"><thead><tr><th style="width:110px">Uhrzeit</th><th>Programmpunkt</th><th></th></tr></thead><tbody>${plan.map(([t,l],i)=>`<tr><td><input type="text" inputmode="numeric" class="f num" data-plan="${g.id}" data-i="${i}" data-k="0" value="${t}" aria-label="Uhrzeit"></td><td><input type="text" data-plan="${g.id}" data-i="${i}" data-k="1" value="${esc(l)}" aria-label="Programmpunkt"></td><td><button class="ib" data-plandel="${g.id}|${i}" aria-label="Zeile löschen">${ICON.x}</button></td></tr>`).join('')}</tbody></table></div>
       <div class="tb">${textBox('kleidung-'+g.id,'Kleidung','')}<div class="kitshow">${g.home && REAL.kit.images.shirt ? ['shirt','shorts','socks'].map(k=>REAL.kit.images[k]?`<img src="${REAL.kit.images[k]}" alt="">`:'').join('') : kitSvg(g.home?'Heim':'Auswärts')}</div></div></div>`],
    ['s-fakten','Fakten', src('fussball.de, fest'), isNext ? `<div class="grid g2" style="align-items:start"><div><h4>${esc(g.opp)}</h4><ul class="flist">${REAL.facts.opp.map(f=>`<li>${esc(f[0])}<small>${f[1]}</small></li>`).join('')}</ul></div>
       <div><h4>TSG Wilhelmshöhe</h4><ul class="flist">${REAL.facts.own.map(f=>`<li>${esc(f[0])}<small>${f[1]}</small></li>`).join('')}</ul></div></div>` : '<p class="sub">Werden für jedes Spiel aus fussball.de berechnet. Im Entwurf nur für das nächste Spiel.</p>'],
    ['s-ki','KI-Erkenntnisse aus den Zahlen', src('Analytics, änderbar'), isNext ? `<p class="sub" style="margin:0">Vorschläge aus dem Zahlenwerk. Passt einer nicht, ändere ihn, zieh einen neuen oder entferne ihn.</p>
       <div class="grid g2" style="align-items:start"><div class="grid"><h4>${esc(g.opp)}</h4>${facts.opp.map(factCard).join('')}<button class="btn ghost small" data-addfact="opp" style="justify-self:start">Erkenntnis hinzufügen</button></div>
       <div class="grid"><h4>TSG Wilhelmshöhe</h4>${facts.own.map(factCard).join('')}<button class="btn ghost small" data-addfact="own" style="justify-self:start">Erkenntnis hinzufügen</button></div></div>` : '<p class="sub">Im Entwurf nur für das nächste Spiel.</p>'],
    ['s-gegner','Gegnerbeobachtung', src('Trainerfragebogen'), qbox('a-', QA)],
    ['s-plan','Unser Plan nach Spielphasen', src('Trainerfragebogen'), qbox('e-', QE)],
    ['s-auftrag','Unser Auftrag', src('Trainerfragebogen'), `<div class="grid g2">${textBox('d-botschaft-'+g.id,'Botschaften an die Mannschaft','bis zu drei, in deinen Worten', 3)}${textBox('d-motto-'+g.id,'Leitmotiv','ein Satz', 1)}</div>`],
    ['s-kader','Kader', src('Zusagen der Spieler'), `<p class="sub" style="margin:0">Wer für dieses Spiel zugesagt hat, steht automatisch im Kader. Bisher hat noch niemand über seinen Link geantwortet. Du kannst den Kader auch selbst zusammenstellen.</p>
       <div class="pickgrid">${players.map(p=>{const a=absentOn(g.date).find(x=>x.pid===p.id);return `<label class="pick ${squad.has(p.id)?'on':''} ${a?'out':''}" for="sq-${p.id}"><input type="checkbox" id="sq-${p.id}" data-squad="${g.id}|${p.id}" ${squad.has(p.id)?'checked':''} ${a?'disabled':''}>${av(p)}<span>${esc(p.name)}<small>${a?a.why:p.pos}</small></span></label>`;}).join('')}</div>
       <span class="note">${squad.size} im Kader</span>`],
    ['s-aufst','Aufstellung', src('optional'), `<p class="sub" style="margin:0">Kommt nur ins Dossier, wenn du den Haken setzt.</p><a class="btn ghost small" href="#spiel-aufstellung" style="justify-self:start">Aufstellung bearbeiten</a>`],
  ];
  if (state.include['s-aufst'] == null) state.include['s-aufst'] = false;
  return `${demo}${spielHead(g,'spiel-vorbereitung')}
  <p class="sub" style="margin:0">Aufgebaut wie das Dossier. Jede Seite zeigt, woher die Inhalte kommen: feste Daten, KI-Erkenntnisse aus den Zahlen oder dein Fragebogen.</p>
  ${REAL.ask && isNext ? `<div class="q"><b>Rückfrage von Coach.AI:</b> ${esc(REAL.ask)}</div>` : ''}
  ${readBox(g)}
  ${parts.map(([id,title,sp,body],n)=>slide(n,[id,title],body).replace('</h3>', `</h3>${sp}`)).join('')}
  <div class="card finish"><div class="row between"><div><h3>Fertig?</h3><p class="sub">Das PDF enthält genau die Seiten mit Haken „im Dossier“.</p></div>
    <div class="row"><button class="btn ghost" data-msg="1">Mannschaftsnachricht</button>${state.released[g.id]?'':`<button class="btn ghost" data-release="${g.id}">Für Spieler freigeben</button>`}<button class="btn" data-pdf="1">Dossier als PDF erzeugen</button></div></div></div>`;
}
''')
# KI-Erkenntnisse statt fester Fakten im änderbaren Pool
rep("  factPool.opp = REAL.facts.opp; factPool.own = REAL.facts.own;", "  factPool.opp = REAL.insights.opp; factPool.own = REAL.insights.own;")
rep("<button class=\"ib\" data-regen=\"${f.id}\" title=\"Neuen Fakt ziehen\" aria-label=\"Neuen Fakt ziehen\">", "<button class=\"ib\" data-regen=\"${f.id}\" title=\"Neue Erkenntnis ziehen\" aria-label=\"Neue Erkenntnis ziehen\">")
rep("'Für diesen Bereich gibt es im Entwurf keine weiteren Fakten.'", "'Für diesen Bereich gibt es keine weiteren Erkenntnisse.'", 0)

# ===================== Fotos zu Namen =====================
rep("const pName = p => `${p.name}${isTW(p)?' (TW)':''}`;", "const pName = p => `${av(p,'sm')} ${p.name}${isTW(p)?' (TW)':''}`;")
rep("<button data-bench=\"${p.id}\" class=\"${a?'out':''}\" ${a?'disabled':''}><span>${p.nr} ${p.name}</span>", "<button data-bench=\"${p.id}\" class=\"${a?'out':''}\" ${a?'disabled':''}><span class=\"row\" style=\"flex-wrap:nowrap;gap:6px\">${av(p,'sm')}${p.nr} ${p.name}</span>")
rep("${xi.map(p=>`<tr><td><b>${p.nr?p.nr+' ':''}${esc(p.name)}</b>", "${xi.map(p=>`<tr><td><span class=\"row\" style=\"flex-wrap:nowrap;gap:8px\">${av(p)}<b>${p.nr?p.nr+' ':''}${esc(p.name)}</b></span>")
rep("<div class=\"phone\"><div class=\"phone-h\"><b>Coach.AI</b><span class=\"note\">${me.name}</span></div>", "<div class=\"phone\"><div class=\"phone-h\"><b>Coach.AI</b><span class=\"row\" style=\"gap:6px\">${av(me,'sm')}<span class=\"note\">${me.name}</span></span></div>")

# ===================== Spielersicht: Analytics wie oben =====================
i = s.index("    analytics: () => `${pv.analyticsSelf?"); j = s.index("\n  };", i)
s = s[:i] + r"""    analytics: () => `<div class="ptabs">${[['team','Mannschaft',pv.analyticsTeam],['spieler','Spieler',pv.analyticsSelf]].filter(x=>x[2]).map(([k,l])=>`<button data-pvana="${k}" class="${(state.pvAna||'team')===k?'on':''}">${l}</button>`).join('')}</div>
      <div class="phone-ana">${(state.pvAna||'team')==='team' && pv.analyticsTeam ? anaTeam() : (()=>{ const keep = state.anaPlayer; state.anaPlayer = ME; const h = anaPlayer().replace(/<div class="row"><label class="row" for="anap">[\s\S]*?<\/label><\/div>/, ''); state.anaPlayer = keep; return h; })()}</div>`,""" + s[j:]

# ===================== Ereignisse =====================
rep("  else if (d.rhadd)", r"""  else if (d.more) { state[d.more] = !state[d.more]; render(); }
  else if (d.ksort) { const K = state.kSort || {k:'pos', dir:1}; state.kSort = {k:d.ksort, dir: K.k===d.ksort ? -K.dir : (['games','starts','goals','assists'].includes(d.ksort) ? -1 : 1)}; render(); }
  else if (d.pvana) { state.pvAna = d.pvana; render(); }
  else if (d.rhadd)""")
rep("  else if (t.id === 'evbox') {", r"""  else if (d.comp) { state.comp[d.comp] = t.checked; render(); }
  else if (t.id === 'tv') { const g = EV(state.game); state.travel[g.id] = Math.max(0, +t.value||0); delete state.plan[g.id]; render(); }
  else if (d.squad) { const [gid, pid] = d.squad.split('|'); const set = state.squad[gid]; t.checked ? set.add(pid) : set.delete(pid); render(); }
  else if (t.id === 'evbox') {""")
rep("include:{}, trainEv:", "include:{}, comp:{liga:true, pokal:true, test:false}, travel:{}, squad:{}, moreUp:false, morePast:false, exId:'x1', trainEv:")

# ===================== CSS =====================
rep("/* ---- Echte Daten ---- */", """/* ---- Runde 8 ---- */
:root { --cup: #a8741a; --cup-soft: #f8eedb; }
:root[data-theme="dark"] { --cup: #e3b45c; --cup-soft: #3a2f17; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --cup: #e3b45c; --cup-soft: #3a2f17; } }
.day { min-width: 0; overflow: hidden; }
.day .ev { min-width: 0; overflow: hidden; }
.day .ev select { width: 100%; max-width: 100%; min-width: 0; }
.day .ev .pill, .sday .ev .pill { white-space: normal; justify-self: start; max-width: 100%; }
.day .ev span, .day .abs div { overflow-wrap: anywhere; }
a.evlink { text-decoration: none; color: inherit; display: grid; }
a.evlink:hover { box-shadow: 0 0 0 2px currentColor; }
a.ev.tr.evlink .t { color: var(--tr); }
.ev.gm.pokal { border-color: var(--cup) !important; background: var(--cup-soft); }
.ev.gm.pokal .t { color: var(--cup); }
.gd.k-pokal { border-left: 6px solid var(--cup); }
.gd.k-test { border-left: 6px solid var(--muted); }
.gd.k-liga { border-left: 6px solid var(--accent); }
.comp { font-size: 12px; border-radius: 10px; padding: 0 8px; justify-self: start; display: inline-block; }
.comp.k-liga { background: var(--accent-soft); color: var(--accent); }
.comp.k-pokal { background: var(--cup-soft); color: var(--cup); font-weight: 600; }
.comp.k-test { background: var(--bg); color: var(--muted); border: 1px solid var(--line); }
.morebtn { border: 1px dashed var(--line); background: var(--panel); border-radius: 10px; padding: 10px; cursor: pointer; color: var(--accent); font-weight: 600; }
th.sortable { cursor: pointer; user-select: none; white-space: nowrap; }
th.sortable:hover, th.sortable.on { color: var(--ink); }
.av.init { display: inline-grid; place-items: center; font-size: 11px; font-weight: 700; color: var(--muted); }
.av.sm { width: 22px; height: 22px; vertical-align: -6px; }
.av.big { width: 64px; height: 64px; }
.att li { display: flex; align-items: center; gap: 6px; }
.compbox { gap: 14px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
.srcpill { margin-left: 10px; font: 600 11px/1.6 var(--body); text-transform: uppercase; letter-spacing: .04em; color: var(--muted); border: 1px solid var(--line); border-radius: 10px; padding: 1px 8px; vertical-align: 3px; }
.meet .fl { display: grid; gap: 2px; }
.meet .big { font-size: 18px; }
.flist { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
.flist small { display: block; color: var(--muted); }
.slide h4 { margin: 0; font-size: 15px; }
.pickgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 6px; }
.pick { display: flex; align-items: center; gap: 8px; border: 1px solid var(--line); border-radius: 8px; padding: 5px 8px; cursor: pointer; font-size: 14px; }
.pick.on { border-color: var(--accent); background: var(--accent-soft); }
.pick.out { opacity: .5; }
.pick small { display: block; color: var(--muted); font-size: 12px; }
.exsec h4 { margin: 0 0 2px; font-size: 15px; }
.exsec p { margin: 0; }
.exsec { border-bottom: 1px solid var(--line); padding-bottom: 8px; }
.exsec:last-child { border-bottom: 0; }
.phone-ana { display: grid; gap: 10px; }
.phone-ana .grid.g2 { grid-template-columns: 1fr; }
.phone-ana .tiles { grid-template-columns: repeat(2, 1fr); }
.phone-ana .card { padding: 10px; }
.phone-ana .compbox { flex-wrap: wrap; font-size: 13px; }
/* ---- Echte Daten ---- */""")
rep('`<div class="ev gm"><span class="t">${e.time} Spiel</span>', '`<div class="ev gm ${e.kind||\'\'}"><span class="t">${e.time} Spiel${e.kind===\'pokal\'?\' · Pokal\':\'\'}</span>')
rep('`<span class="chip gm" title', '`<span class="chip gm ${e.kind===\'pokal\'?\'pokal\':\'\'}" title')
rep('.ev.gm.pokal {', '.chip.gm.pokal { background: var(--cup-soft); color: var(--cup); }\n.ev.gm.pokal {')
rep("[data-useunit], [data-exadd]'); if (!t) return;", "[data-useunit], [data-exadd], [data-ksort]'); if (!t) return;")
rep("„Nachbereitung gegen SV Musterdorf ist da“", "„Die Nachbereitung zum letzten Spiel ist da“")
open(p, 'w').write(s)
print('ok')
