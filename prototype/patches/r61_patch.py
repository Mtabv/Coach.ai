import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Kader und Aufstellung je Spiel: ein Stand, derselbe Block in der Gegnervorbereitung und unter „Aufstellung“ ----
rep("function vAufstellung() {", """/** Aufstellung je Spiel: System und Startelf (Spieler-IDs oder Gast-IDs, null = Position frei). */
function aufst(gid) {
  state.aufst = state.aufst || {};
  return state.aufst[gid] = state.aufst[gid] || { f: FORMATIONS[state.formation] && state.formation !== UNSAVED ? state.formation : Object.keys(FORMATIONS)[0], xi: [] };
}
const kaderSet = gid => state.squad[gid] instanceof Set ? state.squad[gid] : (state.squad[gid] = new Set());
/** Spieler aus dem Kader oder Gast dieses Spiels als einheitlicher Eintrag. */
const kaderPerson = (gid, id) => { const p = players.find(x => x.id === id); if (p) return p; const x = guestsOf(gid).find(y => y.id === id); return x ? { id: x.id, nr: '', name: x.name, pos: x.tw ? 'TW' : (x.team || 'Gast'), gast: true } : null; };
const nachname = n => { const t = String(n).trim().split(/\\s+/); return t.length > 1 ? t.slice(1).join(' ') : t[0]; };
function kaderUndAufstellung(g) {
  const A = aufst(g.id), F = FORMATIONS[A.f] || FORMATIONS[Object.keys(FORMATIONS)[0]], squad = kaderSet(g.id), gaeste = guestsOf(g.id);
  const imKader = id => squad.has(id) || gaeste.some(x => x.id === id);
  A.xi = F.map((_, i) => (A.xi[i] && imKader(A.xi[i]) ? A.xi[i] : null));
  const auf = new Set(A.xi.filter(Boolean)), abw = id => absentOn(g.date).find(x => x.pid === id);
  const bank = [...[...squad].map(id => players.find(p => p.id === id)).filter(Boolean).sort(posVergleich), ...gaeste.map(x => kaderPerson(g.id, x.id))].filter(p => !auf.has(p.id));
  const aktiv = state.activeSpot !== null && state.activeSpot < F.length ? state.activeSpot : null;
  return `<div class="kaufst" data-lgid="${g.id}">
    <div class="row between"><b>Kader</b><span class="note">${squad.size + gaeste.length} im Kader · ${auf.size} von ${F.length} aufgestellt</span></div>
    <p class="sub" style="margin:0">Wer zusagt, steht automatisch im Kader. Haken setzen oder entfernen – das gilt hier und unter „Aufstellung“ gleichermaßen.</p>
    <div class="pickgrid">${players.map(p => { const a = abw(p.id); return `<label class="pick ${squad.has(p.id) ? 'on' : ''} ${a ? 'out' : ''}" for="sq-${p.id}"><input type="checkbox" id="sq-${p.id}" data-squad="${g.id}|${p.id}" ${squad.has(p.id) ? 'checked' : ''} ${a ? 'disabled' : ''}>${av(p)}<span>${esc(p.name)}<small>${a ? esc(a.why) : p.pos}</small></span></label>`; }).join('')}</div>
    ${guestBlock(g.id, 'Zusätzlich im Kader', 'Zum Beispiel aus der zweiten oder dritten Mannschaft, aus der A-Jugend oder ein Gastspieler.', true)}
    <div class="row between" style="margin-top:12px"><b>Aufstellung</b><div class="seg wrap">${Object.keys(FORMATIONS).map(f => `<button data-form="${esc(f)}" class="${A.f === f ? 'on' : ''}">${esc(f)}</button>`).join('')}</div></div>
    <p class="sub" style="margin:0">Position antippen, dann einen Spieler von der Bank wählen. Auf dem Feld verschieben ergibt ein eigenes System.</p>
    ${A.f === UNSAVED ? `<div class="row q"><span>Eigenes System. Unter welchem Namen speichern?</span><input type="text" id="sysname" value="${esc(state.sysName || '')}" placeholder="z. B. 3-5-2 gegen ${esc(g.opp)}" style="flex:1;min-width:180px"><button class="btn small" data-savesys="1">System speichern</button></div>` : ''}
    <div class="lineup">
      <div class="pitch" id="pitch" data-gid="${g.id}"><div class="circle"></div><div class="box l"></div><div class="box r"></div>
        ${F.map(([pos, x, y], i) => { const p = A.xi[i] && kaderPerson(g.id, A.xi[i]); return `<button class="spot ${aktiv === i ? 'active' : ''} ${p ? '' : 'leer'}" data-spot="${i}" style="left:${x}%;top:${y}%"><span class="dot">${p ? (p.nr || pos) : pos}</span><span class="nm">${p ? esc(nachname(p.name)) : pos}</span></button>`; }).join('')}
      </div>
      <div class="bench"><b>Bank</b>${aktiv !== null && A.xi[aktiv] ? `<button data-lclear="1" class="leeren"><span>Position ${F[aktiv][0]} leeren</span></button>` : ''}
        ${bank.map(p => `<button data-bench="${p.id}"><span class="row" style="flex-wrap:nowrap;gap:6px">${p.gast ? `<span class="av sm init guest">G</span>` : av(p, 'sm')}${p.nr ? p.nr + ' ' : ''}${esc(p.name)}</span><span class="note">${esc(p.pos || '')}</span></button>`).join('') || '<span class="note">Alle aus dem Kader stehen auf dem Feld. Weitere Spieler oben per Haken oder als Gast hinzufügen.</span>'}</div>
    </div></div>`;
}
function vAufstellung() {""")
# Reiter „Aufstellung“: derselbe Block
a0 = s.index("""  const F = FORMATIONS[state.formation], used = new Set(lineup);""")
a1 = s.index("""    </div></div>
  `;
}
function vNachbereitung() {""")
s = s[:a0] + """  return `${demo}${spielHead(g,'spiel-aufstellung')}
  <div class="card"><h3>Kader und Aufstellung</h3>${kaderUndAufstellung(g)}</div>`;
}
function vNachbereitung() {""" + s[a1 + len("""    </div></div>
  `;
}
function vNachbereitung() {"""):]
# Gegnervorbereitung: derselbe Block statt eigener Kaderliste
a0 = s.index("""    ['s-kader','Kader', src('Zusagen der Spieler'), `""")
a1 = s.index("""       ${guestBlock(g.id, 'Zusätzlich im Kader', 'Zum Beispiel aus der zweiten oder dritten Mannschaft, aus der A-Jugend oder ein Gastspieler.', true)}`],""", a0)
s = s[:a0] + """    ['s-kader','Kader und Aufstellung', src('Zusagen der Spieler, deine Auswahl'), kaderUndAufstellung(g)],""" + s[a1 + len("""       ${guestBlock(g.id, 'Zusätzlich im Kader', 'Zum Beispiel aus der zweiten oder dritten Mannschaft, aus der A-Jugend oder ein Gastspieler.', true)}`],"""):]
rep("""`<p class="sub" style="margin:0">Kommt nur ins Dossier, wenn du den Haken setzt.</p><a class="btn ghost small" href="#spiel-aufstellung" style="justify-self:start">Aufstellung bearbeiten</a>`],""",
    """`<p class="sub" style="margin:0">Kommt nur ins Dossier, wenn du den Haken setzt. Bearbeitet wird sie oben bei „Kader und Aufstellung“ (derselbe Stand wie im Reiter „Aufstellung“).</p>`],""")

# ---- Klicks: System, Position, Bank, Position leeren – je Spiel ----
gidCode = "const LG = (t.closest('[data-lgid]') || {}).dataset; const A = LG && LG.lgid ? aufst(LG.lgid) : null;"
rep("""  else if (d.form) { state.formation = d.form; state.activeSpot = null; render(); }""",
    """  else if (d.form) { """ + gidCode + """ if (A) A.f = d.form; else state.formation = d.form; state.activeSpot = null; render(); }
  else if (d.lclear) { """ + gidCode + """ if (A && state.activeSpot !== null) A.xi[state.activeSpot] = null; state.activeSpot = null; render(); }""")
rep("""  else if (d.bench && state.activeSpot !== null) { lineup[state.activeSpot] = d.bench; state.activeSpot = null; render(); }""",
    """  else if (d.bench) { """ + gidCode + """ if (!A) return; const F = FORMATIONS[A.f] || [];
    const ziel = state.activeSpot !== null ? state.activeSpot : F.findIndex((_, i) => !A.xi[i]); if (ziel < 0) { state.flash = 'Alle Positionen sind besetzt – erst eine Position antippen.'; render(); return; }
    A.xi = F.map((_, i) => (A.xi[i] === d.bench ? null : A.xi[i] || null)); A.xi[ziel] = d.bench;
    if (players.some(p => p.id === d.bench)) kaderSet(LG.lgid).add(d.bench); state.activeSpot = null; render(); }""")
# Haken raus: auch vom Feld nehmen
rep("""  else if (d.squad) { const [gid, pid] = d.squad.split('|'); const set = state.squad[gid]; t.checked ? set.add(pid) : set.delete(pid); render(); }""",
    """  else if (d.squad) { const [gid, pid] = d.squad.split('|'); const set = kaderSet(gid); t.checked ? set.add(pid) : set.delete(pid); if (!t.checked && state.aufst && state.aufst[gid]) state.aufst[gid].xi = state.aufst[gid].xi.map(x => x === pid ? null : x); render(); }""")
rep("""    state.guests[eid] = (state.guests[eid] || []).filter(g => g.id !== gid);""",
    """    state.guests[eid] = (state.guests[eid] || []).filter(g => g.id !== gid);
    if (state.aufst && state.aufst[eid]) state.aufst[eid].xi = state.aufst[eid].xi.map(x => x === gid ? null : x);""")
# Verschieben und eigenes System speichern: am System dieses Spiels
rep("""    if (state.formation !== UNSAVED) { FORMATIONS[UNSAVED] = FORMATIONS[state.formation].map(r=>[...r]); state.formation = UNSAVED; }""",
    """    const pg = document.getElementById('pitch'), A = pg && pg.dataset.gid ? aufst(pg.dataset.gid) : null, akt = A ? A.f : state.formation;
    if (akt !== UNSAVED) { FORMATIONS[UNSAVED] = FORMATIONS[akt].map(r=>[...r]); if (A) A.f = UNSAVED; else state.formation = UNSAVED; }""")
rep("""    FORMATIONS[n] = FORMATIONS[UNSAVED].map(r=>[...r]); delete FORMATIONS[UNSAVED]; state.formation = n; state.sysName = ''; render(); }""",
    """    FORMATIONS[n] = FORMATIONS[UNSAVED].map(r=>[...r]); delete FORMATIONS[UNSAVED]; const pg = document.getElementById('pitch'); if (pg && pg.dataset.gid) aufst(pg.dataset.gid).f = n; else state.formation = n; state.sysName = ''; render(); }""")
# Dossier: Startelf und System mitgeben (für die Aufstellungsfolie)
rep("""    kader, fahrzeit: g.home ? 0 : travelOf(g),""",
    """    kader, fahrzeit: g.home ? 0 : travelOf(g),
    aufstellung: (() => { const A = (state.aufst || {})[gid]; if (!A) return null; const F = FORMATIONS[A.f] || []; return { system: A.f, startelf: F.map(([pos], i) => { const p = A.xi[i] && kaderPerson(gid, A.xi[i]); return p ? { pos, name: p.name, nr: String(p.nr || '') } : null; }).filter(Boolean) }; })(),""")

rep("</style>\n</head>", """.kaufst { display: grid; gap: 8px; }
.spot.leer .dot { opacity: .55; border-style: dashed; }
.bench .leeren { border-color: var(--warn) !important; color: var(--warn); }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
