import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

rep("/** Nachrichten von 11Plan: zuerst nächste Schritte", r"""/** Rolle eines Spielers je Pflichtspiel: S Startelf, E eingewechselt, B Bank ohne Einsatz, - nicht im Kader. */
function roleSeq(p) {
  return REAL.games.filter(g=>g.res && g.kind!=='test' && REAL.lineups[g.id]).map(g => { const lu = REAL.lineups[g.id];
    if (lu.xi.some(n=>findPlayer(n)===p)) return 'S';
    if ((lu.subs||[]).some(x=>findPlayer(x.inn)===p)) return 'E';
    if ((REAL.timeline[g.id]||[]).some(x=>x.own && findPlayer(x.who)===p)) return 'E'; // Tor ohne eingetragenen Wechsel: war im Spiel
    if (lu.bench.some(n=>findPlayer(n)===p)) return 'B';
    return '-'; });
}
/** Gesprächsimpulse: Menschen statt Kennzahlen. Formuliert als Vorschlag, nie als Urteil. */
function talkNews() {
  const out = [], gs = REAL.games.filter(g=>g.res && g.kind!=='test' && REAL.lineups[g.id]);
  const lastDate = i => fmt(gs[gs.length - i].date);
  for (const p of players) {
    const q = roleSeq(p), last6 = q.slice(-6), last3 = q.slice(-3), early = q.slice(0, -3);
    // 1. Regelmäßig dabei gewesen, jetzt länger nicht im Kader
    const run = q.length - 1 - [...q].reverse().findIndex(r => r !== '-'), gone = q.length - 1 - run;
    if (early.filter(r=>r==='S').length >= 5 && gone >= 3 && gone <= 6 && !absentOn(TODAY).some(a=>a.pid===p.id))
      out.push({kind:'Gespräch', prio: 3 + gone, p, title:`${esc(p.name)} seit ${gone} Spielen nicht im Kader`, sub:`Vorher ${early.filter(r=>r==='S').length} Mal in der Startelf, zuletzt am ${fmt(gs[run].date)} Keine Abwesenheit eingetragen. Einfach mal nachfragen, wie es ihm geht?`});
    // 2. Oft auf der Bank, ohne eingewechselt zu werden (ohne Torhüter, dort ist das normal)
    const benched = last6.filter(r=>r==='B').length;
    if (!isTW(p) && benched >= 3)
      out.push({kind:'Gespräch', prio: 2 + benched, p, title:`${esc(p.name)}: ${benched} Mal auf der Bank, nicht eingewechselt`, sub:`In den letzten ${last6.length} Pflichtspielen, laut Spielberichten (dort fehlen manchmal Wechsel). Wie sieht er seine Rolle? Ein kurzes Gespräch über Perspektive und Trainingseindruck hilft oft.`});
    // 3. Hat sich in die Startelf gespielt: Lob
    let streak = 0; for (let i = q.length - 1; i >= 0 && q[i] === 'S'; i--) streak++;
    const before = q.slice(0, q.length - streak);
    if (streak >= 4 && streak <= 10 && before.filter(r=>r==='B'||r==='E').length >= 2 && before.filter(r=>r==='S').length <= Math.floor(before.length / 3))
      out.push({kind:'Lob', prio: 2 + streak, p, title:`${esc(p.name)} hat sich in die Startelf gespielt`, sub:`${streak} Mal in Folge von Beginn an, vorher nur ${before.filter(r=>r==='S').length} Startelf-Einsätze in ${before.length} Spielen. Ein Lob für die Entwicklung?`});
    // 4. Trifft regelmäßig: Lob
    const gl = gs.slice(-3).filter(g=>(REAL.timeline[g.id]||[]).some(x=>x.own && findPlayer(x.who)===p)).length;
    if (gl >= 2) out.push({kind:'Lob', prio: 4, p, title:`${esc(p.name)} trifft in ${gl} der letzten 3 Spiele`, sub:'Gute Phase. Bestätigung tut gut, gerade wenn die Ergebnisse gerade nicht stimmen.'});
    // 5. Trainingsbeteiligung (sobald Zu- und Absagen da sind): oft gefehlt, ohne Verletzung oder Urlaub
    const missed = trainings().filter(t=>t.date < TODAY && t.date >= addDays(TODAY, -28) && absentOn(t.date).some(a=>a.pid===p.id && !/verletz|urlaub|krank/i.test(a.why))).length;
    if (missed >= 3) out.push({kind:'Gespräch', prio: 6, p, title:`${esc(p.name)} fehlte ${missed} Mal im Training`, sub:'In den letzten vier Wochen, ohne Verletzung, Krankheit oder Urlaub. Gibt es etwas, das ihn gerade abhält?'});
    // 6. Noten (sobald Nachbereitungen da sind)
    const gr = (state.gradesHist||{})[p.id] || [];
    if (gr.length >= 3 && avg(gr.slice(-3)) >= 4) out.push({kind:'Gespräch', prio: 5, p, title:`${esc(p.name)}: zuletzt schwächere Noten`, sub:`Ø ${de(avg(gr.slice(-3)))} in den letzten drei Spielen. Unterstützung anbieten?`});
    if (gr.length >= 3 && avg(gr.slice(-3)) <= 2) out.push({kind:'Lob', prio: 5, p, title:`${esc(p.name)}: starke Noten`, sub:`Ø ${de(avg(gr.slice(-3)))} in den letzten drei Spielen. Ein Lob wert?`});
  }
  return out.sort((a,b)=>b.prio-a.prio).slice(0, 5).map(m => ({...m, href:'#analytics', attrs:`data-anaplayer="${m.p.id}"`, icon: av(m.p)}));
}
/** Nachrichten von 11Plan: zuerst nächste Schritte""")
rep("  // Spielvorbereitung und Nachbereitung stehen schon oben im Kasten „Spiel“ und werden hier nicht wiederholt.\n",
    "  // Spielvorbereitung und Nachbereitung stehen schon oben im Kasten „Spiel“ und werden hier nicht wiederholt.\n  n.push(...talkNews());\n")
rep("`<b class=\"lbl ${m.kind==='Nächster Schritt'?'nba':''}\">${m.kind}</b> ${m.sub}`", "`<b class=\"lbl k-${m.kind==='Nächster Schritt'?'nba':m.kind==='Gespräch'?'talk':m.kind==='Lob'?'praise':'hl'}\">${m.kind==='Gespräch'?'Gesprächsimpuls':m.kind}</b> ${m.sub}`")
rep("<section class=\"card\"><h3>Nachrichten von 11Plan</h3>", "<section class=\"card\"><div class=\"row between\"><h3>Nachrichten von 11Plan</h3><span class=\"note\">Gesprächsimpulse und Lob zuerst, dann Highlights aus den Zahlen</span></div>")
rep("/* ---- Masken ---- */", """/* ---- Gesprächsimpulse ---- */
.lbl.k-talk { color: var(--warn); } .lbl.k-praise { color: var(--accent); } .lbl.k-hl { color: var(--muted); }
.dlink.msg .dl-ic .av { width: 34px; height: 34px; }
.dlink.msg .dl-ic:has(.av) { background: none; }
/* ---- Masken ---- */""")
open(p, 'w').write(s); print('ok')
