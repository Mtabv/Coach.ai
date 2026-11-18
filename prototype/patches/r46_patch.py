import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ======================= 1. Teilnahme: Standard ist „dabei“ =======================
rep("""    else if (state.reply[e.id]==='ja' && p.id===ME) yes.push(p);
    else none.push(p);
  });
  return {yes, no, none};""", """    else yes.push(p); // ohne Antwort gilt: dabei
  });
  return {yes, no, none};""")

# Kaderliste im Training: einheitliche Zeilen, Gäste bei den Teilnehmenden
rep("""function attCard(e, a, pName) {""", """const POS_KURZ = {TW:'TW', ABW:'ABW', MF:'MF', ST:'ST'};
function attCard(e, a, pName) {
  const gaeste = guestsOf(e.id);
  const zeile = (p, rechts, unter = '') => `<li class="attz"><span class="posb">${POS_KURZ[p.pos] || ''}</span><span class="attname">${av(p,'sm')}<span class="attn2">${plink(p)}${unter ? `<span class="attgrund">${unter}</span>` : ''}</span></span><span class="attbtns">${rechts}</span></li>`;
  const ab = p => `<button class="attb no" data-att="${e.id}|${p.id}|nein" title="Absage eintragen" aria-label="Absage: ${esc(p.name)}">✕</button>`;
  const doch = p => `<button class="attb yes" data-att="${e.id}|${p.id}|ja" title="Doch dabei" aria-label="Doch dabei: ${esc(p.name)}">✓</button>`;
  const grund = (p, w) => `<select class="attwhy" data-attwhy="${e.id}|${p.id}" aria-label="Grund der Absage">${['ohne Angabe', ...REASONS].map(r=>`<option ${r===w?'selected':''}>${r}</option>`).join('')}</select>`;
  const gast = x => `<li class="attz"><span class="posb">${x.tw ? 'TW' : 'Gast'}</span><span class="attname"><span class="av sm init guest">${esc((x.team||'G').replace(/[^0-9A-Za-z]/g,'').slice(0,1) || 'G')}</span><span class="attn2">${esc(x.name)}<span class="attgrund">${esc(x.team || 'Gastspieler')}${x.note ? ' · ' + esc(x.note) : ''}</span></span></span><span class="attbtns"><button class="attb no" data-guestdel="${e.id}|${x.id}" title="Gast entfernen" aria-label="${esc(x.name)} entfernen">✕</button></span></li>`;
  return `<div class="card"><div class="row between"><h3>Teilnahme</h3>${availPill(e.date,'tr')}</div>
        <p class="note" style="margin:0">Alle sind dabei, solange niemand absagt. ✕ trägt eine Absage ein, ✓ nimmt sie zurück.</p>
        <div class="att att2"><div><h4>Dabei (${a.yes.length}${gaeste.length ? ` + ${gaeste.length} Gast${gaeste.length > 1 ? 'spieler' : ''}` : ''})</h4><ul>${a.yes.map(p => zeile(p, ab(p))).join('')}${gaeste.map(gast).join('')}</ul></div>
          <div><h4>Abgesagt (${a.no.length})</h4><ul>${a.no.map(([p,w,mine]) => zeile(p, doch(p), mine ? grund(p, w) : `${esc(w)} (Abwesenheit)`)).join('') || '<li class="note">Niemand</li>'}</ul></div></div>
        ${guestBlock(e.id, 'Gastspieler hinzufügen', 'Zum Beispiel aus der zweiten Mannschaft, der A-Jugend oder ein Probespieler.', true).replace(/<ul>[\\s\\S]*?<\\/ul>/, '').replace(/(<h4>Gastspieler hinzufügen) \\(\\d+\\)/, '$1')}</div>`;
}
function attCardAlt(e, a, pName) {""")
rep("""    if (m[pid] && m[pid].s === v) delete m[pid]; else m[pid] = v === 'nein' ? {s:'nein', why:'ohne Angabe'} : {s:'ja'};""",
    """    // Standard ist „dabei“: ✕ trägt eine Absage ein; ✓ nimmt sie zurück (bei eingetragener Abwesenheit: ausdrücklich dabei)
    const abwesend = absentOn((EV(eid) || {}).date || '').some(x => x.pid === pid);
    if (v === 'nein') m[pid] = {s:'nein', why:'ohne Angabe'};
    else if (abwesend) m[pid] = {s:'ja'}; else delete m[pid];""")

# Spielersicht: ohne Antwort steht „Dabei“ an
rep("        const r=state.reply[e.id], dl=deadlineOf(e), late=now>dl,",
    "        const r=state.reply[e.id] || 'ja', dl=deadlineOf(e), late=now>dl,")
rep("""           <span class="note">Absagen bis ${fmtDT(dl)}""", """           <span class="note">${state.reply[e.id] ? '' : 'Du bist automatisch dabei. '}Absagen bis ${fmtDT(dl)}""")

# ======================= 2. Kalender und Dashboard: nur die Anzahl der Absagen =======================
rep("""      ${state.showAbs && abs.length && evs.some(e=>e.type!=='ev'||state.showEv) ? `<div class="abs">${abs.map(a=>`<div><b>${plink(P(a.pid))}</b> · ${esc(a.why)}</div>`).join('')}</div>`:''}""",
    """      ${state.showAbs && abs.length && evs.some(e=>e.type!=='ev'||state.showEv) ? absKurz(abs) : ''}""")
rep("""      ${abs.length && iso>=TODAY ? `<div class="abs"><b>fehlen:</b> ${abs.map(a=>plink(P(a.pid), P(a.pid).name.split(' ').slice(1).join(' '))).join(', ')}</div>` : ''}""",
    """      ${abs.length && iso>=TODAY ? absKurz(abs) : ''}""")
rep("function weekStrip(start) {", """/** Absagen als Anzahl; Namen beim Drüberfahren (title) und beim Antippen (aufklappen). */
function absKurz(abs) {
  const liste = abs.map(a => `${P(a.pid) ? P(a.pid).name : ''} · ${a.why}`);
  return `<details class="abs abskurz" title="${esc(liste.join('\\n'))}"><summary>✕ ${abs.length} ${abs.length === 1 ? 'Absage' : 'Absagen'}</summary>${abs.map(a => `<div>${plink(P(a.pid))} · ${esc(a.why)}</div>`).join('')}</details>`;
}
function weekStrip(start) {""")

# ======================= 3. Vergangene Trainings nachbereiten =======================
rep("""      ${attCard(e, a, pName)}
      ${flashBox()}""", """      ${e.date <= TODAY ? trainingNachbereitung(e, list) : ''}
      ${attCard(e, a, pName)}
      ${flashBox()}""")
rep("function vEinheit() {", """function trainingNachbereitung(e, list) {
  const fertig = state.review[e.id] === 'done';
  const note = (state.trRating || {})[e.id] || '';
  return `<div class="card nb-training"><div class="row between"><h3>${fertig ? '✓ Training nachbereitet' : 'Training nachbereiten'}</h3>${fertig ? `<button class="btn ghost small" data-rvopen="${e.id}">Nachbereitung ändern</button>` : ''}</div>
    ${fertig && state.review[e.id] === 'done' ? `<p class="sub" style="margin:0">Die Notizen stehen bei den Übungen und bei der Einheit. Wer dabei war, siehst du unter „Teilnahme“.</p>` : `
    <p class="sub" style="margin:0">Wie lief es? Wer war dabei (unten unter „Teilnahme“), wie kamen die Übungen an, was nehmen wir mit?</p>
    <label class="fl" for="trr-${e.id}" style="max-width:260px">Wie war das Training insgesamt?<select class="f" id="trr-${e.id}" data-trrate="${e.id}"><option value="">–</option>${[['5','5 · sehr gut'],['4','4 · gut'],['3','3 · in Ordnung'],['2','2 · mäßig'],['1','1 · schlecht']].map(([v,l]) => `<option value="${v}" ${note===v?'selected':''}>${l}</option>`).join('')}</select></label>
    ${list.length ? list.map(id => `<div class="rv-ex"><span><b>${esc(X(id).name)}</b></span><div class="seg small">${Object.entries(MOOD).map(([k,l])=>`<button data-mood="${e.id}|${id}" data-v="${k}" class="${state.texts['mood-'+e.id+id]===k?'on':''}">${l}</button>`).join('')}</div>
        <textarea rows="3" data-text="rv-${e.id}-${id}" placeholder="Erfahrung, z. B. Feld kleiner machen" aria-label="Notiz zu ${esc(X(id).name)}">${esc(state.texts['rv-'+e.id+'-'+id] ?? '')}</textarea></div>`).join('')
      : textBox('rvx-'+e.id, 'Was wurde trainiert?', 'z. B. Rondo, Spielform 7 gegen 7, Abschluss', 3)}
    ${textBox('rvu-'+e.id, 'Notiz zum ganzen Training', 'z. B. Rondo zu lang, Gegenpressing-Teil top, Stimmung gut', 3)}
    <div class="row"><button class="btn" data-rvsave="${e.id}">Nachbereitung speichern</button></div>`}</div>`;
}
document.addEventListener('change', ev => { const t = ev.target; if (!t.dataset || !t.dataset.trrate) return; state.trRating = state.trRating || {}; if (t.value) state.trRating[t.dataset.trrate] = t.value; else delete state.trRating[t.dataset.trrate]; });
function vEinheit() {""")
rep("""  else if (d.rvsave) { const e = EV(d.rvsave), u = U(e.unit), who = document.getElementById('who').value;""",
    """  else if (d.rvsave) { const e = EV(d.rvsave), u = e.unit && U(e.unit), who = (document.getElementById('who') || {}).value || window.__11planIch || 'Trainer';""")
rep("""    const ut = (state.texts['rvu-'+e.id]||'').trim(); if (ut) (unitNotes[u.id] ||= []).push({date:e.date, who, text:ut});
    state.review[e.id] = 'done'; render(); }""", """    const ut = (state.texts['rvu-'+e.id]||'').trim(); if (ut && u) (unitNotes[u.id] ||= []).push({date:e.date, who, text:ut});
    state.review[e.id] = 'done'; state.flash = 'Nachbereitung gespeichert.'; render(); }""")
# In der Trainingsübersicht führt „Training nachbereiten“ zur Trainingsansicht (auch ohne geplante Einheit)
rep("""    ${past ? (u && !rv ? `<div class="tc-ctl one"><button class="btn ghost small" data-rvopen="${e.id}">Training nachbereiten</button></div>` : '') : """,
    """    ${past ? `<div class="tc-ctl one"><a class="btn ${rv === 'done' ? 'ghost' : ''} small" href="#einheit" data-settrain="${e.id}">${rv === 'done' ? '✓ Nachbereitung ansehen' : 'Training nachbereiten'}</a></div>` : """)

# ======================= 4. Prinzipien anlegen, ändern, löschen =======================
rep("const PR = id => principles.find(p=>p.id===id) || (id === 'ath' ? ATH : undefined);",
    "const PR = id => principles.find(p=>p.id===id) || (id === 'ath' ? ATH : id ? {id, phase:'', name:'(gelöschtes Prinzip)', hist:[]} : undefined);")
rep("""  ${PHASES.map(ph=>`<div class="card"><div class="row between"><h3>${ph}</h3><button class="btn ghost small">Prinzip hinzufügen</button></div>""",
    """  ${PHASES.map(ph=>`<div class="card"><div class="row between"><h3>${ph}</h3><button class="btn ghost small" data-pradd="${ph}">Prinzip hinzufügen</button></div>
    ${state.prNeu === ph ? `<div class="row prform"><input type="text" id="prneu" placeholder="z. B. Nach Ballgewinn sofort in die Tiefe" aria-label="Neues Prinzip" style="flex:1"><button class="btn small" data-prsave="${ph}">Hinzufügen</button><button class="btn ghost small" data-prcancel="1">Abbrechen</button></div>` : ''}""")
rep("""      <div><b>${p.name}</b><br><span class="note">""",
    """      <div>${state.prEdit === p.id ? `<span class="row prform"><input type="text" id="predit" value="${esc(p.name)}" aria-label="Prinzip ändern" style="flex:1"><button class="btn small" data-prsavename="${p.id}">Speichern</button><button class="btn ghost small" data-prcancel="1">Abbrechen</button></span>` : `<b>${esc(p.name)}</b> <button class="ib" data-predit="${p.id}" title="Prinzip ändern" aria-label="Prinzip ändern">${ICON.edit}</button><button class="ib" data-prdel="${p.id}" title="Prinzip löschen" aria-label="Prinzip löschen">${ICON.x}</button>`}<br><span class="note">""")
rep("  else if (d.datenladen) { datenLaden(d.datenladen); }", """  else if (d.datenladen) { datenLaden(d.datenladen); }
  else if (d.pradd) { state.prNeu = d.pradd; state.prEdit = null; render(); setTimeout(() => { const i = document.getElementById('prneu'); if (i) i.focus(); }, 0); }
  else if (d.prcancel) { state.prNeu = null; state.prEdit = null; render(); }
  else if (d.prsave) { const n = (document.getElementById('prneu') || {}).value || ''; if (!n.trim()) return;
    principles.push({id: 'pr' + Date.now(), phase: d.prsave, name: n.trim(), hist: []}); state.prNeu = null; state.flash = `Prinzip „${n.trim()}“ hinzugefügt.`; render(); }
  else if (d.predit) { state.prEdit = d.predit; state.prNeu = null; render(); setTimeout(() => { const i = document.getElementById('predit'); if (i) i.focus(); }, 0); }
  else if (d.prsavename) { const n = (document.getElementById('predit') || {}).value || '', x = principles.find(q => q.id === d.prsavename); if (x && n.trim()) x.name = n.trim(); state.prEdit = null; render(); }
  else if (d.prdel) { const x = principles.find(q => q.id === d.prdel); if (!x) return;
    const nutz = units.filter(u => u.pr === x.id).length + exercises.filter(q => q.pr === x.id).length;
    if (!confirm(`Prinzip „${x.name}“ löschen?${nutz ? `\\n\\n${nutz} Einheiten oder Übungen sind ihm zugeordnet; sie bleiben erhalten, nur ohne Prinzip.` : ''}`)) return;
    principles.splice(principles.indexOf(x), 1);
    units.forEach(u => { if (u.pr === x.id) u.pr = null; }); exercises.forEach(q => { if (q.pr === x.id) q.pr = null; });
    state.flash = `Prinzip „${x.name}“ gelöscht.`; render(); }""")

# ======================= 5. Eigener Schwerpunkt je Training =======================
rep("""  const e = EV(state.trainEv) || nextTrainings(1)[0], u = e.unit && U(e.unit), fp = PR(focusPr()), list = exListOf(e), a = attendance(e);""",
    """  const e = EV(state.trainEv) || nextTrainings(1)[0], u = e.unit && U(e.unit), woche = PR(focusPr()), fp = PR(e.focus || focusPr()), list = exListOf(e), a = attendance(e);""")
rep("""· Schwerpunkt der Woche: <b>${fp.phase}: ${fp.name}</b></p></div>""",
    """</p>
    <label class="fl tr-focus" for="trf-${e.id}">Schwerpunkt dieses Trainings<select class="f" id="trf-${e.id}" data-trfocus="${e.id}"><option value="">wie Woche: ${esc(woche.phase)}: ${esc(woche.name)}</option>${principles.map(q => `<option value="${q.id}" ${e.focus === q.id ? 'selected' : ''}>${esc(q.phase)}: ${esc(q.name)}</option>`).join('')}</select></label></div>""")
rep("function trainingNachbereitung(e, list) {", """document.addEventListener('change', ev => { const t = ev.target; if (!t.dataset || !t.dataset.trfocus) return; const e = EV(t.dataset.trfocus); if (!e) return; if (t.value) e.focus = t.value; else delete e.focus; render(); });
function trainingNachbereitung(e, list) {""")
# KI-Vorschlag und Seitenliste richten sich nach dem Schwerpunkt dieses Trainings
rep("  const fp = focusPr(), prev = trainings().filter(t=>t.date<e.date && t.unit).slice(-2).map(t=>t.unit);",
    "  const fp = e.focus || focusPr(), prev = trainings().filter(t=>t.date<e.date && t.unit).slice(-2).map(t=>t.unit);")

rep("</style>\n</head>", """.att.att2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.att ul li.attz { display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--line); }
.att ul li.attz:last-child { border-bottom: 0; }
.posb { font-size: 11px; font-weight: 700; color: var(--muted); text-align: center; border: 1px solid var(--line); border-radius: 6px; padding: 2px 0; }
.attname { display: flex; align-items: center; gap: 8px; min-width: 0; }
.attn2 { display: grid; min-width: 0; }
.attn2 > a, .attn2 > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.attgrund { font-size: 12px; color: var(--muted); }
.attgrund select.attwhy { margin-top: 2px; max-width: 100%; }
@media (max-width: 760px) { .att.att2 { grid-template-columns: 1fr; } }
details.abskurz { cursor: pointer; }
details.abskurz summary { list-style: none; font-size: 12px; color: var(--warn); }
details.abskurz summary::-webkit-details-marker { display: none; }
details.abskurz[open] { font-size: 12px; }
.tr-focus { margin-top: 6px; max-width: 460px; }
.prform { gap: 6px; margin: 6px 0; flex-wrap: nowrap; }
.nb-training .rv-ex { display: grid; gap: 6px; padding: 8px 0; border-top: 1px solid var(--line); }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
