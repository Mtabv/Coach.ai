import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Gruppen als Gesprächspartner: Abwehr, Mittelfeld, Angriff, ganze Mannschaft ----
rep("const P = id => players.find(p=>p.id===id);",
    """const GRUPPEN = {
  'grp-abwehr': {id:'grp-abwehr', name:'Abwehr', kurz:'AB', pos:'ABW', nr:'', gruppe:true},
  'grp-mittelfeld': {id:'grp-mittelfeld', name:'Mittelfeld', kurz:'MF', pos:'MF', nr:'', gruppe:true},
  'grp-angriff': {id:'grp-angriff', name:'Angriff', kurz:'AN', pos:'ST', nr:'', gruppe:true},
  'grp-team': {id:'grp-team', name:'Mannschaft', kurz:'TSG', pos:'', nr:'', gruppe:true},
};
const P = id => players.find(p=>p.id===id) || GRUPPEN[id];""")
rep("const av = (p, cls='') => ", "const av = (p, cls='') => p && p.gruppe ? `<span class=\"av ${cls} init grp\" title=\"${esc(p.name)}\">${esc(p.kurz)}</span>` : ")

# ---- Leitfäden für die neuen Anlässe ----
rep("function talkNews() {", """Object.assign(TALKGUIDE, {
  'note-5':     {label:'Schwache Note im letzten Spiel', ziel:'Gemeinsam verstehen, was nicht geklappt hat, und einen klaren nächsten Schritt vereinbaren.', fragen:['Wie hast du das Spiel selbst erlebt?','Was hat dir gefehlt – körperlich, im Kopf, taktisch?','Was nimmst du dir für die nächste Woche vor?','Wobei können wir dich unterstützen?'], tipps:['Die Note kurz erklären, dann zuhören.','Am Verhalten festmachen, nicht an der Person.','Mit einem konkreten Trainingsziel enden.']},
  gegentore:    {label:'Viele Gegentore', ziel:'Ursachen gemeinsam benennen und zwei, drei klare Abläufe gegen den Ball festlegen.', fragen:['Wie seht ihr die Gegentore der letzten Spiele?','Wo verlieren wir die Ordnung – Abstände, Absicherung, Kommunikation?','Was brauchen wir im Training, damit es besser wird?'], tipps:['Gegentore mit kurzen Szenen oder Skizzen zeigen.','Nicht einzelne Spieler herausgreifen.','Mit zwei, drei klaren Regeln enden.']},
  torflaute:    {label:'Wenig Tore', ziel:'Zuversicht stärken und Abläufe im letzten Drittel schärfen.', fragen:['Wo fehlt uns vorne gerade etwas?','Kommen wir zu wenig in den Strafraum oder machen wir zu wenig aus den Chancen?','Was wollt ihr im Training mehr haben?'], tipps:['Positives zuerst: was klappt vorne schon?','Konkrete Abläufe benennen, nicht nur „mehr Tore“.']},
  'tore-team':  {label:'Viele Tore', ziel:'Gute Phase anerkennen und die Abläufe festigen.', fragen:['Was läuft gerade gut, das wir beibehalten wollen?','Was können wir noch besser machen?'], tipps:['Konkret loben, die Mannschaftsleistung betonen.']},
  niederlagen:  {label:'Mehrere Niederlagen in Folge', ziel:'Stimmung auffangen, Verantwortung teilen, den Blick nach vorn richten.', fragen:['Wie ist die Stimmung bei euch?','Was müssen wir als Mannschaft jetzt anders machen?','Was nehmen wir uns fürs nächste Spiel konkret vor?'], tipps:['Ruhig bleiben, keine Schuldigen suchen.','Gemeinsam ein, zwei erreichbare Ziele fürs nächste Spiel setzen.']},
  siege:        {label:'Siegesserie', ziel:'Erfolg würdigen und Spannung hochhalten.', fragen:['Was macht uns gerade stark?','Wie bleiben wir hungrig?'], tipps:['Loben, aber auch das nächste Ziel benennen.']},
  spaet:        {label:'Späte Gegentore', ziel:'Konzentration und Kraft bis zum Schluss zum Thema machen.', fragen:['Was passiert bei uns in der Schlussphase?','Liegt es an Kraft, Konzentration oder an Wechseln?','Wie wollen wir Spiele zu Ende spielen?'], tipps:['Mit den Minuten der Gegentore belegen.','Klare Abläufe für die letzten 15 Minuten vereinbaren.']},
  nachspiel:    {label:'Kurze Runde nach dem Spiel', ziel:'Das letzte Spiel gemeinsam einordnen und den Fokus für die Woche setzen.', fragen:['Was war gut, was nehmen wir mit?','Was wollen wir im nächsten Spiel anders machen?'], tipps:['Kurz halten, 10 Minuten reichen.','Mit einem klaren Wochenfokus enden.']},
  feedback:     {label:'Feedback für einen Stammspieler', ziel:'Wertschätzung zeigen und Erwartungen abgleichen – auch wenn es gerade läuft.', fragen:['Wie zufrieden bist du gerade mit dir und deiner Rolle?','Was erwartest du von uns Trainern?','Wo willst du dich noch verbessern?'], tipps:['Auch Leistungsträger brauchen regelmäßig Rückmeldung.','Konkret sagen, was du an ihm schätzt.']},
});
function talkNews() {""")

# ---- Neue Anlässe, und immer mindestens vier Impulse ----
rep("  // Wer zum selben Anlass in den letzten 21 Tagen schon ein Gespräch hatte, taucht nicht erneut auf.",
    """  // 7. Note 5 oder schlechter in einem Spiel der letzten drei Wochen
  for (const g of games().filter(g => gespielt(g) && g.date >= addDays(TODAY, -21)).reverse()) {
    for (const [pid, v] of Object.entries((state.grades || {})[g.id] || {})) {
      const n = notenZahl(v), p = P(pid);
      if (n == null || n < 5 || !p || out.some(m => m.p === p && m.code === 'note-5')) continue;
      const grund = String(state.texts['gr-' + g.id + '-' + pid] || '').trim();
      out.push({kind:'Gespräch', prio: 10 + n, code:'note-5', p, title:`${esc(p.name)}: Note ${v} gegen ${esc(g.opp)}`, sub:`Spiel vom ${fmt(g.date)}.${grund ? ' Eure Begründung: ' + esc(grund.slice(0, 160)) : ''} Zeitnah ansprechen, solange das Spiel noch präsent ist.`});
    }
  }
  // 8. Gruppen: Abwehr, Angriff, ganze Mannschaft – nach Toren, Gegentoren und Ergebnissen
  const pg = REAL.games.filter(g => g.res && g.kind !== 'test'), l3 = pg.slice(-3), l5 = pg.slice(-5);
  if (l3.length === 3) {
    const ga = l3.reduce((a, g) => a + (g.ga || 0), 0), gf = l3.reduce((a, g) => a + (g.gf || 0), 0);
    const schnittGa = pg.reduce((a, g) => a + (g.ga || 0), 0) / pg.length, schnittGf = pg.reduce((a, g) => a + (g.gf || 0), 0) / pg.length;
    const gegen = l3.map(g => `${g.gf}:${g.ga} ${g.home ? 'gegen' : 'bei'} ${esc(g.opp)}`).join(', ');
    if (ga >= 7 || ga / 3 > schnittGa + 0.7) out.push({kind:'Gespräch', prio: 3 + Math.floor(ga / 2), code:'gegentore', p: GRUPPEN['grp-abwehr'], title:`Abwehr: ${ga} Gegentore in den letzten 3 Spielen`, sub:`${gegen}. Saisonschnitt ${de(schnittGa)} pro Spiel. Was läuft gegen den Ball schief – Abstände, Absicherung, Kommunikation?`});
    if (gf <= 2) out.push({kind:'Gespräch', prio: 6 - gf, code:'torflaute', p: GRUPPEN['grp-angriff'], title:`Angriff: ${gf === 0 ? 'kein Tor' : gf === 1 ? 'nur ein Tor' : 'nur zwei Tore'} in den letzten 3 Spielen`, sub:`${gegen}. Saisonschnitt ${de(schnittGf)} Tore pro Spiel. Woran fehlt es vorne?`});
    if (gf >= 8) out.push({kind:'Lob', prio: 5, code:'tore-team', p: GRUPPEN['grp-angriff'], title:`Angriff: ${gf} Tore in den letzten 3 Spielen`, sub:`${gegen}. Gute Phase – bestätigen und festigen.`});
    const n = [...l3].reverse(); let ser = 0; for (const g of n) { if ((g.gf || 0) < (g.ga || 0)) ser++; else break; }
    let sieg = 0; for (const g of n) { if ((g.gf || 0) > (g.ga || 0)) sieg++; else break; }
    if (ser >= 2) out.push({kind:'Gespräch', prio: 5 + ser, code:'niederlagen', p: GRUPPEN['grp-team'], title:`Mannschaft: ${ser} Niederlagen in Folge`, sub:`${gegen}. Stimmung auffangen und gemeinsam den Blick nach vorn richten.`});
    if (sieg >= 3) out.push({kind:'Lob', prio: 5, code:'siege', p: GRUPPEN['grp-team'], title:`Mannschaft: ${sieg} Siege in Folge`, sub:`${gegen}. Erfolg würdigen und Spannung hochhalten.`});
  }
  const spaet = l5.flatMap(g => (REAL.timeline[g.id] || []).filter(x => !x.own && parseInt(x.min, 10) >= 75).map(x => `${x.min}′ ${g.home ? 'gegen' : 'bei'} ${g.opp}`));
  if (spaet.length >= 3) out.push({kind:'Gespräch', prio: 4, code:'spaet', p: GRUPPEN['grp-team'], title:`Mannschaft: ${spaet.length} Gegentore ab der 75. Minute`, sub:`In den letzten ${l5.length} Spielen: ${esc(spaet.slice(-4).join(', '))}. Kraft, Konzentration oder Wechsel?`});
  // 9. Ersatz, damit immer mindestens vier Impulse da sind: Runde nach dem Spiel, Feedback für Stammspieler
  const letztes = pg[pg.length - 1];
  if (letztes) out.push({kind:'Gespräch', prio: 1, code:'nachspiel', p: GRUPPEN['grp-team'], title:`Mannschaft: kurze Runde nach dem ${letztes.gf}:${letztes.ga} ${letztes.home ? 'gegen' : 'bei'} ${esc(letztes.opp)}`, sub:`Spiel vom ${fmt(letztes.date)} gemeinsam einordnen und den Fokus für die Woche setzen.`});
  const zuletztGesprochen = p => (talks[p.id] || []).filter(t => t.status === 'geführt').map(t => t.date).sort().pop() || '';
  [...players].filter(p => (p.mins || 0) > 0 && zuletztGesprochen(p) < addDays(TODAY, -60)).sort((a, b) => (b.mins || 0) - (a.mins || 0)).slice(0, 8)
    .forEach((p, i) => out.push({kind:'Gespräch', prio: 0.9 - i / 100, code:'feedback', p, title:`${esc(p.name)}: Feedback-Gespräch`, sub:`${p.mins} Minuten in dieser Saison${zuletztGesprochen(p) ? ', letztes Gespräch am ' + fmt(zuletztGesprochen(p)) : ', bisher kein Gespräch eingetragen'}. Auch Stammspieler brauchen regelmäßig Rückmeldung.`}));
  // Wer zum selben Anlass in den letzten 21 Tagen schon ein Gespräch hatte, taucht nicht erneut auf.""")
# Gesprächsseite für Gruppen: Mannschaftszahlen statt Spielerstatistik
rep("function playerFacts(p) {", """function gruppenFakten(p) {
  const pg = REAL.games.filter(g => g.res && g.kind !== 'test'), l5 = pg.slice(-5);
  const gf = pg.reduce((a, g) => a + (g.gf || 0), 0), ga = pg.reduce((a, g) => a + (g.ga || 0), 0);
  const chip = g => `<span class="rchip r-${(g.gf||0) > (g.ga||0) ? 'S' : (g.gf||0) === (g.ga||0) ? 'E' : 'n'}" title="${g.home ? 'gegen' : 'bei'} ${esc(g.opp)}, ${fmt(g.date)}">${g.gf}:${g.ga}</span>`;
  const mitglieder = p.pos ? players.filter(x => x.pos === p.pos) : players;
  return `<div class="tiles">${[[pg.length,'Spiele'],[gf,'Tore'],[ga,'Gegentore'],[de(gf / Math.max(1, pg.length)),'Tore je Spiel'],[de(ga / Math.max(1, pg.length)),'Gegentore je Spiel']].map(([v,l])=>`<div class="tile"><div class="v">${v}</div><div class="c">${l}</div></div>`).join('')}</div>
    <p class="sub" style="margin:8px 0 4px">Letzte Ergebnisse: ${l5.map(chip).join(' ')}</p>
    <p class="note">${p.pos ? 'Dazu gehören: ' : 'Ganze Mannschaft: '}${mitglieder.map(x => esc(x.name)).join(', ')}</p>`;
}
function playerFacts(p) {
  if (p && p.gruppe) return gruppenFakten(p);""")
rep("<h3>Daten zum Spieler</h3>", "<h3>${p.gruppe ? 'Zahlen der Mannschaft' : 'Daten zum Spieler'}</h3>")
rep("Gespräch geführt, beim Spieler speichern</button>", "Gespräch geführt, ${p.gruppe ? 'speichern' : 'beim Spieler speichern'}</button>")
rep("› Spielergespräch mit ${esc(p.name)}", "› ${p.gruppe ? 'Gespräch mit' : 'Spielergespräch mit'} ${esc(p.name)}")
open(p, 'w').write(s); print('ok')
