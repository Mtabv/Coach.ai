import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ======================= Spielersicht: „Termine“ geht in „Start“ auf =======================
rep("""  const tabs = [['start','Start',true],['termine','Termine',true],['mitfahrt','Mitfahrten',true],""",
    """  const tabs = [['start','Start',true],['mitfahrt','Fahrgemeinschaft',true],""")
# Zu- und Absage direkt im Wochenkalender, Abwesenheit auf „Start“
rep("""  const status = e => { const r = state.reply[e.id], abw = absences.find(a => a.pid === ME && a.from <= e.date && e.date <= a.to);
    return abw || r === 'nein' ? `<span class="pill grey">nicht dabei</span>` : e.date < TODAY ? '' : `<span class="pill ok">dabei</span>`; };""",
    """  const jetzt = new Date(state.pvNow);
  const status = e => { const r = state.reply[e.id], abw = absences.find(a => a.pid === ME && !a.src && a.from <= e.date && e.date <= a.to);
    if (e.date < TODAY) return '';
    if (abw) return `<span class="pill grey" title="${esc(abw.why)}">nicht dabei</span>`;
    const spaet = jetzt > deadlineOf(e);
    if (r === 'nein') return `<span class="pw-ant"><span class="pill grey">nicht dabei</span>${spaet ? '' : `<button class="btn ghost small" data-reply="${e.id}" data-v="ja">doch dabei</button>`}</span>`;
    return `<span class="pw-ant"><span class="pill ok">dabei</span>${spaet ? '' : `<button class="btn ghost small" data-reply="${e.id}" data-v="nein">absagen</button>`}</span>`; };
  const absage = e => state.declining !== e.id ? '' : `<div class="pw-absage"><select class="f" id="rs-${e.id}" aria-label="Grund"><option value="">Grund wählen …</option>${REASONS.map(x => `<option>${x}</option>`).join('')}</select><input type="text" id="rn-${e.id}" placeholder="Notiz, optional"><div class="row"><button class="btn small" data-decline="${e.id}">Absagen</button><button class="btn ghost small" data-declinecancel="1">Abbrechen</button></div></div>`;
  const spaetHinweis = e => e.date >= TODAY && jetzt > deadlineOf(e) && !absences.some(a => a.pid === ME && !a.src && a.from <= e.date && e.date <= a.to) ? `<span class="note pw-spaet">Absagefrist vorbei – bitte beim Trainer anrufen${settings.phone ? ` (${esc(settings.phone)})` : ''}.</span>` : '';
  const meineAbw = absences.filter(a => a.pid === ME && !a.src);""")
rep("""        ${evs.map(e => `<div class="pw-ev t-${e.type}"><span class="pw-zeit">${e.time}</span><span>${e.type === 'gm' ? gameTitle(e) : e.type === 'ev' ? esc(e.title) : 'Training'}<span class="note"> · ${esc(String(e.place || '').replace('Sportplatz ', ''))}</span></span>${status(e)}</div>`).join('')}""",
    """        ${evs.map(e => `<div class="pw-ev t-${e.type}"><span class="pw-zeit">${e.time}</span><span>${e.type === 'gm' ? gameTitle(e) : e.type === 'ev' ? esc(e.title) : 'Training'}<span class="note"> · ${esc(String(e.place || '').replace('Sportplatz ', ''))}</span></span>${status(e)}</div>${absage(e)}${spaetHinweis(e)}`).join('')}""")
rep("""    <b>Schnell erledigt</b>
    <div class="pw-schnell"><button class="btn" data-pvquick="abs">Abwesenheit eintragen</button>${fahrt ? `<button class="btn ghost" data-pvtab="mitfahrt">Mitfahrt ${fahrt.home ? '' : 'zum Auswärtsspiel'}</button>` : ''}</div>`;""",
    """    <b>Schnell erledigt</b>
    <div class="pw-schnell"><button class="btn" data-absform="1">${state.absForm ? 'Abwesenheit schließen' : 'Abwesenheit eintragen'}</button><button class="btn" data-pvtab="mitfahrt">Fahrgemeinschaft</button></div>
    ${state.absForm ? `<div class="pt abs-box"><div class="grid" style="gap:6px"><div class="row" style="flex-wrap:nowrap"><label class="fl" for="af-from" style="flex:1">von<input type="date" id="af-from" value="${TODAY}" class="f"></label><label class="fl" for="af-to" style="flex:1">bis<input type="date" id="af-to" value="${TODAY}" class="f"></label></div>
      <label class="fl" for="af-why">Grund<select class="f" id="af-why">${REASONS.map(r=>`<option>${r}</option>`).join('')}</select></label>
      <input type="text" id="af-note" placeholder="Notiz, optional"><button class="btn small" data-abssave="1">Speichern</button>
      <span class="note">Für alle Termine in diesem Zeitraum gilt dann automatisch „nicht dabei“.</span></div></div>` : ''}
    ${meineAbw.length ? `<div class="pt"><b>Deine Abwesenheiten</b>${meineAbw.map(a => `<div class="row between"><span>${fmt(a.from)}${a.to !== a.from ? `–${fmt(a.to)}` : ''} · ${esc(a.why)}</span><button class="ib" data-absdel="${absences.indexOf(a)}" aria-label="Abwesenheit löschen">${ICON.x}</button></div>`).join('')}</div>` : ''}`;""")
rep("  else if (d.pvquick === 'abs') { state.pvTab = 'termine'; state.absForm = true; }", "  else if (d.pvquick === 'abs') { state.absForm = true; }")

# ======================= Fahrgemeinschaft: Treffpunkt und Ziel automatisch =======================
rep("""    return `<div class="pw-fahrt"><b>${gameTitle(g)}</b><span class="note">${wochentag(g.date)} ${fmt(g.date)} · Anstoß ${g.time} · ${esc(g.place || '')}</span>""",
    """    const rg = REAL.games.find(x => x.id === g.id) || {}, plan = planRows(g)[0] || [], ziel = (rg.venue && rg.address && rg.venue.includes(rg.address) ? rg.venue : [rg.venue, rg.address].filter(Boolean).join(', ')) || g.place || '';
    const karte = ziel ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(ziel)}` : '';
    return `<div class="pw-fahrt"><b>${gameTitle(g)}</b><span class="note">${wochentag(g.date)} ${fmt(g.date)} · Anstoß ${g.time}</span>
      <div class="pw-route"><span>🕑 <b>Treffpunkt ${esc(plan[0] || '')}</b> · ${esc(String(plan[1] || REAL.departure || '').replace(/^(Abfahrt|Treffpunkt)\\s*/, ''))}</span><span>📍 <b>Ziel</b> · ${esc(ziel)}${karte ? ` <a href="${karte}" target="_blank" rel="noopener">Karte ›</a>` : ''}</span><span class="note">Fahrzeit etwa ${travelOf(g)} min</span></div>""")
rep("""<input type="text" id="rideab-${g.id}" placeholder="Abfahrt, z. B. 12:45 Schulstraße">""",
    """<input type="text" id="rideab-${g.id}" value="${esc(((planRows(g)[0] || [])[0] || '') + ' ' + String((planRows(g)[0] || [])[1] || REAL.departure || '').replace(/^(Abfahrt|Treffpunkt)\\s*/, ''))}" placeholder="Abfahrt, z. B. 12:45 Schulstraße" aria-label="Abfahrt">""")
rep("""  return `<p class="note" style="margin:0">Für Auswärtsspiele: Wer fährt, bietet Plätze an und nimmt Suchende mit. Das regelt ihr unter euch, das Trainerteam sieht die Übersicht.</p>` +""",
    """  return `<p class="note" style="margin:0">Fahrgemeinschaften zu Auswärtsspielen: Wer fährt, bietet Plätze an und nimmt Suchende mit. Treffpunkt und Ziel kommen aus der Spielvorbereitung.</p>` +""")

# ======================= Dienste: anlegen, Personen ändern, abgeben =======================
# Mitteilungen in der Spielersicht (bis echte Push-Nachrichten kommen)
rep("function pvStart(me) {", """function mitteilen(pid, text) { state.notices = state.notices || []; state.notices.push({ id: 'n' + Date.now() + Math.random().toString(36).slice(2, 6), to: pid, text, at: new Date().toISOString() }); }
function pvStart(me) {
  const neu = (state.notices || []).filter(n => n.to === ME);
  const mitteilungen = neu.map(n => `<div class="pt pw-mitteilung"><span>🔔 ${n.text}</span><button class="btn ghost small" data-noticeok="${n.id}" style="justify-self:start">Okay</button></div>`).join('');""")
rep("""  return `<p style="margin:0">Hallo ${esc(me.name.split(' ')[0])}!</p>""", """  return `<p style="margin:0">Hallo ${esc(me.name.split(' ')[0])}!</p>
    ${mitteilungen}""")
# Eigener Dienst: an jemanden abgeben, der an dem Tag da ist
rep("""function pvMitfahrt(me) {""", """const verfuegbarFuer = d => players.filter(p => p.id !== ME && !d.who.includes(p.id) && !dutyDates(d).some(iso => absentOn(iso).some(a => a.pid === p.id)));
function dienstAbgeben(d) {
  return `<div class="row" style="flex-wrap:nowrap;gap:6px"><select class="f" id="dg-${d.id}" aria-label="Dienst abgeben an"><option value="">Abgeben an …</option>${verfuegbarFuer(d).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select><button class="btn ghost small" data-dutygive="${d.id}">Abgeben</button></div>`;
}
function pvMitfahrt(me) {""")
rep("""      return `<b>Deine Dienste</b>${mine.length?mine.map(d=>`<div class="pt mine"><b>${esc(d.title)}</b><span class="note">${dutyWhen(d)}</span><button class="btn ghost small" data-dutyleave="${d.id}" style="justify-self:start">Austragen</button></div>`).join(''):'<p class="note">Gerade keine.</p>'}""",
    """      return `<b>Deine Dienste</b>${mine.length?mine.map(d=>`<div class="pt mine"><b>${esc(d.title)}</b><span class="note">${dutyWhen(d)}</span><span class="note">Kannst du nicht? Gib den Dienst an jemanden ab, der an dem Tag da ist – er bekommt eine Mitteilung.</span>${dienstAbgeben(d)}<button class="btn ghost small" data-dutyleave="${d.id}" style="justify-self:start">Nur austragen</button></div>`).join(''):'<p class="note">Gerade keine.</p>'}""")
rep("""  const dienstZeile = d => { const ich = d.who.includes(ME), frei = d.slots - d.who.length;
    return `<div class="pw-dienst ${ich ? 'mein' : ''}"><b>${ich ? '★ ' : ''}${esc(d.title.split(' (')[0])}</b><span class="note">${d.who.length ? d.who.map(id => P(id) ? esc(P(id).name.split(' ')[0]) : '').join(', ') : 'noch niemand'}${frei > 0 ? ` · ${frei} frei` : ''}</span>${!ich && frei > 0 ? `<button class="btn ghost small" data-dutyjoin="${d.id}">Ich übernehme</button>` : ''}</div>`; };""",
    """  const dienstZeile = d => { const ich = d.who.includes(ME), frei = d.slots - d.who.length;
    return `<div class="pw-dienst ${ich ? 'mein' : ''}"><b>${ich ? '★ ' : ''}${esc(d.title.split(' (')[0])}</b><span class="note">${d.who.length ? d.who.map(id => P(id) ? esc(P(id).name.split(' ')[0]) : '').join(', ') : 'noch niemand'}${frei > 0 ? ` · ${frei} frei` : ''}</span>${!ich && frei > 0 ? `<button class="btn ghost small" data-dutyjoin="${d.id}">Ich übernehme</button>` : ''}${ich ? `<button class="btn ghost small" data-pvtab="dienste">Abgeben ›</button>` : ''}</div>`; };""")
# Trainer: Dienst anlegen, Personen entfernen, Dienst löschen
rep("""<button class="btn ghost small" data-flash="Dienst anlegen: Titel, Zeitraum oder Event, Anzahl Plätze. Spieler können sich in ihrer Ansicht selbst eintragen.">Dienst anlegen</button></div>""",
    """<button class="btn ghost small" data-dutynew="1">${state.dutyForm ? 'Schließen' : 'Dienst anlegen'}</button></div>
    ${state.dutyForm ? `<div class="pt dienstform"><div class="grid g3">
      <label class="fl" for="dn-title">Dienst<input type="text" id="dn-title" list="dn-vorschlag" placeholder="z. B. Materialdienst (Bälle, Leibchen, Hütchen)"><datalist id="dn-vorschlag"><option>Materialdienst (Bälle, Leibchen, Hütchen)</option><option>Spieltagsdienst (Kasse und Getränke)</option><option>Trikots waschen</option><option>Platz aufbauen</option><option>Fahrdienst</option></datalist></label>
      <label class="fl" for="dn-art">Wann<select class="f" id="dn-art"><option value="zeit">Zeitraum (z. B. eine Woche)</option>${events.filter(e => e.date >= TODAY).slice(0, 30).map(e => `<option value="${e.id}">${fmt(e.date)} ${e.time} · ${e.type === 'gm' ? gameTitle(e) : e.type === 'ev' ? esc(e.title) : 'Training'}</option>`).join('')}</select></label>
      <label class="fl" for="dn-slots">Plätze<input type="number" id="dn-slots" min="1" max="20" value="1" class="f"></label>
      <label class="fl" for="dn-from">von<input type="date" id="dn-from" class="f" value="${MON}"></label>
      <label class="fl" for="dn-to">bis<input type="date" id="dn-to" class="f" value="${addDays(MON, 6)}"></label>
      <label class="fl" for="dn-who">Gleich einteilen (optional)<select class="f" id="dn-who"><option value="">niemand, Spieler tragen sich ein</option>${players.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label></div>
      <div class="row"><button class="btn" data-dutysave="1">Dienst speichern</button><span class="note">Bei „Zeitraum“ gelten „von“ und „bis“; bei einem Termin der Tag des Termins.</span></div></div>` : ''}""")
rep("""<td>${w.map(id=>plink(P(id))).join(', ')||'–'}""", """<td>${w.map(id=>`${plink(P(id))} <button class="ib" data-dutyrm="${d.id}|${id}" title="Austragen" aria-label="Austragen">${ICON.x}</button>`).join(' ')||'–'}""")
rep("""      <td>${open?`<select class="f" data-dutyadd="${d.id}" """, """      <td><button class="ib" data-dutydel="${d.id}" title="Dienst löschen" aria-label="Dienst löschen">${ICON.x}</button>${open?`<select class="f" data-dutyadd="${d.id}" """)
rep("  else if (d.dutyadd) { if (t.value) { duties.find(x=>x.id===d.dutyadd).who.push(t.value); render(); } }",
    "  else if (d.dutyadd) { if (t.value) { const du = duties.find(x=>x.id===d.dutyadd); du.who.push(t.value); mitteilen(t.value, `Dir wurde ein Dienst zugewiesen: <b>${esc(du.title.split(' (')[0])}</b>, ${dutyWhen(du).replace(/\\.$/, '')}.`); render(); } }")
rep("  else if (d.datenladen) { datenLaden(d.datenladen); }", """  else if (d.datenladen) { datenLaden(d.datenladen); }
  else if (d.dutynew) { state.dutyForm = !state.dutyForm; render(); }
  else if (d.dutysave) { const v = id => (document.getElementById(id) || {}).value || '', titel = v('dn-title').trim(); if (!titel) { const i = document.getElementById('dn-title'); i.classList.add('need'); i.focus(); return; }
    const art = v('dn-art'), id = 'dz' + Date.now(), slots = Math.max(1, +v('dn-slots') || 1), wer = v('dn-who');
    const du = art === 'zeit' ? { id, title: titel, from: v('dn-from'), to: v('dn-to') || v('dn-from'), slots, who: [] } : { id, title: titel, ev: art, slots, who: [] };
    if (du.from && du.to < du.from) [du.from, du.to] = [du.to, du.from];
    if (wer) { du.who.push(wer); mitteilen(wer, `Dir wurde ein Dienst zugewiesen: <b>${esc(titel.split(' (')[0])}</b>, ${dutyWhen(du).replace(/\\.$/, '')}.`); }
    duties.push(du); state.dutyForm = false; state.flash = `Dienst „${titel}“ angelegt.`; render(); }
  else if (d.dutyrm) { const [id, pid] = d.dutyrm.split('|'), du = duties.find(x => x.id === id); if (du) du.who = du.who.filter(x => x !== pid); render(); }
  else if (d.dutydel) { const i = duties.findIndex(x => x.id === d.dutydel); if (i >= 0 && confirm(`Dienst „${duties[i].title}“ löschen?`)) { duties.splice(i, 1); render(); } }
  else if (d.dutygive) { const du = duties.find(x => x.id === d.dutygive), an = (document.getElementById('dg-' + d.dutygive) || {}).value; if (!du || !an) return;
    du.who = du.who.map(x => x === ME ? an : x); mitteilen(an, `${esc(P(ME).name)} hat dir einen Dienst übergeben: <b>${esc(du.title.split(' (')[0])}</b>, ${dutyWhen(du).replace(/\\.$/, '')}.`); state.flash = `Dienst an ${P(an).name} übergeben.`; render(); }
  else if (d.noticeok) { state.notices = (state.notices || []).filter(n => n.id !== d.noticeok); render(); }""")

rep("</style>\n</head>", """.pw-schnell { display: grid !important; grid-template-columns: 1fr 1fr; gap: 8px; }
.pw-schnell .btn { width: 100%; justify-content: center; text-align: center; min-height: 44px; }
.pw-ev { grid-template-columns: 42px minmax(0, 1fr) !important; }
.pw-ev > .pill { grid-column: 2; justify-self: start; }
.pw-ant { grid-column: 2; display: inline-flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-start; }
.pw-ant .btn { padding: 2px 8px; }
.pw-absage { display: grid; gap: 6px; padding: 6px 0 4px 48px; }
.pw-spaet { padding-left: 48px; }
.pw-route { display: grid; gap: 2px; font-size: 14px; border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; }
.pw-mitteilung { border-color: var(--accent) !important; }
.dienstform { margin: 8px 0; }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
