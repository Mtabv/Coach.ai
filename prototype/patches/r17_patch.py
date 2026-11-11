import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

rep("""  <div class="tabs">${[['team','Mannschaft'],['spieler','Spieler']].map(([k,l])=>`<button data-atab="${k}" class="${state.anaTab===k?'on':''}">${l}</button>`).join('')}</div>
  ${state.anaTab==='team' ? anaTeam() : anaPlayer()}`;""",
"""  <div class="tabs">${[['team','Mannschaft'],['spieler','Spieler'],['vergleich','Spielervergleich']].map(([k,l])=>`<button data-atab="${k}" class="${state.anaTab===k?'on':''}">${l}</button>`).join('')}</div>
  ${state.anaTab==='team' ? anaTeam() : state.anaTab==='vergleich' ? anaCompare() : anaPlayer()}`;""")

rep("function vUebung() {", r"""/** Zwei Spieler im direkten Vergleich: gespiegelte Balken je Kennzahl, Minuten je Spiel nebeneinander. */
function minsIn(g, p) {
  const lu = REAL.lineups[g.id]; if (!lu) return null;
  const inXi = lu.xi.some(n=>findPlayer(n)===p), sb = (lu.subs||[]).find(s=>findPlayer(s.inn)===p), so = (lu.subs||[]).find(s=>findPlayer(s.out)===p);
  const inBog = inXi || lu.bench.some(n=>findPlayer(n)===p);
  if (inXi) return Math.min(90, so ? so.min : 90);
  if (sb) return Math.max(0, 90 - Math.min(90, sb.min));
  return inBog ? 0 : null;
}
function anaCompare() {
  const gs = selGames(), st = playerStats(gs);
  if (!state.cmpA) { const top = [...players].sort((a,b)=>b.goals-a.goals); state.cmpA = top[0].id; state.cmpB = top[1].id; }
  const A = P(state.cmpA), B = P(state.cmpB), a = st.get(A.id), b = st.get(B.id);
  const per90 = x => x.mins ? x.goals / x.mins * 90 : 0;
  const rows = [
    ['Im Kader', a.games, b.games, v=>v],
    ['Einsätze', a.apps, b.apps, v=>v],
    ['Startelf', a.starts, b.starts, v=>v],
    ['Spielminuten', a.mins, b.mins, v=>v.toLocaleString('de-DE')],
    ['Anteil an möglichen Minuten', gs.length ? a.mins/(gs.length*90)*100 : 0, gs.length ? b.mins/(gs.length*90)*100 : 0, v=>Math.round(v)+' %', 100],
    ['Ø Minuten pro Einsatz', a.apps ? a.mins/a.apps : 0, b.apps ? b.mins/b.apps : 0, v=>Math.round(v)+'′', 90],
    ['Tore', a.goals, b.goals, v=>v],
    ['Tore pro 90 Minuten', per90(a), per90(b), v=>de(v,2)],
    ['Vorlagen (Saison, FuPa)', A.assists||0, B.assists||0, v=>v],
  ];
  const sel = (id, k) => `<select class="f" id="cmp-${k}" aria-label="Spieler ${k.toUpperCase()}">${players.map(x=>`<option value="${x.id}" ${x.id===id?'selected':''}>${x.nr?x.nr+' ':''}${esc(x.name)}</option>`).join('')}</select>`;
  const head = (p, x, k) => `<div class="cmp-head ${k}">${av(p,'big')}<div><h2>${esc(p.name)}</h2><span class="note">${p.pos}${p.captain?' · Kapitän':''}</span>${sel(p.id, k)}</div></div>`;
  const wins = [0,0]; rows.forEach(([,x,y])=>{ if (x>y) wins[0]++; else if (y>x) wins[1]++; });
  const games = gs.filter(g=>minsIn(g,A)!==null || minsIn(g,B)!==null);
  return `${compBox()}
  <div class="cmp-top">${head(A, a, 'a')}<div class="cmp-vs"><div class="score"><span class="a">${wins[0]}</span><b>:</b><span class="b">${wins[1]}</span></div><small>Kennzahlen vorn</small></div>${head(B, b, 'b')}</div>
  <div class="card cmp-card">
    ${rows.map(([l,x,y,f,mx])=>{ const m = mx || Math.max(1, x, y); return `<div class="cmp-row">
      <span class="cmp-val a ${x>y?'lead':''}">${f(x)}</span>
      <div class="cmp-bar a"><span style="width:${Math.min(100, x/m*100)}%"></span></div>
      <span class="cmp-lab">${l}</span>
      <div class="cmp-bar b"><span style="width:${Math.min(100, y/m*100)}%"></span></div>
      <span class="cmp-val b ${y>x?'lead':''}">${f(y)}</span></div>`; }).join('')}
    <p class="note" style="margin:0">Fett und farbig ist jeweils der höhere Wert. Grundlage: ausgewählte Wettbewerbe, ${gs.length} Spiele.</p></div>
  <div class="card"><h3>Minuten je Spiel</h3><div class="legend"><span><i style="background:var(--cmpA)"></i>${esc(A.name)}</span><span><i style="background:var(--cmpB)"></i>${esc(B.name)}</span><span>dünner Strich: im Kader, nicht eingesetzt · leer: nicht im Spielberichtsbogen</span></div>
    <div class="cmp-games">${games.map(g=>{const x=minsIn(g,A), y=minsIn(g,B); return `<div class="cg" title="${esc(gameTitle(g))} ${g.res}: ${esc(A.name)} ${x??'–'}′, ${esc(B.name)} ${y??'–'}′">
      <div class="cg-bars"><span class="a ${x===null?'none':''}" style="height:${(x||0)/90*100}%"></span><span class="b ${y===null?'none':''}" style="height:${(y||0)/90*100}%"></span></div>
      <small>${fmt(g.date).slice(0,5)}</small>${crest(g.opp,'sm')}</div>`;}).join('')}</div></div>`;
}
function vUebung() {""")
rep("  else if (t.id === 'anap') {", "  else if (t.id === 'cmp-a') { state.cmpA = t.value; render(); }\n  else if (t.id === 'cmp-b') { state.cmpB = t.value; render(); }\n  else if (t.id === 'anap') {")
rep("/* ---- Masken ---- */", """/* ---- Spielervergleich ---- */
:root { --cmpA: #1f6f4a; --cmpB: #6b4fa0; --cmpA-soft: #e2f0e8; --cmpB-soft: #efe9f8; }
:root[data-theme="dark"] { --cmpA: #5cc08e; --cmpB: #b9a0e6; --cmpA-soft: #1d3329; --cmpB-soft: #2a2238; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --cmpA: #5cc08e; --cmpB: #b9a0e6; --cmpA-soft: #1d3329; --cmpB-soft: #2a2238; } }
.cmp-top { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); gap: 16px; align-items: stretch; }
.cmp-head { display: flex; gap: 14px; align-items: center; padding: 14px; border-radius: 12px; border: 2px solid; }
.cmp-head.a { border-color: var(--cmpA); background: var(--cmpA-soft); }
.cmp-head.b { border-color: var(--cmpB); background: var(--cmpB-soft); flex-direction: row-reverse; text-align: right; }
.cmp-head h2 { margin: 0; }
.cmp-head select { margin-top: 6px; width: auto; max-width: 100%; }
.cmp-head .av.big { width: 72px; height: 72px; border: 3px solid var(--panel); }
.cmp-vs { display: grid; place-content: center; justify-items: center; gap: 2px; min-width: 110px; }
.cmp-vs .score { display: flex; gap: 8px; align-items: baseline; font-family: var(--display); font-weight: 700; }
.cmp-vs .score span { font-size: 40px; line-height: 1; }
.cmp-vs .score .a { color: var(--cmpA); } .cmp-vs .score .b { color: var(--cmpB); }
.cmp-vs .score b { font-size: 28px; color: var(--muted); }
.cmp-vs small { font-size: 12px; color: var(--muted); }
.cmp-card { gap: 6px; }
.cmp-row { display: grid; grid-template-columns: 70px minmax(0,1fr) 190px minmax(0,1fr) 70px; gap: 10px; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--line); }
.cmp-row:last-of-type { border-bottom: 0; }
.cmp-lab { text-align: center; font-size: 14px; color: var(--muted); }
.cmp-bar { height: 14px; background: var(--bg); border-radius: 7px; display: flex; overflow: hidden; }
.cmp-bar.a { justify-content: flex-end; }
.cmp-bar span { display: block; height: 100%; border-radius: 7px; }
.cmp-bar.a span { background: var(--cmpA); } .cmp-bar.b span { background: var(--cmpB); }
.cmp-val { font-variant-numeric: tabular-nums; font-size: 15px; }
.cmp-val.a { text-align: right; } .cmp-val.b { text-align: left; }
.cmp-val.lead.a { color: var(--cmpA); font-weight: 700; } .cmp-val.lead.b { color: var(--cmpB); font-weight: 700; }
.cmp-games { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; }
.cg { display: grid; justify-items: center; gap: 3px; min-width: 38px; }
.cg-bars { height: 110px; display: flex; gap: 3px; align-items: flex-end; border-bottom: 1px solid var(--line); }
.cg-bars span { width: 12px; border-radius: 3px 3px 0 0; min-height: 2px; }
.cg-bars .a { background: var(--cmpA); } .cg-bars .b { background: var(--cmpB); }
.cg small { font-size: 11px; color: var(--muted); }
.cg-bars span.none { min-height: 0; background: transparent; }
@media (max-width: 800px) { .cmp-top { grid-template-columns: 1fr; } .cmp-head.b { flex-direction: row; text-align: left; } .cmp-row { grid-template-columns: 52px 1fr 1fr 52px; } .cmp-lab { grid-column: 1 / -1; grid-row: 1; } }
/* ---- Masken ---- */""")
open(p, 'w').write(s); print('ok')
