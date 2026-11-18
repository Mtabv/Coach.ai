import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Wochendienste (z. B. Materialdienst) als durchgehender Balken in allen Kalendern, wie Urlaub in Outlook ----
rep("const dutiesOn = iso =>", """/** Dienste über einen Zeitraum (nicht an einen Termin gebunden), die sich mit [von, bis] überschneiden. */
const zeitraumDienste = (von, bis) => duties.filter(d => !d.ev && d.from && d.to && d.from <= bis && d.to >= von);
function dienstText(d) {
  const namen = d.who.map(id => P(id) ? P(id).name : '').filter(Boolean), frei = d.slots - d.who.length;
  return `<b>${esc(d.title.split(' (')[0])}:</b> ${namen.length ? namen.map(esc).join(', ') : 'noch niemand'}${frei > 0 ? ` <span class="pill warn">${frei} frei</span>` : ''}`;
}
/** Balken im Raster einer Woche (7 Spalten ab start). Gibt HTML und Anzahl der Zeilen zurück. */
function dienstBalken(start) {
  const ende = addDays(start, 6), liste = zeitraumDienste(start, ende);
  const tagNr = iso => Math.round((dt(iso) - dt(start)) / 864e5);
  const html = liste.map((d, i) => { const a = Math.max(0, tagNr(d.from)), b = Math.min(6, tagNr(d.to));
    const ich = typeof ME !== 'undefined' && d.who.includes(ME);
    return `<div class="dbar ${ich ? 'mein' : ''}" style="grid-column:${a + 1} / ${b + 2};grid-row:${i + 1}" title="${esc(d.title)} · ${fmt(d.from)}–${fmt(d.to)}">${dienstText(d)} <span class="note">${fmt(d.from)}–${fmt(d.to)}</span></div>`; }).join('');
  return { html, n: liste.length };
}
const dutiesOn = iso =>""")
# Kalender, Woche
rep("""function weekGrid() {
  return `<div class="week">${[0,1,2,3,4,5,6].map(i=>{""", """function weekGrid() {
  const DB = dienstBalken(state.weekStart);
  return `<div class="week" style="--dbz:${DB.n + 1}">${DB.html}${[0,1,2,3,4,5,6].map(i=>{""")
rep("      ${state.showEv ? dutiesOn(iso).map(d=>dutyChip(d)).join('') : ''}", "      ${state.showEv ? dutiesOn(iso).filter(d => d.ev).map(d=>dutyChip(d)).join('') : ''}")
# Dashboard, Wochenstreifen
rep("""  return `<div class="strip" style="grid-template-columns:${cols}">${days.map(iso=>{""", """  const DB = dienstBalken(start);
  return `<div class="strip" style="grid-template-columns:${cols};--dbz:${DB.n + 1}">${DB.html}${days.map(iso=>{""")
# Kalender, Monat: Hinweis am Wochenanfang bzw. am ersten Tag des Dienstes
rep("      ${talksOn(iso).map(t=>talkChip(t, true)).join('')}", """      ${zeitraumDienste(iso, iso).filter(d => dt(iso).getDay() === 1 || d.from === iso).map(d => `<span class="chip dchip" title="${esc(d.title)} · ${fmt(d.from)}–${fmt(d.to)}">${dienstText(d)}</span>`).join('')}
      ${talksOn(iso).map(t=>talkChip(t, true)).join('')}""")
# Spielersicht: Start und Kalender
rep("""    ${ganzeWoche.map(d => `<div class="pw-ganz">${dienstZeile(d)}<span class="note">die ganze Woche</span></div>`).join('')}""",
    """    ${ganzeWoche.map(d => `<div class="pw-ganz ${d.who.includes(ME) ? 'mein' : ''}"><span>${d.who.includes(ME) ? '★ ' : ''}${dienstText(d)}</span><span class="note">${fmt(d.from)}–${fmt(d.to)}${d.who.includes(ME) ? ' · dein Dienst' : ''}</span>${!d.who.includes(ME) && d.slots > d.who.length ? `<button class="btn ghost small" data-dutyjoin="${d.id}" style="justify-self:start">Ich übernehme</button>` : ''}</div>`).join('')}""")
rep("""    kalender: () => [0,1,2,3,4,5,6,7,8,9,10,11,12,13].map(i=>addDays(MON,i))""",
    """    kalender: () => zeitraumDienste(MON, addDays(MON, 13)).map(d => `<div class="pw-ganz ${d.who.includes(ME) ? 'mein' : ''}"><span>${dienstText(d)}</span><span class="note">${fmt(d.from)}–${fmt(d.to)}</span></div>`).join('') + [0,1,2,3,4,5,6,7,8,9,10,11,12,13].map(i=>addDays(MON,i))""")

rep("</style>\n</head>", """.week > .day, .strip > .sday { grid-row: var(--dbz, 1); }
.dbar { background: var(--accent-soft); border: 1px solid var(--accent); border-radius: 8px; padding: 4px 10px; font-size: 13px; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.dbar.mein { border-width: 2px; }
.dbar .note { margin-left: 6px; }
.chip.dchip { background: var(--accent-soft); border: 1px solid var(--accent); white-space: normal; }
.pw-ganz.mein { border-style: solid; }
@media (max-width: 900px) { .dbar { grid-column: 1 / -1 !important; grid-row: auto !important; white-space: normal; } .week > .day, .strip > .sday { grid-row: auto; } }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
