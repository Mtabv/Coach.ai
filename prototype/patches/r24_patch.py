import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

rep("const EVKINDS = ['Hallenturnier',", "const EVKINDS = ['Training','Hallenturnier',")
# Dialog: bei „Training“ Einheit statt Dienste, Titel optional
rep("""      <label class="fl" for="evf-title">Titel *<input type="text" id="evf-title" data-evf="title" value="${esc(f.title)}" placeholder="z. B. Hallenturnier Baunatal"></label>""",
    """      <label class="fl" for="evf-title">Titel${f.kind==='Training'?' (optional)':' *'}<input type="text" id="evf-title" data-evf="title" value="${esc(f.title)}" placeholder="${f.kind==='Training'?'z. B. Zusatztraining, Torwarttraining':'z. B. Hallenturnier Baunatal'}"></label>""")
rep("""    <label class="row" for="evf-rsvp"><input type="checkbox" id="evf-rsvp" data-evf="rsvp" ${f.rsvp?'checked':''}> Spieler sollen zu- oder absagen</label>
    <div class="tb">""", """    ${f.kind==='Training' ? `<label class="fl" for="evf-unit">Einheit, optional<select class="f" id="evf-unit" data-evf="unit"><option value="">später planen</option>${units.map(u=>`<option value="${u.id}" ${f.unit===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label>
      <p class="note" style="margin:0">Das Training erscheint wie die regulären Trainings im Kalender und im Bereich Training, mit Zu- und Absagen und Spielerzahl.</p>` : ''}
    <label class="row" for="evf-rsvp"><input type="checkbox" id="evf-rsvp" data-evf="rsvp" ${f.rsvp?'checked':''}> Spieler sollen zu- oder absagen</label>
    <div class="tb" ${f.kind==='Training'?'hidden':''}>""")
rep("  else if (d.evf) { state.evForm[d.evf] = t.type==='checkbox' ? t.checked : t.value; }",
    """  else if (d.evf) { const f = state.evForm; f[d.evf] = t.type==='checkbox' ? t.checked : t.value;
    if (d.evf === 'kind') { if (t.value === 'Training') { f.time = settings.rhythm[0] ? settings.rhythm[0].time : '19:00'; f.end = endTime(f.time, settings.rhythm[0] ? settings.rhythm[0].dur : 90); if (!f.place) f.place = REAL.team.venue.name; } render(); } }""")
rep("  else if (d.evsave) { const f = state.evForm;\n", """  else if (d.evsave && state.evForm.kind === 'Training') { const f = state.evForm;
    const toMin = x => { const m = /^(\\d{1,2}):(\\d{2})$/.exec(x||''); return m ? +m[1]*60 + +m[2] : null; };
    const dur = toMin(f.end) && toMin(f.time) && toMin(f.end) > toMin(f.time) ? toMin(f.end) - toMin(f.time) : 90;
    const id = 'e' + f.date + 'x' + (Date.now() % 100000);
    events.push({id, date: f.date, type: 'tr', time: f.time || '19:00', dur, place: f.place || REAL.team.venue.name, unit: f.unit || null, title: f.title.trim() || 'Zusatztraining', extra: true});
    state.evForm = null; state.trainEv = id; state.flash = `${f.title.trim() || 'Zusatztraining'} am ${fmt(f.date)} um ${f.time || '19:00'} Uhr angelegt.${f.unit ? '' : ' Die Einheit kannst du im Training planen.'}`; render(); }
  else if (d.evsave) { const f = state.evForm;
""")
# Zusatztrainings mit Titel kennzeichnen
rep('<span class="t">${e.time}–${endTime(e.time,e.dur)} Training</span>', '<span class="t">${e.time}–${endTime(e.time,e.dur)} ${e.title ? esc(e.title) : "Training"}</span>')
rep("state.evForm = {date: d.addev, kind: 'Hallenturnier', title: '', time: '10:00', end: '', place: '', note: '', rsvp: true, duties: []};",
    "state.evForm = {date: d.addev, kind: 'Training', title: '', time: settings.rhythm[0] ? settings.rhythm[0].time : '19:00', end: endTime(settings.rhythm[0] ? settings.rhythm[0].time : '19:00', settings.rhythm[0] ? settings.rhythm[0].dur : 90), place: REAL.team.venue.name, note: '', rsvp: true, duties: [], unit: ''};")
rep("    if (d.evf === 'kind') { if (t.value === 'Training') {", "    if (d.evf === 'kind') { if (t.value !== 'Training' && f.place === REAL.team.venue.name) f.place = ''; if (t.value === 'Training') {")
rep("/* ---- Masken ---- */", "[hidden] { display: none !important; }\n/* ---- Masken ---- */")
open(p, 'w').write(s); print('ok')
