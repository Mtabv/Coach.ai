import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Übungen: Prinzip optional; ältere Kennung 'ath' bleibt lesbar ----
rep("const PR = id => principles.find(p=>p.id===id);",
    """const ATH = {id:'ath', phase:'Athletik', name:'Kraft, Ausdauer, Schnelligkeit', hist:[]};
const PR = id => principles.find(p=>p.id===id) || (id === 'ath' ? ATH : undefined);
const UE_PHASEN = PHASES;
const prOptionen = sel => `<option value="">ohne Prinzip</option>${principles.map(p=>`<option value="${p.id}" ${p.id===sel?'selected':''}>${p.phase}: ${p.name}</option>`).join('')}`;""")
rep("const groups = [...PHASES, 'ohne Prinzip'].map(", "const groups = [...UE_PHASEN, 'ohne Prinzip'].map(")
rep("""<select class="f" id="exf" aria-label="Spielphase" style="width:auto">${['alle',...PHASES]""",
    """<select class="f" id="exf" aria-label="Spielphase" style="width:auto">${['alle',...UE_PHASEN]""")
rep("""<select class="f" id="nu-phase" aria-label="Spielphase">${['alle',...PHASES]""",
    """<select class="f" id="nu-phase" aria-label="Spielphase">${['alle',...UE_PHASEN]""")
# Beide Erfassungsmasken: echte Kennungen und „ohne Prinzip“
rep("""<select class="f" id="ue-p">${principles.map(p=>`<option>${p.phase}: ${p.name}</option>`).join('')}</select>""",
    """<select class="f" id="ue-p">${prOptionen('')}</select>""")
rep("""<select class="f" id="ue-p"><option value="">ohne Prinzip</option>${principles.map(p=>`<option value="${p.id}">${p.phase}: ${p.name}</option>`).join('')}</select>""",
    """<select class="f" id="ue-p">${prOptionen('')}</select>""")
rep("""<label class="fl" for="ue-p">Prinzip<select""", """<label class="fl" for="ue-p">Prinzip (optional)<select""", 0)
# Erfassen im Übungspool bekommt einen Speichern-Knopf
rep("""      <div class="fl"><span>Skizze</span>${imgSlot('new', 'Skizze', 'Foto oder Grafik, optional')}</div>
    </div></div>`;
}""", """      <div class="fl"><span>Skizze</span>${imgSlot('new', 'Skizze', 'Foto oder Grafik, optional')}</div>
    </div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-exsave="1">Übung speichern</button></div></div>`;
}""")
# Erfolgsmeldung überlebt den Seitenwechsel
rep("state.flash = 'Übung gespeichert. Sie steht jetzt im Übungspool.'; location.hash = 'uebung'; }",
    "state.flashNext = `„${name}“ gespeichert. Du findest sie unter Training › Übungspool${PR(v('ue-p')) ? ' bei ' + PR(v('ue-p')).phase : ''}.`; if (location.hash === '#uebung') render(); else location.hash = 'uebung'; }")
rep("if (k !== lastView) { state.flash = null; state.picked = null; }",
    "if (k !== lastView) { state.flash = null; state.picked = null; }\n  if (state.flashNext) { state.flash = state.flashNext; state.flashNext = null; }")

# ---- Kalender: alles mit einem Klick/Tippen öffnen ----
rep("""title="Doppelklick öffnet das Training">""", """title="Antippen öffnet das Training">""")
rep("""document.addEventListener('dblclick', e => { const el = e.target.closest && e.target.closest('[data-open]'); if (el && !e.target.closest('select')) { state.trainEv = el.dataset.open; location.hash = 'einheit'; } });""",
    """document.addEventListener('click', e => {
  const t = e.target; if (!t.closest || t.closest('select,a,button,input,textarea,label')) return;
  const tr = t.closest('[data-open]'), gm = t.closest('[data-gopen]'), ev = t.closest('[data-evopen]');
  if (tr) { state.trainEv = tr.dataset.open; location.hash = 'einheit'; }
  else if (gm) { const g = EV(gm.dataset.gopen); if (!g) return; if (gespielt(g)) { state.post = g.id; location.hash = 'spiel-nachbereitung'; } else { state.game = g.id; location.hash = 'spiel-vorbereitung'; } }
  else if (ev) { terminOeffnen(ev.dataset.evopen); }
});
/** Vorhandenen Termin im Dialog öffnen (ändern oder löschen). */
function terminOeffnen(id) {
  const e = EV(id); if (!e) return;
  state.evForm = {edit: id, date: e.date, kind: e.kind || EVKINDS.find(k => k !== 'Training') || 'Sonstiges', title: e.title || '', time: e.time || '', end: e.end || '', place: e.place || '', note: e.note || '', rsvp: !!e.rsvp, duties: [], unit: ''};
  render();
}""")
# Spiele in der Wochenansicht
rep("""`<div class="ev gm ${e.kind||''}"><span class="t">${e.time} Spiel${e.kind==='pokal'?' · Pokal':''}</span>""",
    """`<div class="ev gm ${e.kind||''}" data-gopen="${e.id}" title="Antippen öffnet ${gespielt(e)?'die Nachbereitung':'die Vorbereitung'}"><span class="t">${e.time} Spiel${e.kind==='pokal'?' · Pokal':''} ›</span>""")
rep("""${e.res?`<span class="pill game" style="justify-self:start">${e.res}</span>`:`${state.showAbs?availPill(iso,'gm'):''}<a href="#spiel-vorbereitung" data-setgame="${e.id}">Vorbereitung</a>`}</div>`""",
    """${gespielt(e)?`${e.res?`<span class="pill game" style="justify-self:start">${e.res}</span>`:''}<a href="#spiel-nachbereitung" data-setpost="${e.id}">Nachbereitung</a>`:`${state.showAbs?availPill(iso,'gm'):''}<a href="#spiel-vorbereitung" data-setgame="${e.id}">Vorbereitung</a>`}</div>`""")
# Termine (Wochenansicht und Dashboard)
rep("""return `<div class="ev xv"><span class="t">${e.time}${e.end?'–'+e.end:''} ${esc(e.title)}</span>""",
    """return `<div class="ev xv" data-evopen="${e.id}" title="Antippen: Termin ansehen oder ändern"><span class="t">${e.time}${e.end?'–'+e.end:''} ${esc(e.title)} ›</span>""")
rep("""${evs.map(e=>e.type==='ev' ? `<div class="ev xv"><span class="t">${e.time} ${esc(e.title)}</span></div>`""",
    """${evs.map(e=>e.type==='ev' ? `<div class="ev xv" data-evopen="${e.id}" title="Antippen: Termin ansehen oder ändern"><span class="t">${e.time} ${esc(e.title)} ›</span></div>`""")
# Dienste: öffnen den zugehörigen Termin
rep("""return `<div class="duty ${open?'open':''}"><b>""", """return `<div class="duty ${open?'open':''}" ${d.ev?`data-evopen="${d.ev}" title="Antippen öffnet den Termin"`:''}><b>""")
# Monatsansicht
rep("""e.type==='ev'?`<span class="chip xv" title="${esc(e.title)}">${e.time} ${esc(e.title)}</span>`""",
    """e.type==='ev'?`<span class="chip xv" data-evopen="${e.id}" title="${esc(e.title)}">${e.time} ${esc(e.title)}</span>`""")
rep("""? `<span class="chip gm ${e.kind==='pokal'?'pokal':''}" title="${gameTitle(e)}, ${e.comp}">${e.time} ${e.opp}</span>`""",
    """? `<span class="chip gm ${e.kind==='pokal'?'pokal':''}" data-gopen="${e.id}" title="${gameTitle(e)}, ${e.comp}">${e.time} ${e.opp}</span>`""")
rep(""": `<span class="chip tr ${e.unit?'':'open'}" title="${e.unit?U(e.unit).name:'offen'} · ${e.place}">""",
    """: `<span class="chip tr ${e.unit?'':'open'}" data-open="${e.id}" title="${e.unit?U(e.unit).name:'offen'} · ${e.place}">""")

# Termin-Dialog: vorhandene Termine ändern und löschen
rep("""<h2 id="evd-h">Termin anlegen</h2>""", """<h2 id="evd-h">${f.edit ? 'Termin ändern' : 'Termin anlegen'}</h2>""")
rep("else if (d.evsave && state.evForm.kind === 'Training') {", "else if (d.evdel) { const i = events.findIndex(x => x.id === d.evdel); if (i >= 0 && confirm('Termin wirklich löschen?')) { const t = events[i]; events.splice(i, 1); for (let j = duties.length - 1; j >= 0; j--) if (duties[j].ev === t.id) duties.splice(j, 1); state.evForm = null; state.flash = `„${t.title}“ gelöscht.`; render(); } }\n  else if (d.evsave && state.evForm.kind === 'Training' && !state.evForm.edit) {")
rep("""    if (!f.title.trim()) { const el = document.getElementById('evf-title'); el.classList.add('need'); el.focus(); return; }
    const id = 'v' + Date.now();""",
    """    if (!f.title.trim()) { const el = document.getElementById('evf-title'); el.classList.add('need'); el.focus(); return; }
    if (f.edit) { const t = EV(f.edit);
      if (t) { Object.assign(t, {date: f.date, time: f.time || '00:00', end: f.end, title: f.title.trim(), kind: f.kind, place: f.place || 'noch offen', note: f.note, rsvp: f.rsvp});
        f.duties.filter(x=>x.title.trim()).forEach((x,i)=>duties.push({id: t.id+'d'+Date.now()+i, title: x.title.trim(), ev: t.id, slots: +x.slots || 1, who: []})); }
      state.evForm = null; state.flash = `„${f.title.trim()}“ geändert.`; render(); return; }
    const id = 'v' + Date.now();""")
s = s.replace("""<button class="btn" data-evsave="1">""", """${f.edit ? `<button class="btn ghost" data-evdel="${f.edit}">Termin löschen</button>` : ''}<button class="btn" data-evsave="1">""", 1)

# ---- Dashboard: Woche vor- und zurückblättern ----
rep("${weekStrip(MON)}", """<div class="row between dwk" style="margin:4px 0 8px"><b>${(state.dashWeek||0) === 0 ? 'Diese Woche' : (state.dashWeek === 1 ? 'Nächste Woche' : state.dashWeek === -1 ? 'Letzte Woche' : 'KW ' + KW(addDays(MON, 7*state.dashWeek)))} <span class="note num">${fmt(addDays(MON, 7*(state.dashWeek||0)))} – ${fmt(addDays(MON, 7*(state.dashWeek||0)+6))}</span></b><span class="row" style="gap:6px;flex-wrap:nowrap">${state.dashWeek ? '<button class="btn ghost small" data-dwk="0">Heute</button>' : ''}<button class="btn ghost small" data-dwk="-1" aria-label="Vorige Woche">‹</button><button class="btn ghost small" data-dwk="1" aria-label="Nächste Woche">›</button></span></div>
  ${weekStrip(addDays(MON, 7*(state.dashWeek||0)))}""")
rep("// ======================= Router und Ereignisse =======================",
    """document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-dwk]'); if (!b) return; const n = +b.dataset.dwk; state.dashWeek = n === 0 ? 0 : (state.dashWeek || 0) + n; render(); });
// ======================= Router und Ereignisse =======================""")

rep("</style>\n</head>", """.ev.gm[data-gopen], .ev.xv[data-evopen], .duty[data-evopen], .chip[data-evopen], .chip[data-gopen], .chip[data-open] { cursor: pointer; }
.ev.gm[data-gopen]:hover, .ev.xv[data-evopen]:hover, .duty[data-evopen]:hover { box-shadow: 0 0 0 2px currentColor; }
.chip[data-evopen]:hover, .chip[data-gopen]:hover, .chip[data-open]:hover { filter: brightness(1.25); }
</style>
</head>""")
# ---- Übungsanlage nach dem Muster des Trainers ----
# Arten: Spielform, Übungsform, Standard, Athletik, Fußballspezifische Erwärmung, Sonstige
rep("const KINDS = ['Spielform','Übungsform','Standard','Athletik','Sonstige'];",
    "const KINDS = ['Spielform','Übungsform','Standard','Athletik','Fußballspezifische Erwärmung','Sonstige'];")
# Reihenfolge der Textfelder: Aufbau, Ablauf, Ziel, Coaching-Schwerpunkte, Variationen (gespeichert wird wie bisher)
alt = """      <label class="fl" for="ue-z">Ziel<textarea id="ue-z" rows="2"></textarea></label>
      <label class="fl" for="ue-a">Aufbau<textarea id="ue-a" rows="2" placeholder="Feld, Material, Teams"></textarea></label>
      <label class="fl" for="ue-b">Ablauf<textarea id="ue-b" rows="3"></textarea></label>
"""
neu = """      <label class="fl" for="ue-a">Aufbau<textarea id="ue-a" rows="3" placeholder="Feld, Material, Teams"></textarea></label>
      <label class="fl" for="ue-b">Ablauf<textarea id="ue-b" rows="3"></textarea></label>
      <label class="fl" for="ue-z">Ziel<textarea id="ue-z" rows="3"></textarea></label>
"""
assert s.count(alt) == 2; s = s.replace(alt, neu)
rep("${sec('Ziel', d[0])}${sec('Aufbau', d[1])}${sec('Ablauf', d[2])}", "${sec('Aufbau', d[1])}${sec('Ablauf', d[2])}${sec('Ziel', d[0])}")
rep(".exthumb.k-Sonstige {", ".exthumb.k-FuballspezifischeErwrmung { background: var(--accent-soft); color: var(--tr); }\n.exthumb.k-Sonstige {")
open(p, 'w').write(s); print('ok')
