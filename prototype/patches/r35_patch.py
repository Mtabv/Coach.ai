import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Nach dem Abpfiff: Spiel gilt als gespielt, auch bevor fussball.de das Ergebnis hat ----
rep("const nextGame = () => games().find(g=>g.date>=TODAY);", """/** Abgepfiffen: Anstoß plus zwei Stunden sind vorbei (auch wenn fussball.de noch kein Ergebnis hat). */
const nachAbpfiff = g => !!g && !!g.date && (g.date < TODAY || (g.date === TODAY && Date.now() > new Date(`${g.date}T${g.time || '15:00'}:00`).getTime() + 120*60000));
const gespielt = g => !!g && (!!g.res || nachAbpfiff(g));
const nextGame = () => games().find(g => !gespielt(g));
const letztesSpiel = () => games().filter(gespielt).pop();
/** Stand des Spielberichts bei fussball.de: vollständig = Abpfiff, beide Aufstellungen, alle Torschützen. */
const berichtVon = g => (REAL.games.find(x => x.id === g.id) || {}).bericht;
const berichtLabel = g => !g.res ? 'Ergebnis folgt' : berichtVon(g) === 'vollständig' ? 'vollständig' : 'unvollständig';
function berichtBanner(g) {
  if (g.res && berichtVon(g) === 'vollständig') return '';
  const knopf = `<button class="btn small" data-aktualisieren="1">Jetzt von fussball.de aktualisieren</button>`;
  const text = !g.res
    ? '<b>Abgepfiffen.</b> Ergebnis und Spielbericht von fussball.de folgen – der Server fragt alle 15 Minuten nach. Du kannst schon den Fragebogen ausfüllen und den Spieltagskader benoten.'
    : '<b>Ergebnis da, Spielbericht noch unvollständig.</b> Es fehlen z. B. noch Torschützen oder die Aufstellung. Der Server fragt alle 15 Minuten nach; du kannst schon nachbereiten.';
  return `<div class="q berichtq"><div>${text}</div>${knopf}</div>`;
}""")
rep("{ const n = REAL.games.find(g=>!g.res && g.date>=TODAY); if (n) REAL.next = n.id; }",
    "{ const n = REAL.games.find(g=>!g.res && !nachAbpfiff(g)); if (n) REAL.next = n.id; }")

# Dashboard: letztes Spiel = zuletzt abgepfiffenes, mit Stand des Spielberichts
rep("lp = games().filter(g=>g.res).pop();", "lp = letztesSpiel();")
rep("lp = games().filter(g=>g.res && g.post==='offen').pop();", "lp = letztesSpiel();", 0)
rep("""${lp ? dlink('#spiel-nachbereitung', `${crest(lp.opp,'sm')}${esc(lp.opp)} ${lp.res}${postProgress(lp).done ? ' ' + okHaken('nachbereitet') : ''}`, `<b class="lbl">Nachbereitung</b> ${fmt(lp.date)} · ${postLabel(lp)}`""",
    """${lp ? dlink('#spiel-nachbereitung', `${crest(lp.opp,'sm')}${esc(lp.opp)} ${lp.res || '–:–'}${postProgress(lp).done ? ' ' + okHaken('nachbereitet') : ''}`, `<b class="lbl">Nachbereitung</b> ${fmt(lp.date)} · ${!lp.res ? 'Ergebnis von fussball.de folgt' : berichtVon(lp) !== 'vollständig' ? 'Spielbericht unvollständig · ' + postLabel(lp) : postProgress(lp).done ? 'fertig' : 'Spielbericht vollständig – jetzt nachbereiten'}`""")

# Spielkopf, Vorbereitung, Nachbereitung
rep("const tabs = g.res ? [['spiel-nachbereitung','Nachbereitung']]", "const tabs = gespielt(g) ? [['spiel-nachbereitung','Nachbereitung']]")
rep("<h1>${gameTitleH(g)}${g.res?` ${g.res}`:''}</h1>", "<h1>${gameTitleH(g)}${g.res?` ${g.res}`:gespielt(g)?' <span class=\"pill grey\">Ergebnis folgt</span>':''}</h1>")
rep("${g.res?'':`<div class=\"row\"><button class=\"btn ghost\" data-msg=\"1\">Mannschaftsnachricht</button><button class=\"btn\" data-pdf=\"${g.id}\">Dossier als PDF</button></div>`}",
    "${gespielt(g)?'':`<div class=\"row\"><button class=\"btn ghost\" data-msg=\"1\">Mannschaftsnachricht</button><button class=\"btn\" data-pdf=\"${g.id}\">Dossier als PDF</button></div>`}")
rep("${!g.res && state.msg ? teamMessage(g) : ''}", "${!gespielt(g) && state.msg ? teamMessage(g) : ''}")
rep("EV(state.game) && !EV(state.game).res ? EV(state.game) : nextGame()", "EV(state.game) && !gespielt(EV(state.game)) ? EV(state.game) : nextGame()", 0)
rep("EV(state.post) && EV(state.post).res ? EV(state.post) : games().find(x=>x.post==='offen')", "EV(state.post) && gespielt(EV(state.post)) ? EV(state.post) : letztesSpiel()")
rep("${demo}${spielHead(g,'spiel-nachbereitung')}", "${demo}${spielHead(g,'spiel-nachbereitung')}${berichtBanner(g)}")
# Noch keine Aufstellung von fussball.de: Spieltagskader (und Spieler anderer Mannschaften) benoten
rep("""...(LU.subs||[]).map(s=>({p:asP(s.inn), info:`ab ${s.min}′ für ${s.out}`, sub:true}))];""",
    """...(LU.subs||[]).map(s=>({p:asP(s.inn), info: s.out ? `ab ${s.min}′ für ${s.out}` : `eingewechselt ${s.min}′`, sub:true}))];
  if (!LU.xi.length) {
    const sq = state.squad[g.id] instanceof Set ? [...state.squad[g.id]] : [];
    xi.push(...sq.map(pid => P(pid)).filter(Boolean).map(p => ({p, info:'Spieltagskader'})),
      ...guestsOf(g.id).map(x => ({p:{id:x.id, nr:'', name:x.name, pos:x.team||'Gast'}, info:'Spieltagskader'})));
  }""")

# Spieltag-Übersicht und Status je Spiel
rep("const up = games().filter(g=>!g.res), past = games().filter(g=>g.res).reverse()", "const up = games().filter(g=>!gespielt(g)), past = games().filter(gespielt).reverse()")
rep("function gameStatus(g) {\n  if (g.res) return [\n    ['Spieldaten von fussball.de', 'geladen', true],",
    "function gameStatus(g) {\n  if (gespielt(g)) return [\n    ['Spielbericht (fussball.de)', berichtLabel(g), berichtVon(g) === 'vollständig'],")
rep("const todo = g.res ? g.post==='offen' : (isNext || g.date <= addDays(TODAY, 7));", "const todo = gespielt(g) ? !postProgress(g).done : (isNext || g.date <= addDays(TODAY, 7));")
rep("${todo?'<span class=\"pill warn\">offen</span>':g.res?'<span class=\"pill grey\">nicht nachbereitet</span>':''}",
    "${!g.res && gespielt(g) ? '<span class=\"pill grey\">Ergebnis folgt</span>' : ''}${todo?'<span class=\"pill warn\">offen</span>':gespielt(g)?okHaken(g.res?'nachbereitet':'vorbereitet'):''}")
rep("""<div class="row">${g.res
        ? `<a class="btn ${g.post==='offen'?'':'ghost'} small" href="#spiel-nachbereitung" data-setpost="${g.id}">Nachbereitung ${g.post==='offen'?'ausfüllen':'ansehen'}</a>`""",
    """<div class="row">${gespielt(g)
        ? `<a class="btn ${postProgress(g).done?'ghost':''} small" href="#spiel-nachbereitung" data-setpost="${g.id}">Nachbereitung ${postProgress(g).done?'ansehen':'ausfüllen'}</a>`""")
rep("</style>\n</head>", """.q.berichtq { display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
