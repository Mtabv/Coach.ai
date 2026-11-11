import sys
p = sys.argv[1]
s = open(p).read()

def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---------- Übungspool: auf kommende Trainings legen, Auswahlmodus für ein Training ----------
rep("function uebungen() {", r"""const trLabel = e => `${WD[dt(e.date).getDay()]} ${fmt(e.date)}`;
function exAction(x) {
  if (state.pickFor) { const ev = EV(state.pickFor), inside = exListOf(ev).includes(x.id);
    return `<button class="btn ${inside?'ghost':''} small" data-pickadd="${x.id}">${inside?'Nochmal hinzufügen':'+ zum Training'}</button>`; }
  return `<select class="f exto" data-exto="${x.id}" aria-label="${esc(x.name)} auf ein Training legen"><option value="">Auf Training legen …</option>${nextTrainings(4).map(e=>`<option value="${e.id}">${trLabel(e)}, ${e.time} Uhr</option>`).join('')}</select>`;
}
function pickBanner() {
  if (!state.pickFor) return '';
  const ev = EV(state.pickFor), l = exListOf(ev);
  return `<div class="q pickbar"><div><b>Übungen für das Training ${trLabel(ev)} auswählen.</b> Im Training: ${l.length ? l.map(id=>esc(X(id).name)).join(', ') : 'noch keine'}.</div>
    <div class="row"><a class="btn small" href="#einheit" data-settrain="${ev.id}" data-pickdone="1">Fertig, zurück zum Training</a></div></div>`;
}
function poolSide() {
  if (state.pickFor) return '';
  return `<aside class="card poolside"><h3>Nächste Trainings</h3><p class="sub">Übung hierher ziehen oder in der Liste „Auf Training legen“ wählen.</p>
    ${nextTrainings(4).map(e=>{const l=exListOf(e);return `<div class="drop ${l.length?'filled':''}" data-exdrop="${e.id}"><div class="row between"><b>${trLabel(e)} · ${e.time}</b><a href="#einheit" data-settrain="${e.id}">öffnen ›</a></div>
      ${l.length ? `<span class="note">${e.unit?esc(U(e.unit).name)+': ':''}${l.map(id=>esc(X(id).name)).join(', ')}</span>` : '<span class="note">noch leer</span>'}</div>`;}).join('')}</aside>`;
}
function uebungen() {""")
rep("  return `<div class=\"card\"><div class=\"row between\"><h3>Übungspool (${exercises.length})</h3>",
    "  return `${pickBanner()}<div class=\"poolwrap ${state.pickFor?'single':''}\"><div class=\"card\"><div class=\"row between\"><h3>Übungspool (${exercises.length})</h3>")
rep(": '<p class=\"sub\">Keine Übung passt zu diesem Filter.</p>'}</div>", ": '<p class=\"sub\">Keine Übung passt zu diesem Filter.</p>'}</div>${poolSide()}</div>")
rep("${l.map(e=>`<tr><td><b>${exLink(e.id)}</b>", "${l.map(e=>`<tr class=\"exrow\" draggable=\"true\" data-dragex=\"${e.id}\"><td><b>${exLink(e.id)}</b>")
rep("<td class=\"note\">${e.src}</td></tr>`).join('')}</tbody></table></div>`).join('')", "<td class=\"note\">${e.src}</td><td>${exAction(e)}</td></tr>`).join('')}</tbody></table></div>`).join('')")

# ---------- Einzeltraining und Trainingskachel: direkt in den Übungspool ----------
rep("""          <div class="exdrop" data-exdrop="${e.id}">Übung oder Einheit von rechts hierher ziehen oder dort antippen</div></div></div>""",
    """          <div class="exdrop" data-exdrop="${e.id}">Übung oder Einheit von rechts hierher ziehen oder dort antippen</div>
          <a class="btn ghost small" href="#training" data-pickfor="${e.id}" style="justify-self:start">Einzelne Übungen aus dem Übungspool hinzufügen</a></div></div>""")
rep("""<a class="btn ghost small" href="#einheit" data-settrain="${e.id}" style="justify-self:start;align-self:start">Training öffnen</a>""",
    """<span class="row" style="gap:6px"><a class="btn ghost small" href="#einheit" data-settrain="${e.id}">Training öffnen</a><a class="btn ghost small" href="#training" data-pickfor="${e.id}">Übung hinzufügen</a></span>""")
# Training ohne ganze Einheit, nur mit einzelnen Übungen
rep("const u = e.unit && U(e.unit), abs = absentOn(e.date), s = state.suggest[e.id], past = e.date < TODAY, rv = state.review[e.id], exl = e.unit ? exListOf(e) : [];",
    "const u = (e.unit && U(e.unit)) || (e.ex && e.ex.length ? {id:null, name:'Eigene Zusammenstellung', pr:(e.ex.map(X).find(x=>x.pr)||{pr:currentFocus.pr}).pr, ex:e.ex} : null), abs = absentOn(e.date), s = state.suggest[e.id], past = e.date < TODAY, rv = state.review[e.id], exl = exListOf(e);")
rep("<h2>${u?u.name:'Noch keine Einheit'}</h2>", "<h2>${u?u.name:list.length?'Eigene Zusammenstellung':'Noch keine Einheit'}</h2>")
rep("${e.unit?`<span>${U(e.unit).name}</span><span class=\"note\">${PR(U(e.unit).pr).phase}</span>`:`<span class=\"empty\">Einheit offen, jetzt planen</span>`}",
    "${e.unit?`<span>${U(e.unit).name}</span><span class=\"note\">${PR(U(e.unit).pr).phase}</span>`:e.ex&&e.ex.length?`<span>Eigene Zusammenstellung</span><span class=\"note\">${e.ex.length} Übungen</span>`:`<span class=\"empty\">Einheit offen, jetzt planen</span>`}")

# ---------- Ereignisse ----------
rep("  if (d.settrain) state.trainEv = d.settrain;", "  if (d.settrain) state.trainEv = d.settrain;\n  if (d.pickfor) { state.pickFor = d.pickfor; state.trainTab = 'uebungen'; }\n  if (d.pickdone) state.pickFor = null;")
rep("  else if (d.more) {", """  else if (d.pickadd) { const ev = EV(state.pickFor); ev.ex = [...exListOf(ev), d.pickadd]; render(); }
  else if (d.more) {""")
rep("  else if (d.comp) {", """  else if (d.exto) { if (t.value) { const ev = EV(t.value); ev.ex = [...exListOf(ev), d.exto]; state.flash = `„${X(d.exto).name}“ liegt jetzt auf dem Training ${trLabel(ev)}.`; render(); } }
  else if (d.comp) {""")
# Ablegen im Pool zeigt eine kurze Bestätigung
rep("    if (v.startsWith('x:')) ev.ex = [...exListOf(ev), v.slice(2)];", "    if (v.startsWith('x:')) { ev.ex = [...exListOf(ev), v.slice(2)]; state.flash = `„${X(v.slice(2)).name}“ liegt jetzt auf dem Training ${trLabel(ev)}.`; }")
rep("include:{}, imgs:{},", "include:{}, imgs:{}, pickFor:null,")
rep("/* ---- Skizzen ---- */", """/* ---- Übungspool und Trainings ---- */
.poolwrap { display: grid; grid-template-columns: minmax(0, 1fr) 290px; gap: 16px; align-items: start; }
.poolwrap.single { grid-template-columns: 1fr; }
.poolside { position: sticky; top: 16px; }
.exrow { cursor: grab; }
.exrow:hover td { background: var(--bg); }
.exto { width: auto; max-width: 190px; font-size: 13px; padding: 3px 4px; }
.pickbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; position: sticky; top: 0; z-index: 2; }
@media (max-width: 1000px) { .poolwrap { grid-template-columns: 1fr; } .poolside { position: static; } }
/* ---- Skizzen ---- */""")
open(p, 'w').write(s)
print('ok')
