import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Gastspieler im Training ----
rep("const availFor = e => { const c = counts(e.date); return c.tw + c.fp; };",
    """/** Gastspieler je Termin: {id, name, tw, note} */
const guestsOf = eid => (state.guests || {})[eid] || [];
const guestsOn = iso => events.filter(e=>e.date===iso).flatMap(e=>guestsOf(e.id));
const availFor = e => { const c = counts(e.date); return c.tw + c.fp + guestsOf(e.id).length; };""")
rep("""function availPill(iso, type) {
  const c = counts(iso), low = c.tw < settings.minTw || c.fp < (type==='gm' ? settings.minFpGm : settings.minFpTr);
  return `<span class="pill ${low?'warn':''} avail num" title="verfügbare Spieler">TW ${c.tw}/${c.twAll} · Feld ${c.fp}/${c.fpAll}</span>`;
}""", """function availPill(iso, type) {
  const c = counts(iso), g = guestsOn(iso), gtw = g.filter(x=>x.tw).length, gfp = g.length - gtw;
  const low = c.tw + gtw < settings.minTw || c.fp + gfp < (type==='gm' ? settings.minFpGm : settings.minFpTr);
  return `<span class="pill ${low?'warn':''} avail num" title="verfügbare Spieler${g.length?', dazu Gastspieler':''}">TW ${c.tw}/${c.twAll} · Feld ${c.fp}/${c.fpAll}${g.length?` · +${g.length} Gast${g.length>1?'spieler':''}`:''}</span>`;
}""")
rep("""          <div><h4>Keine Antwort (${a.none.length})</h4><ul>${a.none.map(p=>row(p)).join('')}</ul>${a.none.length ? `<button class="btn ghost small" data-attall="${e.id}">Alle ohne Antwort zusagen</button>` : ''}</div></div></div>`;""",
"""          <div><h4>Keine Antwort (${a.none.length})</h4><ul>${a.none.map(p=>row(p)).join('')}</ul>${a.none.length ? `<button class="btn ghost small" data-attall="${e.id}">Alle ohne Antwort zusagen</button>` : ''}</div></div>
        <div class="guests"><h4>Gastspieler (${guestsOf(e.id).length})</h4>
          ${guestsOf(e.id).length ? `<ul>${guestsOf(e.id).map(g=>`<li><span class="attn"><span class="av sm init guest">G</span> ${esc(g.name)}${g.tw?' (TW)':''}${g.note?` <span class="note">· ${esc(g.note)}</span>`:''}</span><button class="ib" data-guestdel="${e.id}|${g.id}" title="Gastspieler entfernen" aria-label="${esc(g.name)} entfernen">${ICON.x}</button></li>`).join('')}</ul>` : '<p class="note" style="margin:0">Zum Beispiel aus der zweiten Mannschaft, der A-Jugend oder ein Probespieler.</p>'}
          <div class="row guestform"><input type="text" id="gname-${e.id}" placeholder="Name des Gastspielers" aria-label="Name des Gastspielers"><input type="text" id="gnote-${e.id}" placeholder="z. B. 2. Mannschaft, Probetraining" aria-label="Hinweis"><label class="row note" style="gap:4px"><input type="checkbox" id="gtw-${e.id}"> TW</label><button class="btn small" data-guestadd="${e.id}">Hinzufügen</button></div></div></div>`;""")
rep("<div><h4>Zugesagt (${a.yes.length})</h4>", "<div><h4>Zugesagt (${a.yes.length}${guestsOf(e.id).length?` + ${guestsOf(e.id).length} Gast${guestsOf(e.id).length>1?'spieler':''}`:''})</h4>")
rep("""window.addEventListener('hashchange', render);
render();""", """document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-guestadd],[data-guestdel]');
  if (!b) return;
  state.guests = state.guests || {};
  if (b.dataset.guestadd) {
    const eid = b.dataset.guestadd, name = document.getElementById('gname-'+eid).value.trim();
    if (!name) { document.getElementById('gname-'+eid).focus(); return; }
    (state.guests[eid] = state.guests[eid] || []).push({id: 'g' + Date.now().toString(36), name, tw: document.getElementById('gtw-'+eid).checked, note: document.getElementById('gnote-'+eid).value.trim()});
  } else {
    const [eid, gid] = b.dataset.guestdel.split('|');
    state.guests[eid] = (state.guests[eid] || []).filter(g => g.id !== gid);
  }
  render();
});
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Enter' || !ev.target.id || !/^g(name|note)-/.test(ev.target.id)) return;
  const btn = ev.target.closest('.guestform') && ev.target.closest('.guestform').querySelector('[data-guestadd]'); if (btn) { ev.preventDefault(); btn.click(); }
});
window.addEventListener('hashchange', render);
render();""")

# ---- Links (z. B. Übungsnamen) in hellerem Blau, gut lesbar auf dunklem Grund ----
rep("</style>\n</head>", """:root { --link: #1f5f8b; }
:root[data-theme="dark"] { --link: #a8d0ff; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --link: #a8d0ff; } }
main a:not([class]), main a:not([class]):visited { color: var(--link); }
main a:not([class]):hover { color: var(--accent); }
.guests { border-top: 1px solid var(--line); padding-top: 10px; display: grid; gap: 6px; }
.guests h4 { margin: 0; font-size: 15px; }
.guests ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; font-size: 14px; }
.guests li { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.guestform { flex-wrap: wrap; gap: 6px; }
.guestform input[type="text"] { width: auto; flex: 1 1 160px; }
.av.guest { background: var(--accent-soft); color: var(--accent); }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
