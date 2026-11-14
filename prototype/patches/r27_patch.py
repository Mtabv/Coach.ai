import sys
from datetime import datetime
from zoneinfo import ZoneInfo
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Heute statt fest 11.11.2026: Woche, Kalender, nächstes Spiel und Training richten sich nach dem echten Datum ----
JETZT = datetime.now(ZoneInfo('Europe/Berlin'))
STAND = JETZT.strftime('%d.%m.%Y')
rep("const TODAY = '2026-11-11';", """const TODAY = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
const plusDays = (iso, n) => { const d = new Date(iso+'T12:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
const mondayOf = iso => { const d = new Date(iso+'T12:00:00'); return plusDays(iso, -((d.getDay()+6)%7)); };
const MON = mondayOf(TODAY);
/** Kalenderwoche nach ISO 8601 */
const KW = iso => { const d = new Date(iso+'T12:00:00'); d.setDate(d.getDate()+3-((d.getDay()+6)%7)); const y = new Date(d.getFullYear(),0,4,12); return 1+Math.round(((d-y)/864e5-3+((y.getDay()+6)%7))/7); };
const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
/** Stand der Daten von fussball.de und FuPa (Tag des Abrufs) */
const STAND = '""" + STAND + """';
/** Zeitpunkt des Abrufs, für die Anzeige „Daten von …“ */
const STAND_ISO = '""" + JETZT.isoformat(timespec='minutes') + """';""")
rep("weekStart:'2026-11-09'", "weekStart:MON")

# Trainings nach Rhythmus: sechs Wochen zurück, drei Monate voraus
rep("""  for (let d = new Date('2026-10-12T12:00:00'); d <= new Date('2026-12-06T12:00:00'); d.setDate(d.getDate()+1)) {
    const iso = d.toISOString().slice(0,10), r = settings.rhythm.find(x=>x.wd===d.getDay());
    if (r && !gd.has(iso))""", """  for (let d = new Date(plusDays(MON,-42)+'T12:00:00'); d <= new Date(plusDays(MON,91)+'T12:00:00'); d.setDate(d.getDate()+1)) {
    const iso = d.toISOString().slice(0,10), r = settings.rhythm.find(x=>x.wd===d.getDay());
    if (r && !gd.has(iso))""")
# Nächstes Spiel ab heute
rep("  // Termine: Spiele von fussball.de, Trainings nach Rhythmus\n", "  { const n = REAL.games.find(g=>!g.res && g.date>=TODAY); if (n) REAL.next = n.id; }\n  // Termine: Spiele von fussball.de, Trainings nach Rhythmus\n")
rep("state.trainEv = 'e2026-11-13';", "state.trainEv = (nextTrainings(1)[0] || trainings().slice(-1)[0] || {}).id;")
rep("{id:'t1', text:`Gegnervorbereitung ${nx.opp} (So ${fmt(nx.date)})`", "{id:'t1', text:`Gegnervorbereitung ${nx.opp} (${WD[dt(nx.date).getDay()]} ${fmt(nx.date)})`")
rep("{id:'t4', text:'Einheiten für Di 10.11. und Fr 13.11. eintragen', href:'#training'}", "{id:'t4', text:`Einheiten für ${nextTrainings(2).map(t=>`${WD[dt(t.date).getDay()]} ${fmt(t.date)}`).join(' und ')} eintragen`, href:'#training'}")

# Dashboard
rep("const wk = trainings().filter(t=>t.date>='2026-11-09' && t.date<='2026-11-22' && t.date>=TODAY);", "const wk = trainings().filter(t=>t.date>=MON && t.date<=plusDays(MON,13) && t.date>=TODAY);")
rep("<p>KW 46 · 09.11. bis 15.11.2026 · Schwerpunkt", "<p>KW ${KW(TODAY)} · ${fmt(MON)} bis ${fmt(plusDays(MON,6))}${plusDays(MON,6).slice(0,4)} · Schwerpunkt")
rep("${weekStrip('2026-11-09')}", "${weekStrip(MON)}")

# Training › Aktuell
rep("Schwerpunkt für die Woche · KW 46 · aus der Beispiel-Periodisierung", "Schwerpunkt für die Woche · KW ${KW(TODAY)} · aus der Beispiel-Periodisierung")
rep("laut Periodisierung, Woche ${wk} von ${len} (KW 46–48)", "laut Periodisierung, Woche ${wk} von ${len} (${WEEKS[b.from]}–${WEEKS[b.to]})")
rep("""<h3 class="grp">Aktuelle Trainingswoche · KW 46</h3>
  <div class="tgrid">${week('2026-11-09','2026-11-15').map(trainingCard).join('')}</div>
  <h3 class="grp">Kommende Trainingswoche · KW 47</h3>
  <div class="tgrid">${week('2026-11-16','2026-11-22').map(trainingCard).join('')}</div>""", """<h3 class="grp">Aktuelle Trainingswoche · KW ${KW(MON)}</h3>
  <div class="tgrid">${week(MON, plusDays(MON,6)).map(trainingCard).join('')}</div>
  <h3 class="grp">Kommende Trainingswoche · KW ${KW(plusDays(MON,7))}</h3>
  <div class="tgrid">${week(plusDays(MON,7), plusDays(MON,13)).map(trainingCard).join('')}</div>""")

# Kalender: Monat mit Blättern
rep("""function monthGrid() {
  const start = '2026-10-26';""", """function monthGrid() {
  const m0 = plusDays(state.weekStart, 3).slice(0,8) + '01', start = mondayOf(m0);""")
rep("for (let i=0;i<35;i++) {\n    const iso = addDays(start,i), evs = events.filter(e=>e.date===iso), c = counts(iso), n = absentOn(iso).length;",
    "for (let i=0;i<42;i++) {\n    const iso = addDays(start,i), evs = events.filter(e=>e.date===iso), c = counts(iso), n = absentOn(iso).length;\n    if (i===35 && iso.slice(5,7)!==m0.slice(5,7)) break;")
rep("iso.slice(5,7)!=='11'?'out':''", "iso.slice(5,7)!==m0.slice(5,7)?'out':''")
rep("""`:'<span>November 2026</span>'}""", """`:(()=>{ const m0 = plusDays(state.weekStart,3); return `<button class="btn ghost small" data-mon="-1" aria-label="Voriger Monat">‹</button><span>${MONATE[+m0.slice(5,7)-1]} ${m0.slice(0,4)}</span><button class="btn ghost small" data-mon="1" aria-label="Nächster Monat">›</button>`; })()}""")
rep("""window.addEventListener('hashchange', render);
render();""", """document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-mon]');
  if (!b) return;
  const m = plusDays(state.weekStart, 3), d = new Date(m.slice(0,8)+'01T12:00:00');
  d.setMonth(d.getMonth() + (+b.dataset.mon));
  state.weekStart = mondayOf(d.toISOString().slice(0,8)+'01'); render();
});
window.addEventListener('hashchange', render);
render();""")

# Weitere feste Daten
rep("ex=events.find(e=>e.type===k&&e.date>='2026-11-12')", "ex=events.find(e=>e.type===k&&e.date>=TODAY)")
rep('<input type="date" id="af-from" value="2026-11-16" class="f">', '<input type="date" id="af-from" value="${TODAY}" class="f">')
rep('<input type="date" id="af-to" value="2026-11-22" class="f">', '<input type="date" id="af-to" value="${TODAY}" class="f">')
rep("[0,1,2,3,4,5,6,7,8,9,10,11,12,13].map(i=>addDays('2026-11-09',i))", "[0,1,2,3,4,5,6,7,8,9,10,11,12,13].map(i=>addDays(MON,i))")
rep("Stand 11.11.2026", "Stand ${STAND}", 0)
open(p, 'w').write(s); print('ok')
