import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Spieltagsdossier als Reiter der Spielvorbereitung, mit Abschluss ----
rep("const tabs = gespielt(g) ? [['spiel-nachbereitung','Nachbereitung']] : [['spiel-vorbereitung','Gegnervorbereitung'],['spiel-aufstellung','Aufstellung']];",
    "const tabs = gespielt(g) ? [['spiel-nachbereitung','Nachbereitung']] : [['spiel-vorbereitung','Gegnervorbereitung'],['spiel-aufstellung','Aufstellung'],['spiel-dossier', dossierFertig(g) ? 'Dossier ✓' : 'Dossier']];")
# Knopf im Kopf: kein neues Fenster mehr, sondern der Reiter
rep("""<button class="btn" data-pdf="${g.id}">Dossier als PDF</button></div>`}</div>""",
    """<a class="btn" href="#spiel-dossier" data-setgame="${g.id}">${dossierFertig(g) ? 'Dossier ansehen' : 'Zum Dossier'}</a></div>`}</div>""")

# Auftrag: drei Botschaften je Zeile, dazu Merksätze
rep("""${textBox('d-botschaft-'+g.id,'Botschaften an die Mannschaft','bis zu drei, in deinen Worten', 3)}${textBox('d-motto-'+g.id,'Leitmotiv','ein Satz', 1)}</div>`],""",
    """${textBox('d-botschaft-'+g.id,'Drei Botschaften an die Mannschaft','je Zeile eine, in deinen Worten', 3)}<div class="grid" style="gap:10px">${textBox('d-motto-'+g.id,'Leitmotiv','ein kurzer Satz für den schwarzen Kasten', 1)}${textBox('d-merksaetze-'+g.id,'Merksätze','optional, je Zeile einer – leer lassen, wenn keine', 2)}</div></div>`],""")

# Ende der Vorbereitung: Spieltagsdossier abschließen
rep("""  <div class="card finish"><div class="row between"><div><h3>Fertig?</h3><p class="sub">Das PDF enthält genau die Seiten mit Haken „im Dossier“.</p></div>
    <div class="row"><button class="btn ghost" data-msg="1">Mannschaftsnachricht</button>${state.released[g.id]?'':`<button class="btn ghost" data-release="${g.id}">Für Spieler freigeben</button>`}<button class="btn" data-pdf="${g.id}">Dossier als PDF erzeugen</button></div></div></div>`;\n}""",
    """  <div class="card finish"><div class="row between"><div><h3>${dossierFertig(g) ? '✓ Spieltagsdossier abgeschlossen' : 'Fertig?'}</h3><p class="sub">${dossierFertig(g) ? `am ${dossierFertigText(g)}. Änderst du noch etwas, schließe das Dossier danach erneut ab (neue Version).` : 'Im Reiter „Dossier“ siehst du die Folien mit deinen Einträgen. Erst nach dem Abschluss gilt das Spiel als vorbereitet.'}</p></div>
    <div class="row"><button class="btn ghost" data-msg="1">Mannschaftsnachricht</button>${state.released[g.id]?'':`<button class="btn ghost" data-release="${g.id}">Für Spieler freigeben</button>`}<a class="btn" href="#spiel-dossier" ${dossierFertig(g) ? '' : 'data-dossierende="1"'}>${dossierFertig(g) ? 'Dossier ansehen' : 'Spieltagsdossier abschließen ›'}</a></div></div></div>`;
}
const dossierFertig = g => !!g && !!(state.dossierDone || {})[g.id];
const dossierFertigText = g => { const d = (state.dossierDone || {})[g.id]; if (!d) return ''; const t = new Date(d.am); return `${t.toLocaleDateString('de-DE')} um ${t.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})} Uhr${d.version ? ` (Version ${d.version})` : ''}`; };
const dossierSpiel = () => EV(state.game) && !gespielt(EV(state.game)) ? EV(state.game) : nextGame();
function dossierStatus(g) {
  return dossierFertig(g)
    ? `<b>✓ Spieltagsdossier abgeschlossen</b> am ${dossierFertigText(g)}. PDF und PowerPoint findest du unten im Dossier.`
    : `<b>So geht's:</b> Das Dossier übernimmt automatisch, was du in der Gegnervorbereitung eingetragen hast. 1. Daten von fussball.de laden, 2. Folien ansehen, 3. „Spieltagsdossier abschließen“ – danach PDF oder PowerPoint.`;
}
function dossierAdresse(g, ende) {
  const r = REAL.games.find(x=>x.id===g.id) || {};
  const q = new URLSearchParams({dossier:'1', tz:g.id, gegner:g.opp||'', datum:g.date||'', anstoss:g.time||'', heim:g.home?'1':'0', wettbewerb:g.comp||'', art:g.kind||'liga', ort:r.venue||g.place||'', adresse:r.address||'', fahrzeit:String(g.home?0:travelOf(g))});
  if (ende) q.set('schritt', 'abschluss');
  return '/?' + q.toString() + '#/';
}
function vDossier() {
  const g = dossierSpiel();
  const online = location.protocol.startsWith('http') && location.pathname === '/teamzentrale';
  const ende = state.dossierEnde; state.dossierEnde = false;
  return `${demo}${spielHead(g,'spiel-dossier')}
  <div class="q dossierq" id="dossier-status">${dossierStatus(g)}</div>
  ${online ? `<iframe id="dossier-frame" class="dossier-frame" data-g="${g.id}" title="Spieltagsdossier" src="${esc(dossierAdresse(g, ende))}"></iframe>`
           : '<div class="card"><p class="sub">Das Spieltagsdossier mit Folien, PDF und PowerPoint läuft auf 11plan.de und erscheint dort an dieser Stelle.</p></div>'}`;
}
/** Für das eingebettete Dossier: alles, was der Trainer in der Gegnervorbereitung eingetragen hat. */
window.__11planVorbereitung = gid => {
  const g = EV(gid); if (!g) return null;
  const T = k => String(state.texts[k + '-' + gid] ?? '').trim();
  const sq = state.squad[gid] instanceof Set ? [...state.squad[gid]] : [];
  const kader = sq.map(id => P(id)).filter(Boolean).map(p => ({ name: p.name, nr: String(p.nr || ''), pos: p.pos || '' }))
    .concat(guestsOf(gid).map(x => ({ name: x.name, nr: '', pos: x.team || 'Gast' })));
  return {
    spiel: gid, gegner: g.opp, datum: g.date,
    antworten: Object.fromEntries([...QA.map(([k]) => [k, T('a-' + k)]), ...QE.map(([k]) => [k, T('e-' + k)])]),
    botschaften: T('d-botschaft'), leitmotiv: T('d-motto'), merksaetze: T('d-merksaetze'),
    kleidung: T('kleidung') || (typeof kitText === 'function' ? kitText(g) : ''),
    kader, fahrzeit: g.home ? 0 : travelOf(g),
  };
};
/** Meldung des eingebetteten Dossiers: abgeschlossen (bestätigt) oder wieder geöffnet. */
window.addEventListener('message', ev => {
  if (ev.origin !== location.origin || !ev.data || typeof ev.data !== 'object') return;
  const { typ, spiel, version } = ev.data;
  if (!spiel || !EV(spiel)) return;
  state.dossierDone = state.dossierDone || {};
  if (typ === '11plan-dossier-abgeschlossen') state.dossierDone[spiel] = { am: new Date().toISOString(), version: version || null };
  else if (typ === '11plan-dossier-geoeffnet') delete state.dossierDone[spiel];
  else return;
  const el = document.getElementById('dossier-status'); if (el) el.innerHTML = dossierStatus(EV(spiel));
  const tab = document.querySelector('.tabs a[href="#spiel-dossier"]'); if (tab) tab.textContent = dossierFertig(EV(spiel)) ? 'Dossier ✓' : 'Dossier';
});""")
rep("'spiel-vorbereitung':vVorbereitung,", "'spiel-vorbereitung':vVorbereitung,'spiel-dossier':vDossier,")
# Den eingebetteten Dossier-Rahmen nicht bei jedem Neuzeichnen neu laden
rep("  if (k !== lastView) { state.flash = null; state.picked = null; }",
    """  if (k === 'spiel-dossier' && lastView === k) { const f = document.getElementById('dossier-frame'), g = dossierSpiel(); if (f && g && f.dataset.g === g.id) { const el = document.getElementById('dossier-status'); if (el) el.innerHTML = dossierStatus(g); return; } }
  if (k !== lastView) { state.flash = null; state.picked = null; }""")
# „Spieltagsdossier abschließen“ springt im Dossier direkt zum Abschluss
rep("  if (d.ttabgo) state.trainTab = d.ttabgo;", "  if (d.ttabgo) state.trainTab = d.ttabgo;\n  if (d.dossierende) state.dossierEnde = true;")
rep("  else if (d.pdf) { if (location.protocol.startsWith('http') && location.pathname === '/teamzentrale') (() => {",
    "  else if (d.pdf) { if (EV(d.pdf)) { state.game = d.pdf; location.hash = 'spiel-dossier'; return; } if (location.protocol.startsWith('http') && location.pathname === '/teamzentrale') (() => {")

# Vorbereitet heißt jetzt: Spieltagsdossier abgeschlossen
rep("  const done = !!auftrag && filled >= Math.ceil(keys.length * 0.6) && kader > 0;\n  return { filled, total: keys.length, kader, done };",
    "  const bereit = !!auftrag && filled >= Math.ceil(keys.length * 0.6) && kader > 0;\n  return { filled, total: keys.length, kader, done: dossierFertig(g), bereit };")
rep("  if (pp.done) return 'fertig';", "  if (pp.done) return 'Dossier abgeschlossen';\n  if (pp.bereit) return 'eingetragen – Dossier noch abschließen';")

rep("</style>\n</head>", """.dossier-frame { width: 100%; height: calc(100vh - 230px); min-height: 560px; border: 1px solid var(--line); border-radius: 12px; background: var(--bg); display: block; }
.q.dossierq { margin: 0; }
@media (max-width: 700px) { .dossier-frame { height: calc(100vh - 170px); min-height: 480px; border-radius: 8px; } }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
