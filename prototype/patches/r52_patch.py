import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# Dienst abgeben: nur ausschließen, wer an einem der noch anstehenden Diensttage (Training/Spiel) fehlt –
# nicht jeden, der irgendwann in der Dienstwoche abwesend ist.
rep("""const verfuegbarFuer = d => players.filter(p => p.id !== ME && !d.who.includes(p.id) && !dutyDates(d).some(iso => absentOn(iso).some(a => a.pid === p.id)));""",
    """const verfuegbarFuer = d => { const tage = dienstTage(d).filter(iso => iso >= TODAY); return players.filter(p => p.id !== ME && !d.who.includes(p.id) && !tage.some(iso => abwesendAm(p.id, iso))); };""")
open(p, 'w').write(s); print('ok')
