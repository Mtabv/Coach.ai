import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Beschreibung eines Dienstes für Mitteilungen: was, Details, wann und wozu (Training/Spiel am Tag) ----
rep("const dienstTage = d =>", """function dienstBeschreibung(d) {
  const [name, det] = [d.title.split(' (')[0], (d.title.match(/\\((.*)\\)$/) || [])[1]];
  const tage = dienstTage(d), anlass = iso => events.filter(e => e.date === iso && (e.type === 'tr' || e.type === 'gm')).map(e => e.type === 'gm' ? `Spiel ${e.home ? 'gegen' : 'bei'} ${e.opp} ${e.time}` : `Training ${e.time}`).join(', ');
  const wann = tage.length && tage.length <= 3 ? tage.map(iso => `${wochentag(iso)} ${fmt(iso)}${anlass(iso) ? ` (${anlass(iso)})` : ''}`).join(', ') : dutyWhen(d);
  return `<b>${esc(name)}</b>${det ? ` – ${esc(det)}` : ''}, ${esc(wann)}`;
}
const dienstTage = d =>""")
rep("""    if (wer) { du.who.push(wer); mitteilen(wer, `Dir wurde ein Dienst zugewiesen: <b>${esc(titel.split(' (')[0])}</b>, ${dutyWhen(du).replace(/\\.$/, '')}.`); }""",
    """    for (const w of wer) { du.who.push(w); mitteilen(w, `Dir wurde ein Dienst zugewiesen: ${dienstBeschreibung(du)}.`); }""")
rep("""const id = 'dz' + Date.now(), slots = Math.max(1, +v('dn-slots') || 1), wer = v('dn-who');""",
    """const id = 'dz' + Date.now(), wer = [...document.querySelectorAll('.dn-wer input:checked')].map(i => i.value), slots = Math.max(1, +v('dn-slots') || 1, wer.length);""")

# ---- Gleich einteilen: mehrere Personen per Häkchen ----
rep("""      <label class="fl" for="dn-who">Gleich einteilen (optional)<select class="f" id="dn-who"><option value="">niemand – Spieler tragen sich selbst ein</option>${players.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label></div>""",
    """      <div class="fl"><span>Gleich einteilen (optional)</span><details class="dn-wer"><summary class="f">niemand – Spieler tragen sich selbst ein</summary><div class="dn-liste">${players.map(p => `<label class="row" for="dnw-${p.id}"><input type="checkbox" id="dnw-${p.id}" value="${p.id}"> ${esc(p.name)} <span class="note">${p.pos || ''}</span></label>`).join('')}</div></details></div></div>""")
rep("""  else if (t.id === 'dn-typ') {""", """  else if (t.closest && t.closest('.dn-wer')) { const w = t.closest('.dn-wer'), n = [...w.querySelectorAll('input:checked')].map(i => P(i.value) ? P(i.value).name : ''); w.querySelector('summary').textContent = n.length ? n.join(', ') : 'niemand – Spieler tragen sich selbst ein'; const sl = document.getElementById('dn-slots'); if (sl && +sl.value < n.length) sl.value = n.length; }
  else if (t.id === 'dn-typ') {""")

# ---- Spieler-Start: Dienste auch direkt am Tag, eigene deutlich hervorgehoben ----
rep("""      const ds = duties.filter(d => dienstOk(d) && d.ev && EV(d.ev).date === iso);""",
    """      const ds = duties.filter(d => dienstOk(d) && (d.ev ? EV(d.ev).date === iso : dienstTage(d).includes(iso))).sort((a, b) => b.who.includes(ME) - a.who.includes(ME));""")
rep("""    return `<div class="pw-dienst ${ich ? 'mein' : ''}"><b>${ich ? '★ ' : ''}${esc(d.title.split(' (')[0])}</b>""",
    """    return `<div class="pw-dienst ${ich ? 'mein' : ''}"><b>${ich ? '★ Dein Dienst: ' : ''}${esc(d.title.split(' (')[0])}</b>""")

rep("</style>\n</head>", """.dn-wer { position: relative; }
.dn-wer summary { cursor: pointer; list-style: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dn-wer[open] .dn-liste { margin-top: 6px; max-height: 260px; overflow-y: auto; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; display: grid; gap: 2px; }
.dn-liste label { display: flex; align-items: center; gap: 8px; padding: 4px 0; margin: 0; cursor: pointer; flex-wrap: nowrap; }
.dn-liste input { width: auto; flex: none; }
.pw-dienst.mein { border: 2px solid var(--accent) !important; background: color-mix(in srgb, var(--accent) 14%, transparent) !important; border-radius: 8px; padding: 6px 8px; }
.pw-dienst.mein b { color: var(--accent); }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
