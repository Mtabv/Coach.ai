import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Dienstarten: Materialdienst gilt an Trainings- und Spieltagen, ein eigener Dienst (art 'frei') an jedem Tag ----
rep("""const dienstTage = d => d.ev ? (EV(d.ev) ? [EV(d.ev).date] : []) : dutyDates(d).filter(""",
    """const dienstTage = d => d.ev ? (EV(d.ev) ? [EV(d.ev).date] : []) : d.art === 'frei' ? dutyDates(d) : dutyDates(d).filter(""")
rep("""})() : `Woche ${d.from.slice(8)}.${d.from.slice(5,7)}.–${d.to.slice(8)}.${d.to.slice(5,7)}.`;""",
    """})() : d.from === d.to ? `${WD[new Date(d.from+'T12:00:00').getDay()]} ${d.from.slice(8)}.${d.from.slice(5,7)}.` : `${d.art === 'frei' ? '' : 'Woche '}${d.from.slice(8)}.${d.from.slice(5,7)}.–${d.to.slice(8)}.${d.to.slice(5,7)}.`;""")

# ---- Formular: Art (Materialdienst / eigener Dienst), Zeitraum, Details, Plätze, gleich einteilen ----
a0 = s.index("""    ${state.dutyForm ? `<div class="pt dienstform"><div class="grid g3">""")
a1 = s.index("""<span class="note">Bei „Zeitraum“ gelten „von“ und „bis“; bei einem Termin der Tag des Termins.</span></div></div>` : ''}""") + len("""<span class="note">Bei „Zeitraum“ gelten „von“ und „bis“; bei einem Termin der Tag des Termins.</span></div></div>` : ''}""")
s = s[:a0] + """    ${state.dutyForm ? `<div class="pt dienstform" data-typ="material"><div class="grid g3">
      <label class="fl" for="dn-typ">Dienst<select class="f" id="dn-typ"><option value="material">Materialdienst</option><option value="frei">Anderer Dienst …</option></select></label>
      <label class="fl nur-frei" for="dn-title">Name des Dienstes<input type="text" id="dn-title" placeholder="z. B. Weihnachtsmarkt – Schicht Glühweinstand"></label>
      <label class="fl" for="dn-detail">Details (optional)<input type="text" id="dn-detail" placeholder="z. B. Bälle, Leibchen, Hütchen · oder 16–20 Uhr"></label>
      <label class="fl" for="dn-from">von<input type="date" id="dn-from" class="f" value="${MON}"></label>
      <label class="fl" for="dn-to">bis<input type="date" id="dn-to" class="f" value="${addDays(MON, 6)}"></label>
      <label class="fl" for="dn-slots">Wie viele Personen?<input type="number" id="dn-slots" min="1" max="30" value="1" class="f"></label>
      <label class="fl" for="dn-who">Gleich einteilen (optional)<select class="f" id="dn-who"><option value="">niemand – Spieler tragen sich selbst ein</option>${players.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label></div>
      <div class="row"><button class="btn" data-dutysave="1">Dienst speichern</button><span class="note nur-material">Materialdienst: gilt an den Trainings- und Spieltagen im Zeitraum.</span><span class="note nur-frei">Eigener Dienst: gilt an jedem Tag im Zeitraum – für einen einzelnen Tag „von“ und „bis“ gleich setzen.</span></div></div>` : ''}""" + s[a1:]
rep("""  else if (d.dutysave) { const v = id => (document.getElementById(id) || {}).value || '', titel = v('dn-title').trim(); if (!titel) { const i = document.getElementById('dn-title'); i.classList.add('need'); i.focus(); return; }
    const art = v('dn-art'), id = 'dz' + Date.now(), slots = Math.max(1, +v('dn-slots') || 1), wer = v('dn-who');
    const du = art === 'zeit' ? { id, title: titel, from: v('dn-from'), to: v('dn-to') || v('dn-from'), slots, who: [] } : { id, title: titel, ev: art, slots, who: [] };""",
    """  else if (d.dutysave) { const v = id => (document.getElementById(id) || {}).value || '', typ = v('dn-typ'), name = typ === 'frei' ? v('dn-title').trim() : 'Materialdienst';
    if (!name) { const i = document.getElementById('dn-title'); i.classList.add('need'); i.focus(); return; }
    if (!v('dn-from')) { const i = document.getElementById('dn-from'); i.classList.add('need'); i.focus(); return; }
    const detail = v('dn-detail').trim(), titel = detail ? `${name} (${detail})` : name;
    const id = 'dz' + Date.now(), slots = Math.max(1, +v('dn-slots') || 1), wer = v('dn-who');
    const du = { id, title: titel, art: typ === 'frei' ? 'frei' : 'material', from: v('dn-from'), to: v('dn-to') || v('dn-from'), slots, who: [] };""")
# Art umschalten ohne neu zu zeichnen (Eingaben bleiben erhalten)
rep("""  else if (t.id === 'evbox') { state.showEv = t.checked; render(); }""",
    """  else if (t.id === 'evbox') { state.showEv = t.checked; render(); }
  else if (t.id === 'dn-typ') { const f = t.closest('.dienstform'); if (f) f.dataset.typ = t.value; if (t.value === 'frei') setTimeout(() => document.getElementById('dn-title').focus(), 0); }""")

# ---- Dienste im Kader (immer sichtbar); im Kalender nur noch ein Hinweis ----
rep("""  ${state.showEv ? dutyTable() : ''}""", """  ${state.showEv ? '<p class="note">Dienste legst du im <a href="#kader">Kader</a> an und verwaltest sie dort.</p>' : ''}""")
rep("""  <p class="note">Im Kader: wie oft im Spielberichtsbogen, also Startelf oder Bank. Einsätze: Startelf oder eingewechselt. Minuten: aus den Wechseln im Spielbericht, Nachspielzeit nicht mitgezählt. Vorlagen kommen von FuPa und gelten für die ganze Saison.</p>`;""",
    """  <p class="note">Im Kader: wie oft im Spielberichtsbogen, also Startelf oder Bank. Einsätze: Startelf oder eingewechselt. Minuten: aus den Wechseln im Spielbericht, Nachspielzeit nicht mitgezählt. Vorlagen kommen von FuPa und gelten für die ganze Saison.</p>
  <div id="dienste">${dutyTable()}</div>`;""")
rep("""<p class="sub">Spieler sehen ihre Dienste in ihrer Ansicht und können sich für offene Plätze eintragen.</p>""",
    """<p class="sub">Spieler sehen ihre Dienste in ihrer App (auch im Kalender), können sich für offene Plätze eintragen und einen Dienst an jemanden abgeben, der da ist.</p>""")

rep("</style>\n</head>", """.dienstform[data-typ="material"] .nur-frei, .dienstform[data-typ="frei"] .nur-material { display: none; }
</style>
</head>""")
# Spieler-Kalender: auch Tage, an denen nur ein Dienst ansteht (z. B. Weihnachtsmarkt)
rep("""  const letzter = events.reduce((m, e) => e.date > m ? e.date : m, TODAY);""", """  const dienstTag = x => duties.some(d => dienstOk(d) && dienstTage(d).includes(x));
  const letzter = [...events.map(e => e.date), ...duties.filter(d => !d.ev && d.to).map(d => d.to)].reduce((m, x) => x > m ? x : m, TODAY);""")
rep("""if (x === TODAY || events.some(e => e.date === x && sichtbar(e))) tage.push(x);""", """if (x === TODAY || events.some(e => e.date === x && sichtbar(e)) || dienstTag(x)) tage.push(x);""")
open(p, 'w').write(s); print('ok')
