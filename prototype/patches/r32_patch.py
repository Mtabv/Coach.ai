import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Stand der Spielvorbereitung aus den echten Eingaben statt fest „nicht begonnen“ ----
rep("""function gameStatus(g) {""", """/** Wie weit ist die Spielvorbereitung? Zählt Gegnerbeobachtung, unseren Plan, Auftrag und Kader. */
function prepProgress(g) {
  const keys = [...QA.map(([k])=>'a-'+k), ...QE.filter(([k])=>k!=='u1_grundordnung').map(([k])=>'e-'+k), 'd-botschaft', 'd-motto'].map(k=>k+'-'+g.id);
  const filled = keys.filter(k => String(state.texts[k] ?? '').trim()).length;
  const sq = state.squad[g.id], kader = (sq instanceof Set ? sq.size : 0) + guestsOf(g.id).length;
  const auftrag = String(state.texts['d-botschaft-'+g.id] ?? '').trim() && String(state.texts['d-motto-'+g.id] ?? '').trim();
  const done = !!auftrag && filled >= Math.ceil(keys.length * 0.6) && kader > 0;
  return { filled, total: keys.length, kader, done };
}
function prepLabel(g) {
  const pp = prepProgress(g);
  if (pp.done) return 'fertig';
  if (!pp.filled && !pp.kader) return 'nicht begonnen';
  return `${pp.filled} von ${pp.total} Angaben${pp.kader ? '' : ', Kader offen'}`;
}
function gameStatus(g) {""")
rep("""    ['Gegnervorbereitung', g.prep==='nicht begonnen' ? 'nicht begonnen' : `${g.prep} Seiten`, false],
    ['Aufstellung', 'offen', false],""", """    ['Spielvorbereitung', prepLabel(g), prepProgress(g).done],
    ['Kader', prepProgress(g).kader ? `${prepProgress(g).kader} Spieler` : 'offen', prepProgress(g).kader > 0],""")
rep("· Vorbereitung ${nx.prep}, Aufstellung offen`", "· Vorbereitung ${prepLabel(nx)}${prepProgress(nx).kader ? ` · Kader ${prepProgress(nx).kader} Spieler` : ''}`")
open(p, 'w').write(s); print('ok')
