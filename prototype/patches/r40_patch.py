import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Nachbereitung: Begründung der Spielernote als mehrzeiliges Feld (5 Zeilen) ----
rep("""<input type="text" id="r-${p.id}" data-text="gr-${g.id}-${p.id}" value="${esc(state.texts['gr-'+g.id+'-'+p.id] ?? '')}" aria-label="Begründung ${p.name}" placeholder="kurz, z. B. sicher im Aufbau, zweikampfstark">""",
    """<textarea id="r-${p.id}" class="begruendung" rows="5" data-text="gr-${g.id}-${p.id}" aria-label="Begründung ${p.name}" placeholder="z. B. sicher im Aufbau, zweikampfstark, zwei Ballverluste vor dem 0:1">${esc(state.texts['gr-'+g.id+'-'+p.id] ?? '')}</textarea>""")
rep("</style>\n</head>", """textarea.begruendung { width: 100%; min-width: 320px; min-height: 7.5em; resize: vertical; }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
