import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Kalender-Abo: Knopf in der Spieler-App (Kalender); das Fenster dazu kommt aus rolle.ts ----
rep("""  return `<div class="pw-liste">${tage.map(iso => {""", """  return `<button class="btn ghost small pw-kalabo" data-kalabo="1">📅 In meinen Kalender übernehmen</button><div class="pw-liste">${tage.map(iso => {""")
rep("</style>\n</head>", """.pw-kalabo { justify-self: start; margin-bottom: 8px; }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
