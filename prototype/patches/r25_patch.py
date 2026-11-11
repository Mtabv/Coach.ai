import sys, re
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# Erkenntnisse klassifizieren
for old, new in [
  ("n.push({kind:'Highlight', icon:I.chart, href:'#analytics', attrs:`data-anaplayer=\"${top.id}\"`", "n.push({kind:'Torgefahr', icon:I.chart, href:'#analytics', attrs:`data-anaplayer=\"${top.id}\"`"),
  ("n.push({kind:'Highlight', icon:I.clock, href:'#analytics', attrs:`data-anaplayer=\"${mm.id}\"`", "n.push({kind:'Belastung', icon:I.clock, href:'#analytics', attrs:`data-anaplayer=\"${mm.id}\"`"),
  ("if (h2 > h1) n.push({kind:'Highlight',", "if (h2 > h1) n.push({kind:'Spielverlauf',"),
  ("else if (h1 > h2) n.push({kind:'Highlight',", "else if (h1 > h2) n.push({kind:'Spielverlauf',"),
  ("if (T.away > T.home) n.push({kind:'Highlight',", "if (T.away > T.home) n.push({kind:'Heim und auswärts',"),
  ("if (safe && own && own.pl > safe.pl) n.push({kind:'Highlight',", "if (safe && own && own.pl > safe.pl) n.push({kind:'Tabelle',"),
  ("if (cup) n.push({kind:'Highlight',", "if (cup) n.push({kind:'Pokal',"),
]: rep(old, new)

# Dashboard: Spiel und Training oben, dann Kommunikation und Erkenntnisse, dann Schnelleinstieg und Administratives
i = s.index("function vDashboard() {"); j = s.index("\n}\n", i)
d = s[i:j]
a = d.index('    <section class="card dbox"><h3>Schnelleinstieg</h3>'); b = d.index('  </div>\n  <section class="card"><div class="row between"><h3>Nachrichten von 11Plan')
quick = d[a:b]
d = d[:a] + d[b:]
m1 = d.index('  <section class="card"><div class="row between"><h3>Nachrichten von 11Plan'); m2 = d.index('  <section class="card"><div class="row between"><h3>Trainerteam</h3>')
msgs = r"""  <div class="dgrid two">
  <section class="card"><div class="row between"><h3>Kommunikation</h3><a class="note" href="#kommunikation" data-komtab="uebersicht">Kommunikation öffnen ›</a></div>
    <p class="sub" style="margin:0">Gesprächsimpulse und Lob für einzelne Spieler</p>
    <div class="msgs one">${(()=>{ const l = talkNews(); return l.length ? l.map(m=>dlink(m.href, m.title, `<b class="lbl k-${m.kind==='Gespräch'?'talk':'praise'}">${m.kind==='Gespräch'?'Gesprächsimpuls':'Lob'}</b> ${m.sub}`, m.attrs, m.icon, 'msg')).join('') : '<p class="sub">Gerade nichts Auffälliges.</p>'; })()}</div></section>
  <section class="card"><div class="row between"><h3>Erkenntnisse aus den Zahlen</h3><a class="note" href="#analytics" data-anateam="1">Analytics öffnen ›</a></div>
    <p class="sub" style="margin:0">Was die Spielberichte und die Tabelle hergeben</p>
    <div class="msgs one">${coachNews().filter(m=>m.kind!=='Gespräch' && m.kind!=='Lob').map(m=>dlink(m.href, m.title, `<b class="lbl k-hl">${m.kind}</b> ${m.sub}`, m.attrs||'', m.icon, 'msg')).join('')}</div></section>
  </div>
  <div class="dgrid two">
""" + quick + "  </div>\n"
d = d[:m1] + msgs + d[m2:]
s = s[:i] + d + s[j:]

# Kommunikation: Reiter Mannschaft raus, Übersicht ohne Mannschaft-Kasten
rep("const tabs = [['uebersicht','Übersicht'],['gespraeche','Spielergespräche'],['mannschaft','Mannschaft'],['trainerteam','Trainerteam']];", "const tabs = [['uebersicht','Übersicht'],['gespraeche','Spielergespräche'],['trainerteam','Trainerteam']];")
rep("             : T==='mannschaft' ? komMannschaft() : T==='trainerteam'", "             : T==='trainerteam'")
i = s.index('    <section class="card"><div class="row between"><h3>Mannschaft</h3></div>'); j = s.index('    <section class="card"><div class="row between"><h3>Zuletzt geführt</h3>', i)
s = s[:i] + s[j:]
rep("<p>Alles an einem Ort: Gespräche mit Spielern, Nachrichten an die Mannschaft und Absprachen im Trainerteam.</p>", "<p>Gespräche mit Spielern und Absprachen im Trainerteam an einem Ort. Nur für das Trainerteam sichtbar.</p>")
rep("Sie steht jetzt unter Kommunikation › Mannschaft.`", "`")
rep("/* ---- Masken ---- */", """.dgrid.two { grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); }
.msgs.one { grid-template-columns: 1fr; }
/* ---- Masken ---- */""")
open(p, 'w').write(s); print('ok')
