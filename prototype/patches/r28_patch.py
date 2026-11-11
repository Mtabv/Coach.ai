import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Abwesenheiten: Verletzung/Krankheit sagt Training und Spiele ab, sonstige Abwesenheit zusätzlich Events und Dienste ----
rep("const absentOn = iso => absences.filter(a=>a.from<=iso && iso<=a.to);", """const absentOn = iso => absences.filter(a=>a.from<=iso && iso<=a.to);
const ABS_ARTEN = ['Verletzung','Krankheit','Urlaub','Arbeit','Uni oder Schule','Familie','Sonstiges'];
/** Verletzung oder Krankheit: betrifft nur Training und Spiele (auch Testspiele). */
const isInj = a => a.kind ? a.kind === 'verletzung' : /^(verletz|krank|angeschlagen)/i.test(a.why || '');
const absCovers = (a, type) => (type === 'ev' || type === 'dienst') ? !isInj(a) : true;
const absentFor = (pid, iso, type) => absences.find(a => a.pid===pid && a.from<=iso && iso<=a.to && absCovers(a, type));""")
rep("const out = new Map(absentOn(e.date).map(a=>[a.pid, a.why]));\n  const yes = [], no = [], none = [];\n  players.forEach(p => {\n    const t = attEntry(e.id, p.id);",
    "const out = new Map(absentOn(e.date).filter(a=>absCovers(a, e.type)).map(a=>[a.pid, a.why]));\n  const yes = [], no = [], none = [];\n  players.forEach(p => {\n    const t = attEntry(e.id, p.id);")

# Dienste: Wer im Zeitraum abwesend ist (nicht bei Verletzung), ist automatisch ausgetragen, der Platz wird frei
rep("function dutyChip(d) {\n  const open = d.slots - d.who.length;", """const dutyDates = d => { if (d.ev) { const e = EV(d.ev); return e ? [e.date] : []; } const o = []; for (let x = d.from; x <= d.to; x = plusDays(x, 1)) o.push(x); return o; };
const dutyOut = d => d.who.filter(pid => dutyDates(d).some(iso => absentFor(pid, iso, 'dienst')));
const dutyWho = d => { const out = dutyOut(d); return d.who.filter(pid => !out.includes(pid)); };
function dutyChip(d) {
  const open = d.slots - dutyWho(d).length;""")
rep("${d.who.map(id=>P(id).name.split(' ')[1]).join(', ')}${open?` <span class=\"pill warn\">${open} offen</span>`:''}</div>`;",
    "${dutyWho(d).map(id=>P(id).name.split(' ')[1]).join(', ')}${open?` <span class=\"pill warn\">${open} offen</span>`:''}</div>`;")
rep("${duties.map(d=>{const open=d.slots-d.who.length;return `<tr><td><b>${esc(d.title)}</b></td><td class=\"note\">${dutyWhen(d)}</td><td>${d.who.map(id=>P(id).name).join(', ')||'–'}</td>",
    "${duties.map(d=>{const w=dutyWho(d), out=dutyOut(d), open=d.slots-w.length;return `<tr><td><b>${esc(d.title)}</b></td><td class=\"note\">${dutyWhen(d)}</td><td>${w.map(id=>plink(P(id))).join(', ')||'–'}${out.length?`<br><span class=\"note\">ausgetragen, abwesend: ${out.map(id=>plink(P(id))).join(', ')}</span>`:''}</td>")

# ---- Spielerprofil: von überall erreichbar ----
rep("const av = (p, cls='') => p && p.photo ? `<img class=\"av ${cls}\" src=\"${p.photo}\" alt=\"\">` : `<span class=\"av ${cls} init\">${p ? esc(p.name.split(' ').map(x=>x[0]).join('').slice(0,2)) : ''}</span>`;",
    """const av = (p, cls='') => p && p.photo ? `<img class="av ${cls}" src="${p.photo}" alt="" data-spieler="${p.id}" title="Profil von ${esc(p.name)}">` : `<span class="av ${cls} init" ${p?`data-spieler="${p.id}" title="Profil von ${esc(p.name)}"`:''}>${p ? esc(p.name.split(' ').map(x=>x[0]).join('').slice(0,2)) : ''}</span>`;
/** Name als Link aufs Spielerprofil */
const plink = (p, label) => p ? `<a class="plink" href="#spieler" data-spieler="${p.id}">${esc(label ?? p.name)}</a>` : '';""")
rep("const pName = p => `${av(p,'sm')} ${p.name}${isTW(p)?' (TW)':''}`;", "const pName = p => `${av(p,'sm')} ${plink(p)}${isTW(p)?' (TW)':''}`;")
rep("<a class=\"plink\" href=\"#analytics\" data-anaplayer=\"${p.id}\"><b>${esc(p.name)}</b></a>", "<a class=\"plink\" href=\"#spieler\" data-spieler=\"${p.id}\"><b>${esc(p.name)}</b></a>")
rep("${abs.map(a=>`<div><b>${P(a.pid).name}</b> · ${a.why}</div>`).join('')}", "${abs.map(a=>`<div><b>${plink(P(a.pid))}</b> · ${esc(a.why)}</div>`).join('')}")
rep("<b>fehlen:</b> ${abs.map(a=>P(a.pid).name.split(' ').slice(1).join(' ')).join(', ')}", "<b>fehlen:</b> ${abs.map(a=>plink(P(a.pid), P(a.pid).name.split(' ').slice(1).join(' '))).join(', ')}")
rep("<b>fehlen:</b> ${abs.map(a=>`${P(a.pid).name}${isTW(P(a.pid))?' (TW)':''} · ${a.why}`).join(', ')}", "<b>fehlen:</b> ${abs.map(a=>`${plink(P(a.pid))}${isTW(P(a.pid))?' (TW)':''} · ${esc(a.why)}`).join(', ')}")
rep("lastView = k; nav(k);", "lastView = k; nav(k==='spieler' ? 'kader' : k);")

PROFIL = r"""
// ======================= Spielerprofil =======================
function absImpact(a) {
  const evs = events.filter(e => e.date>=a.from && e.date<=a.to && e.date>=TODAY && absCovers(a, e.type));
  const n = t => evs.filter(e=>e.type===t).length;
  const ds = duties.filter(d => d.who.includes(a.pid) && dutyDates(d).some(iso => iso>=a.from && iso<=a.to) && absCovers(a, 'dienst'));
  const parts = [n('tr') && `${n('tr')} Training${n('tr')>1?'s':''}`, n('gm') && `${n('gm')} Spiel${n('gm')>1?'e':''}`, n('ev') && `${n('ev')} Event${n('ev')>1?'s':''}`, ds.length && `${ds.length} Dienst${ds.length>1?'e':''}`].filter(Boolean);
  return parts.length ? `automatisch abgesagt: ${parts.join(', ')}` : 'keine Termine in diesem Zeitraum';
}
function vSpieler() {
  const p = P(state.spieler) || players[0];
  const abs = absences.map((a,i)=>({a,i})).filter(x=>x.a.pid===p.id).sort((x,y)=>x.a.from.localeCompare(y.a.from));
  const cur = abs.filter(x=>x.a.to>=TODAY), past = abs.filter(x=>x.a.to<TODAY);
  const kommend = events.filter(e=>e.date>=TODAY).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||''))).slice(0,10);
  const status = e => { const t = attEntry(e.id, p.id); if (t) return t.s==='ja' ? ['ja','zugesagt (Trainerteam)'] : ['nein', `abgesagt · ${esc(t.why||'ohne Angabe')}`];
    const a = absentFor(p.id, e.date, e.type); if (a) return ['nein', `abgesagt · ${esc(a.why)} (${fmt(a.from)}–${fmt(a.to)})`]; return ['offen','keine Antwort']; };
  const titel = e => e.type==='gm' ? `${gameTitle(e)}${e.kind==='test'?' (Test)':''}` : e.type==='tr' ? 'Training' : esc(e.title||'Termin');
  const meineDienste = duties.filter(d=>d.who.includes(p.id));
  const tile = (l, v) => `<div class="tile"><span class="note">${l}</span><div class="v num">${v}</div></div>`;
  const absRow = ({a,i}) => `<li><span><b>${esc(a.why)}</b> <span class="pill ${isInj(a)?'game':'grey'}">${isInj(a)?'Verletzung/Krankheit':'Abwesenheit'}</span><br><span class="note">${fmt(a.from)}${a.from.slice(0,4)!==a.to.slice(0,4)?a.from.slice(0,4):''}–${fmt(a.to)}${a.to.slice(0,4)} · ${absImpact(a)}</span></span><button class="ib" data-absdel2="${i}" title="Eintrag löschen" aria-label="Eintrag löschen">${ICON.x}</button></li>`;
  return `${demo}
  <div class="crumb"><a href="#kader">Kader</a> › ${esc(p.name)}</div>
  <div class="head"><div class="row" style="gap:14px;flex-wrap:nowrap">${av(p,'xl')}<div><h1>${esc(p.name)}</h1><p>${p.nr?`Nr. ${p.nr} · `:''}${p.pos}${p.captain?' · Kapitän':''}</p></div></div>
    <div class="row"><a class="btn ghost small" href="#analytics" data-anaplayer="${p.id}">Analytics</a><a class="btn ghost small" href="#kommunikation" data-komtab="gespraeche">Spielergespräche</a></div></div>
  <div class="tiles">${tile('Im Kader', p.games)}${tile('Einsätze', p.apps)}${tile('Minuten', p.mins)}${tile('Startelf', p.starts)}${tile('Tore', p.goals)}${tile('Vorlagen', p.assists??0)}${tile('Ø Note', p.grade!=null?de(p.grade):'–')}</div>
  <div class="grid g2" style="align-items:start">
    <div class="card"><div class="row between"><h3>Verletzungen und Abwesenheiten</h3><button class="btn small ${state.absOpen?'ghost':''}" data-absopen="1">${state.absOpen?'Schließen':'Eintragen'}</button></div>
      <p class="note" style="margin:0">Verletzung oder Krankheit sagt im Zeitraum alle Trainings und Spiele ab, auch Testspiele. Jede andere Abwesenheit, etwa Urlaub, zusätzlich alle Events und Dienste.</p>
      ${state.absOpen ? `<div class="grid" style="gap:8px">
        <label class="fl" for="ab-art">Art<select id="ab-art">${ABS_ARTEN.map(x=>`<option>${x}</option>`).join('')}</select></label>
        <div class="row" style="flex-wrap:nowrap"><label class="fl" for="ab-von" style="flex:1">von<input type="date" id="ab-von" value="${TODAY}"></label><label class="fl" for="ab-bis" style="flex:1">bis einschließlich<input type="date" id="ab-bis" value="${plusDays(TODAY,6)}"></label></div>
        <label class="fl" for="ab-notiz">Notiz, optional<input type="text" id="ab-notiz" placeholder="z. B. Bänderdehnung, Rückkehr ins Lauftraining ab …"></label>
        <button class="btn" data-abssave2="${p.id}" style="justify-self:start">Speichern und Termine absagen</button></div>` : ''}
      <ul class="list">${cur.length ? cur.map(absRow).join('') : '<li><span class="note">Aktuell und künftig nichts eingetragen.</span></li>'}</ul>
      ${past.length ? `<details><summary class="note">Frühere Einträge (${past.length})</summary><ul class="list">${past.map(absRow).join('')}</ul></details>` : ''}</div>
    <div class="card"><h3>Nächste Termine</h3>
      <ul class="list">${kommend.map(e=>{ const [k,l] = status(e); return `<li><span><b>${WD[dt(e.date).getDay()]} ${fmt(e.date)}</b> · ${titel(e)}<br><span class="note">${l}</span></span>${e.type==='ev'?'':`<span class="attbtns"><button class="attb yes ${k==='ja'&&attEntry(e.id,p.id)?'on':''}" data-att="${e.id}|${p.id}|ja" title="Zusage">✓</button><button class="attb no ${k==='nein'&&attEntry(e.id,p.id)?'on':''}" data-att="${e.id}|${p.id}|nein" title="Absage">✕</button></span>`}</li>`; }).join('')}</ul>
      ${meineDienste.length ? `<h4 style="margin:6px 0 0">Dienste</h4><ul class="list">${meineDienste.map(d=>`<li><span>${esc(d.title)}<br><span class="note">${dutyWhen(d)}${dutyOut(d).includes(p.id)?' · ausgetragen wegen Abwesenheit':''}</span></span></li>`).join('')}</ul>` : ''}
      ${(talks[p.id]||[]).length ? `<h4 style="margin:6px 0 0">Gespräche</h4><ul class="list">${talks[p.id].map(t=>`<li><span>${fmt(t.date)} · ${esc((guideFor(t.code)||{}).label||t.code)}</span><span class="pill grey">${esc(t.status)}</span></li>`).join('')}</ul>` : ''}</div>
  </div>`;
}
document.addEventListener('click', ev => {
  const t = ev.target.closest && ev.target.closest('[data-spieler]');
  if (!t || ev.target.closest('#pitch, .pitch, .spot, .bench, [draggable="true"], button, select, input, label, .pick')) return;
  ev.preventDefault(); ev.stopPropagation();
  state.spieler = t.dataset.spieler; state.absOpen = false;
  if (location.hash === '#spieler') render(); else location.hash = '#spieler';
  window.scrollTo(0, 0);
}, true);
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-absopen],[data-abssave2],[data-absdel2]');
  if (!b) return;
  if (b.dataset.absopen) state.absOpen = !state.absOpen;
  if (b.dataset.abssave2) {
    const art = document.getElementById('ab-art').value, from = document.getElementById('ab-von').value, to0 = document.getElementById('ab-bis').value || from, note = document.getElementById('ab-notiz').value.trim();
    if (!from) return;
    const to = to0 < from ? from : to0;
    absences.push({pid: b.dataset.abssave2, from, to, why: art + (note ? `: ${note}` : ''), kind: (art==='Verletzung' || art==='Krankheit') ? 'verletzung' : 'abwesend', src: 'trainer'});
    state.absOpen = false;
  }
  if (b.dataset.absdel2) absences.splice(+b.dataset.absdel2, 1);
  render();
});
"""
rep("// ======================= Router und Ereignisse =======================", PROFIL + "// ======================= Router und Ereignisse =======================")
rep("else if (d.pdf) { state.flash = 'Im Entwurf ohne Funktion: Hier entsteht das PDF genau aus der Gegnervorbereitung, mit den Seiten, die einen Haken „im Dossier“ haben, und der Aufstellung.'; render(); }",
    "else if (d.pdf) { if (location.protocol.startsWith('http') && location.pathname === '/teamzentrale') (() => { const g = EV(d.pdf) || {}, r = REAL.games.find(x=>x.id===d.pdf) || {}; const q = new URLSearchParams({dossier:'1', gegner:g.opp||'', datum:g.date||'', anstoss:g.time||'', heim:g.home?'1':'0', wettbewerb:g.comp||'', art:g.kind||'liga', ort:r.venue||g.place||'', adresse:r.address||''}); window.open('/?' + q.toString() + '#/', '_blank'); })(); else { state.flash = 'Das Dossier als PDF gibt es auf 11plan.de: Der Knopf öffnet dort das Spieltagsdossier mit Folien, PDF und PowerPoint.'; render(); } }")
rep("squad = state.squad[g.id] || (state.squad[g.id] = new Set(", "squad = (state.squad[g.id] instanceof Set ? state.squad[g.id] : null) || (state.squad[g.id] = new Set(")
rep('data-pdf="1"', 'data-pdf="${g.id}"', 0)
rep("${fmt(g.date)}2026 · ${g.time} Uhr", "${fmt(g.date)}${g.date.slice(0,4)} · ${g.time} Uhr")
rep("const R = {kommunikation:vKommunikation,", "const R = {spieler:vSpieler,kommunikation:vKommunikation,")
rep("</style>\n</head>", """.av[data-spieler] { cursor: pointer; }
.av.xl { width: 72px; height: 72px; font-size: 24px; }
a.plink { color: inherit; text-decoration: none; }
a.plink:hover { color: var(--accent); text-decoration: underline; }
.tile .v { font-family: var(--display); font-size: 26px; font-weight: 600; }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
