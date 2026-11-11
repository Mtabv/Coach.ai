import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ===================== Maske: Übung erfassen =====================
rep("function vUebung() {", r"""function vUebungNeu() {
  return `${demo}
  <div class="crumb"><a href="#training" data-ttabgo="uebungen">Übungspool</a> › Neue Übung</div>
  <div class="head"><div><h1>Übung erfassen</h1><p>Erzählen oder schreiben, dazu ein Foto der Skizze. Die KI erfindet keine Übungen, sie ordnet eure ein.</p></div>
    <button class="mic" data-flash="Sprachnachricht: erzählen, 11Plan füllt die Felder. Im Entwurf ohne Funktion.">${ICON.mic} Sprachnachricht</button></div>
  ${flashBox()}
  <div class="card mask">
    <div class="grid g3">
      <label class="fl" for="ue-n">Name *<input id="ue-n" type="text" placeholder="z. B. Pressing-Auslöser Rückpass"></label>
      <label class="fl" for="ue-p">Prinzip<select class="f" id="ue-p"><option value="">ohne Prinzip</option>${principles.map(p=>`<option value="${p.id}">${p.phase}: ${p.name}</option>`).join('')}</select></label>
      <label class="fl" for="ue-k">Art<select class="f" id="ue-k">${KINDS.map(k=>`<option>${k}</option>`).join('')}</select></label>
      <label class="fl" for="ue-s">Spieler<input id="ue-s" type="text" placeholder="z. B. 10–14"></label>
      <label class="fl" for="ue-f">Feld<input id="ue-f" type="text" placeholder="z. B. 40 × 30 m"></label>
      <label class="fl" for="ue-d">Dauer in Minuten<input id="ue-d" type="number" min="5" step="5" class="f" value="20"></label>
    </div>
    <div class="grid g2">
      <label class="fl" for="ue-z">Ziel<textarea id="ue-z" rows="2"></textarea></label>
      <label class="fl" for="ue-a">Aufbau<textarea id="ue-a" rows="2" placeholder="Feld, Material, Teams"></textarea></label>
      <label class="fl" for="ue-b">Ablauf<textarea id="ue-b" rows="3"></textarea></label>
      <label class="fl" for="ue-c">Coaching-Schwerpunkte<textarea id="ue-c" rows="3"></textarea></label>
      <label class="fl" for="ue-v">Variationen<textarea id="ue-v" rows="2"></textarea></label>
      <div class="fl"><span>Skizze</span>${imgSlot('new', 'Skizze', 'Foto oder Grafik, optional')}</div>
    </div>
    <div class="row"><button class="btn" data-exsave="1">Übung speichern</button><a class="btn ghost" href="#training" data-ttabgo="uebungen">Abbrechen</a><span class="note">* Pflichtfeld</span></div>
  </div>`;
}

// ===================== Maske: Trainingseinheit zusammenstellen =====================
function vEinheitNeu() {
  const nu = state.nu || (state.nu = {name:'', pr: focusPr(), ex: [], date: (nextTrainings(4).find(t=>!t.unit && !(t.ex&&t.ex.length))||{}).id || ''});
  const tr = nu.date ? EV(nu.date) : null, total = 15 + nu.ex.reduce((a,id)=>a+X(id).min, 0);
  const need = nu.ex.length ? Math.max(...nu.ex.map(id=>needOf(X(id)))) : 0, avail = tr ? availFor(tr) : null;
  const phs = state.nuPhase || 'alle';
  const pool = exercises.filter(x => phs==='alle' || (x.pr && PR(x.pr).phase===phs));
  return `${demo}
  <div class="crumb"><a href="#training" data-ttabgo="einheiten">Trainingseinheiten</a> › Neue Einheit</div>
  <div class="head"><div><h1>Trainingseinheit zusammenstellen</h1><p>Übungen aus dem Pool auswählen, Reihenfolge festlegen und einem Training zuordnen.</p></div></div>
  <div class="nuwrap">
    <div class="grid" style="gap:12px">
      <div class="card mask"><div class="grid g3">
        <label class="fl" for="nu-name">Name der Einheit *<input id="nu-name" type="text" data-nu="name" value="${esc(nu.name)}" placeholder="z. B. Gegenpressing kompakt"></label>
        <label class="fl" for="nu-pr">Prinzip<select class="f" id="nu-pr" data-nu="pr">${principles.map(p=>`<option value="${p.id}" ${p.id===nu.pr?'selected':''}>${p.phase}: ${p.name}</option>`).join('')}</select></label>
        <label class="fl" for="nu-date">Für welches Training?<select class="f" id="nu-date" data-nu="date"><option value="">Ohne Datum, nur ins Inventar</option>${nextTrainings(8).map(t=>`<option value="${t.id}" ${t.id===nu.date?'selected':''}>${DAYNAMES[dt(t.date).getDay()]}, ${fmt(t.date)} · ${t.time} Uhr${t.unit?` (ersetzt: ${esc(U(t.unit).name)})`:''}</option>`).join('')}</select></label>
      </div>
      ${tr ? `<p class="note" style="margin:0">${DAYNAMES[dt(tr.date).getDay()]}, ${fmt(tr.date)} · ${tr.time}–${endTime(tr.time,tr.dur)} · ${tr.place} · ${availPill(tr.date,'tr')}</p>` : ''}</div>
      <div class="card"><div class="row between"><h3>Ablauf</h3><span class="pill ${tr && total>tr.dur?'warn':''}">${total} min${tr?` von ${tr.dur}`:''}</span></div>
        ${tr && total > tr.dur ? `<div class="warnbox">Die Einheit dauert ${total-tr.dur} Minuten länger als das Training.</div>` : ''}
        ${tr && need > avail ? `<div class="warnbox">Eine Übung braucht ${need} Spieler, verfügbar sind laut Abwesenheiten nur ${avail}.</div>` : ''}
        <div class="timeline">${(()=>{let t = tr ? tr.time : '19:00'; const rows=[[t,'Aufwärmen',15,null]]; t=endTime(t,15); nu.ex.forEach((id,i)=>{rows.push([t,X(id).name,X(id).min,id,i]); t=endTime(t,X(id).min);}); return rows.map(([tm,n,m,id,i])=>`<div class="tl ${id?'':'warm'}"><span class="tm">${tm}</span><div><h4>${id?exLink(id):esc(n)}</h4><span class="note">${id?`${X(id).kind} · ${X(id).players} Spieler · `:''}${m} min</span></div>
          ${id?`<span class="row" style="flex-wrap:nowrap;gap:4px">${i>0?`<button class="ib" data-nuup="${i}" aria-label="nach oben">↑</button>`:''}<button class="ib" data-nudel="${i}" aria-label="entfernen">${ICON.x}</button></span>`:''}</div>`).join('');})()}
          ${nu.ex.length ? '' : '<p class="sub">Noch keine Übung ausgewählt. Rechts aus dem Pool hinzufügen.</p>'}</div>
        <div class="row"><button class="btn" data-nusave="1">Einheit speichern${tr?` und dem ${fmt(tr.date)} zuordnen`:''}</button><a class="btn ghost" href="#training" data-ttabgo="einheiten" data-nureset="1">Abbrechen</a></div></div>
      ${flashBox()}
    </div>
    <aside class="card nupool"><div class="row between"><h3>Übungspool</h3><a class="note" href="#uebung-neu">neue Übung ›</a></div>
      <select class="f" id="nu-phase" aria-label="Spielphase">${['alle',...PHASES].map(p=>`<option value="${p}" ${phs===p?'selected':''}>${p==='alle'?'Alle Spielphasen':p}</option>`).join('')}</select>
      <div class="side-pick">${pool.map(x=>`<div class="it ${nu.ex.includes(x.id)?'in':''}" data-nuadd="${x.id}" role="button" tabindex="0"><b>${esc(x.name)}</b><small>${x.kind} · ${x.players} Sp. · ${x.min} min${nu.ex.includes(x.id)?' · ausgewählt':''}</small></div>`).join('')}</div>
      <p class="note">Antippen fügt die Übung am Ende hinzu.</p></aside>
  </div>`;
}
function vUebung() {""")
rep("const R = {uebung:vUebung,", "const R = {'uebung-neu':vUebungNeu,'einheit-neu':vEinheitNeu,uebung:vUebung,")
rep("(cur === 'einheit' || cur === 'uebung') ? 'training' : cur;", "(['einheit','uebung','uebung-neu','einheit-neu'].includes(cur)) ? 'training' : cur;")
rep("  const t = e.target.closest('button, a, .unit, [data-drop], [data-useunit], [data-exadd], [data-ksort]'); if (!t) return;", "  const t = e.target.closest('button, a, .unit, [data-drop], [data-useunit], [data-exadd], [data-ksort], [data-nuadd]'); if (!t) return;")
rep("  if (d.setex) state.exId = d.setex;", "  if (d.setex) state.exId = d.setex;\n  if (d.nureset) state.nu = null;\n  if (d.anaplayer) { state.anaTab = 'spieler'; state.anaPlayer = d.anaplayer; }\n  if (d.anateam) state.anaTab = 'team';")
rep("  else if (d.more) {", r"""  else if (d.exsave) { const v = id => (document.getElementById(id)||{}).value || '', name = v('ue-n').trim();
    if (!name) { document.getElementById('ue-n').focus(); document.getElementById('ue-n').classList.add('need'); return; }
    const id = 'xn' + Date.now(); exercises.push({id, name, pr: v('ue-p') || null, kind: v('ue-k'), players: v('ue-s') || '–', field: v('ue-f') || '–', min: +v('ue-d') || 20, src: 'Trainer'});
    EXD[id] = [v('ue-z'), v('ue-a'), v('ue-b'), v('ue-c'), v('ue-v')]; if (state.imgs['new']) { state.imgs['ex-'+id] = state.imgs['new']; delete state.imgs['new']; }
    state.exId = id; state.flash = 'Übung gespeichert. Sie steht jetzt im Übungspool.'; location.hash = 'uebung'; }
  else if (d.nuadd) { state.nu.ex.push(d.nuadd); render(); }
  else if (d.nudel) { state.nu.ex.splice(+d.nudel, 1); render(); }
  else if (d.nuup) { const i = +d.nuup, l = state.nu.ex; [l[i-1], l[i]] = [l[i], l[i-1]]; render(); }
  else if (d.nusave) { const nu = state.nu;
    if (!nu.name.trim()) { const el = document.getElementById('nu-name'); el.focus(); el.classList.add('need'); return; }
    if (!nu.ex.length) { state.flash = 'Bitte mindestens eine Übung auswählen.'; render(); return; }
    const id = 'un' + Date.now(); units.push({id, name: nu.name.trim(), pr: nu.pr, ex: [...nu.ex]});
    if (nu.date) { const t = EV(nu.date); t.unit = id; t.ex = null; state.trainEv = nu.date; state.nu = null; state.flash = null; location.hash = 'einheit'; }
    else { state.nu = null; state.trainTab = 'einheiten'; state.flash = 'Einheit gespeichert. Sie steht im Inventar.'; location.hash = 'training'; } }
  else if (d.more) {""")
rep("document.addEventListener('input', e => {", "document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.nu === 'name') { state.nu.name = e.target.value; return; }")
rep("  else if (d.comp) {", "  else if (d.nu) { state.nu[d.nu] = t.value; render(); }\n  else if (t.id === 'nu-phase') { state.nuPhase = t.value; render(); }\n  else if (d.comp) {")
rep("Einheit skizzieren</button>", "Einheit zusammenstellen</button>", 1)
s = s.replace('<button class="btn small">Einheit zusammenstellen</button>', '<a class="btn small" href="#einheit-neu" data-nureset="1">Einheit zusammenstellen</a>', 1)
# Dashboard: direkt in die Masken
rep("${dlink('#training', 'Übung erfassen', 'per Text oder Sprachnachricht, mit Skizze', 'data-ttabgo=\"uebungen\"', I.plus)}", "${dlink('#uebung-neu', 'Übung erfassen', 'per Text oder Sprachnachricht, mit Skizze', '', I.plus)}")
rep("${dlink('#training', 'Trainingseinheit zusammenstellen', 'aus Übungen des Pools', 'data-ttabgo=\"einheiten\"', I.plus)}", "${dlink('#einheit-neu', 'Trainingseinheit zusammenstellen', 'aus Übungen des Pools, mit Datum', 'data-nureset=\"1\"', I.plus)}")

# ===================== Nachrichten: nächste Schritte und Highlights =====================
i = s.index("    <div class=\"msgs\">"); j = s.index("    </div></section>", i)
s = s[:i] + r"""    <div class="msgs">${coachNews().map(m=>dlink(m.href, m.title, `<b class="lbl ${m.kind==='Nächster Schritt'?'nba':''}">${m.kind}</b> ${m.sub}`, m.attrs||'', m.icon, 'msg')).join('')}
""" + s[j:]
rep("function dlink(href,", r"""/** Nachrichten von 11Plan: zuerst nächste Schritte, dann Highlights aus den Zahlen, die in Analytics führen. */
function coachNews() {
  const T = REAL.tiles, B = REAL.bins, nx = EV(REAL.next), rg = REAL.games.find(g=>g.id===REAL.next), lp = games().filter(g=>g.res && g.post==='offen').pop();
  const n = [], lg = REAL.games.filter(g=>g.res && g.kind==='liga');
  // Spielvorbereitung und Nachbereitung stehen schon oben im Kasten „Spiel“ und werden hier nicht wiederholt.
  const top = [...players].sort((a,b)=>b.goals-a.goals)[0], allGoals = REAL.games.filter(g=>g.res && g.kind!=='test').reduce((a,g)=>a+g.gf,0);
  n.push({kind:'Highlight', icon:I.chart, href:'#analytics', attrs:`data-anaplayer="${top.id}"`, title:`${esc(top.name)}: ${top.goals} Tore in Pflichtspielen`, sub:`Das sind ${Math.round(top.goals/allGoals*100)} % unserer ${allGoals} Tore. Wie verteilen sie sich über die Saison?`});
  const mm = [...players].sort((a,b)=>b.mins-a.mins)[0];
  n.push({kind:'Highlight', icon:I.clock, href:'#analytics', attrs:`data-anaplayer="${mm.id}"`, title:`${esc(mm.name)}: ${mm.mins.toLocaleString('de-DE')} Spielminuten`, sub:`Mehr als jeder andere im Kader. Wer braucht Pausen, wer mehr Einsatzzeit?`});
  const h2 = B.own_for[3]+B.own_for[4]+B.own_for[5], h1 = B.own_for[0]+B.own_for[1]+B.own_for[2];
  if (h2 > h1) n.push({kind:'Highlight', icon:I.chart, href:'#analytics', attrs:'data-anateam="1"', title:`${h2} von ${h1+h2} Ligatoren nach der Pause`, sub:'Die Mannschaft trifft in der zweiten Halbzeit häufiger. Was ist dann anders?'});
  else if (h1 > h2) n.push({kind:'Highlight', icon:I.chart, href:'#analytics', attrs:'data-anateam="1"', title:`${h1} von ${h1+h2} Ligatoren vor der Pause`, sub:'Nach der Halbzeit fallen weniger eigene Tore. Was ändert sich?'});
  if (T.away > T.home) n.push({kind:'Highlight', icon:I.chart, href:'#analytics', attrs:'data-anateam="1"', title:`Auswärts ${T.away} Punkte, zu Hause ${T.home}`, sub:`Aus je ${T.awayG} und ${T.homeG} Spielen. Woran liegt es auf dem eigenen Platz?`});
  const z = REAL.team.zones || {relegation:4}, safe = REAL.table[REAL.table.length - z.relegation - 1], own = REAL.table.find(x=>x.own);
  if (safe && own && own.pl > safe.pl) n.push({kind:'Highlight', icon:I.chart, href:'#analytics', attrs:'data-anateam="1"', title:`${safe.pts - own.pts} Punkte bis Platz ${safe.pl}`, sub:`${esc(safe.team)} steht mit ${safe.pts} Punkten auf dem ersten Platz ohne Abstieg.`});
  const cup = REAL.games.find(g=>!g.res && g.kind==='pokal');
  if (cup) n.push({kind:'Highlight', icon:I.cal, href:'#spieltag', title:`Im Kreispokal noch dabei`, sub:`Nächste Runde am ${fmt(cup.date)} gegen ${esc(cup.opp)}.`});
  return n;
}
function dlink(href,""")
rep("/* ---- Wappen und Dashboard ---- */", """/* ---- Masken ---- */
.mask { gap: 12px; }
.nuwrap { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
.nupool { position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow: auto; }
.side-pick .it.in { border-color: var(--accent); background: var(--accent-soft); }
input.need { outline: 2px solid var(--game); }
.lbl.nba { color: var(--accent); }
@media (max-width: 900px) { .nuwrap { grid-template-columns: 1fr; } .nupool { position: static; max-height: none; } }
/* ---- Wappen und Dashboard ---- */""")
open(p, 'w').write(s); print('ok')
