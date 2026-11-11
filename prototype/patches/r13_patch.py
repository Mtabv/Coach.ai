import sys
p = sys.argv[1]
s = open(p).read()

def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---------- Spielerzahl je Übung und Hinweis bei zu wenigen Spielern ----------
rep("function vUebung() {", r"""const needOf = x => { const m = /(\d+)/.exec(x.players || ''); return m ? +m[1] : 0; };
const availFor = e => { const c = counts(e.date); return c.tw + c.fp; };
/** Übungen eines Trainings, für die zu wenige Spieler verfügbar sind (laut Abwesenheiten und Absagen). */
function shortage(e) { const a = availFor(e); return exListOf(e).map(X).filter(x => needOf(x) > a).map(x => ({x, need: needOf(x), a})); }
function shortBox(e, compact) {
  const l = exListOf(e); if (!l.length) return '';
  const sh = shortage(e), a = availFor(e), need = Math.max(...l.map(id=>needOf(X(id))));
  if (!sh.length) return compact ? '' : `<p class="note okline">Spielerzahl passt: Die Übungen brauchen bis zu ${need} Spieler, verfügbar sind ${a}.</p>`;
  return `<div class="warnbox"><b>Achtung, zu wenige Spieler.</b> ${sh.map(s=>`„${esc(s.x.name)}“ braucht ${s.need}`).join(', ')}, verfügbar sind laut Abwesenheiten und Absagen nur ${a}. So kann das Training nicht wie geplant stattfinden. Kleinere Spielform wählen?</div>`;
}
function vUebung() {""")
rep("    ${review}\n", "    ${past ? '' : shortBox(e, false)}\n    ${review}\n")
rep("        ${noteLine(u && unitNotes[u.id], 'unit')}", "        ${shortBox(e, false)}\n        ${noteLine(u && unitNotes[u.id], 'unit')}")
rep("<span class=\"note\">${X(id).kind} · ${X(id).players} Spieler · ${X(id).field} · ${min} min",
    "<span class=\"note\">${X(id).kind} · <span class=\"${needOf(X(id))>availFor(e)?'need-bad':''}\">${X(id).players} Spieler</span> · ${X(id).field} · ${min} min")
# Dashboard: Warnzeichen im Wochenstreifen
rep("`<span class=\"empty\">Einheit offen, jetzt planen</span>`}${e.date>=TODAY?availPill(iso,'tr'):''}</a>`",
    "`<span class=\"empty\">Einheit offen, jetzt planen</span>`}${e.date>=TODAY?availPill(iso,'tr'):''}${e.date>=TODAY && shortage(e).length?'<span class=\"pill warn\">zu wenige Spieler für den Plan</span>':''}</a>`")
# Kalender: Warnzeichen in der Wochenansicht
rep("${state.showAbs && iso>=TODAY?availPill(iso,'tr'):''}<a class=\"open-link\"", "${state.showAbs && iso>=TODAY?availPill(iso,'tr'):''}${iso>=TODAY && shortage(e).length?'<span class=\"pill warn\">zu wenige Spieler</span>':''}<a class=\"open-link\"")

# ---------- Übungspool als Kartenraster ----------
i = s.index("function uebungen() {"); j = s.index("\n}\n", i) + 3
old = s[i:j]
k = old.index("  <div class=\"card\"><div class=\"row between\"><h3>Übung erfassen</h3>")
form = old[k:]  # Formular „Übung erfassen“ bleibt
new = r"""function uebungen() {
  const list = exercises.filter(e=>(state.exFilter==='alle'||(e.pr&&PR(e.pr).phase===state.exFilter)) && (state.exKind==='alle'||e.kind===state.exKind) && (!state.exQ || e.name.toLowerCase().includes(state.exQ.toLowerCase())));
  const groups = [...PHASES, 'ohne Prinzip'].map(ph=>[ph, list.filter(e=> ph==='ohne Prinzip' ? !e.pr : e.pr && PR(e.pr).phase===ph)]).filter(([,l])=>l.length);
  const card = x => { const img = state.imgs['ex-'+x.id], n = exNotes[x.id];
    return `<article class="excard" draggable="true" data-dragex="${x.id}">
      <a class="exthumb k-${x.kind.replace(/\W/g,'')}" href="#uebung" data-setex="${x.id}">${img ? `<img src="${img}" alt="">` : `<span>${esc(x.kind)}</span>`}</a>
      <div class="exbody"><a class="extitle" href="#uebung" data-setex="${x.id}">${esc(x.name)}</a>
        <span class="note">${x.pr ? esc(PR(x.pr).name) : 'Spielform zum Abschluss'}</span>
        <div class="exmeta"><span>${esc(x.kind)}</span><span>${esc(x.players)} Spieler</span><span>${esc(x.field)}</span><span>${x.min} min</span></div>
        ${n && n.length ? `<span class="xp">Erfahrung ${fmt(n[n.length-1].date)}: ${esc(n[n.length-1].text)}</span>` : ''}</div>
      <div class="exfoot">${exAction(x)}</div></article>`; };
  return `${pickBanner()}<div class="poolwrap ${state.pickFor?'single':''}"><div class="grid" style="gap:12px">
    <div class="card pooltools"><div class="row between"><h3>Übungspool <span class="note">(${list.length} von ${exercises.length})</span></h3>
      <div class="row"><input type="search" id="exq" value="${esc(state.exQ||'')}" placeholder="Übung suchen" aria-label="Übung suchen" style="width:180px">
      <select class="f" id="exf" aria-label="Spielphase" style="width:auto">${['alle',...PHASES].map(p=>`<option value="${p}" ${state.exFilter===p?'selected':''}>${p==='alle'?'Alle Spielphasen':p}</option>`).join('')}</select>
      <select class="f" id="exk" aria-label="Art" style="width:auto">${['alle',...KINDS].map(p=>`<option value="${p}" ${state.exKind===p?'selected':''}>${p==='alle'?'Alle Arten':p}</option>`).join('')}</select></div></div>
      <p class="note" style="margin:0">${state.pickFor ? 'Mit „+ zum Training“ hinzufügen.' : 'Karte auf ein Training rechts ziehen oder unten „Auf Training legen“ wählen. Ein Klick auf den Namen öffnet die Übung.'}</p></div>
    ${groups.length ? groups.map(([ph,l])=>`<section class="exgroup"><h4 class="grp">${ph} <span class="note">(${l.length})</span></h4><div class="exgrid">${l.map(card).join('')}</div></section>`).join('') : '<div class="card"><p class="sub">Keine Übung passt zu diesem Filter.</p></div>'}
  </div>${poolSide()}</div>
""" + form
s = s[:i] + new + s[j:]
rep("document.addEventListener('input', e => {", "document.addEventListener('input', e => { if (e.target.id === 'exq') { state.exQ = e.target.value; render(); const q = document.getElementById('exq'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } return; }")
rep("/* ---- Nachbereitung ---- */", """/* ---- Übungspool als Karten ---- */
.pooltools { gap: 8px; }
.exgroup { display: grid; gap: 8px; }
.exgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
.excard { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; display: grid; grid-template-rows: auto 1fr auto; overflow: hidden; cursor: grab; }
.excard:hover { border-color: var(--accent); box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.exthumb { display: grid; place-items: center; height: 96px; background: var(--accent-soft); color: var(--accent); text-decoration: none; font-family: var(--display); font-size: 18px; letter-spacing: .03em; }
.exthumb img { width: 100%; height: 96px; object-fit: cover; }
.exthumb.k-Spielform { background: var(--accent-soft); color: var(--accent); }
.exthumb.k-bungsform { background: var(--tr-soft); color: var(--tr); }
.exthumb.k-Standard { background: var(--cup-soft); color: var(--cup); }
.exthumb.k-Athletik { background: var(--game-soft); color: var(--game); }
.exthumb.k-Sonstige { background: var(--bg); color: var(--muted); }
.exbody { padding: 10px 12px; display: grid; gap: 4px; align-content: start; }
.extitle { font-weight: 700; color: var(--ink); text-decoration: none; line-height: 1.25; }
.extitle:hover { text-decoration: underline; }
.exmeta { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.exmeta span { font-size: 12px; background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 0 7px; }
.exfoot { padding: 8px 12px; border-top: 1px solid var(--line); background: var(--bg); }
.exfoot select, .exfoot .btn { width: 100%; max-width: none; }
.warnbox { background: var(--warn-soft); border: 1px solid var(--warn); border-radius: 8px; padding: 8px 10px; font-size: 14px; }
.okline { margin: 0; }
.need-bad { color: var(--game); font-weight: 700; }
/* ---- Nachbereitung ---- */""")
rep("include:{}, ask:{},", "include:{}, exQ:'', ask:{},")
rep("state.flash = `„${X(d.exto).name}“ liegt jetzt auf dem Training ${trLabel(ev)}.`;", "state.flash = `„${X(d.exto).name}“ liegt jetzt auf dem Training ${trLabel(ev)}.` + (needOf(X(d.exto)) > availFor(ev) ? ` Achtung: Die Übung braucht ${needOf(X(d.exto))} Spieler, verfügbar sind nur ${availFor(ev)}.` : '');")
rep("state.flash = `„${X(v.slice(2)).name}“ liegt jetzt auf dem Training ${trLabel(ev)}.`;", "state.flash = `„${X(v.slice(2)).name}“ liegt jetzt auf dem Training ${trLabel(ev)}.` + (needOf(X(v.slice(2))) > availFor(ev) ? ` Achtung: Die Übung braucht ${needOf(X(v.slice(2)))} Spieler, verfügbar sind nur ${availFor(ev)}.` : '');")
open(p, 'w').write(s)
print('ok')
