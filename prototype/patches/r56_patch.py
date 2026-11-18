import sys, re
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Ergebnisse überall nach Ausgang einfärben: Sieg grün, Unentschieden gelb, Niederlage rot ----
# Gespeichert ist das Ergebnis in der Reihenfolge der Paarung (Heim:Gast); aus unserer Sicht umrechnen.
rep("const gespielt = g =>", """/** Ausgang aus unserer Sicht: 'sieg' | 'remis' | 'niederlage' (leer, wenn kein Ergebnis). */
const ausgang = g => { const m = /^(\\d+):(\\d+)$/.exec(String((g && g.res) || '').trim()); if (!m) return ''; const [wir, sie] = g.home ? [+m[1], +m[2]] : [+m[2], +m[1]]; return wir > sie ? 'sieg' : wir < sie ? 'niederlage' : 'remis'; };
const ergPill = (g, stil = '') => g && g.res ? `<span class="pill erg-${ausgang(g) || 'offen'}"${stil ? ` style="${stil}"` : ''} title="${{ sieg: 'Sieg', remis: 'Unentschieden', niederlage: 'Niederlage' }[ausgang(g)] || ''}">${g.res}</span>` : '';
const gespielt = g =>""")
n0 = s.count('<span class="pill game"')
s, n = re.subn(r'<span class="pill game"( style="([^"]*)")?>\$\{(\w+)\.res\}</span>', lambda m: "${ergPill(%s%s)}" % (m.group(3), ", '%s'" % m.group(2) if m.group(2) else ''), s)
assert n == 5, n
# Spieler-App: Kalender und letztes Spiel ebenfalls farbig
rep("""${e.type === 'gm' ? gameTitle(e) + (e.res ? ` (${e.res})` : '') : e.type === 'ev'""", """${e.type === 'gm' ? gameTitle(e) + (e.res ? ' ' + ergPill(e) : '') : e.type === 'ev'""")
rep("""<b>${gameTitle(lg)} ${lg.res}</b>""", """<b>${gameTitle(lg)} ${ergPill(lg)}</b>""")
rep("""<h1>${gameTitleH(g)}${g.res?` ${g.res}`:""", """<h1>${gameTitleH(g)}${g.res?` ${ergPill(g)}`:""")
rep("""${esc(lp.opp)} ${lp.res || '–:–'}""", """${esc(lp.opp)} ${lp.res ? ergPill(lp) : '–:–'}""")

rep("</style>\n</head>", """.pill.erg-sieg { background: color-mix(in srgb, #4ade80 18%, transparent); color: #4ade80; }
.pill.erg-remis { background: color-mix(in srgb, #facc15 18%, transparent); color: #facc15; }
.pill.erg-niederlage { background: var(--game-soft); color: var(--game); }
.pill.erg-offen { background: var(--game-soft); color: var(--muted); }
</style>
</head>""")
open(p, 'w').write(s); print('ok', n0)
