import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Kleidung: Bild je Teil nach Farbe aus allen hinterlegten Kombinationen (z. B. schwarzes Trikot) ----
rep("function kitSvg(k) {", """const kitFarbe = t => String(t || '').toLowerCase().replace(/ß/g, 'ss').replace(/\\(.*?\\)/g, '').replace(/(es|er|en|em|e)\\b/g, '').replace(/\\s+/g, ' ').trim();
/** Aus „Trikot schwarz, Hose weiß, Stutzen schwarz“ die Bilder der Teile in dieser Farbe. */
function kitBilder(text) {
  const sets = (REAL.kit && REAL.kit.sets) || (REAL.kit && REAL.kit.images ? [{ ...REAL.kit.home, images: REAL.kit.images }] : []);
  const FARB = /^(schwarz|wei(ß|ss)|rot|blau|gr(ü|ue)n|gelb|grau|orange|lila|pink|beige)/i;
  const teil = w => { const v = new RegExp('([a-zäöüß]+)\\\\s+' + w + '\\\\b', 'i').exec(text || ''); if (v && FARB.test(v[1])) return v[1];
    return (new RegExp(w + '[:\\\\s]+([^,;.\\\\n]+)', 'i').exec(text || '') || [])[1] || ''; };
  return [['shirt', 'Trikots?'], ['shorts', 'Hosen?'], ['socks', 'Stutzen']].map(([k, w]) => { const f = kitFarbe(teil(w)); if (!f) return ''; const s = sets.find(x => x.images && x.images[k] && kitFarbe(x[k]) === f); if (s) return s.images[k]; const st = (window.__11planKleidung || []).find(b => b.teil === k && kitFarbe(b.farbe) === f); return st ? st.src : ''; });
}
function kitSvg(k) {""")
rep("""<div class="kitshow">${g.home && REAL.kit.images.shirt ? ['shirt','shorts','socks'].map(k=>REAL.kit.images[k]?`<img src="${REAL.kit.images[k]}" alt="">`:'').join('') : kitSvg(g.home?'Heim':'Auswärts')}</div>""",
    """<div class="kitshow">${(b => b.some(Boolean) ? b.map(src => src ? `<img src="${src}" alt="">` : '').join('') : kitSvg(g.home?'Heim':'Auswärts'))(kitBilder(state.texts['kleidung-'+g.id] ?? kitText(g)))}</div>""")
rep("</style>\n</head>", """.kitshow img { width: auto !important; height: 120px !important; max-width: 110px; object-fit: contain !important; background: transparent !important; border: 0 !important; }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
