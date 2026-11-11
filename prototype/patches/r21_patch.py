import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

PLUS = '<button class="addev" data-addev="${iso}" title="Termin am ${fmt(iso)} anlegen" aria-label="Termin am ${fmt(iso)} anlegen">+</button>'
# Plus an jedem Tag: Kalender Woche, Monat, Wochenleiste im Dashboard
rep('<div class="day ${iso===TODAY?\'today\':\'\'}"><div class="dh"><b>${WD[dt(iso).getDay()]}</b><span class="num">${fmt(iso)}</span></div>',
    '<div class="day ${iso===TODAY?\'today\':\'\'}"><div class="dh"><b>${WD[dt(iso).getDay()]}</b><span class="row" style="gap:4px;flex-wrap:nowrap"><span class="num">${fmt(iso)}</span>' + PLUS + '</span></div>')
rep('<div class="mday ${iso.slice(5,7)!==\'11\'?\'out\':\'\'} ${iso===TODAY?\'today\':\'\'}"><span class="num">${+iso.slice(8)}</span>',
    '<div class="mday ${iso.slice(5,7)!==\'11\'?\'out\':\'\'} ${iso===TODAY?\'today\':\'\'}"><span class="mh2"><span class="num">${+iso.slice(8)}</span>' + PLUS + '</span>')
rep('<div class="sday rest ${iso===TODAY?\'today\':\'\'}"><b>${WD[dt(iso).getDay()]}</b><span class="note num">${fmt(iso)}</span></div>',
    '<div class="sday rest ${iso===TODAY?\'today\':\'\'}"><b>${WD[dt(iso).getDay()]}</b><span class="note num">${fmt(iso)}</span>' + PLUS + '</div>')
rep('<div class="sday ${iso===TODAY?\'today\':\'\'}"><b>${WD[dt(iso).getDay()]} ${fmt(iso)}</b>',
    '<div class="sday ${iso===TODAY?\'today\':\'\'}"><span class="row between" style="flex-wrap:nowrap"><b>${WD[dt(iso).getDay()]} ${fmt(iso)}</b>' + PLUS + '</span>')
rep('<button class="btn ghost small" data-flash="Event anlegen: Titel, Datum, Ort und optional Dienste mit Anzahl der Plätze. Im Entwurf ohne Funktion.">Event anlegen</button>',
    '<button class="btn ghost small" data-addev="${TODAY}">Termin anlegen</button>')

# Formular als Dialog über der Seite
rep("function vUebung() {", r"""const EVKINDS = ['Hallenturnier','Abteilungsveranstaltung','Mannschaftsabend','Arbeitseinsatz','Testspiel','Sonstiges'];
function evDialog() {
  const f = state.evForm; if (!f) return '';
  return `<div class="modal-bg" data-evclose="1"></div><div class="modal" role="dialog" aria-modal="true" aria-labelledby="evd-h">
    <div class="row between"><h2 id="evd-h">Termin anlegen</h2><button class="ib" data-evclose="1" aria-label="Schließen">${ICON.x}</button></div>
    <div class="grid g2">
      <label class="fl" for="evf-kind">Art<select class="f" id="evf-kind" data-evf="kind">${EVKINDS.map(k=>`<option ${f.kind===k?'selected':''}>${k}</option>`).join('')}</select></label>
      <label class="fl" for="evf-title">Titel *<input type="text" id="evf-title" data-evf="title" value="${esc(f.title)}" placeholder="z. B. Hallenturnier Baunatal"></label>
      <label class="fl" for="evf-date">Datum<input type="date" class="f" id="evf-date" data-evf="date" value="${f.date}"></label>
      <div class="row" style="flex-wrap:nowrap;align-items:end"><label class="fl" for="evf-time" style="flex:1">Beginn<input type="text" inputmode="numeric" class="f" id="evf-time" data-evf="time" value="${esc(f.time)}"></label><label class="fl" for="evf-end" style="flex:1">Ende<input type="text" inputmode="numeric" class="f" id="evf-end" data-evf="end" value="${esc(f.end)}" placeholder="optional"></label></div>
      <label class="fl" for="evf-place">Ort<input type="text" id="evf-place" data-evf="place" value="${esc(f.place)}" placeholder="z. B. Sporthalle, Adresse"></label>
      <label class="fl" for="evf-note">Hinweis für die Spieler<input type="text" id="evf-note" data-evf="note" value="${esc(f.note)}" placeholder="z. B. Hallenschuhe mitbringen"></label>
    </div>
    <label class="row" for="evf-rsvp"><input type="checkbox" id="evf-rsvp" data-evf="rsvp" ${f.rsvp?'checked':''}> Spieler sollen zu- oder absagen</label>
    <div class="tb"><div class="tbh"><span>Dienste <span class="note">optional, zum Beispiel Kuchen, Aufbau, Fahrer</span></span><button class="btn ghost small" data-evduty="1">Dienst hinzufügen</button></div>
      ${f.duties.map((d,i)=>`<div class="row" style="flex-wrap:nowrap"><input type="text" data-evd="${i}" data-k="title" value="${esc(d.title)}" placeholder="Dienst" aria-label="Dienst"><input type="number" min="1" class="f" data-evd="${i}" data-k="slots" value="${d.slots}" style="width:80px" aria-label="Plätze"><span class="note">Plätze</span><button class="ib" data-evdutydel="${i}" aria-label="Dienst entfernen">${ICON.x}</button></div>`).join('')}</div>
    <div class="row"><button class="btn" data-evsave="1">Termin speichern</button><button class="btn ghost" data-evclose="1">Abbrechen</button></div>
  </div>`;
}
function vUebung() {""")
rep("  lastView = k; nav(k); document.getElementById('main').innerHTML = R[k]();", "  lastView = k; nav(k); document.getElementById('main').innerHTML = R[k]() + evDialog();\n  if (state.evFocus) { state.evFocus = false; const t = document.getElementById('evf-title'); if (t) t.focus(); }")
rep("  else if (d.more) {", r"""  else if (d.addev) { state.evForm = {date: d.addev, kind: 'Hallenturnier', title: '', time: '10:00', end: '', place: '', note: '', rsvp: true, duties: []}; state.evFocus = true; render(); }
  else if (d.evclose) { state.evForm = null; render(); }
  else if (d.evduty) { state.evForm.duties.push({title: '', slots: 1}); render(); }
  else if (d.evdutydel) { state.evForm.duties.splice(+d.evdutydel, 1); render(); }
  else if (d.evsave) { const f = state.evForm;
    if (!f.title.trim()) { const el = document.getElementById('evf-title'); el.classList.add('need'); el.focus(); return; }
    const id = 'v' + Date.now();
    events.push({id, date: f.date, type: 'ev', time: f.time || '00:00', end: f.end, title: f.title.trim(), kind: f.kind, place: f.place || 'noch offen', note: f.note, rsvp: f.rsvp});
    f.duties.filter(x=>x.title.trim()).forEach((x,i)=>duties.push({id: id+'d'+i, title: x.title.trim(), ev: id, slots: +x.slots || 1, who: []}));
    state.evForm = null; state.showEv = true; state.flash = `„${f.title.trim()}“ am ${fmt(f.date)} angelegt.${f.rsvp ? ' Die Spieler sehen den Termin und können zu- oder absagen.' : ''}`; render(); }
  else if (d.more) {""")
rep("document.addEventListener('input', e => {", "document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.evf && e.target.type !== 'checkbox') { state.evForm[e.target.dataset.evf] = e.target.value; return; } if (e.target.dataset && e.target.dataset.evd) { const x = state.evForm.duties[+e.target.dataset.evd]; x[e.target.dataset.k] = e.target.dataset.k==='slots' ? +e.target.value : e.target.value; return; }")
rep("  else if (d.comp) {", "  else if (d.evf) { state.evForm[d.evf] = t.type==='checkbox' ? t.checked : t.value; }\n  else if (d.comp) {")
rep("document.addEventListener('keydown', e => {", "document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.evForm) { state.evForm = null; render(); return; }")
# Event-Blöcke zeigen die Art
rep("function evBlock(e) {\n  return `<div class=\"ev xv\"><span class=\"t\">${e.time} ${esc(e.title)}</span>", "function evBlock(e) {\n  return `<div class=\"ev xv\"><span class=\"t\">${e.time}${e.end?'–'+e.end:''} ${esc(e.title)}</span>${e.kind?`<span class=\"note\">${esc(e.kind)}</span>`:''}")
# Spieltag-Übersicht und Dashboard zeigen den Hinweis nach dem Speichern
rep("  ${weekStrip('2026-11-09')}\n  <div class=\"dgrid\">", "  ${weekStrip('2026-11-09')}\n  ${flashBox()}\n  <div class=\"dgrid\">")
rep("/* ---- Masken ---- */", """/* ---- Termin anlegen ---- */
.addev { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--line); background: var(--panel); color: var(--accent); font: 700 15px/1 var(--body); cursor: pointer; padding: 0; display: inline-grid; place-items: center; flex: none; }
.addev:hover, .addev:focus-visible { background: var(--accent); color: #fff; border-color: var(--accent); }
.mh2 { display: flex; justify-content: space-between; align-items: center; }
.mday .addev { width: 18px; height: 18px; font-size: 13px; opacity: .55; } .mday:hover .addev { opacity: 1; }
.sday.rest .addev { margin-top: 6px; }
.modal-bg { position: fixed; inset: 0; background: rgba(10, 20, 15, .45); z-index: 20; }
.modal { position: fixed; z-index: 21; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(720px, calc(100vw - 24px)); max-height: calc(100vh - 32px); overflow: auto; background: var(--panel); border-radius: 14px; padding: 20px; display: grid; gap: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
.modal h2 { margin: 0; }
/* ---- Masken ---- */""")
rep("[data-ksort], [data-nuadd]'); if (!t) return;", "[data-ksort], [data-nuadd], [data-evclose]'); if (!t) return;")
open(p, 'w').write(s); print('ok')
