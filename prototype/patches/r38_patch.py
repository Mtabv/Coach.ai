import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Datenstand je Spiel im Spielkopf: ✓ geladen (aktualisieren) oder „Daten laden“ ----
rep("""<p>${['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'][dt(g.date).getDay()]}, ${fmt(g.date)}${g.date.slice(0,4)} · ${g.time} Uhr · ${g.comp} · ${g.place}</p></div>""",
    """<p>${['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'][dt(g.date).getDay()]}, ${fmt(g.date)}${g.date.slice(0,4)} · ${g.time} Uhr · ${g.comp} · ${g.place}</p>${gespielt(g) ? '' : `<div class="datenzeile" data-datenpill="${g.id}">${datenPill(g)}</div>`}</div>""")
rep("function spielHead(g, cur) {", """/** Daten von fussball.de und FuPa für das Spiel (Gegnervorbereitung und Dossier): Stand je Spiel. */
const datenLaedt = {};
const datenFehler = {};
function datenPill(g) {
  const am = (state.spielDaten || {})[g.id];
  if (datenLaedt[g.id]) return `<span class="pill datenpill">Daten werden geladen …</span>`;
  if (datenFehler[g.id]) return `<span class="pill warn" title="${esc(datenFehler[g.id])}">Laden fehlgeschlagen</span><button class="btn small" data-datenladen="${g.id}">erneut laden</button>`;
  if (am) { const t = new Date(am); return `<span class="pill datenok" title="Daten von fussball.de und FuPa für dieses Spiel">✓ Daten geladen · ${t.toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit'})} ${t.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})}</span><button class="btn ghost small" data-datenladen="${g.id}">aktualisieren</button>`; }
  return `<button class="btn small datenlos" data-datenladen="${g.id}" title="Tabelle, Ergebnisse, Torschützen und Kader von fussball.de und FuPa für dieses Spiel laden">⚠ Daten noch nicht geladen – jetzt laden</button>`;
}
function datenPillsZeigen() { document.querySelectorAll('[data-datenpill]').forEach(el => { const g = EV(el.dataset.datenpill); if (g) el.innerHTML = datenPill(g); }); }
function datenLaden(gid) {
  const g = EV(gid); if (!g) return;
  if (!(location.protocol.startsWith('http') && location.pathname === '/teamzentrale')) { state.flash = 'Die Daten je Spiel lädt 11Plan auf 11plan.de.'; render(); return; }
  delete datenFehler[gid];
  const sichtbar = document.getElementById('dossier-frame');
  if (sichtbar && sichtbar.dataset.g === gid && sichtbar.contentWindow) {
    sichtbar.contentWindow.postMessage({ typ: '11plan-laden' }, location.origin);
  } else {
    const alt = document.getElementById('datenlader-' + gid); if (alt) alt.remove();
    const f = document.createElement('iframe');
    f.id = 'datenlader-' + gid; f.className = 'datenlader'; f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
    f.src = dossierAdresse(g).replace('#/', '&laden=1#/');
    document.body.appendChild(f);
    setTimeout(() => { if (datenLaedt[gid]) { delete datenLaedt[gid]; datenFehler[gid] = 'Keine Antwort nach 5 Minuten'; const x = document.getElementById('datenlader-' + gid); if (x) x.remove(); datenPillsZeigen(); } }, 300000);
  }
  datenLaedt[gid] = true; datenPillsZeigen();
}
window.addEventListener('message', ev => {
  if (ev.origin !== location.origin || !ev.data || typeof ev.data !== 'object') return;
  const { typ, spiel, am, fehler } = ev.data;
  if (!spiel || !EV(spiel) || !/^11plan-(datenstand|daten-geladen|daten-fehler)$/.test(typ || '')) return;
  state.spielDaten = state.spielDaten || {};
  if (typ === 'datenstand' || typ === '11plan-datenstand') { if (am && am !== state.spielDaten[spiel]) state.spielDaten[spiel] = am; }
  if (typ === '11plan-daten-geladen') {
    delete datenLaedt[spiel]; if (am) state.spielDaten[spiel] = am;
    const x = document.getElementById('datenlader-' + spiel); if (x) x.remove();
    // Steht das Dossier gerade offen und hat ein anderer Rahmen geladen: neu öffnen, damit es den neuen Stand zeigt.
    const sichtbar = document.getElementById('dossier-frame');
    if (sichtbar && sichtbar.dataset.g === spiel && ev.source !== sichtbar.contentWindow) sichtbar.src = sichtbar.src;
  }
  if (typ === '11plan-daten-fehler') { delete datenLaedt[spiel]; datenFehler[spiel] = fehler || 'unbekannter Fehler'; const x = document.getElementById('datenlader-' + spiel); if (x) x.remove(); }
  datenPillsZeigen();
});
function spielHead(g, cur) {""")
rep("  else if (d.msg) {", "  else if (d.datenladen) { datenLaden(d.datenladen); }\n  else if (d.msg) {")
# Hinweis im Dossier-Reiter: Daten lädt man jetzt oben am Spiel
rep("1. Daten von fussball.de laden, 2. Folien ansehen, 3. „Spieltagsdossier abschließen“ – danach PDF oder PowerPoint.",
    "Die Daten von fussball.de und FuPa lädst du oben neben dem Spiel (beim ersten Öffnen lädt das Dossier sie selbst). Folien ansehen, dann „Spieltagsdossier abschließen“ – danach PDF oder PowerPoint.")
rep("</style>\n</head>", """.datenzeile { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
.pill.datenok { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }
.btn.datenlos { background: var(--warn); border-color: var(--warn); color: #111; }
iframe.datenlader { position: absolute; width: 1px; height: 1px; left: -10000px; top: 0; border: 0; visibility: hidden; }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
