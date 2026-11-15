import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Dashboard: immer die nächsten vier Trainingseinheiten ----
rep("const wk = trainings().filter(t=>t.date>=MON && t.date<=plusDays(MON,13) && t.date>=TODAY);", "const wk = nextTrainings(4);")
rep("${wk.slice(0,3).map(t=>dlink('#einheit',", "${wk.map(t=>dlink('#einheit',")
open(p, 'w').write(s); print('ok')
