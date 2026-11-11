import sys
src, data, dst = sys.argv[1:4]
s = open(src).read()

def rep(a, b, count=1):
    global s
    assert a in s, a[:100]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

def replace_fn(name, new):
    global s
    i = s.index(f'function {name}(')
    ends = [x for x in [s.find('\nfunction ', i+1), s.find('\n// ====', i+1), s.find('\nconst ', i+1), s.find('\nlet ', i+1)] if x != -1]
    s = s[:i] + new.strip('\n') + '\n' + s[min(ends)+1:]

def replace_between(start, end, new):
    global s
    i = s.index(start); j = s.index(end, i)
    s = s[:i] + new + s[j:]

rep('<title>Coach.AI Teamzentrale Entwurf</title>', '<title>Coach.AI TSG Wilhelmshöhe</title>')
rep('<select id="who"><option>Trainer</option><option>Co-Trainer</option></select>', '<select id="who"><option>Manuel Viehmann</option><option>Thorsten Klemann</option></select>')
rep('<span>Beide sehen und bearbeiten dieselben Daten.</span>', '<span>Trainer und Co-Trainer sehen und bearbeiten dieselben Daten.</span>')
rep('<script>\n', '<script>\n' + open(data).read(), 1)

# ---------- Hinweisleiste ----------
i = s.index('const demo = `'); j = s.index('`;', i) + 2
s = s[:i] + ("const demo = `<div class=\"demo\"><b>Echte Daten</b> (Stand 11.11.2026): Spielplan, Ergebnisse, Tabelle und Spielberichte von fussball.de, Kader und Fotos von FuPa, "
             "Zeitplan und Spielkleidung aus euren Eingaben. <b>Beispiele</b>, bis ihr eigene erfasst: Übungen, Einheiten, Periodisierung, Prinzipien. Zu- und Absagen, Noten und Dienste sind noch leer. Die Seite speichert noch nichts.</div>`;") + s[j:]

# ---------- Tabelle ----------
replace_fn('leagueTable', r'''
function leagueTable(rows) {
  const z = REAL.team.zones || {promotion:1, promotionPlayoff:0, relegation:3}, n = REAL.table.length;
  return `<div class="scroll"><table class="ltab"><thead><tr><th class="num">Pl.</th><th>Mannschaft</th><th class="num">Sp.</th><th class="num">S</th><th class="num">U</th><th class="num">N</th><th class="num">Tore</th><th class="num">Diff.</th><th class="num">Pkt.</th><th title="letzte fünf Ligaspiele, das jüngste rechts">Form</th></tr></thead><tbody>
    ${rows.map(r=>`<tr class="${r.own?'own':''} ${r.pl<=z.promotion+(z.promotionPlayoff||0)?'up':''} ${r.pl>n-z.relegation?'down':''}"><td class="num">${r.pl}</td><td>${esc(r.team)}</td><td class="num">${r.sp}</td><td class="num">${r.s}</td><td class="num">${r.u}</td><td class="num">${r.n}</td><td class="num">${r.gf}:${r.ga}</td><td class="num">${r.gf-r.ga>0?'+':''}${r.gf-r.ga}</td><td class="num"><b>${r.pts}</b></td><td class="note form">${r.form}</td></tr>`).join('')}</tbody></table></div>`;
}
''')
rep('<div class="card"><div class="row between"><h3>Tabelle Gruppenliga</h3><span class="note">von fussball.de, Stand 10.11.2026</span></div>${leagueTable(LEAGUE)}',
    '<div class="card"><div class="row between"><h3>Tabelle ${esc(REAL.team.short)}</h3><span class="note">von fussball.de, Stand 11.11.2026${REAL.team.deduction?` · ${esc(REAL.team.deduction)}`:''}</span></div>${leagueTable(REAL.table)}')
rep('${leagueTable(LEAGUE.slice(0,6))}<span class="note">Platz 1 bis 6 von 16</span>', '${leagueTable(REAL.table)}')

# ---------- Analytics ----------
replace_fn('anaTeam', r'''
function anaTeam() {
  const T = REAL.tiles, B = REAL.bins, bins = ['1–15','16–30','31–45','46–60','61–75','76–90'];
  const max = Math.max(...B.own_against, ...B.league, ...B.own_for);
  const tile = (v,l,c) => `<div class="tile"><div class="v">${v}</div><div class="c">${l}</div><div class="c">${c}</div></div>`;
  const pair = (own, col) => bins.map((b,i)=>`<div class="minibar"><span class="num">${b}</span><div class="pair"><div class="b1" style="width:${own[i]/max*100}%;background:${col}"></div><div class="b2" style="width:${B.league[i]/max*100}%"></div></div><span class="num note">${own[i]} / ${de(B.league[i])}</span></div>`).join('');
  return `<div class="tiles">
    ${tile(de(T.ppg,2),'Punkte pro Spiel',`Liga: <b>${de(T.lppg,2)}</b>`)}${tile(de(T.gpg,2),'Tore pro Spiel',`Liga: <b>${de(T.lgpg,2)}</b>`)}${tile(de(T.gapg,2),'Gegentore pro Spiel',`Liga: <b>${de(T.lgpg,2)}</b>`)}
    ${tile(T.place+'.','Tabellenplatz',`von ${T.teams}`)}${tile(`${T.home} / ${T.away}`,'Punkte Heim / Auswärts',`aus ${T.homeG} / ${T.awayG} Spielen`)}</div>
  <div class="grid g2">
    <div class="card"><h3>Wann fallen die Gegentore?</h3><p class="sub">${B.own_against.reduce((a,b)=>a+b,0)} Gegentore aus ${B.full} Ligaspielen je Viertelstunde, daneben der Ligaschnitt auf ${B.full} Spiele umgerechnet (${B.league_full} Spielberichte der Liga)</p>
      ${pair(B.own_against, 'var(--game)')}
      <div class="legend"><span><i style="background:var(--game)"></i>wir</span><span><i style="background:var(--muted);opacity:.5"></i>Ligaschnitt</span></div>
      <div class="q">${(()=>{const r=B.own_against.map((v,i)=>v/B.league[i]);const i=r.indexOf(Math.max(...r));return `In jeder Viertelstunde fallen mehr Gegentore als im Ligaschnitt, am deutlichsten zwischen der ${bins[i].replace('–','. und der ')}. Minute (${B.own_against[i]} gegenüber ${de(B.league[i])} im Ligaschnitt). Liegt das eher an der Ordnung gegen den Ball oder am Umschalten nach Ballverlust?`;})()}</div></div>
    <div class="card"><h3>Wann fallen unsere Tore?</h3><p class="sub">${B.own_for.reduce((a,b)=>a+b,0)} Tore aus ${B.full} Ligaspielen, daneben der Ligaschnitt</p>
      ${pair(B.own_for, 'var(--accent)')}
      <div class="legend"><span><i style="background:var(--accent)"></i>wir</span><span><i style="background:var(--muted);opacity:.5"></i>Ligaschnitt</span></div></div>
  </div>
  <div class="card"><h3>Spielphasen im Verlauf</h3><p class="sub">Entsteht aus euren Nachbereitungen. Bisher ist noch kein Spiel nachbereitet.</p></div>
  <div class="card"><div class="row between"><h3>Tabelle ${esc(REAL.team.short)}</h3><span class="note">von fussball.de, Stand 11.11.2026${REAL.team.deduction?` · ${esc(REAL.team.deduction)}`:''}</span></div>${leagueTable(REAL.table)}
    <div class="legend"><span><i style="background:var(--accent)"></i>Aufstieg und Relegation</span><span><i style="background:var(--game)"></i>Abstieg</span></div></div>`;
}
''')
replace_fn('anaPlayer', r'''
function anaPlayer() {
  const p = P(state.anaPlayer), n = REAL.games.filter(g=>g.res && g.kind!=='test').length;
  const tile = (v,l,c) => `<div class="tile"><div class="v">${v}</div><div class="c">${l}</div><div class="c">${c}</div></div>`;
  return `<div class="row"><label class="row" for="anap">Spieler <select class="f" id="anap" style="width:auto">${players.map(x=>`<option value="${x.id}" ${x.id===p.id?'selected':''}>${x.nr?x.nr+' ':''}${x.name}</option>`).join('')}</select></label></div>
  <div class="row" style="align-items:center;gap:14px">${p.photo?`<img class="avbig" src="${p.photo}" alt="">`:''}<div><h2>${esc(p.name)}</h2><span class="note">${p.pos}${p.captain?' · Kapitän':''}</span></div></div>
  <div class="tiles">${tile(p.games,'Im Spielberichtsbogen',`von ${n} Pflichtspielen`)}${tile(p.starts,'Startelf','')}${tile(p.goals,'Tore','Pflichtspiele')}${tile('–','Ø Note','noch keine Nachbereitung')}</div>
  <div class="card"><h3>Noten im Verlauf</h3><p class="sub">Entsteht aus den Spielernoten in den Nachbereitungen. Bisher gibt es noch keine.</p></div>`;
}
''')
rep('<img class="kitphoto"', '<img class="kitphoto"', 0)

# ---------- Kader ----------
replace_fn('vKader', r'''
function vKader() {
  return `${demo}
  <div class="head"><div><h1>Kader</h1><p>${players.length} Spieler laut FuPa · Spielberichtsbogen, Startelf und Tore aus ${REAL.games.filter(g=>g.res && g.kind!=='test').length} Pflichtspielen (fussball.de). Noten kommen aus den Nachbereitungen.</p></div><div class="row"><button class="btn ghost" data-flash="Im Entwurf ohne Funktion. Abwesenheiten tragen Spieler in ihrer Ansicht selbst ein.">Abwesenheit eintragen</button><button class="btn">Spieler anlegen</button></div></div>
  ${flashBox()}
  <div class="card scroll"><table><thead><tr><th class="num">Nr.</th><th>Name</th><th>Position</th><th class="num">Im Bogen</th><th class="num">Startelf</th><th class="num">Tore</th><th class="num">Ø Note</th><th>Abwesend</th></tr></thead><tbody>
  ${players.map(p=>{const a=absences.filter(x=>x.pid===p.id&&x.to>=TODAY);return `<tr><td class="num">${p.nr}</td><td><span class="row" style="flex-wrap:nowrap;gap:8px">${p.photo?`<img class="av" src="${p.photo}" alt="">`:'<span class="av"></span>'}<b>${esc(p.name)}</b>${p.captain?' <span class="pill">C</span>':''}</span></td><td>${p.pos}</td><td class="num">${p.games}</td><td class="num">${p.starts}</td><td class="num">${p.goals}</td><td class="num">–</td><td class="note">${a.map(x=>`${fmt(x.from)}${x.to!==x.from?`–${fmt(x.to)}`:''} ${esc(x.why)}`).join('; ')}</td></tr>`;}).join('')}
  </tbody></table></div>`;
}
''')

# ---------- Spieltag ----------
replace_fn('gameStatus', r'''
function gameStatus(g) {
  if (g.res) return [
    ['Spieldaten von fussball.de', 'geladen', true],
    ['Fragebogen', g.post==='offen' ? 'offen' : 'nicht ausgefüllt', false],
    ['Spielernoten', g.post==='offen' ? '0 von 11' : 'keine', false],
  ];
  return [
    ['Gegnervorbereitung', g.prep==='nicht begonnen' ? 'nicht begonnen' : `${g.prep} Seiten`, false],
    ['Aufstellung', 'offen', false],
    ['Mannschaftsnachricht', 'offen', false],
  ];
}
''')
rep("${todo?'<span class=\"pill warn\">offen</span>':g.res?'<span class=\"pill grey\">erledigt</span>':''}",
    "${todo?'<span class=\"pill warn\">offen</span>':g.res?'<span class=\"pill grey\">nicht nachbereitet</span>':''}")
rep("""  const tbl = [[3,'SC Testfeld',12,25],[4,'TSG Wilhelmshöhe',12,22],[5,'SV Musterdorf',12,20],[9,'TuS Probehausen',12,15],[10,'FV Vorlage',12,13]];""",
    """  const near = r => REAL.table.filter(x=>Math.abs(x.pl-r.pl)<=1), pick = [...new Map([...near(REAL.table.find(x=>x.own)), ...near(REAL.table.find(x=>x.opp))].map(x=>[x.pl,x])).values()].sort((a,b)=>a.pl-b.pl);
  const tbl = pick.map(x=>[x.pl, x.team, x.sp, x.pts, x.form, x.own||x.opp]);""")
rep("""<span class="note">Von fussball.de, Stand 10.11.2026</span>""", """<span class="note">Von fussball.de, Stand 11.11.2026</span>""")
rep("""${tbl.map(([pl,n,s,p])=>`<tr ${n.startsWith('TSG')||n.startsWith('TuS')?'style="font-weight:700"':''}><td class="num">${pl}</td><td>${n}</td><td class="num">${s}</td><td class="num">${p}</td><td class="note">${n.startsWith('TuS')?'N S N U N':n.startsWith('TSG')?'S S S N U':''}</td></tr>`).join('')}""",
    """${tbl.map(([pl,n,s,p,f,b])=>`<tr ${b?'style="font-weight:700"':''}><td class="num">${pl}</td><td>${esc(n)}</td><td class="num">${s}</td><td class="num">${p}</td><td class="note form">${f}</td></tr>`).join('')}""")
rep("""<div class="q"><b>Rückfrage von Coach.AI:</b> 6 der 19 Tore des Gegners fielen nach Standards. Soll Standards defensiv in „Unser Plan“?</div>""",
    """${REAL.ask && g.id===REAL.next ? `<div class="q"><b>Rückfrage von Coach.AI:</b> ${esc(REAL.ask)}</div>` : ''}""")
rep("""<div class="tb">${textBox('kleidung-'+g.id,'Kleidung','')}<div class="kitshow">${state.kitPhoto[g.home?'Heim':'Auswärts'] ? `<img src="${state.kitPhoto[g.home?'Heim':'Auswärts']}" alt="Foto Spielkleidung">` : kitSvg(g.home?'Heim':'Auswärts')}""",
    """<div class="tb">${textBox('kleidung-'+g.id,'Kleidung','')}<div class="kitshow">${g.home && REAL.kit.images.shirt ? ['shirt','shorts','socks'].map(k=>REAL.kit.images[k]?`<img src="${REAL.kit.images[k]}" alt="">`:'').join('') : state.kitPhoto[g.home?'Heim':'Auswärts'] ? `<img src="${state.kitPhoto[g.home?'Heim':'Auswärts']}" alt="Foto Spielkleidung">` : kitSvg(g.home?'Heim':'Auswärts')}""")
rep("const kitText = g =>", "const kitText = g => settings.kit[g.home?'Heim':'Auswärts'][0][1]==='noch offen' ? 'Auswärtskleidung ist noch nicht hinterlegt (Einstellungen › Spieltag und Dossier).' : kitText_(g);\nconst kitText_ = g =>")

# Nachbereitung mit echtem Spielverlauf und echter Startelf
rep("""  const xi = lineup.map(P);
  return `${demo}${spielHead(g,'spiel-nachbereitung')}""", """  const tl = REAL.timeline[g.id] || [], conc = tl.filter(x=>!x.own), c2 = conc.filter(x=>parseInt(x.min)>45).length;
  const xi = ((REAL.lineups[g.id]||{}).xi || []).map(n=>findPlayer(n) || {id:'x'+n, nr:'', name:n, pos:''});
  return `${demo}${spielHead(g,'spiel-nachbereitung')}""")
rep("""<p class="sub">Für dieses Beispiel sind die Tore erfunden.</p>
      <ul class="list"><li><span>12′ 1:0 Luca Neumann</span></li><li><span>38′ 1:1 Gegner</span></li><li><span>67′ 2:1 Max Hoffmann</span></li><li><span>88′ 2:2 Gegner</span></li></ul></div>""",
    """<p class="sub">${tl.length} Tore laut Spielbericht</p>
      <ul class="list">${tl.map(x=>`<li><span>${x.min} ${x.score||''} ${esc(x.who)}</span><span class="pill ${x.own?'':'game'}">${x.own?'TSG':'Gegner'}</span></li>`).join('') || '<li><span class="note">Im Spielbericht stehen keine Tore.</span></li>'}</ul></div>""")
rep("""<div class="q"><b>Vorschlag von Coach.AI:</b> Beide Gegentore fielen kurz nach eigenem Ballverlust. Soll der laufende Block „Sofort Gegenpressing“ um zwei Wochen verlängert werden?</div>
      <div class="row"><button class="btn small">Verlängern</button><button class="btn ghost small">Anderer Schwerpunkt</button></div>""",
    """<div class="q"><b>Frage von Coach.AI:</b> ${conc.length ? `${conc.length} Gegentore, davon ${c2} in der zweiten Halbzeit. Woran lag es aus deiner Sicht, und soll daraus ein Schwerpunkt für die nächsten Wochen werden?` : 'Kein Gegentor. Was hat gegen den Ball besonders gut funktioniert?'}</div>""")
rep("<p class=\"sub\">Schulnoten 1 bis 6 mit kurzer Begründung.", "<p class=\"sub\">Startelf laut Spielbericht. Schulnoten 1 bis 6 mit kurzer Begründung.")
rep("""${xi.map(p=>`<tr><td><b>${p.nr} ${p.name}</b> <span class="note">${p.pos}</span></td>""", """${xi.map(p=>`<tr><td><b>${p.nr?p.nr+' ':''}${esc(p.name)}</b> <span class="note">${p.pos}</span></td>""")

# Spielersicht: echter Spielverlauf, keine erfundenen Texte
rep("""<span class="note">12′ 1:0 Neumann · 38′ 1:1 · 67′ 2:1 Hoffmann · 88′ 2:2</span>
        <span>Was wir mitnehmen: Nach Ballverlust sofort ins Gegenpressing. Das trainieren wir diese Woche.</span>
        ${pv.note&&state.publish?`<span><b>Deine Note: 2</b> „Zwei Torvorlagen, im Pressing sehr aktiv.“</span>`:''}</div>`:''}`,""",
    """<span class="note">${(REAL.timeline[lg.id]||[]).map(x=>`${x.min} ${x.score||''}`).join(' · ')}</span>
        <span class="note">Die Nachbereitung des Trainerteams erscheint hier, sobald sie freigegeben ist.</span></div>`:''}`,""")
rep("""<div class="tile"><div class="v">${me.games}</div><div class="c">Einsätze</div></div>""", """<div class="tile"><div class="v">${me.games}</div><div class="c">im Bogen</div></div>""")

# ---------- Training: Schwerpunkt-Vorschlag aus echten Daten ----------
replace_between("    ${state.focusSug ? `<div class=\"q\"><b>Aus den Spielbeobachtungen:</b>", "    <div class=\"row\"><label class=\"note\" for=\"wf\">Schwerpunkt selbst festlegen</label>",
r"""    ${state.focusSug ? (()=>{ const B = REAL.bins, r = B.own_against.map((v,i)=>v/B.league[i]), i = r.indexOf(Math.max(...r)), lbl = ['1.–15.','16.–30.','31.–45.','46.–60.','61.–75.','76.–90.'][i];
      return `<div class="q"><b>Aus den Spielberichten</b> (noch keine bewerteten Nachbereitungen): ${B.own_against.reduce((a,b)=>a+b,0)} Gegentore in ${B.full} Ligaspielen, in jeder Viertelstunde mehr als im Ligaschnitt, am deutlichsten in der ${lbl} Minute (${B.own_against[i]} gegenüber ${de(B.league[i])}).
      Soll der Schwerpunkt diese Woche auf „Gegen den Ball: Kompakt stehen“ liegen?
      <div class="row" style="margin-top:6px"><button class="btn small" data-setfocus="g2">Übernehmen</button><button class="btn ghost small" data-keepfocus="1">Beibehalten</button></div></div>`; })() : ''}
""")
rep("""  <div class="card"><h3>Vorschlag von Coach.AI</h3><div class="q">Das Prinzip „Ecken defensiv“ lag in den letzten 6 Spielen bei Ø ${de(avg(PR('s1').hist))}. Soll der geplante Block in KW 49 vorgezogen werden?</div>
    <div class="row"><button class="btn small">Vorziehen</button><button class="btn ghost small">So lassen</button></div></div>`;""",
    """  <div class="card"><h3>Hinweis</h3><p class="sub" style="margin:0">Die Blöcke oben sind ein Beispiel. Legt eure eigene Periodisierung an, sobald die Spielphilosophie mit den Prinzipien steht. Vorschläge kommen dann aus euren Nachbereitungen.</p></div>`;""")
rep("<h3>Periodisierung Hinrunde und Rückrunden-Vorbereitung</h3>", "<h3>Periodisierung Hinrunde und Rückrunden-Vorbereitung <span class=\"pill grey\">Beispiel</span></h3>")
rep("""<span class="note">Schwerpunkt für die Woche · KW 46</span>""", """<span class="note">Schwerpunkt für die Woche · KW 46 · aus der Beispiel-Periodisierung</span>""")
rep("Schwerpunkt: <b>${currentFocus.row}: ${currentFocus.title}</b>", "Schwerpunkt (Beispiel): <b>${currentFocus.row}: ${currentFocus.title}</b>")
# Prinzipien ohne Bewertung
rep("""      <div>${spark(p.hist,null,34)}</div>
      <div><span class="score" style="color:${a<2.5?'var(--game)':a<3.5?'var(--warn)':'var(--accent)'}">${de(a)}</span> <span class="note">Ø letzte 3 Spiele</span></div></div>`;}).join('')}""",
    """      ${p.hist.length ? `<div>${spark(p.hist,null,34)}</div><div><span class="score" style="color:${a<2.5?'var(--game)':a<3.5?'var(--warn)':'var(--accent)'}">${de(a)}</span> <span class="note">Ø letzte 3 Spiele</span></div>` : '<div class="note">noch keine Bewertung</div><div></div>'}</div>`;}).join('')}""")
rep("<p>Die Vorarbeit für alles andere. Einmal festlegen, selten ändern.</p>", "<p>Die Vorarbeit für alles andere. Einmal festlegen, selten ändern. Die Prinzipien unten sind Beispiele, bis ihr eure eigenen festlegt.</p>")

# Teilnahme ohne erfundene Zusagen
replace_fn('attendance', r'''
function attendance(e) {
  const out = new Map(absentOn(e.date).map(a=>[a.pid, a.why]));
  const yes = [], no = [], none = [];
  players.forEach(p => { if (out.has(p.id)) no.push([p, out.get(p.id)]); else if (state.reply[e.id]==='ja' && p.id===ME) yes.push(p); else none.push(p); });
  return {yes, no, none};
}
''')
rep("<p class=\"note\">Zugesagt und keine Antwort sind im Entwurf Beispielwerte, Abgesagt kommt aus den Abwesenheiten.</p>", "<p class=\"note\">Noch hat niemand geantwortet: Die Zu- und Absagen kommen, sobald die Spieler ihre Links haben.</p>")

# Einstellungen: echte Namen
rep('<label class="fl" for="vw-l">Liga und Saison<input id="vw-l" type="text" value="Gruppenliga, Saison 2026/27"></label>',
    '<label class="fl" for="vw-l">Liga und Saison<input id="vw-l" type="text" value="${esc(REAL.team.league)}"></label>')
rep("""<ul class="list"><li><span><b>Trainer</b></span><span class="pill">aktiv</span></li><li><span><b>Co-Trainer</b></span><span class="pill">aktiv</span></li></ul>""",
    """<ul class="list">${REAL.team.coaches.map(c=>`<li><span><b>${esc(c.name)}</b> · ${esc(c.role)}</span><span class="pill grey">laut FuPa</span></li>`).join('')}</ul>""")

# ---------- Daten übernehmen (vor dem Router) ----------
rep("// ======================= Router und Ereignisse =======================", r"""// ======================= Echte Daten übernehmen =======================
const foldN = s => (s||'').toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
function findPlayer(name) {
  const t = foldN(name), parts = t.split(' ');
  const ex = players.find(p=>foldN(p.name)===t); if (ex) return ex;
  const last = p => foldN(p.name.split(' ').slice(1).join(' '));
  const fl = players.filter(p=>t.endsWith(' '+last(p)) && foldN(p.name).split(' ')[0]===parts[0]); if (fl.length===1) return fl[0];
  const lo = players.filter(p=>t.endsWith(' '+last(p))); if (lo.length===1) return lo[0];
  const tk = new Set(parts), sub = players.filter(p=>foldN(p.name).split(' ').every(x=>tk.has(x))); return sub.length===1 ? sub[0] : null;
}
(function applyReal() {
  players.length = 0;
  REAL.players.forEach((p,i)=>players.push({id:'p'+i, nr:p.nr, name:p.name, pos:p.pos, status:'', games:p.kader, starts:p.starts, goals:p.goals, grade:null, photo:p.photo, captain:p.captain}));
  absences.length = 0; duties.length = 0; comments.length = 0;
  for (const k in dossierRead) delete dossierRead[k];
  for (const k in exNotes) delete exNotes[k];
  for (const k in unitNotes) delete unitNotes[k];
  for (const k in planHistory) delete planHistory[k];
  principles.forEach(p => p.hist = []);
  exercises.forEach(e => e.src = 'Beispiel');
  state.released = {};
  // Training dienstags und freitags 19 Uhr
  settings.rhythm.splice(0, settings.rhythm.length, {wd:2, time:'19:00', dur:90, place:REAL.team.venue.name}, {wd:5, time:'19:00', dur:90, place:REAL.team.venue.name});
  settings.home = `${REAL.team.venue.name}, ${REAL.team.venue.address}`;
  // Ablauf aus euren Eingaben: Dauer je Block
  const toRows = bl => bl.map(b => [b.label, b.endOffsetMin - b.startOffsetMin]);
  settings.flow.heim = toRows(REAL.schedule.home.blocks);
  settings.flow['auswärts'] = [[`Treffpunkt ${REAL.schedule.away.departurePoint}, Abfahrt`, REAL.schedule.away.meetingBeforeDepartureMin || 10], ['Fahrt (Fahrzeit je Spiel eintragen)', 0], ...toRows(REAL.schedule.away.blocks)];
  const hx = c => ({'weiß':'#ffffff','schwarz':'#222222','grün':'#1f6f4a','rot':'#c0392b','blau':'#1f4e9a','gelb':'#f2c94c'})[c] || '#cccccc';
  settings.kit['Heim'] = [['Trikot', REAL.kit.home.shirt, hx(REAL.kit.home.shirt)], ['Hose', REAL.kit.home.shorts, hx(REAL.kit.home.shorts)], ['Stutzen', REAL.kit.home.socks, hx(REAL.kit.home.socks)]];
  settings.kit['Auswärts'] = [['Trikot','noch offen','#dddddd'], ['Hose','noch offen','#dddddd'], ['Stutzen','noch offen','#dddddd']];
  settings.warmup = 'noch nicht hinterlegt';
  // Termine: Spiele von fussball.de, Trainings nach Rhythmus
  events.length = 0;
  const lastPlayed = REAL.games.filter(g=>g.res && g.kind==='liga').pop();
  for (const g of REAL.games) events.push({id:g.id, date:g.date, type:'gm', time:g.time, opp:g.opp, home:g.home, res:g.res, comp:g.comp, kind:g.kind,
    place: g.home ? REAL.team.venue.name : `auswärts bei ${g.opp}`, post: g.res ? (g.id===lastPlayed.id ? 'offen' : 'nein') : null, prep: g.res ? null : 'nicht begonnen'});
  const gd = new Set(REAL.games.map(g=>g.date));
  for (let d = new Date('2026-10-12T12:00:00'); d <= new Date('2026-12-06T12:00:00'); d.setDate(d.getDate()+1)) {
    const iso = d.toISOString().slice(0,10), r = settings.rhythm.find(x=>x.wd===d.getDay());
    if (r && !gd.has(iso)) events.push({id:'e'+iso, date:iso, type:'tr', time:r.time, dur:r.dur, place:r.place, unit:null});
  }
  // Gegnerfakten
  factPool.opp = REAL.facts.opp; factPool.own = REAL.facts.own;
  facts.opp = factPool.opp.slice(0,3).map((_,i)=>({id:'fo'+i, kind:'opp', i})); facts.own = factPool.own.slice(0,3).map((_,i)=>({id:'fw'+i, kind:'own', i}));
  // Aufstellung: Startelf des letzten Ligaspiels
  const xi = ((REAL.lineups[lastPlayed.id]||{}).xi || []).map(findPlayer).filter(Boolean).map(p=>p.id);
  const rest = players.map(p=>p.id).filter(id=>!xi.includes(id));
  lineup = [...xi, ...rest].slice(0, 11);
  // Aufgaben aus dem echten Stand
  const nx = REAL.games.find(g=>g.id===REAL.next), nx2 = REAL.games.filter(g=>!g.res)[1];
  for (const k in todos) delete todos[k];
  todos['Spiel'] = [
    {id:'t1', text:`Gegnervorbereitung ${nx.opp} (So ${fmt(nx.date)})`, href:'#spiel-vorbereitung', set:{game:nx.id}},
    {id:'t2', text:`Aufstellung gegen ${nx.opp} festlegen`, href:'#spiel-aufstellung', set:{game:nx.id}},
    {id:'t3', text:`Nachbereitung ${lastPlayed.home?'gegen':'bei'} ${lastPlayed.opp} (${lastPlayed.res})`, href:'#spiel-nachbereitung', set:{post:lastPlayed.id}},
  ];
  todos['Training'] = [
    {id:'t4', text:'Einheiten für Di 10.11. und Fr 13.11. eintragen', href:'#training'},
    {id:'t5', text:'Erste eigene Übungen erfassen', href:'#training'},
    {id:'t6', text:'Trainingsdauer prüfen (angenommen: 90 Minuten)', href:'#einstellungen'},
  ];
  todos['Administratives'] = [
    {id:'t7', text:'Spielphilosophie und Prinzipien festlegen', href:'#philosophie'},
    {id:'t8', text:'Auswärtskleidung und Aufwärmkleidung hinterlegen', href:'#einstellungen', set:{}},
    {id:'t9', text:'Spieler-Links an die Mannschaft verschicken', href:'#spielersicht'},
  ];
  state.game = REAL.next; state.post = lastPlayed.id; state.trainEv = 'e2026-11-13';
  const top = [...players].sort((a,b)=>b.goals-a.goals)[0]; state.anaPlayer = top.id; ME = top.id;
})();
// ======================= Router und Ereignisse =======================""")
rep("const ME = 'p12';", "let ME = 'p12';")
# CSS
rep("/* ---- Runde 6 ---- */", """/* ---- Echte Daten ---- */
.av { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; background: var(--line); flex: none; display: inline-block; }
.avbig { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; }
.form { letter-spacing: .08em; white-space: nowrap; }
.kitshow img { width: 64px; height: 64px; object-fit: contain; background: var(--panel); }
.minibar { grid-template-columns: 70px 1fr 70px !important; }
/* ---- Runde 6 ---- */""")
rep("${ab.length} fehlen (${ab.map(x=>`${P(x.pid).name.split(' ')[1]}: ${x.why}`).join(', ')}).", "${ab.length ? `${ab.length} fehlen (${ab.map(x=>`${P(x.pid).name.split(' ').slice(1).join(' ')}: ${x.why}`).join(', ')})` : 'bisher hat niemand abgesagt'}.")
rep('placeholder="kurz, z. B. sicher im Aufbau, Ballverlust vor dem 2:2"', 'placeholder="kurz, z. B. sicher im Aufbau, zweikampfstark"')
rep("<p class=\"sub\">Von fussball.de, Stand 11.11.2026</span>", "<p class=\"sub\">Von fussball.de, Stand 11.11.2026</span>") if False else None
open(dst, 'w').write(s)
print('ok')
