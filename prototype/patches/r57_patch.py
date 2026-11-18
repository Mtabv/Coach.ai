import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Fahrgemeinschaft: erst zwei Knöpfe; Plätze erst nach „Mitfahrt anbieten“; keine Abfahrt ----
a0 = s.index("    else meins = `<div class=\"pt\"><div class=\"row\" style=\"flex-wrap:nowrap;gap:6px\"><select class=\"f\" id=\"rideseats-${g.id}\"")
a1 = s.index("</div></div>`;\n", a0) + len("</div></div>`;\n")
s = s[:a0] + """    else meins = state.rideForm === g.id
      ? `<div class="pt"><b>Mitfahrt anbieten</b><label class="fl" for="rideseats-${g.id}">Wie viele Plätze hast du frei?<select class="f" id="rideseats-${g.id}" style="width:auto">${[1,2,3,4,5,6].map(n => `<option value="${n}" ${n === 3 ? 'selected' : ''}>${n} ${n === 1 ? 'Platz' : 'Plätze'}</option>`).join('')}</select></label>
        <div class="row"><button class="btn small" data-rideoffer="${g.id}">Anbieten</button><button class="btn ghost small" data-rideform="-">Abbrechen</button></div></div>`
      : `<div class="pt"><div class="row"><button class="btn small" data-rideform="${g.id}">Mitfahrt anbieten</button><button class="btn ghost small" data-rideseek="${g.id}">Mitfahrt gesucht</button></div></div>`;
""" + s[a1:]
# Treffpunkt aus der Spielvorbereitung („offen“, solange nichts eingetragen ist) statt der Abfahrt aus dem Ablaufplan
rep("""      <div class="pw-route"><span>🕑 <b>Treffpunkt ${esc(plan[0] || '')}</b> · ${esc(String(plan[1] || REAL.departure || '').replace(/^(Abfahrt|Treffpunkt)\\s*/, ''))}</span>""",
    """      <div class="pw-route"><span>🕑 <b>Treffpunkt:</b> ${String(state.texts['treffpunkt-' + g.id] || '').trim() ? esc(String(state.texts['treffpunkt-' + g.id]).trim()) : '<span class="note">offen</span>'}</span>""")
rep("""ev.target.closest('[data-pvwoche],[data-pvquick],[data-rideoffer],""", """ev.target.closest('[data-pvwoche],[data-pvquick],[data-rideform],[data-rideoffer],""")
rep("""  else if (d.pvquick === 'abs') { state.absForm = true; }""", """  else if (d.pvquick === 'abs') { state.absForm = true; }
  else if (d.rideform) { state.rideForm = d.rideform === '-' ? null : d.rideform; }""")
rep("""if (!fahrerVon(d.rideoffer, ME)) F.fahrer.push({ pid: ME, plaetze: +document.getElementById('rideseats-' + d.rideoffer).value || 1, ab: (document.getElementById('rideab-' + d.rideoffer) || {}).value || '', mit: [] }); }""",
    """if (!fahrerVon(d.rideoffer, ME)) F.fahrer.push({ pid: ME, plaetze: +document.getElementById('rideseats-' + d.rideoffer).value || 1, ab: '', mit: [] }); state.rideForm = null; }""")
open(p, 'w').write(s); print('ok')
