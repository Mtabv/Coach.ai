import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Nachbereitung, Spielverlauf: Kommentar je Tor als mehrzeiliges Feld (5 Zeilen) ----
rep("""<input type="text" data-text="gc-${g.id}-${i}" value="${esc(state.texts['gc-'+g.id+'-'+i]??'')}" placeholder="${x.own?'Wie ist das Tor entstanden?':'Was ist passiert? z. B. Ballverlust im Aufbau, Standard'}" aria-label="Kommentar zum Tor ${x.min}">""",
    """<textarea class="begruendung torkommentar" rows="5" data-text="gc-${g.id}-${i}" placeholder="${x.own?'Wie ist das Tor entstanden?':'Was ist passiert? z. B. Ballverlust im Aufbau, Standard'}" aria-label="Kommentar zum Tor ${x.min}">${esc(state.texts['gc-'+g.id+'-'+i]??'')}</textarea>""")
rep("</style>\n</head>", """textarea.torkommentar { flex: 1 1 auto; min-width: 0; }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
