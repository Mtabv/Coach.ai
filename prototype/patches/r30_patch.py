import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Feste Spielerkennung aus dem Namen statt aus der Reihenfolge im FuPa-Kader ----
# Kommt ein Spieler dazu (z. B. ein neuer Torwart), verschieben sich sonst alle Kennungen,
# und gespeicherte Angaben (Fotos, Abwesenheiten, Zusagen) landen beim falschen Spieler.
rep("REAL.players.forEach((p,i)=>players.push({id:'p'+i,",
    "const pidSeen = new Set(); const pidOf = n => { let id = 'p-' + foldN(n).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); while (pidSeen.has(id)) id += '-2'; pidSeen.add(id); return id; };\n  REAL.players.forEach((p,i)=>players.push({id:pidOf(p.name),")

# ---- Spielvorbereitung: eine Sprachaufnahme je Abschnitt (6 Gegnerbeobachtung, 7 Unser Plan, 8 Auftrag) ----
SEC = "['s-gegner','s-plan','s-auftrag']"
rep("${parts.map(([id,title,sp,body],n)=>slide(n,[id,title],body).replace('</h3>', `</h3>${sp}`)).join('')}",
    "${parts.map(([id,title,sp,body],n)=>{ const mic = " + SEC + ".includes(id); const b = mic ? body.replace(/<button class=\"mic\"[^>]*>[\\s\\S]*?<\\/button>/g, '') : body; return slide(n,[id,title],b).replace('</h3>', `</h3>${sp}${mic ? `<button class=\"mic secmic\" data-secmic=\"${id}\" title=\"Sprachaufnahme für diesen Abschnitt\">${ICON.mic} Sprachaufnahme</button>` : ''}`); }).join('')}")

rep("""window.addEventListener('hashchange', render);
render();""", """// Sprachaufnahme je Abschnitt: Der Text landet im zuletzt angetippten Feld des Abschnitts (sonst im ersten leeren).
// Die Spracherkennung macht der Browser selbst (Safari, Chrome). Die Verteilung auf alle Felder übernimmt später die KI.
const secLastField = {};
let secRec = null;
document.addEventListener('focusin', ev => { const t = ev.target; if (t.matches && t.matches('textarea[data-text]')) { const sec = t.closest('section.slide'); const b = sec && sec.querySelector('[data-secmic]'); if (b) secLastField[b.dataset.secmic] = t.dataset.text; } });
function secMicStop() { if (secRec) { const r = secRec; secRec = null; try { r.rec.stop(); } catch (e) {} r.btn.classList.remove('rec'); r.btn.innerHTML = `${ICON.mic} Sprachaufnahme`; } }
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-secmic]');
  if (!b) return;
  ev.preventDefault();
  if (secRec && secRec.btn === b) { secMicStop(); return; }
  secMicStop();
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { state.flash = 'Dieser Browser kann keine Sprache erkennen. In Safari oder Chrome funktioniert es; alternativ die Diktierfunktion der Tastatur nutzen.'; render(); return; }
  const sec = b.closest('section.slide'), fields = [...sec.querySelectorAll('textarea[data-text]')];
  const key = secLastField[b.dataset.secmic];
  const ta = fields.find(f => f.dataset.text === key) || fields.find(f => !f.value.trim()) || fields[0];
  if (!ta) return;
  ta.focus();
  const rec = new SR(); rec.lang = 'de-DE'; rec.continuous = true; rec.interimResults = false;
  rec.onresult = e => {
    for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) {
      const t = e.results[i][0].transcript.trim(); if (!t) continue;
      // Feld frisch suchen: die Seite kann inzwischen neu gezeichnet worden sein
      const k = ta.dataset.text, el = document.querySelector(`textarea[data-text="${CSS.escape(k)}"]`) || ta;
      const alt = (state.texts[k] ?? el.value ?? '').trim();
      state.texts[k] = (alt ? alt + ' ' : '') + t.charAt(0).toUpperCase() + t.slice(1);
      el.value = state.texts[k];
    }
  };
  rec.onend = () => { if (secRec && secRec.rec === rec) secMicStop(); };
  rec.onerror = e => { secMicStop(); if (e.error === 'not-allowed') { state.flash = 'Kein Zugriff aufs Mikrofon. Bitte im Browser erlauben.'; render(); } };
  secRec = { rec, btn: b };
  b.classList.add('rec'); b.innerHTML = `● Aufnahme läuft – tippen zum Beenden`;
  try { rec.start(); } catch (e) { secMicStop(); }
});
window.addEventListener('hashchange', () => secMicStop());
window.addEventListener('hashchange', render);
render();""")
rep("</style>\n</head>", """.secmic { margin-left: auto; }
.secmic.rec { color: #fff; background: var(--game); border-color: var(--game); }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
