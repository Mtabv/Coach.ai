import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Übungspool: neue Übung gut sichtbar, bestehende Übungen bearbeiten ----
# Kopf des Pools: Knopf „+ Neue Übung“
rep("""    <div class="card pooltools"><div class="row between"><h3>Übungspool <span class="note">(${list.length} von ${exercises.length})</span></h3>
      <div class="row">""",
    """    <div class="card pooltools"><div class="row between"><h3>Übungspool <span class="note">(${list.length} von ${exercises.length})</span></h3>
      <div class="row"><a class="btn small" href="#uebung-neu">+ Neue Übung</a>""")

# Übungsansicht: „Bearbeiten“ öffnet die Maske mit den Werten der Übung
rep("""<button class="btn ghost small" data-flash="Bearbeiten: im Entwurf ohne Funktion.">Bearbeiten</button>""",
    """<a class="btn ghost small" href="#uebung-neu" data-exedit="${e.id}">Bearbeiten</a>""")

# Maske: neu oder bearbeiten
rep("""function vUebungNeu() {
  return `${demo}
  <div class="crumb"><a href="#training" data-ttabgo="uebungen">Übungspool</a> › Neue Übung</div>
  <div class="head"><div><h1>Übung erfassen</h1><p>Erzählen oder schreiben, dazu ein Foto der Skizze. Die KI erfindet keine Übungen, sie ordnet eure ein.</p></div>""",
    """function vUebungNeu() {
  const ed = state.exEdit ? X(state.exEdit) : null, dd = ed ? (EXD[ed.id] || ['','','','','']) : ['','','','',''];
  const w = v => esc(v && v !== '–' ? String(v) : '');
  const slot = ed ? 'ex-' + ed.id : 'new';
  return `${demo}
  <div class="crumb"><a href="#training" data-ttabgo="uebungen">Übungspool</a> › ${ed ? `<a href="#uebung" data-setex="${ed.id}">${esc(ed.name)}</a> › Bearbeiten` : 'Neue Übung'}</div>
  <div class="head"><div><h1>${ed ? 'Übung bearbeiten' : 'Übung erfassen'}</h1><p>${ed ? 'Ändere, was nicht mehr passt. Gespeichert wird erst mit „Änderungen speichern“.' : 'Erzählen oder schreiben, dazu ein Foto der Skizze. Die KI erfindet keine Übungen, sie ordnet eure ein.'}</p></div>""")
rep("""      <label class="fl" for="ue-n">Name *<input id="ue-n" type="text" placeholder="z. B. Pressing-Auslöser Rückpass"></label>
      <label class="fl" for="ue-p">Prinzip (optional)<select class="f" id="ue-p">${prOptionen('')}</select></label>
      <label class="fl" for="ue-k">Art<select class="f" id="ue-k">${KINDS.map(k=>`<option>${k}</option>`).join('')}</select></label>
      <label class="fl" for="ue-s">Spieler<input id="ue-s" type="text" placeholder="z. B. 10–14"></label>
      <label class="fl" for="ue-f">Feld<input id="ue-f" type="text" placeholder="z. B. 40 × 30 m"></label>
      <label class="fl" for="ue-d">Dauer in Minuten<input id="ue-d" type="number" min="5" step="5" class="f" value="20"></label>
    </div>
    <div class="grid g2">
      <label class="fl" for="ue-a">Aufbau<textarea id="ue-a" rows="3" placeholder="Feld, Material, Teams"></textarea></label>
      <label class="fl" for="ue-b">Ablauf<textarea id="ue-b" rows="3"></textarea></label>
      <label class="fl" for="ue-z">Ziel<textarea id="ue-z" rows="3"></textarea></label>
      <label class="fl" for="ue-c">Coaching-Schwerpunkte<textarea id="ue-c" rows="3"></textarea></label>
      <label class="fl" for="ue-v">Variationen<textarea id="ue-v" rows="2"></textarea></label>
      <div class="fl"><span>Skizze</span>${imgSlot('new', 'Skizze', 'Foto oder Grafik, optional')}</div>
    </div>
    <div class="row"><button class="btn" data-exsave="1">Übung speichern</button><a class="btn ghost" href="#training" data-ttabgo="uebungen">Abbrechen</a><span class="note">* Pflichtfeld</span></div>""",
    """      <label class="fl" for="ue-n">Name *<input id="ue-n" type="text" placeholder="z. B. Pressing-Auslöser Rückpass" value="${w(ed && ed.name)}"></label>
      <label class="fl" for="ue-p">Prinzip (optional)<select class="f" id="ue-p">${prOptionen(ed ? ed.pr || '' : '')}</select></label>
      <label class="fl" for="ue-k">Art<select class="f" id="ue-k">${[...new Set([...KINDS, ...(ed && ed.kind ? [ed.kind] : [])])].map(k=>`<option ${ed && ed.kind===k?'selected':''}>${k}</option>`).join('')}</select></label>
      <label class="fl" for="ue-s">Spieler<input id="ue-s" type="text" placeholder="z. B. 10–14" value="${w(ed && ed.players)}"></label>
      <label class="fl" for="ue-f">Feld<input id="ue-f" type="text" placeholder="z. B. 40 × 30 m" value="${w(ed && ed.field)}"></label>
      <label class="fl" for="ue-d">Dauer in Minuten<input id="ue-d" type="number" min="5" step="5" class="f" value="${ed ? ed.min || 20 : 20}"></label>
    </div>
    <div class="grid g2">
      <label class="fl" for="ue-a">Aufbau<textarea id="ue-a" rows="3" placeholder="Feld, Material, Teams">${esc(dd[1] || '')}</textarea></label>
      <label class="fl" for="ue-b">Ablauf<textarea id="ue-b" rows="3">${esc(dd[2] || '')}</textarea></label>
      <label class="fl" for="ue-z">Ziel<textarea id="ue-z" rows="3">${esc(dd[0] || '')}</textarea></label>
      <label class="fl" for="ue-c">Coaching-Schwerpunkte<textarea id="ue-c" rows="3">${esc(dd[3] || '')}</textarea></label>
      <label class="fl" for="ue-v">Variationen<textarea id="ue-v" rows="2">${esc(dd[4] || '')}</textarea></label>
      <div class="fl"><span>Skizze</span>${imgSlot(slot, 'Skizze', 'Foto oder Grafik, optional')}</div>
    </div>
    <div class="row"><button class="btn" data-exsave="1">${ed ? 'Änderungen speichern' : 'Übung speichern'}</button><a class="btn ghost" href="${ed ? '#uebung' : '#training'}" ${ed ? `data-setex="${ed.id}"` : 'data-ttabgo="uebungen"'}>Abbrechen</a><span class="note">* Pflichtfeld</span></div>""")

# Speichern: bestehende Übung ändern statt neue anlegen
rep("""    const id = 'xn' + Date.now(); exercises.push({id, name, pr: v('ue-p') || null, kind: v('ue-k'), players: v('ue-s') || '–', field: v('ue-f') || '–', min: +v('ue-d') || 20, src: 'Trainer'});""",
    """    const alt = location.hash === '#uebung-neu' && state.exEdit ? X(state.exEdit) : null;
    if (alt) {
      Object.assign(alt, {name, pr: v('ue-p') || null, kind: v('ue-k'), players: v('ue-s') || '–', field: v('ue-f') || '–', min: +v('ue-d') || alt.min || 20});
      EXD[alt.id] = [v('ue-z'), v('ue-a'), v('ue-b'), v('ue-c'), v('ue-v')];
      state.exId = alt.id; state.exEdit = null; state.flashNext = `„${name}“ geändert.`; location.hash = 'uebung'; return;
    }
    const id = 'xn' + Date.now(); exercises.push({id, name, pr: v('ue-p') || null, kind: v('ue-k'), players: v('ue-s') || '–', field: v('ue-f') || '–', min: +v('ue-d') || 20, src: 'Trainer'});""")

# Klicks: „Bearbeiten“ merkt sich die Übung, jeder andere Weg zur Maske startet leer
rep("  if (d.ttabgo) state.trainTab = d.ttabgo;",
    "  if (d.ttabgo) state.trainTab = d.ttabgo;\n  if (t.getAttribute && t.getAttribute('href') === '#uebung-neu') state.exEdit = d.exedit || null;")
open(p, 'w').write(s); print('ok')
