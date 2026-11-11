import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Zu- und Absagen durch das Trainerteam (Anruf, SMS, WhatsApp) ----
rep("""function attendance(e) {
  const out = new Map(absentOn(e.date).map(a=>[a.pid, a.why]));
  const yes = [], no = [], none = [];
  players.forEach(p => { if (out.has(p.id)) no.push([p, out.get(p.id)]); else if (state.reply[e.id]==='ja' && p.id===ME) yes.push(p); else none.push(p); });
  return {yes, no, none};
}""", """/** Eintrag des Trainerteams für einen Termin: {s:'ja'|'nein', why}. Geht vor Abwesenheiten. */
const attEntry = (eid, pid) => ((state.att || {})[eid] || {})[pid];
function attendance(e) {
  const out = new Map(absentOn(e.date).map(a=>[a.pid, a.why]));
  const yes = [], no = [], none = [];
  players.forEach(p => {
    const t = attEntry(e.id, p.id);
    if (t && t.s === 'ja') yes.push(p);
    else if (t && t.s === 'nein') no.push([p, t.why || 'ohne Angabe', true]);
    else if (out.has(p.id)) no.push([p, out.get(p.id), false]);
    else if (state.reply[e.id]==='ja' && p.id===ME) yes.push(p);
    else none.push(p);
  });
  return {yes, no, none};
}
function attCard(e, a, pName) {
  const btn = (p, v, label) => `<button class="attb ${v==='ja'?'yes':'no'} ${(attEntry(e.id,p.id)||{}).s===v?'on':''}" data-att="${e.id}|${p.id}|${v}" title="${label}" aria-label="${label}: ${esc(p.name)}">${v==='ja'?'✓':'✕'}</button>`;
  const row = (p, extra='') => `<li><span class="attn">${pName(p)}${extra}</span><span class="attbtns">${btn(p,'ja','Zusage')}${btn(p,'nein','Absage')}</span></li>`;
  const why = (p, w) => ` <select class="attwhy" data-attwhy="${e.id}|${p.id}" aria-label="Grund der Absage">${['ohne Angabe', ...REASONS].map(r=>`<option ${r===w?'selected':''}>${r}</option>`).join('')}</select>`;
  return `<div class="card"><div class="row between"><h3>Teilnahme</h3>${availPill(e.date,'tr')}</div>
        <p class="note" style="margin:0">Zu- oder Absage per Anruf, SMS oder WhatsApp? Hier eintragen: ✓ dabei, ✕ nicht dabei. Nochmal tippen nimmt es zurück.</p>
        <div class="att"><div><h4>Zugesagt (${a.yes.length})</h4><ul>${a.yes.map(p=>row(p)).join('')}</ul></div>
          <div><h4>Abgesagt (${a.no.length})</h4><ul>${a.no.map(([p,w,mine])=>row(p, mine ? why(p, w) : ` <span class="note">· ${esc(w)} (Abwesenheit)</span>`)).join('')}</ul></div>
          <div><h4>Keine Antwort (${a.none.length})</h4><ul>${a.none.map(p=>row(p)).join('')}</ul>${a.none.length ? `<button class="btn ghost small" data-attall="${e.id}">Alle ohne Antwort zusagen</button>` : ''}</div></div></div>`;
}""")

i = s.index('<div class="card"><div class="row between"><h3>Teilnahme</h3>${availPill(e.date,\'tr\')}</div>', s.index('function vEinheit() {'))
j = s.index('ihre Links haben.</p></div>', i) + len('ihre Links haben.</p></div>')
s = s[:i] + '${attCard(e, a, pName)}' + s[j:]

# Verfügbarkeit (TW x/y · Feld x/y) berücksichtigt die Einträge des Trainerteams
rep("""function counts(iso) {
  const out = new Set(absentOn(iso).map(a=>a.pid));""", """function counts(iso) {
  const out = new Set(absentOn(iso).map(a=>a.pid));
  for (const ev of events.filter(x=>x.date===iso)) for (const [pid, t] of Object.entries((state.att || {})[ev.id] || {})) { if (t.s === 'nein') out.add(pid); else if (t.s === 'ja') out.delete(pid); }""")

rep("""window.addEventListener('hashchange', render);
render();""", """// Zu- und Absagen eintragen
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-att],[data-attall]');
  if (!b) return;
  state.att = state.att || {};
  if (b.dataset.attall) {
    const e = EV(b.dataset.attall), m = state.att[e.id] = state.att[e.id] || {};
    attendance(e).none.forEach(p => { m[p.id] = {s:'ja'}; });
  } else {
    const [eid, pid, v] = b.dataset.att.split('|'), m = state.att[eid] = state.att[eid] || {};
    if (m[pid] && m[pid].s === v) delete m[pid]; else m[pid] = v === 'nein' ? {s:'nein', why:'ohne Angabe'} : {s:'ja'};
  }
  render();
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (!t.dataset || !t.dataset.attwhy) return;
  const [eid, pid] = t.dataset.attwhy.split('|');
  if (((state.att || {})[eid] || {})[pid]) { state.att[eid][pid].why = t.value; render(); }
});
window.addEventListener('hashchange', render);
render();""")

# ---- Formularelemente im Stil der App statt Systemoptik ----
rep("</style>\n</head>", """/* ---- Teilnahme ---- */
.att li { justify-content: space-between; }
.attn { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0; }
.attbtns { display: flex; gap: 4px; flex: none; }
.attb { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--line); background: transparent; color: var(--muted); cursor: pointer; font-size: 14px; line-height: 1; display: inline-grid; place-items: center; padding: 0; transition: background .15s, border-color .15s, color .15s; }
.attb.yes:hover { border-color: var(--accent); color: var(--accent); }
.attb.no:hover { border-color: var(--game); color: var(--game); }
.attb.yes.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.attb.no.on { background: var(--game); border-color: var(--game); color: #fff; }
/* ---- Auswahlfelder, Eingaben, Häkchen ---- */
select {
  -webkit-appearance: none; appearance: none;
  background-color: var(--panel) !important;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%239baba3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 8l5 5 5-5'/%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important; background-position: right 10px center !important; background-size: 16px !important;
  border: 1px solid var(--line) !important; border-radius: 8px !important;
  padding: 8px 12px; padding-right: 34px !important;
  color: var(--ink); font: inherit; line-height: 1.3; cursor: pointer;
  transition: border-color .15s, box-shadow .15s;
}
select:hover { border-color: var(--muted) !important; }
select:focus, select:focus-visible { outline: none; border-color: var(--accent) !important; box-shadow: 0 0 0 3px var(--accent-soft); }
select option, select optgroup { background: var(--panel); color: var(--ink); }
select.need { border-color: var(--game) !important; box-shadow: 0 0 0 2px var(--game-soft); }
select.attwhy { width: auto; font-size: 13px; padding: 3px 8px; padding-right: 26px !important; background-position: right 7px center !important; background-size: 13px !important; }
input[type="text"], input[type="date"], input[type="time"], input[type="number"], input[type="search"], input[type="email"], textarea { border-radius: 8px !important; transition: border-color .15s, box-shadow .15s; }
input[type="text"]:focus, input[type="date"]:focus, input[type="time"]:focus, input[type="number"]:focus, input[type="search"]:focus, input[type="email"]:focus, textarea:focus { outline: none; border-color: var(--accent) !important; box-shadow: 0 0 0 3px var(--accent-soft); }
input[type="checkbox"], input[type="radio"] { accent-color: var(--accent); }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
