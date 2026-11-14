import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Spieltagskader: Gastspieler oder Spieler aus der 2./3. Mannschaft hinzufügen ----
rep("""       <span class="note">${squad.size} im Kader</span>`],""",
"""       <span class="note">${squad.size} im Kader${guestsOf(g.id).length ? ` + ${guestsOf(g.id).length} aus anderen Mannschaften oder als Gast` : ''}</span>
       ${guestBlock(g.id, 'Zusätzlich im Kader', 'Zum Beispiel aus der zweiten oder dritten Mannschaft, aus der A-Jugend oder ein Gastspieler.', true)}`],""")

# Gastspieler-Block als gemeinsamer Baustein für Training und Spiel
rep("""function attCard(e, a, pName) {""", """const GUEST_TEAMS = ['2. Mannschaft', '3. Mannschaft', 'A-Jugend', 'Gastspieler'];
function guestBlock(eid, title, hint, withTeam) {
  const list = guestsOf(eid);
  return `<div class="guests"><h4>${title} (${list.length})</h4>
    ${list.length ? `<ul>${list.map(x=>`<li><span class="attn"><span class="av sm init guest">${esc((x.team||'G').replace(/[^0-9A-Za-z]/g,'').slice(0,1) || 'G')}</span> ${esc(x.name)}${x.tw?' (TW)':''}${x.team?` <span class="pill grey">${esc(x.team)}</span>`:''}${x.note?` <span class="note">· ${esc(x.note)}</span>`:''}</span><button class="ib" data-guestdel="${eid}|${x.id}" title="Entfernen" aria-label="${esc(x.name)} entfernen">${ICON.x}</button></li>`).join('')}</ul>` : `<p class="note" style="margin:0">${hint}</p>`}
    <div class="row guestform"><input type="text" id="gname-${eid}" placeholder="Name" aria-label="Name">${withTeam ? `<select id="gteam-${eid}" aria-label="Mannschaft">${GUEST_TEAMS.map(t=>`<option>${t}</option>`).join('')}</select>` : ''}<input type="text" id="gnote-${eid}" placeholder="${withTeam ? 'Hinweis, optional' : 'z. B. 2. Mannschaft, Probetraining'}" aria-label="Hinweis"><label class="row note" style="gap:4px"><input type="checkbox" id="gtw-${eid}"> TW</label><button class="btn small" data-guestadd="${eid}">Hinzufügen</button></div></div>`;
}
function attCard(e, a, pName) {""")
rep("""    (state.guests[eid] = state.guests[eid] || []).push({id: 'g' + Date.now().toString(36), name, tw: document.getElementById('gtw-'+eid).checked, note: document.getElementById('gnote-'+eid).value.trim()});""",
"""    const teamSel = document.getElementById('gteam-'+eid);
    (state.guests[eid] = state.guests[eid] || []).push({id: 'g' + Date.now().toString(36), name, tw: document.getElementById('gtw-'+eid).checked, note: document.getElementById('gnote-'+eid).value.trim(), team: teamSel ? teamSel.value : ''});""")
i = s.index('<div class="guests"><h4>Gastspieler (${guestsOf(e.id).length})</h4>')
j = s.index('data-guestadd="${e.id}">Hinzufügen</button></div></div>', i) + len('data-guestadd="${e.id}">Hinzufügen</button></div></div>')
s = s[:i] + "${guestBlock(e.id, 'Gastspieler', 'Zum Beispiel aus der zweiten Mannschaft, der A-Jugend oder ein Probespieler.', true)}" + s[j:]
rep("</style>\n</head>", """.guestform select { width: auto; }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
