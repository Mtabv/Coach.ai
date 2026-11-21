import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Spielkleidung per Auswahl (Trikot, Hose, Stutzen: schwarz/weiß) mit Bildvorschau wie im Dossier ----
rep("function kitSvg(k) {", """const KLEID_TEILE = [['shirt', 'Trikot', 'Trikots?'], ['shorts', 'Hose', 'Hosen?'], ['socks', 'Stutzen', 'Stutzen']];
/** Farben aus dem Kleidungstext lesen: { shirt: 'schwarz' | 'weiß' | '', … } */
function kleidungWerte(text) {
  const FARB = /^(schwarz|wei(ß|ss))/i;
  const teil = w => { const v = new RegExp('([a-zäöüß]+)\\\\s+' + w + '\\\\b', 'i').exec(text || ''); if (v && FARB.test(v[1])) return v[1];
    return (new RegExp(w + '[:\\\\s]+([^,;.\\\\n]+)', 'i').exec(text || '') || [])[1] || ''; };
  const norm = f => /^schwarz/i.test(f.trim()) ? 'schwarz' : /^wei(ß|ss)/i.test(f.trim()) ? 'weiß' : '';
  return Object.fromEntries(KLEID_TEILE.map(([k, , w]) => [k, norm(teil(w))]));
}
const kleidungText = w => KLEID_TEILE.map(([k, n]) => `${n} ${w[k] || 'offen'}`).join(', ');
function kleidungWahl(g) {
  const roh = state.texts['kleidung-' + g.id] ?? kitText(g);
  // Hinweis zum Aufwärmen aus dem bisherigen Freitext in den Zusatz übernehmen
  if (state.texts['kleidung-zusatz-' + g.id] == null) { const a = /Aufwärmen[^.\\n]*/i.exec(roh); state.texts['kleidung-zusatz-' + g.id] = a && !/noch nicht hinterlegt/.test(a[0]) ? a[0].trim() : ''; }
  const w = kleidungWerte(roh), std = kleidungWerte(kitText(g));
  for (const [k] of KLEID_TEILE) if (!w[k]) w[k] = std[k] || (k === 'shorts' ? 'schwarz' : 'weiß');
  const text = kleidungText(w);
  if (state.texts['kleidung-' + g.id] !== text) state.texts['kleidung-' + g.id] = text; // einheitliche Form für Dossier und Spieler-App
  const bilder = kitBilder(text);
  return `<div class="kleidwahl" data-kgid="${g.id}"><b>Spielkleidung</b>
    <div class="kleid-reihe">${KLEID_TEILE.map(([k, n], i) => `<label class="fl" for="kl-${k}-${g.id}">${n}<select class="f" id="kl-${k}-${g.id}" data-kleid="${k}">${['schwarz', 'weiß'].map(f => `<option value="${f}" ${w[k] === f ? 'selected' : ''}>${f === 'weiß' ? 'Weiß' : 'Schwarz'}</option>`).join('')}</select></label>`).join('')}</div>
    <div class="kleid-vorschau">${KLEID_TEILE.map(([k, n], i) => `<figure>${bilder[i] ? `<img src="${bilder[i]}" alt="${n} ${w[k]}">` : '<span class="note">kein Bild</span>'}<figcaption><b>${n}</b> ${w[k]}</figcaption></figure>`).join('')}</div>
    <span class="note">So erscheint es im Dossier (Folie „Unser Spiel“) und in der Spieler-App.</span>
    ${textBox('kleidung-zusatz-' + g.id, 'Zusatz (optional)', 'z. B. Aufwärmen im Trainingsanzug', 1)}</div>`;
}
function kitSvg(k) {""")
rep("""${textBox('kleidung-'+g.id,'Kleidung','')}<div class="kitshow">${(b => b.some(Boolean) ? b.map(src => src ? `<img src="${src}" alt="">` : '').join('') : kitSvg(g.home?'Heim':'Auswärts'))(kitBilder(state.texts['kleidung-'+g.id] ?? kitText(g)))}</div>""",
    """${kleidungWahl(g)}""")
# Auswahl ändern: Text setzen und neu zeichnen (Bilder wechseln sofort)
rep("""  else if (t.id === 'evbox') { state.showEv = t.checked; render(); }""",
    """  else if (d.kleid) { const box = t.closest('[data-kgid]'); if (box) { const gid = box.dataset.kgid, w = kleidungWerte(state.texts['kleidung-' + gid] || ''); w[d.kleid] = t.value; state.texts['kleidung-' + gid] = kleidungText(w); render(); } }
  else if (t.id === 'evbox') { state.showEv = t.checked; render(); }""")
# Spieler-App und Mannschaftsnachricht: Zusatz anhängen
rep("""<span class="note">${esc(state.texts['kleidung-'+ng.id] ?? kitText(ng))}</span>""",
    """<span class="note">${esc(state.texts['kleidung-'+ng.id] ?? kitText(ng))}${String(state.texts['kleidung-zusatz-'+ng.id] || '').trim() ? '. ' + esc(state.texts['kleidung-zusatz-'+ng.id].trim()) : ''}</span>""")

rep("</style>\n</head>", """.kleidwahl { display: grid; gap: 10px; }
.kleid-reihe { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.kleid-vorschau { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: color-mix(in srgb, var(--panel) 60%, transparent); }
.kleid-vorschau figure { margin: 0; display: grid; justify-items: center; gap: 4px; }
.kleid-vorschau img { height: 120px; width: auto; max-width: 110px; object-fit: contain; }
.kleid-vorschau figcaption { font-size: 13px; color: var(--muted); text-align: center; }
.kleid-vorschau figcaption b { display: block; color: var(--accent); }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
