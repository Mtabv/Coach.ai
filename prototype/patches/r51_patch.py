import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# Automatisches Umlegen macht der Server um 17 Uhr. Die Seite springt nur noch bei Trainern ab 17:05 ein
# (falls der Server es nicht geschafft hat), nie bei Spielern oder Betreuern.
rep("""function autoUmlegen() {
  if (new Date().getHours() < 17) return;""", """function autoUmlegen() {
  const jetzt = new Date();
  if (jetzt.getHours() < 17 || (jetzt.getHours() === 17 && jetzt.getMinutes() < 5)) return;
  if (window.__11plan && window.__11plan.rolle && window.__11plan.rolle !== 'trainer') return;""")
# Zu- und Absage eines Spielers steht in den Abwesenheiten (je Termin, src = Termin) – gilt für alle Spieler,
# nicht nur für die Vorschau. Die Antwort wird daraus abgeleitet.
rep("  const status = e => { const r = state.reply[e.id], abw =", "  const status = e => { const r = absences.some(a => a.pid === ME && a.src === e.id) ? 'nein' : state.reply[e.id], abw =")
open(p, 'w').write(s); print('ok')
