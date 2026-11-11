import sys, re
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---------- Anlass-Codes an die Impulse hängen ----------
for old, code in [("out.push({kind:'Gespräch', prio: 3 + gone, p,", 'gone'), ("out.push({kind:'Gespräch', prio: 2 + benched, p,", 'bench'),
                  ("out.push({kind:'Lob', prio: 2 + streak, p,", 'startelf'), ("out.push({kind:'Lob', prio: 4, p,", 'tore'),
                  ("out.push({kind:'Gespräch', prio: 6, p,", 'training'), ("out.push({kind:'Gespräch', prio: 5, p,", 'noten-schwach'), ("out.push({kind:'Lob', prio: 5, p,", 'noten-stark')]:
    rep(old, old.replace(" p,", f" code:'{code}', p,"))
rep("  return out.sort((a,b)=>b.prio-a.prio).slice(0, 5).map(m => ({...m, href:'#analytics', attrs:`data-anaplayer=\"${m.p.id}\"`, icon: av(m.p)}));",
    """  // Wer zum selben Anlass in den letzten 21 Tagen schon ein Gespräch hatte, taucht nicht erneut auf.
  const fresh = out.filter(m => !(talks[m.p.id]||[]).some(t => t.status==='geführt' && t.code===m.code && t.date >= addDays(TODAY, -21)));
  fresh.forEach(m => { TALKCAUSE[m.p.id+'|'+m.code] = {title: m.title, sub: m.sub, kind: m.kind}; });
  return fresh.sort((a,b)=>b.prio-a.prio).slice(0, 5).map(m => ({...m, href:'#gespraech', attrs:`data-talk="${m.p.id}|${m.code}"`, icon: av(m.p)}));""")

# ---------- Gesprächsvorbereitung ----------
rep("/** Rolle eines Spielers je Pflichtspiel:", r"""const talks = {};          // Historie je Spieler: {date, code, anlass, ziel, notizen, vereinbart, status, who}
const TALKCAUSE = {};
const TALKGUIDE = {
  gone:     {label:'Länger nicht im Kader', ziel:'Verstehen, was los ist, und zeigen, dass er gebraucht wird.', fragen:['Wie geht es dir gerade, auch abseits vom Fußball?','Was hält dich im Moment vom Training oder von den Spielen ab?','Können wir dich irgendwie unterstützen?','Wann können wir wieder mit dir planen?'], tipps:['Zuhören statt vorwerfen.','Konkret sagen, dass er fehlt und warum.','Eine kleine, verbindliche Absprache treffen.']},
  bench:    {label:'Viel Bank, wenig Einsatz', ziel:'Rolle klären und eine Perspektive aufzeigen.', fragen:['Wie siehst du deine Rolle in der Mannschaft gerade?','Was fehlt dir aus deiner Sicht für mehr Einsatzzeit?','Woran möchtest du in den nächsten Wochen arbeiten?'], tipps:['Ehrlich sagen, wie du die Lage siehst.','Ein, zwei konkrete Punkte aus dem Training benennen.','Ein nächstes Ziel vereinbaren und darauf zurückkommen.']},
  startelf: {label:'Hat sich in die Startelf gespielt', ziel:'Entwicklung anerkennen und Motivation stärken.', fragen:['Was hat dir aus deiner Sicht geholfen?','Wo willst du als Nächstes hin?'], tipps:['Konkret loben: was genau ist besser geworden?','Nicht nur das Ergebnis, auch den Einsatz im Training würdigen.']},
  tore:     {label:'Gute Phase vor dem Tor', ziel:'Bestätigen und den Lauf stützen.', fragen:['Was machst du gerade anders?','Was brauchst du, damit es so weitergeht?'], tipps:['Kurz und konkret bleiben.','Den Beitrag zur Mannschaft betonen, nicht nur die Tore.']},
  training: {label:'Oft im Training gefehlt', ziel:'Gründe verstehen und eine Vereinbarung treffen.', fragen:['Was steht im Moment zwischen dir und dem Training?','Was wäre für dich machbar?'], tipps:['Ohne Vorwurf ansprechen.','Erwartungen der Mannschaft klar machen.','Eine machbare Absprache treffen.']},
  'noten-schwach': {label:'Zuletzt schwächere Noten', ziel:'Unterstützen, ohne Druck aufzubauen.', fragen:['Wie siehst du deine letzten Spiele selbst?','Was beschäftigt dich gerade?','Wobei können wir dir helfen?'], tipps:['Mit dem anfangen, was gut ist.','Einen konkreten Ansatzpunkt fürs Training vereinbaren.']},
  'noten-stark': {label:'Starke Noten', ziel:'Leistung anerkennen.', fragen:['Was läuft gerade besonders gut?'], tipps:['Konkret loben.']},
  frei:     {label:'Eigenes Thema', ziel:'', fragen:['Wie geht es dir in der Mannschaft?','Was wünschst du dir von uns Trainern?'], tipps:['Ziel des Gesprächs vorher in einem Satz aufschreiben.']},
};
function playerFacts(p) {
  const gs = REAL.games.filter(g=>g.res && g.kind!=='test'), st = playerStats(gs).get(p.id), q = roleSeq(p);
  const chip = r => `<span class="rchip r-${r==='-'?'n':r}" title="${{S:'Startelf',E:'eingewechselt',B:'Bank, nicht eingesetzt','-':'nicht im Kader'}[r]}">${r==='-'?'·':r}</span>`;
  const abs = absences.filter(a=>a.pid===p.id), last = (talks[p.id]||[]).filter(t=>t.status==='geführt').slice(-1)[0];
  return `<div class="tiles">${[[st.games,'Im Kader'],[st.apps,'Einsätze'],[st.starts,'Startelf'],[st.mins.toLocaleString('de-DE'),'Minuten'],[st.goals,'Tore']].map(([v,l])=>`<div class="tile"><div class="v">${v}</div><div class="c">${l}</div></div>`).join('')}</div>
    <div><span class="note">Pflichtspiele der Reihe nach, das jüngste rechts</span><div class="rseq">${q.map(chip).join('')}</div>
      <div class="legend"><span><b class="rchip r-S">S</b>Startelf</span><span><b class="rchip r-E">E</b>eingewechselt</span><span><b class="rchip r-B">B</b>Bank</span><span><b class="rchip r-n">·</b>nicht im Kader</span></div></div>
    <ul class="list"><li><span>Abwesenheiten</span><span class="note">${abs.length ? abs.map(a=>`${fmt(a.from)} ${esc(a.why)}`).join(', ') : 'keine eingetragen'}</span></li>
      <li><span>Noten</span><span class="note">${((state.gradesHist||{})[p.id]||[]).length ? 'Ø '+de(avg(state.gradesHist[p.id])) : 'noch keine'}</span></li>
      <li><span>Letztes Gespräch</span><span class="note">${last ? `${fmt(last.date)}: ${esc(last.anlass)}` : 'noch keins'}</span></li></ul>`;
}
function vGespraech() {
  const t = state.talk || {pid: players[0].id, code: 'frei'}, p = P(t.pid), G = TALKGUIDE[t.code] || TALKGUIDE.frei, cause = TALKCAUSE[t.pid+'|'+t.code];
  const k = key => `talk-${t.pid}-${t.code}-${key}`;
  if (state.texts[k('anlass')] == null) state.texts[k('anlass')] = cause ? `${cause.title.replace(/<[^>]+>/g,'')}. ${cause.sub}`.replace(/&amp;/g,'&') : '';
  if (state.texts[k('ziel')] == null) state.texts[k('ziel')] = G.ziel;
  const hist = (talks[p.id]||[]).slice().reverse();
  return `${demo}
  <div class="crumb"><a href="#dashboard">Dashboard</a> › Gespräch mit ${esc(p.name)}</div>
  <div class="head"><div class="row" style="gap:14px;align-items:center">${av(p,'big')}<div><h1>Gespräch mit ${esc(p.name)}</h1><p>${p.pos}${p.captain?' · Kapitän':''} · <span class="pill ${G===TALKGUIDE.startelf||G===TALKGUIDE.tore||G===TALKGUIDE['noten-stark']?'':'warn'}">${G.label}</span></p></div></div>
    <label class="fl" for="talk-kind" style="min-width:220px">Anlass<select class="f" id="talk-kind">${Object.entries(TALKGUIDE).map(([c,g])=>`<option value="${c}" ${c===t.code?'selected':''}>${g.label}</option>`).join('')}</select></label></div>
  ${flashBox()}
  <div class="talkwrap">
    <div class="grid" style="gap:12px">
      <div class="card"><h3>Vorbereitung</h3>
        ${textBox(k('anlass'), 'Anlass', 'Warum das Gespräch?', 2)}
        ${textBox(k('ziel'), 'Ziel des Gesprächs', 'Was soll am Ende klar sein?', 1)}
        <div class="tb"><span class="tbh"><span>Leitfaden</span><span class="note">Vorschläge, du entscheidest</span></span>
          <div class="guide"><div><b>Fragen</b><ul>${G.fragen.map(f=>`<li>${esc(f)}</li>`).join('')}</ul></div><div><b>Worauf achten</b><ul>${G.tipps.map(f=>`<li>${esc(f)}</li>`).join('')}</ul></div></div></div>
        ${textBox(k('sagen'), 'Was ich sagen will', 'Stichpunkte, gern per Sprachnachricht', 3)}
        <label class="fl" for="talk-date">Geplant am<input type="date" id="talk-date" class="f" value="${state.texts[k('datum')] || addDays(TODAY, 2)}" data-text="${k('datum')}" style="width:auto;max-width:200px"></label>
        <div class="row"><button class="btn ghost" data-talksave="geplant">Als geplant speichern</button></div></div>
      <div class="card"><h3>Nach dem Gespräch</h3>
        ${textBox(k('notizen'), 'Wie lief es? Notizen', 'Was hat er gesagt, wie war die Stimmung?', 3)}
        ${textBox(k('vereinbart'), 'Vereinbarungen', 'z. B. bis Ende des Monats jedes Training, dann neues Gespräch', 2)}
        <div class="row"><button class="btn" data-talksave="geführt">Gespräch geführt, beim Spieler speichern</button><span class="note">Nur das Trainerteam sieht Gespräche.</span></div></div>
    </div>
    <aside class="grid" style="gap:12px;align-content:start">
      <div class="card"><h3>Daten zum Spieler</h3>${playerFacts(p)}</div>
      <div class="card"><h3>Bisherige Gespräche</h3>${hist.length ? `<ul class="list tlist">${hist.map(h=>`<li><span><b>${fmt(h.date)}</b> ${esc(h.anlass)}${h.vereinbart?`<br><span class="note">Vereinbart: ${esc(h.vereinbart)}</span>`:''}</span><span class="pill ${h.status==='geführt'?'':'grey'}">${h.status}</span></li>`).join('')}</ul>` : '<p class="sub">Noch keine. Geführte Gespräche erscheinen hier und in der Spieleransicht.</p>'}</div>
    </aside></div>`;
}
/** Rolle eines Spielers je Pflichtspiel:""")
rep("const R = {'uebung-neu':vUebungNeu,", "const R = {gespraech:vGespraech,'uebung-neu':vUebungNeu,")
rep("(['einheit','uebung','uebung-neu','einheit-neu'].includes(cur)) ? 'training' : cur;", "(['einheit','uebung','uebung-neu','einheit-neu'].includes(cur)) ? 'training' : cur === 'gespraech' ? 'kader' : cur;")
rep("  if (d.nureset) state.nu = null;", "  if (d.nureset) state.nu = null;\n  if (d.talk) { const [pid, code] = d.talk.split('|'); state.talk = {pid, code}; state.flash = null; }")
rep("  else if (d.more) {", r"""  else if (d.talksave) { const t = state.talk, k = key => state.texts[`talk-${t.pid}-${t.code}-${key}`] || '';
    const entry = {date: d.talksave==='geführt' ? TODAY : (k('datum') || addDays(TODAY, 2)), code: t.code, anlass: (k('anlass') || TALKGUIDE[t.code].label).split('. ')[0], ziel: k('ziel'), sagen: k('sagen'), notizen: k('notizen'), vereinbart: k('vereinbart'), status: d.talksave, who: document.getElementById('who').value};
    const l = talks[t.pid] = (talks[t.pid] || []).filter(x => !(x.status==='geplant' && x.code===t.code)); l.push(entry);
    state.flash = d.talksave==='geführt' ? `Gespräch gespeichert. Es steht jetzt in der Historie von ${P(t.pid).name}.` : `Gespräch für den ${fmt(entry.date)} vorgemerkt. Es steht auf dem Dashboard unter Administratives.`;
    render(); }
  else if (d.more) {""")
rep("  else if (d.comp) {", "  else if (t.id === 'talk-kind') { state.talk = {pid: state.talk.pid, code: t.value}; render(); }\n  else if (t.id === 'talk-date') { state.texts[t.dataset.text] = t.value; }\n  else if (d.comp) {")
# Spieleransicht: Gespräche und Knopf
rep('<div class="card"><h3>Noten im Verlauf</h3>', """<div class="card"><div class="row between"><h3>Gespräche</h3><a class="btn ghost small" href="#gespraech" data-talk="${p.id}|frei">Gespräch vorbereiten</a></div>
    ${(talks[p.id]||[]).length ? `<ul class="list tlist">${(talks[p.id]).slice().reverse().map(h=>`<li><span><b>${fmt(h.date)}</b> ${esc(h.anlass)}${h.vereinbart?`<br><span class="note">Vereinbart: ${esc(h.vereinbart)}</span>`:''}${h.notizen?`<br><span class="note">${esc(h.notizen)}</span>`:''}</span><span class="pill ${h.status==='geführt'?'':'grey'}">${h.status}</span></li>`).join('')}</ul>` : '<p class="sub" style="margin:0">Noch keine Gespräche festgehalten.</p>'}</div>
  <div class="card"><h3>Noten im Verlauf</h3>""")
# Kader: Name öffnet die Spieleransicht
rep('<span class="row" style="flex-wrap:nowrap;gap:8px">${av(p)}<b>${esc(p.name)}</b>', '<span class="row" style="flex-wrap:nowrap;gap:8px">${av(p)}<a class="plink" href="#analytics" data-anaplayer="${p.id}"><b>${esc(p.name)}</b></a>${(talks[p.id]||[]).some(t=>t.status===\'geführt\')?\'<span class="pill grey" title="Gespräch geführt">Gespräch</span>\':\'\'}')
# Dashboard: geplante Gespräche unter Administratives
rep("${dlink('#spielersicht', 'Spieler-Links verschicken', 'damit Zu- und Absagen hier ankommen', '', I.link)}",
    "${Object.entries(talks).flatMap(([pid,l])=>l.filter(x=>x.status==='geplant').map(x=>dlink('#gespraech', `Gespräch mit ${esc(P(pid).name)}`, `geplant am ${fmt(x.date)} · ${esc(TALKGUIDE[x.code].label)}`, `data-talk=\"${pid}|${x.code}\"`, av(P(pid))))).join('')}${dlink('#spielersicht', 'Spieler-Links verschicken', 'damit Zu- und Absagen hier ankommen', '', I.link)}")
rep("/* ---- Masken ---- */", """/* ---- Gespräche ---- */
.talkwrap { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; align-items: start; }
.guide { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: var(--accent-soft); border-radius: 8px; padding: 10px 12px; font-size: 15px; }
.guide ul { margin: 4px 0 0; padding-left: 18px; display: grid; gap: 3px; }
.rseq { display: flex; flex-wrap: wrap; gap: 3px; margin: 4px 0; }
.rchip { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 4px; font: 700 11px/1 var(--body); color: #fff; margin-right: 4px; }
.rchip.r-S { background: var(--accent); } .rchip.r-E { background: var(--tr); } .rchip.r-B { background: var(--warn); } .rchip.r-n { background: var(--line); color: var(--muted); }
.tlist li { align-items: start; }
.plink { color: var(--ink); text-decoration: none; } .plink:hover { text-decoration: underline; }
@media (max-width: 1000px) { .talkwrap { grid-template-columns: 1fr; } .guide { grid-template-columns: 1fr; } }
/* ---- Masken ---- */""")
open(p, 'w').write(s); print('ok')
