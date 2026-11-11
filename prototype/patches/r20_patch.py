import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---------- Wiederkehrende Gesprächsrunden ----------
rep("function playerFacts(p) {", r"""const talkSeries = [
  {id:'hs', name:'Halbserien-Gespräch', active:true, who:'alle', periods:'01.12.–31.01.; 01.06.–31.07.', lead:21,
   ziel:'Rückblick auf die Halbserie und gemeinsame Ziele für die nächste.',
   fragen:['Wie zufrieden bist du mit deiner Halbserie?','Was lief gut, woran willst du arbeiten?','Welche Rolle wünschst du dir in der Mannschaft?','Was können wir Trainer besser machen?']},
  {id:'kap', name:'Kapitänsrunde', active:false, who:'kapitaen', periods:'01.10.–15.10.; 01.03.–15.03.', lead:7,
   ziel:'Stimmung in der Mannschaft erfahren.', fragen:['Wie ist die Stimmung in der Mannschaft?','Gibt es Themen, die wir ansprechen sollten?']},
  {id:'neu', name:'Gespräch mit Neuzugängen', active:false, who:'auswahl', periods:'15.08.–31.08.', lead:7,
   ziel:'Ankommen begleiten.', fragen:['Wie bist du in der Mannschaft angekommen?','Was brauchst du noch von uns?']},
];
const WHO = {alle:'alle Spieler', kapitaen:'Kapitän', tw:'Torhüter', auswahl:'Auswahl von Hand'};
function seriesPlayers(x) { return x.who==='alle' ? players : x.who==='kapitaen' ? players.filter(q=>q.captain) : x.who==='tw' ? players.filter(isTW) : players.filter(q=>(x.pick||[]).includes(q.id)); }
/** Zeitfenster einer Runde: das laufende oder das nächste innerhalb des Vorlaufs. */
function seriesWindow(x, iso) {
  const y = +iso.slice(0,4), out = [];
  for (const part of (x.periods||'').split(';')) {
    const m = /(\d{1,2})\.(\d{1,2})\.?\s*[–-]\s*(\d{1,2})\.(\d{1,2})\./.exec(part.trim()); if (!m) continue;
    for (const yy of [y-1, y, y+1]) {
      const from = `${yy}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; let to = `${yy}-${m[4].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
      if (to < from) to = `${yy+1}-${m[4].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
      out.push({from, to});
    }
  }
  const cur = out.find(w => w.from <= iso && iso <= w.to); if (cur) return {...cur, state:'läuft'};
  const nx = out.filter(w => w.from > iso).sort((a,b)=>a.from.localeCompare(b.from))[0];
  return nx ? {...nx, state: nx.from <= addDays(iso, x.lead||14) ? 'bald' : 'später'} : null;
}
const fmtY = iso => `${iso.slice(8)}.${iso.slice(5,7)}.${iso.slice(0,4)}`;
function seriesStatus(x, w, pid) { const l = (talks[pid]||[]).filter(t=>t.code==='serie-'+x.id && t.date >= addDays(w.from, -(x.lead||14)) && t.date <= w.to);
  return l.some(t=>t.status==='geführt') ? 'geführt' : l.some(t=>t.status==='geplant') ? 'geplant' : 'offen'; }
function guideFor(code) {
  if (code && code.startsWith('serie-')) { const x = talkSeries.find(z=>'serie-'+z.id===code) || talkSeries[0];
    return {label:x.name, ziel:x.ziel, fragen:x.fragen.length?x.fragen:['Wie geht es dir in der Mannschaft?'], tipps:['Gespräch vorher kurz terminieren, 15 bis 20 Minuten reichen.','Erst zuhören, dann eigene Sicht.','Ein, zwei Vereinbarungen festhalten.']}; }
  return TALKGUIDE[code] || TALKGUIDE.frei;
}
function playerFacts(p) {""")
rep("G = TALKGUIDE[t.code] || TALKGUIDE.frei, cause", "G = guideFor(t.code), cause")
rep("""<label class="fl" for="talk-kind" style="min-width:220px">Anlass<select class="f" id="talk-kind">${Object.entries(TALKGUIDE).map(([c,g])=>`<option value="${c}" ${c===t.code?'selected':''}>${g.label}</option>`).join('')}</select></label></div>""",
    """<div class="row" style="align-items:end"><label class="fl" for="talk-player" style="min-width:200px">Spieler<select class="f" id="talk-player">${players.map(x=>`<option value="${x.id}" ${x.id===p.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
    <label class="fl" for="talk-kind" style="min-width:220px">Anlass<select class="f" id="talk-kind">${[...talkSeries.filter(x=>x.active).map(x=>['serie-'+x.id, x.name]), ...Object.entries(TALKGUIDE).map(([c,g])=>[c,g.label])].map(([c,l])=>`<option value="${c}" ${c===t.code?'selected':''}>${esc(l)}</option>`).join('')}</select></label></div></div>""")
rep("anlass: (k('anlass') || TALKGUIDE[t.code].label)", "anlass: (k('anlass') || guideFor(t.code).label)")
rep("`geplant am ${fmt(x.date)} · ${esc(TALKGUIDE[x.code].label)}`", "`geplant am ${fmt(x.date)} · ${esc(guideFor(x.code).label)}`")
rep("  else if (t.id === 'talk-kind') {", "  else if (t.id === 'talk-player') { state.talk = {pid: t.value, code: state.talk.code}; render(); }\n  else if (t.id === 'talk-kind') {")

# ---------- Übersicht Spielergespräche ----------
rep("function vGespraech() {", r"""function vGespraeche() {
  const all = Object.entries(talks).flatMap(([pid,l])=>l.map(x=>({...x, pid}))).sort((a,b)=>b.date.localeCompare(a.date));
  const ser = talkSeries.filter(x=>x.active).map(x=>({x, w: seriesWindow(x, TODAY)})).filter(o=>o.w);
  return `${demo}
  <div class="head"><div><h1>Spielergespräche</h1><p>Anlassgespräche, wiederkehrende Runden und alles, was schon besprochen wurde. Nur für das Trainerteam.</p></div>
    <div class="row"><a class="btn ghost small" href="#einstellungen" data-settab="gespraeche">Runden einstellen</a></div></div>
  <div class="card"><h3>Gespräch anlegen</h3><div class="row" style="align-items:end">
    <label class="fl" for="ng-p">Spieler<select class="f" id="ng-p">${players.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
    <label class="fl" for="ng-k">Anlass<select class="f" id="ng-k">${[...talkSeries.filter(x=>x.active).map(x=>['serie-'+x.id, x.name]), ...Object.entries(TALKGUIDE).map(([c,g])=>[c,g.label])].map(([c,l])=>`<option value="${c}" ${c==='frei'?'selected':''}>${esc(l)}</option>`).join('')}</select></label>
    <button class="btn" data-newtalk="1">Vorbereiten</button></div></div>
  ${ser.map(({x,w})=>{ const ps = seriesPlayers(x), st = ps.map(q=>[q, seriesStatus(x,w,q.id)]), done = st.filter(s=>s[1]==='geführt').length;
    return `<div class="card"><div class="row between"><div><h3>${esc(x.name)}</h3><p class="sub" style="margin:0">${WHO[x.who]} · Zeitraum ${fmtY(w.from)} bis ${fmtY(w.to)} · ${w.state==='läuft'?'läuft gerade':w.state==='bald'?'beginnt bald, jetzt Termine planen':'später'}</p></div>
      <div class="serprog"><span><b>${done} von ${ps.length}</b> geführt</span><div class="readbar"><span style="width:${ps.length?done/ps.length*100:0}%"></span></div></div></div>
      <div class="pickgrid">${st.map(([q,s])=>`<a class="pick tstat-${s}" href="#gespraech" data-talk="${q.id}|serie-${x.id}">${av(q)}<span>${esc(q.name)}<small>${s}</small></span></a>`).join('')}</div></div>`; }).join('')}
  <div class="card"><h3>Alle Gespräche</h3>${all.length ? `<div class="scroll"><table><thead><tr><th>Datum</th><th>Spieler</th><th>Anlass</th><th>Vereinbart</th><th>Status</th></tr></thead><tbody>
    ${all.map(t=>`<tr><td class="num">${fmt(t.date)}</td><td><a class="plink" href="#gespraech" data-talk="${t.pid}|${t.code}"><span class="row" style="flex-wrap:nowrap;gap:6px">${av(P(t.pid),'sm')}${esc(P(t.pid).name)}</span></a></td><td>${esc(t.anlass)}</td><td class="note">${esc(t.vereinbart||'')}</td><td><span class="pill ${t.status==='geführt'?'':'grey'}">${t.status}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="sub" style="margin:0">Noch keine Gespräche festgehalten.</p>'}</div>`;
}
function vGespraech() {""")
rep("const R = {gespraech:vGespraech,", "const R = {gespraeche:vGespraeche,gespraech:vGespraech,")
rep("cur === 'gespraech' ? 'kader' : cur;", "(cur === 'gespraech' || cur === 'gespraeche') ? 'kader' : cur;")
rep("<div class=\"crumb\"><a href=\"#dashboard\">Dashboard</a> › Gespräch mit ${esc(p.name)}</div>", "<div class=\"crumb\"><a href=\"#gespraeche\">Spielergespräche</a> › ${esc(p.name)}</div>")
rep("  else if (d.more) {", r"""  else if (d.newtalk) { state.talk = {pid: document.getElementById('ng-p').value, code: document.getElementById('ng-k').value}; state.flash = null; location.hash = 'gespraech'; }
  else if (d.seradd) { talkSeries.push({id:'s'+Date.now(), name:'Neue Gesprächsrunde', active:true, who:'alle', periods:'01.03.–31.03.', lead:14, ziel:'', fragen:[]}); render(); }
  else if (d.serdel) { const i = talkSeries.findIndex(x=>x.id===d.serdel); if (i>=0) talkSeries.splice(i,1); render(); }
  else if (d.more) {""")
rep("  else if (d.comp) {", r"""  else if (d.ser) { const x = talkSeries.find(z=>z.id===d.ser); if (x) { if (d.k==='active') x.active = t.checked; else if (d.k==='lead') x.lead = +t.value||0; else if (d.k==='fragen') x.fragen = t.value.split('\n').map(z=>z.trim()).filter(Boolean); else x[d.k] = t.value; render(); } }
  else if (d.comp) {""")
# Kader: Zugang zu den Gesprächen
rep("<div class=\"head\"><div><h1>Kader</h1><p>${players.length} Spieler laut FuPa. Zahlen aus ${n} Pflichtspielen (fussball.de). Spaltenkopf antippen zum Sortieren.</p></div><button class=\"btn\">Spieler anlegen</button></div>",
    "<div class=\"head\"><div><h1>Kader</h1><p>${players.length} Spieler laut FuPa. Zahlen aus ${n} Pflichtspielen (fussball.de). Spaltenkopf antippen zum Sortieren.</p></div><div class=\"row\"><a class=\"btn ghost\" href=\"#gespraeche\">Spielergespräche</a><button class=\"btn\">Spieler anlegen</button></div></div>")

# ---------- Einstellungen: Reiter Spielergespräche ----------
rep("['spieler','Spielersicht'],", "['spieler','Spielersicht'],['gespraeche','Spielergespräche'],")
rep("({fristen:setFristen,", "({gespraeche:setGespraeche,fristen:setFristen,")
rep("function setDaten() {", r"""function setGespraeche() {
  return `<div class="card"><h3>Wiederkehrende Gesprächsrunden</h3><p class="sub">Coach.AI erinnert dich rechtzeitig vor dem Zeitraum auf dem Dashboard und zeigt, mit wem das Gespräch noch offen ist. Zeiträume als „TT.MM.–TT.MM.“, mehrere mit Semikolon getrennt.</p></div>
  ${talkSeries.map(x=>{ const w = seriesWindow(x, TODAY); return `<div class="card serset ${x.active?'':'off'}"><div class="row between"><label class="row" for="ser-a-${x.id}"><input type="checkbox" id="ser-a-${x.id}" data-ser="${x.id}" data-k="active" ${x.active?'checked':''}> <b>aktiv</b></label>
      <span class="note">${w ? `nächster Zeitraum: ${fmtY(w.from)} bis ${fmtY(w.to)}${w.state==='läuft'?' (läuft)':''}` : 'kein gültiger Zeitraum'}</span><button class="ib" data-serdel="${x.id}" aria-label="Runde löschen">${ICON.x}</button></div>
    <div class="grid g3">
      <label class="fl" for="ser-n-${x.id}">Name<input type="text" id="ser-n-${x.id}" data-ser="${x.id}" data-k="name" value="${esc(x.name)}"></label>
      <label class="fl" for="ser-w-${x.id}">Mit wem<select class="f" id="ser-w-${x.id}" data-ser="${x.id}" data-k="who">${Object.entries(WHO).map(([k,l])=>`<option value="${k}" ${x.who===k?'selected':''}>${l}</option>`).join('')}</select></label>
      <label class="fl" for="ser-l-${x.id}">Erinnerung vorher (Tage)<input type="number" min="0" class="f" id="ser-l-${x.id}" data-ser="${x.id}" data-k="lead" value="${x.lead}"></label>
    </div>
    <div class="grid g2">
      <label class="fl" for="ser-p-${x.id}">Zeiträume<input type="text" id="ser-p-${x.id}" data-ser="${x.id}" data-k="periods" value="${esc(x.periods)}"></label>
      <label class="fl" for="ser-z-${x.id}">Ziel<input type="text" id="ser-z-${x.id}" data-ser="${x.id}" data-k="ziel" value="${esc(x.ziel)}"></label>
    </div>
    <label class="fl" for="ser-f-${x.id}">Leitfragen, eine pro Zeile<textarea id="ser-f-${x.id}" rows="3" data-ser="${x.id}" data-k="fragen">${esc(x.fragen.join('\n'))}</textarea></label></div>`; }).join('')}
  <button class="btn ghost small" data-seradd="1" style="justify-self:start">Gesprächsrunde hinzufügen</button>`;
}
function setDaten() {""")

# ---------- Dashboard: Runden automatisch einspielen ----------
rep("${Object.entries(talks).flatMap(([pid,l])=>l.filter(x=>x.status==='geplant')", r"""${talkSeries.filter(x=>x.active).map(x=>({x, w: seriesWindow(x, TODAY)})).filter(o=>o.w && o.w.state!=='später').map(({x,w})=>{ const ps = seriesPlayers(x), done = ps.filter(q=>seriesStatus(x,w,q.id)==='geführt').length;
        return dlink('#gespraeche', w.state==='läuft' ? `${esc(x.name)}: ${done} von ${ps.length} geführt` : `${esc(x.name)}: Runde ab ${fmt(w.from)}`, w.state==='läuft' ? `Zeitraum bis ${fmt(w.to)}` : `${ps.length} Gespräche (${WHO[x.who]}). Jetzt Termine planen?`, '', I.cal); }).join('')}${Object.entries(talks).flatMap(([pid,l])=>l.filter(x=>x.status==='geplant')""")
rep("${dlink('#philosophie', 'Spielphilosophie festlegen', 'Leitfragen und Prinzipien', '', I.plus)}", "${dlink('#philosophie', 'Spielphilosophie festlegen', 'Leitfragen und Prinzipien', '', I.plus)}${dlink('#gespraeche', 'Spielergespräch anlegen', 'Anlass wählen, vorbereiten, festhalten', '', I.plus)}")
rep("/* ---- Masken ---- */", """/* ---- Gesprächsrunden ---- */
.serprog { display: grid; gap: 4px; justify-items: end; font-size: 14px; color: var(--muted); } .serprog b { color: var(--ink); }
a.pick { text-decoration: none; color: var(--ink); }
.pick.tstat-geführt { border-color: var(--accent); background: var(--accent-soft); }
.pick.tstat-geplant { border-color: var(--warn); background: var(--warn-soft); }
.serset.off { opacity: .6; }
/* ---- Masken ---- */""")
open(p, 'w').write(s); print('ok')
