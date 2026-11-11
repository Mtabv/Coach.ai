import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---------- Navigation ----------
rep("['kader','Kader'],['analytics','Analytics'],", "['kader','Kader'],['kommunikation','Kommunikation'],['analytics','Analytics'],")
rep("(cur === 'gespraech' || cur === 'gespraeche') ? 'kader' : cur;", "(cur === 'gespraech' || cur === 'gespraeche') ? 'kommunikation' : cur;")
rep("${k==='spieltag'?'<span class=\"badge\" title=\"1 Nachbereitung offen\">1</span>':''}</a>`;",
    "${k==='spieltag'?'<span class=\"badge\" title=\"1 Nachbereitung offen\">1</span>':''}${k==='kommunikation' && komOpen() ? `<span class=\"badge\" title=\"offene Gesprächsimpulse und geplante Gespräche\">${komOpen()}</span>`:''}</a>`;")

# ---------- Kommunikation als Sammelstelle ----------
rep("function vGespraeche() {", r"""const komOpen = () => { try { return talkNews().filter(m=>m.kind==='Gespräch').length + Object.values(talks).flat().filter(t=>t.status==='geplant').length; } catch (e) { return 0; } };
const sentMsgs = [];
function vKommunikation() {
  const T = state.komTab || 'uebersicht';
  const tabs = [['uebersicht','Übersicht'],['gespraeche','Spielergespräche'],['mannschaft','Mannschaft'],['trainerteam','Trainerteam']];
  const body = T==='gespraeche' ? vGespraeche().replace(demo, '').replace(/<!--gh-->[\s\S]*?<!--\/gh-->/, '')
             : T==='mannschaft' ? komMannschaft() : T==='trainerteam' ? komTrainerteam() : komUebersicht();
  return `${demo}
  <div class="head"><div><h1>Kommunikation</h1><p>Alles an einem Ort: Gespräche mit Spielern, Nachrichten an die Mannschaft und Absprachen im Trainerteam.</p></div>
    <a class="btn ghost small" href="#einstellungen" data-settab="gespraeche">Gesprächsrunden einstellen</a></div>
  <div class="tabs">${tabs.map(([k,l])=>`<button data-komtab="${k}" class="${T===k?'on':''}">${l}</button>`).join('')}</div>
  ${flashBox()}
  ${body}`;
}
function komUebersicht() {
  const imp = talkNews(), planned = Object.entries(talks).flatMap(([pid,l])=>l.filter(x=>x.status==='geplant').map(x=>({...x,pid})));
  const done = Object.entries(talks).flatMap(([pid,l])=>l.filter(x=>x.status==='geführt').map(x=>({...x,pid}))).sort((a,b)=>b.date.localeCompare(a.date));
  const ser = talkSeries.filter(x=>x.active).map(x=>({x, w: seriesWindow(x, TODAY)})).filter(o=>o.w && o.w.state!=='später');
  const nx = EV(REAL.next), read = (dossierRead[nx.id]||[]).length;
  return `<div class="komgrid">
    <section class="card"><div class="row between"><h3>Gesprächsimpulse</h3><span class="pill ${imp.length?'warn':''}">${imp.length}</span></div>
      ${imp.length ? imp.map(m=>dlink(m.href, m.title, `<b class="lbl k-${m.kind==='Gespräch'?'talk':'praise'}">${m.kind==='Gespräch'?'Gesprächsimpuls':'Lob'}</b> ${m.sub}`, m.attrs, m.icon, 'msg')).join('') : '<p class="sub">Gerade nichts Auffälliges.</p>'}</section>
    <section class="card"><div class="row between"><h3>Geplante Gespräche</h3><span class="pill grey">${planned.length}</span></div>
      ${planned.length ? planned.map(t=>dlink('#gespraech', esc(P(t.pid).name), `${fmt(t.date)} · ${esc(guideFor(t.code).label)}`, `data-talk="${t.pid}|${t.code}"`, av(P(t.pid)))).join('') : '<p class="sub">Keine. Aus einem Impuls oder über „Spielergespräche“ planen.</p>'}
      ${ser.map(({x,w})=>{ const ps = seriesPlayers(x), d = ps.filter(q=>seriesStatus(x,w,q.id)==='geführt').length;
        return dlink('#gespraeche', esc(x.name), `${w.state==='läuft'?`läuft bis ${fmt(w.to)}`:`ab ${fmt(w.from)}`} · ${d} von ${ps.length} geführt`, '', I.cal); }).join('')}</section>
    <section class="card"><div class="row between"><h3>Mannschaft</h3></div>
      ${dlink('#kommunikation', `Mannschaftsnachricht ${crest(nx.opp,'sm')}${esc(nx.opp)}`, sentMsgs.length ? `zuletzt gesendet am ${sentMsgs[0].when}` : 'noch nicht verschickt · Treffpunkt, Zeitplan, Kleidung, Kader', 'data-komtab="mannschaft"', I.doc)}
      ${dlink('#spiel-vorbereitung', 'Dossier für die Spieler', state.released[nx.id] ? `freigegeben · gelesen von ${read} von ${players.length}` : 'noch nicht freigegeben', `data-setgame="${nx.id}"`, I.ball)}</section>
    <section class="card"><div class="row between"><h3>Zuletzt geführt</h3></div>
      ${done.length ? done.slice(0,5).map(t=>dlink('#gespraech', esc(P(t.pid).name), `${fmt(t.date)} · ${esc(t.anlass)}${t.vereinbart?` · vereinbart: ${esc(t.vereinbart)}`:''}`, `data-talk="${t.pid}|${t.code}"`, av(P(t.pid)))).join('') : '<p class="sub">Noch keine Gespräche festgehalten.</p>'}</section>
    <section class="card komwide"><div class="row between"><h3>Trainerteam</h3><button class="btn ghost small" data-komtab="trainerteam">Alle Notizen</button></div>
      ${comments.length ? `<ul class="list">${comments.slice(0,3).map(c=>`<li><span><b>${c.who}:</b> ${esc(c.text)}</span><span class="note">${c.when}</span></li>`).join('')}</ul>` : '<p class="sub" style="margin:0">Noch keine Notizen.</p>'}</section>
  </div>`;
}
function komMannschaft() {
  const nx = EV(REAL.next);
  return `<div class="grid" style="gap:14px">
    ${teamMessage(nx).replace('<h3>Mannschaftsnachricht</h3>', `<h3>Mannschaftsnachricht zum Spiel ${crest(nx.opp,'sm')}${esc(nx.opp)}</h3>`).replace(/<button class="ib" data-msg="1"[^>]*>[\s\S]*?<\/button>/, '')}
    ${readBox(nx)}
    <div class="card"><h3>Verschickte Nachrichten</h3>${sentMsgs.length ? `<ul class="list">${sentMsgs.map(m=>`<li><span><b>${esc(m.title)}</b><br><span class="note">${esc(m.text.slice(0,140))}${m.text.length>140?' …':''}</span></span><span class="note">${m.when} · ${m.channel}</span></li>`).join('')}</ul>` : '<p class="sub" style="margin:0">Noch keine. Verschickte Nachrichten erscheinen hier mit Datum und Weg.</p>'}</div>
  </div>`;
}
function komTrainerteam() {
  return `<div class="card"><h3>Notizen im Trainerteam</h3><p class="sub" style="margin:0">Sieht nur das Trainerteam. Auch über das Dashboard erreichbar.</p>
    <div class="row" style="flex-wrap:nowrap"><input type="text" id="cmt" placeholder="Kommentar oder Notiz für das Trainerteam" aria-label="Kommentar"><button class="btn small" data-comment="1">Senden</button></div>
    ${comments.length ? `<ul class="list">${comments.map(c=>`<li><span><b>${c.who}:</b> ${esc(c.text)}</span><span class="note" style="white-space:nowrap">${c.when}</span></li>`).join('')}</ul>` : '<p class="note" style="margin:0">Noch keine Notizen.</p>'}</div>`;
}
function vGespraeche() {""")
rep("const R = {gespraeche:vGespraeche,", "const R = {kommunikation:vKommunikation,gespraeche:()=>{ state.komTab='gespraeche'; return vKommunikation(); },")
rep("<div class=\"crumb\"><a href=\"#gespraeche\">Spielergespräche</a> › ${esc(p.name)}</div>", "<div class=\"crumb\"><a href=\"#kommunikation\" data-komtab=\"gespraeche\">Kommunikation</a> › Spielergespräch mit ${esc(p.name)}</div>")
# Senden protokollieren
rep("<button class=\"btn small\" data-flash=\"Im Entwurf: ${players.length} Spieler bekämen eine Push-Nachricht aufs Handy, wer keine Push-Nachrichten erlaubt hat, eine E-Mail.\">Als Push an alle Spieler</button>",
    "<button class=\"btn small\" data-sendmsg=\"Push\">Als Push an alle Spieler</button>")
rep("  else if (d.more) {", r"""  else if (d.komtab) { state.komTab = d.komtab; if (location.hash !== '#kommunikation') { location.hash = 'kommunikation'; } else render(); }
  else if (d.sendmsg) { const txt = (document.getElementById('msgtxt')||{}).value || '', nx = EV(REAL.next);
    sentMsgs.unshift({title: `Mannschaftsnachricht ${nx.opp}`, text: txt, when: `${fmt(TODAY)} ${new Date().toTimeString().slice(0,5)}`, channel: d.sendmsg});
    state.flash = `Im Entwurf: ${players.length} Spieler bekämen die Nachricht als Push, wer keine Push-Nachrichten erlaubt hat, per E-Mail. Sie steht jetzt unter Kommunikation › Mannschaft.`; render(); }
  else if (d.more) {""")
# Link aus dem Kader und Dashboard
rep("<a class=\"btn ghost\" href=\"#gespraeche\">Spielergespräche</a>", "<a class=\"btn ghost\" href=\"#kommunikation\" data-komtab=\"gespraeche\">Spielergespräche</a>")
rep("<section class=\"card\"><h3>Trainerteam</h3>", "<section class=\"card\"><div class=\"row between\"><h3>Trainerteam</h3><a class=\"note\" href=\"#kommunikation\" data-komtab=\"trainerteam\">alle in Kommunikation ›</a></div>")
rep("<section class=\"card\"><div class=\"row between\"><h3>Nachrichten von Coach.AI</h3>", "<section class=\"card\"><div class=\"row between\"><h3>Nachrichten von Coach.AI <a class=\"note\" href=\"#kommunikation\" data-komtab=\"uebersicht\" style=\"font-family:var(--body);font-size:14px;font-weight:400\">Kommunikation öffnen ›</a></h3>")
rep("/* ---- Masken ---- */", """/* ---- Kommunikation ---- */
.komgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; align-items: start; }
.komgrid .card { gap: 8px; }
.komwide { grid-column: 1 / -1; }
/* ---- Masken ---- */""")
rep('''  return `${demo}
  <div class="head"><div><h1>Spielergespräche</h1>''', '''  return `${demo}
  <!--gh--><div class="head"><div><h1>Spielergespräche</h1>''')
rep('''data-settab="gespraeche">Runden einstellen</a></div></div>''', '''data-settab="gespraeche">Runden einstellen</a></div></div><!--/gh-->''')
rep("  if (d.nureset) state.nu = null;", "  if (d.nureset) state.nu = null;\n  if (d.komtab) state.komTab = d.komtab;")
open(p, 'w').write(s); print('ok')
