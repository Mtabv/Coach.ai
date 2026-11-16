import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Kader überall nach Positionen: Torhüter, Abwehr, Mittelfeld, Sturm (dann Rückennummer, Name) ----
rep("const P = id => players.find(p=>p.id===id);",
    """const P = id => players.find(p=>p.id===id);
const POS_RANG = {TW:0, ABW:1, MF:2, ST:3};
const posVergleich = (a, b) => (POS_RANG[a.pos] ?? 9) - (POS_RANG[b.pos] ?? 9) || (+a.nr || 999) - (+b.nr || 999) || String(a.name).localeCompare(String(b.name), 'de');""")
rep("REAL.players.forEach((p,i)=>players.push({id:pidOf(p.name), apps:p.apps, mins:p.mins, nr:p.nr, name:p.name, pos:p.pos, status:'', games:p.kader, starts:p.starts, goals:p.goals, grade:null, photo:p.photo, captain:p.captain}));",
    "REAL.players.forEach((p,i)=>players.push({id:pidOf(p.name), apps:p.apps, mins:p.mins, nr:p.nr, name:p.name, pos:p.pos, status:'', games:p.kader, starts:p.starts, goals:p.goals, grade:null, photo:p.photo, captain:p.captain}));\n  players.sort(posVergleich);")
# Nachbereitung: Noten in Positionsreihenfolge (Startelf vor Eingewechselten derselben Position)
rep("""  return `${demo}${spielHead(g,'spiel-nachbereitung')}${berichtBanner(g)}""",
    """  xi.sort((a, b) => (POS_RANG[a.p.pos] ?? 9) - (POS_RANG[b.p.pos] ?? 9) || (a.sub ? 1 : 0) - (b.sub ? 1 : 0) || posVergleich(a.p, b.p));
  return `${demo}${spielHead(g,'spiel-nachbereitung')}${berichtBanner(g)}""")

# ---- Gesprächsimpulse: Noten aus den Nachbereitungen zählen mit ----
rep("function talkNews() {", """const notenZahl = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
/** Noten eines Spielers in Spielreihenfolge: frühere Liste plus die Noten aus den Nachbereitungen. */
function notenVerlauf(pid) {
  const alt = ((state.gradesHist || {})[pid] || []).slice();
  const neu = games().filter(g => gespielt(g)).map(g => notenZahl(((state.grades || {})[g.id] || {})[pid])).filter(n => n != null);
  return [...alt, ...neu];
}
function talkNews() {""")
rep("    const gr = (state.gradesHist||{})[p.id] || [];", "    const gr = notenVerlauf(p.id);")
rep("${((state.gradesHist||{})[p.id]||[]).length ? 'Ø '+de(avg(state.gradesHist[p.id])) : 'noch keine'}",
    "${notenVerlauf(p.id).length ? 'Ø '+de(avg(notenVerlauf(p.id))) : 'noch keine'}")

# ---- Gespräch nicht nötig: Impuls für drei Wochen ausblenden ----
rep("  const fresh = out.filter(m => !(talks[m.p.id]||[]).some(t => t.status==='geführt' && t.code===m.code && t.date >= addDays(TODAY, -21)));",
    "  const fresh = out.filter(m => !(talks[m.p.id]||[]).some(t => t.status==='geführt' && t.code===m.code && t.date >= addDays(TODAY, -21)) && !(((state.talkSkip || {})[m.p.id+'|'+m.code] || '') >= addDays(TODAY, -21)));")
rep("""<button class="btn" data-talksave="geführt">Gespräch geführt, beim Spieler speichern</button>""",
    """<button class="btn" data-talksave="geführt">Gespräch geführt, beim Spieler speichern</button>${cause ? `<button class="btn ghost" data-talkskip="1" title="Der Impuls verschwindet für drei Wochen aus Dashboard und Kommunikation">Gespräch nicht nötig</button>` : ''}""")
rep("  else if (d.talksave) {", """  else if (d.talkskip) { const t = state.talk; state.talkSkip = state.talkSkip || {}; state.talkSkip[t.pid+'|'+t.code] = TODAY;
    state.flashNext = `Impuls für ${P(t.pid).name} ausgeblendet. Er kommt nur wieder, wenn der Anlass in drei Wochen noch besteht.`; location.hash = 'dashboard'; }
  else if (d.talksave) {""")

# ---- KI-Erkenntnisse gehören zum nächsten Spiel: neuer Gegner → frische Auswahl, Handänderungen verfallen ----
rep("const factText = f => f.custom ?? factPool[f.kind][f.i][0];", """function faktenFuerSpiel() {
  if (!REAL.next || facts.spiel === REAL.next) return;
  for (const kind of ['opp', 'own']) facts[kind].splice(0, facts[kind].length, ...[0,1,2].filter(i => (factPool[kind] || [])[i]).map(i => ({id: (kind === 'opp' ? 'fo' : 'fw') + i, kind, i})));
  facts.spiel = REAL.next;
}
const factText = f => f.custom ?? (factPool[f.kind][f.i] || [''])[0];""")
rep("const factSrc = f => f.custom!=null ? 'von Hand geändert' : factPool[f.kind][f.i][1];",
    "const factSrc = f => f.custom!=null ? 'von Hand geändert' : (factPool[f.kind][f.i] || ['', ''])[1];")
rep("function render() {\n", "function render() {\n  faktenFuerSpiel();\n")
open(p, 'w').write(s); print('ok')
