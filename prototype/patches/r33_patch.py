import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Nachbereitung je Spiel speichern: Fragebogen, Prinzipien, Noten mit Begründung ----
rep("${textBox('nb-sp','Dein Schwerpunkt aus dem Spiel'", "${textBox('nb-sp-'+g.id,'Dein Schwerpunkt aus dem Spiel'")
rep("${textBox('nb-gegner','Wie hat der Gegner gespielt?'", "${textBox('nb-gegner-'+g.id,'Wie hat der Gegner gespielt?'")
rep("""<button data-rate="${p.id}" data-v="${n}" class="${state.rating[p.id]===n?'on':''}">${n}</button>""",
    """<button data-rate="${g.id}|${p.id}" data-v="${n}" class="${state.rating[g.id+'|'+p.id]===n?'on':''}">${n}</button>""")
rep("""<select class="f" id="g-${p.id}" aria-label="Note ${p.name}" style="width:80px">${['–','1','1,5','2','2,5','3','3,5','4','4,5','5','6'].map(n=>`<option>${n}</option>`).join('')}</select></td><td><input type="text" id="r-${p.id}" aria-label="Begründung ${p.name}" placeholder="kurz, z. B. sicher im Aufbau, zweikampfstark"></td></tr>""",
    """<select class="f" id="g-${p.id}" data-grade="${g.id}|${p.id}" aria-label="Note ${p.name}" style="width:80px">${['–','1','1,5','2','2,5','3','3,5','4','4,5','5','6'].map(n=>`<option ${((state.grades||{})[g.id]||{})[p.id]===n?'selected':''}>${n}</option>`).join('')}</select></td><td><input type="text" id="r-${p.id}" data-text="gr-${g.id}-${p.id}" value="${esc(state.texts['gr-'+g.id+'-'+p.id] ?? '')}" aria-label="Begründung ${p.name}" placeholder="kurz, z. B. sicher im Aufbau, zweikampfstark"></td></tr>""")

rep("""function gameStatus(g) {""", """/** Wie weit ist die Nachbereitung eines Spiels? Noten der eingesetzten Spieler, Fragebogen, Prinzipien. */
function postProgress(g) {
  const LU = REAL.lineups[g.id] || {xi:[], subs:[]};
  const einsatz = LU.xi.length + (LU.subs || []).length;
  const noten = Object.values((state.grades || {})[g.id] || {}).filter(v => v && v !== '–').length;
  const frage = ['nb-sp-', 'nb-gegner-'].filter(k => String(state.texts[k+g.id] ?? '').trim()).length;
  const prinz = Object.keys(state.rating || {}).filter(k => k.startsWith(g.id+'|')).length;
  const done = noten >= Math.max(1, Math.ceil(einsatz * 0.8)) && (frage > 0 || prinz > 0);
  return { noten, einsatz, frage, prinz, done };
}
function postLabel(g) {
  const pp = postProgress(g);
  if (pp.done) return 'fertig';
  if (!pp.noten && !pp.frage && !pp.prinz) return 'Fragebogen und Noten offen';
  return `Noten ${pp.noten} von ${pp.einsatz || '–'}${pp.frage || pp.prinz ? '' : ', Fragebogen offen'}`;
}
const okHaken = txt => `<span class="pill okpill">✓ ${txt}</span>`;
function gameStatus(g) {""")
rep("""    ['Fragebogen', g.post==='offen' ? 'offen' : 'nicht ausgefüllt', false],
    ['Spielernoten', g.post==='offen' ? '0 von 11' : 'keine', false],""",
    """    ['Fragebogen', postProgress(g).frage || postProgress(g).prinz ? 'ausgefüllt' : 'offen', !!(postProgress(g).frage || postProgress(g).prinz)],
    ['Spielernoten', `${postProgress(g).noten} von ${postProgress(g).einsatz || '–'}`, postProgress(g).done],""")

# Dashboard: nächstes Spiel und letztes Spiel immer zeigen, mit Haken wenn erledigt
rep("lp = games().filter(g=>g.res && g.post==='offen').pop();", "lp = games().filter(g=>g.res).pop();")
rep("""${dlink('#spiel-vorbereitung', `${crest(nx.opp,'sm')}${esc(nx.opp)}`, `<b class="lbl">Spielvorbereitung</b>""",
    """${dlink('#spiel-vorbereitung', `${crest(nx.opp,'sm')}${esc(nx.opp)}${prepProgress(nx).done ? ' ' + okHaken('vorbereitet') : ''}`, `<b class="lbl">Spielvorbereitung</b>""")
rep("""${lp ? dlink('#spiel-nachbereitung', `${crest(lp.opp,'sm')}${esc(lp.opp)} ${lp.res}`, `<b class="lbl">Nachbereitung</b> ${fmt(lp.date)} · Fragebogen und Noten offen`""",
    """${lp ? dlink('#spiel-nachbereitung', `${crest(lp.opp,'sm')}${esc(lp.opp)} ${lp.res}${postProgress(lp).done ? ' ' + okHaken('nachbereitet') : ''}`, `<b class="lbl">Nachbereitung</b> ${fmt(lp.date)} · ${postLabel(lp)}`""")

# Noten speichern und Ø Note im Kader aus den Nachbereitungen
rep("""window.addEventListener('hashchange', render);
render();""", """document.addEventListener('change', ev => {
  const t = ev.target; if (!t.dataset || !t.dataset.grade) return;
  const [gid, pid] = t.dataset.grade.split('|');
  state.grades = state.grades || {}; state.grades[gid] = state.grades[gid] || {};
  if (t.value === '–') delete state.grades[gid][pid]; else state.grades[gid][pid] = t.value;
  render();
});
const _renderOhneNoten = render;
render = function () {
  const sum = {}, n = {};
  for (const gr of Object.values(state.grades || {})) for (const [pid, v] of Object.entries(gr)) { const x = parseFloat(String(v).replace(',', '.')); if (!isNaN(x)) { sum[pid] = (sum[pid] || 0) + x; n[pid] = (n[pid] || 0) + 1; } }
  players.forEach(p => { p.grade = n[p.id] ? Math.round(sum[p.id] / n[p.id] * 10) / 10 : null; });
  return _renderOhneNoten();
};
window.addEventListener('hashchange', render);
render();""")
rep("</style>\n</head>", """.pill.okpill { background: var(--accent-soft); color: var(--accent); border: 1px solid var(--accent); font-weight: 600; }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
