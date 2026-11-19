import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Mehrere Aufstellungen je Spiel (z. B. 1. und 2. Halbzeit, Varianten zum Besprechen) ----
# state.aufst[gid] = { aktiv, varianten: [{ name, f, xi }] }; aufst(gid) liefert die gerade gezeigte Variante.
rep("""function aufst(gid) {
  state.aufst = state.aufst || {};
  return state.aufst[gid] = state.aufst[gid] || { f: FORMATIONS[state.formation] && state.formation !== UNSAVED ? state.formation : Object.keys(FORMATIONS)[0], xi: [] };
}""", """function aufstGruppe(gid) {
  state.aufst = state.aufst || {};
  let A = state.aufst[gid];
  if (!A) A = { aktiv: 0, varianten: [{ name: 'Startelf', f: FORMATIONS[state.formation] && state.formation !== UNSAVED ? state.formation : Object.keys(FORMATIONS)[0], xi: [] }] };
  else if (!Array.isArray(A.varianten)) A = { aktiv: 0, varianten: [{ name: 'Startelf', f: A.f, xi: A.xi || [] }] }; // älterer Stand: eine Aufstellung
  if (!(A.aktiv >= 0 && A.aktiv < A.varianten.length)) A.aktiv = 0;
  return state.aufst[gid] = A;
}
const aufst = gid => { const A = aufstGruppe(gid); return A.varianten[A.aktiv]; };
/** Person aus allen Aufstellungen dieses Spiels nehmen (Haken raus, Gast entfernt). */
const ausAufstellungen = (gid, id) => { if (!state.aufst || !state.aufst[gid]) return; aufstGruppe(gid).varianten.forEach(v => { v.xi = v.xi.map(x => x === id ? null : x); }); };""")
rep("""if (!t.checked && state.aufst && state.aufst[gid]) state.aufst[gid].xi = state.aufst[gid].xi.map(x => x === pid ? null : x); render(); }""",
    """if (!t.checked) ausAufstellungen(gid, pid); render(); }""")
rep("""    if (state.aufst && state.aufst[eid]) state.aufst[eid].xi = state.aufst[eid].xi.map(x => x === gid ? null : x);""",
    """    ausAufstellungen(eid, gid);""")

# Leiste mit den Aufstellungen: antippen zum Wechseln, + für eine neue (Kopie der aktuellen), Name ändern, löschen
rep("""    <div class="row between" style="margin-top:12px"><b>Aufstellung</b><div class="seg wrap">""",
    """    <div class="av-leiste">${(() => { const G = aufstGruppe(g.id); return G.varianten.map((v, i) => `<button class="av-tab ${i === G.aktiv ? 'on' : ''}" data-avwahl="${i}">${esc(v.name || 'Aufstellung ' + (i + 1))} <span class="note">${v.xi.filter(Boolean).length}/${(FORMATIONS[v.f] || []).length}</span></button>`).join('') + `<button class="av-tab av-plus" data-avneu="1" title="Weitere Aufstellung anlegen (Kopie der gezeigten)" aria-label="Weitere Aufstellung anlegen">+</button>`; })()}</div>
    <div class="row" style="gap:6px;flex-wrap:nowrap"><label class="fl" for="avname-${g.id}" style="flex:1">Bezeichnung dieser Aufstellung<input type="text" id="avname-${g.id}" data-avname="${g.id}" value="${esc(A.name || '')}" placeholder="z. B. 1. Halbzeit, 2. Halbzeit, Variante Thorsten"></label>${aufstGruppe(g.id).varianten.length > 1 ? `<button class="ib" data-avdel="1" title="Diese Aufstellung löschen" aria-label="Diese Aufstellung löschen" style="align-self:end">${ICON.x}</button>` : ''}</div>
    <div class="row between" style="margin-top:4px"><b>System</b><div class="seg wrap">""")
rep("""  else if (d.lclear) {""", """  else if (d.avwahl) { const LG = (t.closest('[data-lgid]') || {}).dataset; if (LG && LG.lgid) { aufstGruppe(LG.lgid).aktiv = +d.avwahl; state.activeSpot = null; render(); } }
  else if (d.avneu) { const LG = (t.closest('[data-lgid]') || {}).dataset; if (LG && LG.lgid) { const G = aufstGruppe(LG.lgid), v = G.varianten[G.aktiv]; G.varianten.push({ name: `Aufstellung ${G.varianten.length + 1}`, f: v.f, xi: [...v.xi] }); G.aktiv = G.varianten.length - 1; state.activeSpot = null; render(); setTimeout(() => { const i = document.getElementById('avname-' + LG.lgid); if (i) { i.focus(); i.select(); } }, 0); } }
  else if (d.avdel) { const LG = (t.closest('[data-lgid]') || {}).dataset; if (LG && LG.lgid) { const G = aufstGruppe(LG.lgid); if (G.varianten.length > 1 && confirm(`Aufstellung „${G.varianten[G.aktiv].name}“ löschen?`)) { G.varianten.splice(G.aktiv, 1); G.aktiv = Math.max(0, G.aktiv - 1); render(); } } }
  else if (d.lclear) {""")
# Name übernehmen beim Tippen (ohne neu zu zeichnen), die Leiste beim Verlassen des Feldes aktualisieren
rep("""document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.evf""",
    """document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.avname) { aufst(e.target.dataset.avname).name = e.target.value; const b = document.querySelector('.av-tab.on'); if (b && b.firstChild) b.firstChild.textContent = (e.target.value || 'Aufstellung') + ' '; } });
document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.evf""")

# Dossier: die erste Aufstellung (in der Regel die Startelf) und alle weiteren mit Namen
rep("""    aufstellung: (() => { const A = (state.aufst || {})[gid]; if (!A) return null; const F = FORMATIONS[A.f] || []; return { system: A.f, startelf: F.map(([pos], i) => { const p = A.xi[i] && kaderPerson(gid, A.xi[i]); return p ? { pos, name: p.name, nr: String(p.nr || '') } : null; }).filter(Boolean) }; })(),""",
    """    aufstellung: (() => { if (!(state.aufst || {})[gid]) return null; const liste = aufstGruppe(gid).varianten.map(v => { const F = FORMATIONS[v.f] || []; return { name: v.name, system: v.f, startelf: F.map(([pos], i) => { const p = v.xi[i] && kaderPerson(gid, v.xi[i]); return p ? { pos, name: p.name, nr: String(p.nr || '') } : null; }).filter(Boolean) }; }); return { ...liste[0], varianten: liste }; })(),""")

rep("</style>\n</head>", """.av-leiste { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.av-tab { border: 1px solid var(--line); background: var(--panel); color: var(--text); border-radius: 999px; padding: 6px 12px; cursor: pointer; font: inherit; }
.av-tab.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); font-weight: 600; }
.av-plus { font-weight: 700; min-width: 40px; }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
