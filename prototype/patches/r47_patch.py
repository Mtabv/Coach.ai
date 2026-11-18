import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Spielersicht: Start mit Wochenkalender, Diensten, Schnelleinstieg; Mitfahrten ----
rep("""  const tabs = [['termine','Termine',true],['dienste','Dienste',true],""",
    """  if (!state.pvNow || state.pvNow.slice(0, 10) < TODAY) state.pvNow = `${TODAY}T${new Date().toTimeString().slice(0, 5)}`;
  const tabs = [['start','Start',true],['termine','Termine',true],['mitfahrt','Mitfahrten',true],['dienste','Dienste',true],""")
rep("  if (!tabs.find(t=>t[0]===state.pvTab)) state.pvTab = 'termine';", "  if (!tabs.find(t=>t[0]===state.pvTab)) state.pvTab = 'start';")
rep("""  const body = {
    termine: () => {""", """  const body = {
    start: () => pvStart(me),
    mitfahrt: () => pvMitfahrt(me),
    termine: () => {""")
# Vorschau: Spieler wählen, Zeitpunkt = jetzt
rep("""  <div class="row"><label class="row note" for="pvnow">Vorschau-Zeitpunkt <select class="f" id="pvnow" style="width:auto"><option value="2026-11-11T11:00" ${state.pvNow==='2026-11-11T11:00'?'selected':''}>Mi 11.11., 11:00 Uhr (heute)</option><option value="2026-11-12T15:00" ${state.pvNow==='2026-11-12T15:00'?'selected':''}>Do 12.11., 15:00 Uhr (nach der Frist fürs Training)</option></select></label></div>""",
    """  <div class="row"><label class="row note" for="pvme">Vorschau als <select class="f" id="pvme" style="width:auto">${players.map(x => `<option value="${x.id}" ${x.id === ME ? 'selected' : ''}>${esc(x.name)} (${x.pos})</option>`).join('')}</select></label>
    <span class="note">Alles, was du hier als Spieler tust (Absage, Dienst, Mitfahrt), wird wirklich gespeichert – zum Ausprobieren danach wieder zurücknehmen.</span></div>""")
rep("let ME = 'p12';", """let ME = 'p12';
document.addEventListener('change', ev => { const t = ev.target; if (t && t.id === 'pvme') { ME = t.value; state.pvMe = ME; render(); } });
const dienstOk = d => !d.ev || !!EV(d.ev);
const wochentag = iso => ['So','Mo','Di','Mi','Do','Fr','Sa'][dt(iso).getDay()];
/** Start der Spielersicht: diese Woche als Kalender, Dienste, Schnelleinstieg. */
function pvStart(me) {
  const woche = state.pvWoche || 0, mo = addDays(MON, 7 * woche), tage = [0,1,2,3,4,5,6].map(i => addDays(mo, i)), so = tage[6];
  const ganzeWoche = duties.filter(d => dienstOk(d) && !d.ev && d.from <= so && d.to >= mo);
  const status = e => { const r = state.reply[e.id], abw = absences.find(a => a.pid === ME && a.from <= e.date && e.date <= a.to);
    return abw || r === 'nein' ? `<span class="pill grey">nicht dabei</span>` : e.date < TODAY ? '' : `<span class="pill ok">dabei</span>`; };
  const dienstZeile = d => { const ich = d.who.includes(ME), frei = d.slots - d.who.length;
    return `<div class="pw-dienst ${ich ? 'mein' : ''}"><b>${ich ? '★ ' : ''}${esc(d.title.split(' (')[0])}</b><span class="note">${d.who.length ? d.who.map(id => P(id) ? esc(P(id).name.split(' ')[0]) : '').join(', ') : 'noch niemand'}${frei > 0 ? ` · ${frei} frei` : ''}</span>${!ich && frei > 0 ? `<button class="btn ghost small" data-dutyjoin="${d.id}">Ich übernehme</button>` : ''}</div>`; };
  const fahrt = naechsteAuswaerts()[0], fs = fahrt ? fahrtStatus(fahrt) : '';
  return `<p style="margin:0">Hallo ${esc(me.name.split(' ')[0])}!</p>
    ${fs ? `<button type="button" class="pt pw-hinweis" data-pvtab="mitfahrt"><span>${fs} ›</span></button>` : ''}
    <div class="pw-kopf"><button class="ib" data-pvwoche="-1" aria-label="Vorige Woche">‹</button><b>${woche === 0 ? 'Diese Woche' : woche === 1 ? 'Nächste Woche' : 'KW ' + KW(mo)} · ${fmt(mo)}–${fmt(so)}</b><button class="ib" data-pvwoche="1" aria-label="Nächste Woche">›</button></div>
    ${ganzeWoche.map(d => `<div class="pw-ganz">${dienstZeile(d)}<span class="note">die ganze Woche</span></div>`).join('')}
    <div class="pw-tage">${tage.map(iso => {
      const evs = events.filter(e => e.date === iso && (e.type !== 'ev' || e.rsvp !== false)).sort((a, b) => a.time.localeCompare(b.time));
      const ds = duties.filter(d => dienstOk(d) && d.ev && EV(d.ev).date === iso);
      return `<div class="pw-tag ${iso === TODAY ? 'heute' : ''} ${evs.length || ds.length ? '' : 'leer'}"><div class="pw-datum"><b>${wochentag(iso)}</b><span class="note">${fmt(iso)}</span></div><div class="pw-eintraege">
        ${evs.map(e => `<div class="pw-ev t-${e.type}"><span class="pw-zeit">${e.time}</span><span>${e.type === 'gm' ? gameTitle(e) : e.type === 'ev' ? esc(e.title) : 'Training'}<span class="note"> · ${esc(String(e.place || '').replace('Sportplatz ', ''))}</span></span>${status(e)}</div>`).join('')}
        ${ds.map(dienstZeile).join('')}
        ${!evs.length && !ds.length ? '<span class="note">frei</span>' : ''}</div></div>`; }).join('')}</div>
    <b>Schnell erledigt</b>
    <div class="pw-schnell"><button class="btn" data-pvquick="abs">Abwesenheit eintragen</button>${fahrt ? `<button class="btn ghost" data-pvtab="mitfahrt">Mitfahrt ${fahrt.home ? '' : 'zum Auswärtsspiel'}</button>` : ''}</div>`;
}
// ---- Mitfahrten zu Auswärtsspielen: Fahrer bieten Plätze an, Suchende werden zugeordnet ----
const naechsteAuswaerts = () => games().filter(g => !g.home && !gespielt(g) && g.date >= TODAY).slice(0, 2);
const fahrten = gid => { state.rides = state.rides || {}; return state.rides[gid] = state.rides[gid] || { fahrer: [], suche: [] }; };
const fahrerVon = (gid, pid) => fahrten(gid).fahrer.find(f => f.pid === pid);
const mitWem = (gid, pid) => fahrten(gid).fahrer.find(f => f.mit.includes(pid));
function fahrtStatus(g) {
  const f = fahrerVon(g.id, ME), m = mitWem(g.id, ME), s = fahrten(g.id).suche.includes(ME);
  if (f) return `🚗 Du fährst zum Spiel bei ${esc(g.opp)} · ${f.mit.length} von ${f.plaetze} Plätzen belegt`;
  if (m) return `✓ Mitfahrt organisiert: Du fährst bei <b>${esc(P(m.pid).name)}</b> mit (${esc(g.opp)}, ${fmt(g.date)})`;
  if (s) return `Du suchst noch eine Mitfahrt zum Spiel bei ${esc(g.opp)}`;
  return '';
}
function pvMitfahrt(me) {
  const liste = naechsteAuswaerts();
  if (!liste.length) return '<p class="note">Gerade steht kein Auswärtsspiel an.</p>';
  return `<p class="note" style="margin:0">Für Auswärtsspiele: Wer fährt, bietet Plätze an und nimmt Suchende mit. Das regelt ihr unter euch, das Trainerteam sieht die Übersicht.</p>` + liste.map(g => {
    const F = fahrten(g.id), ich = fahrerVon(g.id, ME), mit = mitWem(g.id, ME), suche = F.suche.includes(ME);
    const offen = F.suche.filter(pid => !mitWem(g.id, pid));
    const frei = F.fahrer.reduce((a, f) => a + f.plaetze - f.mit.length, 0);
    let meins;
    if (ich) meins = `<div class="pt mein"><b>🚗 Du fährst · ${ich.plaetze} ${ich.plaetze === 1 ? 'Platz' : 'Plätze'}</b>${ich.ab ? `<span class="note">Abfahrt: ${esc(ich.ab)}</span>` : ''}
        ${ich.mit.map(pid => `<div class="row between"><span>✓ ${esc(P(pid).name)}</span><button class="ib" data-ridedrop="${g.id}|${pid}" aria-label="Mitfahrer entfernen">${ICON.x}</button></div>`).join('') || '<span class="note">Noch niemand dabei.</span>'}
        ${ich.mit.length < ich.plaetze && offen.length ? `<div class="row" style="flex-wrap:nowrap"><select class="f" id="ridepick-${g.id}">${offen.map(pid => `<option value="${pid}">${esc(P(pid).name)}</option>`).join('')}</select><button class="btn small" data-ridetake="${g.id}">Mitnehmen</button></div>` : ich.mit.length < ich.plaetze ? '<span class="note">Gerade sucht niemand.</span>' : '<span class="note">Auto voll.</span>'}
        <button class="btn ghost small" data-rideoff="${g.id}" style="justify-self:start">Angebot zurückziehen</button></div>`;
    else if (mit) meins = `<div class="pt mein"><b>✓ Du fährst bei ${esc(P(mit.pid).name)} mit</b>${mit.ab ? `<span class="note">Abfahrt: ${esc(mit.ab)}</span>` : ''}<button class="btn ghost small" data-rideleave="${g.id}" style="justify-self:start">Doch nicht</button></div>`;
    else if (suche) meins = `<div class="pt"><b>Du suchst eine Mitfahrt</b><span class="note">${frei ? `Es gibt ${frei} freie Plätze – ein Fahrer nimmt dich auf.` : 'Noch kein freier Platz angeboten.'}</span><button class="btn ghost small" data-rideleave="${g.id}" style="justify-self:start">Suche zurückziehen</button></div>`;
    else meins = `<div class="pt"><div class="row" style="flex-wrap:nowrap;gap:6px"><select class="f" id="rideseats-${g.id}" aria-label="Freie Plätze" style="width:auto">${[1,2,3,4,5,6].map(n => `<option value="${n}" ${n === 3 ? 'selected' : ''}>${n} ${n === 1 ? 'Platz' : 'Plätze'}</option>`).join('')}</select><input type="text" id="rideab-${g.id}" placeholder="Abfahrt, z. B. 12:45 Schulstraße"></div>
        <div class="row"><button class="btn small" data-rideoffer="${g.id}">Mitfahrt anbieten</button><button class="btn ghost small" data-rideseek="${g.id}">Mitfahrt gesucht</button></div></div>`;
    return `<div class="pw-fahrt"><b>${gameTitle(g)}</b><span class="note">${wochentag(g.date)} ${fmt(g.date)} · Anstoß ${g.time} · ${esc(g.place || '')}</span>
      ${meins}
      <span class="note">${F.fahrer.length} ${F.fahrer.length === 1 ? 'Fahrer' : 'Fahrer'} · ${frei} freie Plätze · ${offen.length} suchen noch${offen.length ? ': ' + offen.map(pid => esc(P(pid).name.split(' ')[0])).join(', ') : ''}</span></div>`;
  }).join('');
}
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-pvwoche],[data-pvquick],[data-rideoffer],[data-rideseek],[data-ridetake],[data-ridedrop],[data-rideoff],[data-rideleave]'); if (!b) return;
  const d = b.dataset;
  if (d.pvwoche) state.pvWoche = (state.pvWoche || 0) + (+d.pvwoche);
  else if (d.pvquick === 'abs') { state.pvTab = 'termine'; state.absForm = true; }
  else if (d.rideoffer) { const F = fahrten(d.rideoffer); F.suche = F.suche.filter(x => x !== ME); if (!fahrerVon(d.rideoffer, ME)) F.fahrer.push({ pid: ME, plaetze: +document.getElementById('rideseats-' + d.rideoffer).value || 1, ab: (document.getElementById('rideab-' + d.rideoffer) || {}).value || '', mit: [] }); }
  else if (d.rideseek) { const F = fahrten(d.rideseek); if (!F.suche.includes(ME)) F.suche.push(ME); }
  else if (d.ridetake) { const f = fahrerVon(d.ridetake, ME), sel = document.getElementById('ridepick-' + d.ridetake); if (f && sel && sel.value && f.mit.length < f.plaetze) f.mit.push(sel.value); }
  else if (d.ridedrop) { const [gid, pid] = d.ridedrop.split('|'), f = fahrerVon(gid, ME); if (f) f.mit = f.mit.filter(x => x !== pid); }
  else if (d.rideoff) { const F = fahrten(d.rideoff); F.fahrer = F.fahrer.filter(f => f.pid !== ME); }
  else if (d.rideleave) { const F = fahrten(d.rideleave); F.suche = F.suche.filter(x => x !== ME); F.fahrer.forEach(f => { f.mit = f.mit.filter(x => x !== ME); }); }
  render();
});""")
# Spieler der Vorschau bleibt beim Neuzeichnen erhalten
rep("state.anaPlayer = top.id; ME = top.id;", "state.anaPlayer = top.id; ME = (state.pvMe && P(state.pvMe) && !P(state.pvMe).gruppe) ? state.pvMe : top.id;")
# Dienste-Reiter: Dienste mit gelöschten Terminen nicht anzeigen (sonst Fehler)
rep("const dutiesOn = iso => duties.filter(d => d.ev ? events.find(e=>e.id===d.ev).date===iso :",
    "const dutiesOn = iso => duties.filter(d => d.ev ? (EV(d.ev) || {}).date===iso :")
rep("const dutyWhen = d => d.ev ? (()=>{const e=events.find(x=>x.id===d.ev);", "const dutyWhen = d => d.ev ? (()=>{const e=events.find(x=>x.id===d.ev); if (!e) return 'Termin entfällt';")

rep("</style>\n</head>", """.pw-kopf { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
.pw-ganz { border: 1px dashed var(--accent); border-radius: 10px; padding: 6px 8px; display: grid; gap: 2px; }
.pw-tage { display: grid; gap: 4px; }
.pw-tag { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 8px; padding: 6px 0; border-top: 1px solid var(--line); }
.pw-tag.heute .pw-datum b { color: var(--accent); }
.pw-tag.leer { opacity: .6; }
.pw-datum { display: grid; line-height: 1.2; }
.pw-eintraege { display: grid; gap: 4px; min-width: 0; }
.pw-ev { display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; gap: 6px; align-items: center; font-size: 14px; }
.pw-ev.t-gm { color: var(--game); } .pw-ev.t-tr .pw-zeit { color: var(--tr); }
.pw-zeit { font-variant-numeric: tabular-nums; font-weight: 600; }
.pw-dienst { display: grid; gap: 2px; font-size: 13px; } .pw-dienst.mein b { color: var(--accent); }
.pw-dienst .btn { justify-self: start; }
.pw-schnell { display: flex; flex-wrap: wrap; gap: 8px; }
.pw-hinweis { cursor: pointer; border-color: var(--accent) !important; text-align: left; font: inherit; color: inherit; width: 100%; }
.pw-fahrt { display: grid; gap: 6px; padding: 8px 0; border-top: 1px solid var(--line); }
.pt.mein { border-color: var(--accent) !important; }
.pill.ok { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
