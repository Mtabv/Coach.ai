import sys
p = sys.argv[1]
s = open(p).read()

def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---------- Fragen von 11Plan: neu generieren ----------
rep("function vUebung() {", r"""/** Frage von 11Plan mit Knopf „neue Frage“. Die Liste wird aus den Daten erzeugt, der Knopf blättert weiter. */
function askBox(key, list, label='Frage von 11Plan') {
  list = list.filter(Boolean); if (!list.length) return '';
  const i = (state.ask[key] || 0) % list.length;
  return `<div class="q askq"><div><b>${label}:</b> ${esc(list[i])}</div><button class="ib" data-reask="${key}" title="Neue Frage" aria-label="Neue Frage">${ICON.refresh}</button></div>`;
}
function postQuestions(g) {
  const tl = REAL.timeline[g.id] || [], conc = tl.filter(x=>!x.own), own = tl.filter(x=>x.own), c2 = conc.filter(x=>parseInt(x.min)>45).length, q = [];
  if (conc.length) q.push(`${conc.length} Gegentore, davon ${c2} in der zweiten Halbzeit. Woran lag es aus deiner Sicht, und soll daraus ein Schwerpunkt für die nächsten Wochen werden?`);
  else q.push('Kein Gegentor. Was hat gegen den Ball besonders gut funktioniert?');
  if (conc.length) q.push(`Das erste Gegentor fiel in der ${parseInt(conc[0].min)}. Minute. Was ist in der Situation davor passiert?`);
  for (let i = 1; i < conc.length; i++) { const a = parseInt(conc[i-1].min), b = parseInt(conc[i].min); if (b - a <= 12) { q.push(`Zwischen der ${a}. und ${b}. Minute fielen zwei Gegentore kurz nacheinander. Was hat sich in dieser Phase verändert?`); break; } }
  if (own.length) q.push(`Unser Tor in der ${parseInt(own[0].min)}. Minute: Wie ist es entstanden, und lässt sich das wiederholen?`);
  else if (tl.length) q.push('Kein eigenes Tor. Woran hat es im letzten Drittel gefehlt?');
  const subs = ((REAL.lineups[g.id]||{}).subs||[]); if (subs.length) q.push(`Es gab ${subs.length} Wechsel, der erste in der ${subs[0].min}. Minute. Haben die Wechsel das Spiel verändert?`);
  q.push('Wie hat die Mannschaft auf das erste Gegentor reagiert?');
  return q;
}
function vUebung() {""")
rep("""      <div class="q"><b>Frage von 11Plan:</b> ${conc.length ? `${conc.length} Gegentore, davon ${c2} in der zweiten Halbzeit. Woran lag es aus deiner Sicht, und soll daraus ein Schwerpunkt für die nächsten Wochen werden?` : 'Kein Gegentor. Was hat gegen den Ball besonders gut funktioniert?'}</div>""",
    """      ${askBox('post-'+g.id, postQuestions(g))}""")
rep("""  ${REAL.ask && isNext ? `<div class="q"><b>Rückfrage von 11Plan:</b> ${esc(REAL.ask)}</div>` : ''}""",
    """  ${isNext ? askBox('prep-'+g.id, REAL.asks, 'Rückfrage von 11Plan') : ''}""")
rep("""      ${full?`<div class="q">Im Verhältnis zum Ligaschnitt fallen die meisten Gegentore zwischen der ${bins[bi].replace('–','. und der ')}. Minute (${ba[bi]} gegenüber ${de(lb[bi])}). Liegt das eher an der Ordnung gegen den Ball oder am Umschalten nach Ballverlust?</div>`:''}</div>""",
    """      ${full?askBox('ana', [
        `Im Verhältnis zum Ligaschnitt fallen die meisten Gegentore zwischen der ${bins[bi].replace('–','. und der ')}. Minute (${ba[bi]} gegenüber ${de(lb[bi])}). Liegt das eher an der Ordnung gegen den Ball oder am Umschalten nach Ballverlust?`,
        `${ba[0]+ba[1]} Gegentore in den ersten 30 Minuten (Ligaschnitt ${de(lb[0]+lb[1])}). Kommt die Mannschaft schnell genug ins Spiel?`,
        `${ba[3]} Gegentore direkt nach der Pause zwischen der 46. und 60. Minute (Ligaschnitt ${de(lb[3])}). Wie läuft die Halbzeitansprache, und kommt sie an?`,
        `${ba[5]} Gegentore ab der 76. Minute (Ligaschnitt ${de(lb[5])}). Fehlt am Ende die Kraft oder die Konzentration?`,
        `${bf[4]+bf[5]} unserer ${bf.reduce((a,b)=>a+b,0)} Tore fallen in der letzten halben Stunde. Was ist dann anders als vorher?`,
      ], 'Frage von 11Plan'):''}</div>""")

# ---------- Spielverlauf: Tore kommentieren ----------
rep("""      <ul class="list">${tl.map(x=>`<li><span>${x.min} ${x.score||''} ${esc(x.who)}</span><span class="pill ${x.own?'':'game'}">${x.own?'TSG':'Gegner'}</span></li>`).join('') || '<li><span class="note">Im Spielbericht stehen keine Tore.</span></li>'}</ul></div>""",
    """      <div class="goals">${tl.map((x,i)=>`<div class="goal ${x.own?'own':'opp'}"><div class="row between"><span><b class="num">${x.min}</b> ${x.score||''} ${esc(x.who)}</span><span class="pill ${x.own?'':'game'}">${x.own?'TSG':'Gegner'}</span></div>
        <div class="row" style="flex-wrap:nowrap"><input type="text" data-text="gc-${g.id}-${i}" value="${esc(state.texts['gc-'+g.id+'-'+i]??'')}" placeholder="${x.own?'Wie ist das Tor entstanden?':'Was ist passiert? z. B. Ballverlust im Aufbau, Standard'}" aria-label="Kommentar zum Tor ${x.min}"><button class="mic" data-flash="Sprachnachricht: Kommentar zum Tor einsprechen. Im Entwurf ohne Funktion.">${ICON.mic}</button></div></div>`).join('') || '<p class="note">Im Spielbericht stehen keine Tore.</p>'}</div></div>""")
rep("<p class=\"sub\">${tl.length} Tore laut Spielbericht</p>", "<p class=\"sub\">${tl.length} Tore laut Spielbericht. Zu jedem Tor kannst du notieren, wie es entstanden ist.</p>")

# ---------- Spielernoten: Startelf und Eingewechselte ----------
rep("""  const xi = ((REAL.lineups[g.id]||{}).xi || []).map(n=>findPlayer(n) || {id:'x'+n, nr:'', name:n, pos:''});""",
    """  const LU = REAL.lineups[g.id] || {xi:[], subs:[]}, asP = n => findPlayer(n) || {id:'x'+n.replace(/\\W/g,''), nr:'', name:n, pos:''};
  const outMin = Object.fromEntries((LU.subs||[]).map(s=>[s.out, s.min]));
  const xi = [...LU.xi.map(n=>({p:asP(n), info: outMin[n] ? `bis ${outMin[n]}′` : 'Startelf'})), ...(LU.subs||[]).map(s=>({p:asP(s.inn), info:`ab ${s.min}′ für ${s.out}`, sub:true}))];""")
rep("<p class=\"sub\">Startelf laut Spielbericht.", "<p class=\"sub\">Startelf und Eingewechselte laut Spielbericht.")
i = s.index("    ${xi.map(p=>`<tr><td>"); j = s.index("</tr>`).join('')}", i)
row = s[i:j]
row = row.replace("${xi.map(p=>`<tr><td>", "${xi.map(({p,info,sub})=>`<tr class=\"${sub?'subrow':''}\"><td>").replace("<span class=\"note\">${p.pos}</span></td>", "<span class=\"note\">${p.pos} · ${esc(info)}</span></td>")
s = s[:i] + row + s[j:]

# ---------- Aufstellung: Kasten unten raus ----------
i = s.index("  <div class=\"card finish\"><div class=\"row between\"><div><h3>Aufstellung fertig?</h3>"); j = s.index("</div></div></div>`;", i) + len("</div></div></div>`;")
s = s[:i] + "  `;" + s[j:]

# ---------- Kader: Einsätze und Minuten ----------
rep("REAL.players.forEach((p,i)=>players.push({id:'p'+i, nr:p.nr,", "REAL.players.forEach((p,i)=>players.push({id:'p'+i, apps:p.apps, mins:p.mins, nr:p.nr,")
rep("${th('games','Im Kader',true,'im Spielberichtsbogen nominiert, Startelf und Bank')}${th('starts','Startelf',true)}",
    "${th('games','Im Kader',true,'im Spielberichtsbogen nominiert, Startelf und Bank')}${th('apps','Einsätze',true,'Startelf oder eingewechselt')}${th('mins','Minuten',true,'aus Startelf und Wechseln berechnet, 90 Minuten je Spiel')}${th('starts','Startelf',true)}")
rep("<td class=\"num\">${p.games}</td><td class=\"num\">${p.starts}</td><td class=\"num\">${p.goals}</td><td class=\"num\">${p.assists??0}</td>",
    "<td class=\"num\">${p.games}</td><td class=\"num\">${p.apps}</td><td class=\"num\">${p.mins}</td><td class=\"num\">${p.starts}</td><td class=\"num\">${p.goals}</td><td class=\"num\">${p.assists??0}</td>")
rep("games: p=>p.games, starts: p=>p.starts,", "games: p=>p.games, apps: p=>p.apps, mins: p=>p.mins, starts: p=>p.starts,")
rep("['games','starts','goals','assists'].includes(d.ksort)", "['games','apps','mins','starts','goals','assists'].includes(d.ksort)")
rep("<p class=\"note\">Im Kader: wie oft im Spielberichtsbogen, also in der Startelf oder auf der Bank. Vorlagen kommen von FuPa und gelten für die ganze Saison.</p>",
    "<p class=\"note\">Im Kader: wie oft im Spielberichtsbogen, also Startelf oder Bank. Einsätze: Startelf oder eingewechselt. Minuten: aus den Wechseln im Spielbericht, Nachspielzeit nicht mitgezählt. Vorlagen kommen von FuPa und gelten für die ganze Saison.</p>")
# Analytics je Wettbewerb: Einsätze und Minuten
rep("  const st = new Map(players.map(p=>[p.id, {games:0, starts:0, goals:0}]));", "  const st = new Map(players.map(p=>[p.id, {games:0, starts:0, goals:0, apps:0, mins:0}]));")
rep("""  for (const g of gs) { const lu = REAL.lineups[g.id]; if (lu) { lu.xi.forEach(n=>{const p=findPlayer(n); if (p) { st.get(p.id).games++; st.get(p.id).starts++; }}); lu.bench.forEach(n=>{const p=findPlayer(n); if (p) st.get(p.id).games++;}); }""",
    """  for (const g of gs) { const lu = REAL.lineups[g.id]; if (lu) { const outs = Object.fromEntries((lu.subs||[]).map(s=>[s.out, s.min]));
      lu.xi.forEach(n=>{const p=findPlayer(n); if (p) { const x=st.get(p.id); x.games++; x.starts++; x.apps++; x.mins += Math.min(90, outs[n] ?? 90); }});
      lu.bench.forEach(n=>{const p=findPlayer(n); if (p) st.get(p.id).games++;});
      (lu.subs||[]).forEach(s=>{const p=findPlayer(s.inn); if (p) { const x=st.get(p.id); x.apps++; x.mins += Math.max(0, 90-Math.min(90, s.min)); }}); }""")
rep("${tile(st.games,'Im Kader',`von ${gs.length} Spielen`)}${tile(st.starts,'Startelf','')}", "${tile(st.games,'Im Kader',`von ${gs.length} Spielen`)}${tile(st.apps,'Einsätze',`${st.mins} Minuten`)}${tile(st.starts,'Startelf','')}")
rep("return `<tr><td class=\"num\">${fmt(g.date)}</td><td><span class=\"comp k-${g.kind}\">${g.comp}</span> ${gameTitle(g)}</td><td><span class=\"pill game\">${g.res}</span></td><td>${xi?'Startelf':'Bank'}</td>",
    "const sb=(lu.subs||[]).find(s=>findPlayer(s.inn)===p), so=(lu.subs||[]).find(s=>findPlayer(s.out)===p);\n      return `<tr><td class=\"num\">${fmt(g.date)}</td><td><span class=\"comp k-${g.kind}\">${g.comp}</span> ${gameTitle(g)}</td><td><span class=\"pill game\">${g.res}</span></td><td>${xi?(so?`Startelf, bis ${so.min}′`:'Startelf'):sb?`eingewechselt ${sb.min}′`:'Bank, nicht eingesetzt'}</td>")

# ---------- Ereignisse und Stil ----------
rep("  else if (d.more) {", "  else if (d.reask) { state.ask[d.reask] = (state.ask[d.reask] || 0) + 1; render(); }\n  else if (d.more) {")
rep("include:{}, imgs:{},", "include:{}, ask:{}, imgs:{},")
rep("/* ---- Übungspool und Trainings ---- */", """/* ---- Nachbereitung ---- */
.askq { display: flex; justify-content: space-between; gap: 10px; align-items: start; }
.askq .ib { flex: none; background: var(--panel); }
.goals { display: grid; gap: 8px; }
.goal { border: 1px solid var(--line); border-left: 4px solid var(--game); border-radius: 8px; padding: 8px 10px; display: grid; gap: 6px; }
.goal.own { border-left-color: var(--accent); }
.goal input { flex: 1; }
.goal .mic { padding: 4px 8px; }
tr.subrow td { background: var(--bg); }
/* ---- Übungspool und Trainings ---- */""")
open(p, 'w').write(s)
print('ok')
