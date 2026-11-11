import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b):
    global s
    assert a in s, a[:100]; s = s.replace(a, b, 1)
rep("${tile(st.apps,'Einsätze',`${st.mins} Minuten`)}${tile(st.starts,'Startelf','')}",
    "${tile(st.apps,'Einsätze',`von ${gs.length} Spielen`)}${tile(st.mins.toLocaleString('de-DE'),'Spielminuten',`von ${(gs.length*90).toLocaleString('de-DE')} möglichen (${gs.length?Math.round(st.mins/(gs.length*90)*100):0} %)`)}"
    "${tile(st.apps?Math.round(st.mins/st.apps)+'′':'–','Ø Minuten pro Einsatz',`Ø pro Mannschaftsspiel: ${gs.length?Math.round(st.mins/gs.length):0}′`)}${tile(st.starts,'Startelf','')}")
rep("const sb=(lu.subs||[]).find(s=>findPlayer(s.inn)===p), so=(lu.subs||[]).find(s=>findPlayer(s.out)===p);",
    "const sb=(lu.subs||[]).find(s=>findPlayer(s.inn)===p), so=(lu.subs||[]).find(s=>findPlayer(s.out)===p), mn = xi ? Math.min(90, so?so.min:90) : sb ? Math.max(0, 90-Math.min(90, sb.min)) : 0;")
rep("<td>${xi?(so?`Startelf, bis ${so.min}′`:'Startelf'):sb?`eingewechselt ${sb.min}′`:'Bank, nicht eingesetzt'}</td>",
    "<td>${xi?(so?`Startelf, bis ${so.min}′`:'Startelf'):sb?`eingewechselt ${sb.min}′`:'Bank, nicht eingesetzt'}</td><td class=\"minbar\"><span style=\"width:${mn/90*100}%\"></span><b class=\"num\">${mn}′</b></td>")
rep('<div class="card"><h3>Spiele</h3>', '<div class="card"><h3>Spiele</h3><p class="sub" style="margin:0">Minuten aus Startelf und Wechseln laut Spielbericht, 90 je Spiel, ohne Nachspielzeit.</p>')
rep("/* ---- Übungspool als Karten ---- */", """.minbar { position: relative; min-width: 110px; }
.minbar span { position: absolute; left: 8px; top: 50%; height: 8px; margin-top: -4px; max-width: calc(100% - 52px); background: var(--accent); border-radius: 4px; opacity: .7; }
.minbar b { position: relative; float: right; font-size: 13px; }
/* ---- Übungspool als Karten ---- */""")
rep("  const lastPlayed = REAL.games.filter(g=>g.res && g.kind==='liga').pop();", "  REAL.games.forEach(g => { if (g.res) g.res = g.home ? `${g.gf}:${g.ga}` : `${g.ga}:${g.gf}`; }); // Ergebnis in der Reihenfolge der Paarung\n  const lastPlayed = REAL.games.filter(g=>g.res && g.kind==='liga').pop();")
open(p, 'w').write(s); print('ok')
