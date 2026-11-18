import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Treffpunkt: eigenes Feld in der Spielvorbereitung (Rahmen), in der Spieler-App „Treffpunkt: … / offen“ ----
rep("""       <div class="tb">${textBox('kleidung-'+g.id,'Kleidung','')}""",
    """       <div class="tb">${textBox('treffpunkt-'+g.id,'Treffpunkt für die Spieler','z. B. 13:00 Kabine Schulstraße – leer lassen, solange er noch offen ist',1)}${textBox('kleidung-'+g.id,'Kleidung','')}""")
rep("""        <span class="note" style="white-space:pre-line">${esc(state.texts['zeitplan-'+ng.id] ?? flowText(ng))}</span>""",
    """        <span class="pw-treff">📍 <b>Treffpunkt:</b> ${String(state.texts['treffpunkt-'+ng.id] || '').trim() ? esc(String(state.texts['treffpunkt-'+ng.id]).trim()) : '<span class="note">offen</span>'}</span>
        <span class="note" style="white-space:pre-line">${esc(state.texts['zeitplan-'+ng.id] ?? flowText(ng))}</span>""")

# ---- Fahrgemeinschaft: Wettbewerb und Spieltag über dem Gegner ----
rep("""    return `<div class="pw-fahrt"><b>${gameTitle(g)}</b>""", """    return `<div class="pw-fahrt"><span class="note">${esc(g.comp || '')}</span><b>${gameTitle(g)}</b>""")

# ---- Analytics, Spieler: Spiele als aufgeräumte Liste statt breiter Tabelle ----
rep("""${rows.length?`<div class="scroll"><table><tbody>${rows.map(g=>{""", """${rows.length?`${ALS_SPIELER ? '<div class="pw-spiele">' : '<div class="scroll"><table><tbody>'}${rows.map(g=>{""")
rep("""      return `<tr><td class="num">${fmt(g.date)}</td>""", """      if (ALS_SPIELER) return `<div class="pw-spiel"><div class="pw-spiel-k"><span class="note">${fmt(g.date)} · ${esc(g.comp || '')}</span><span class="pill game">${g.res}</span></div>
        <b>${gameTitle(g)}</b><span class="note">${xi?(so?`Startelf, bis ${so.min}′`:'Startelf'):sb?`eingewechselt ${sb.min}′`:'Bank, nicht eingesetzt'}${t?` · ${t} Tor${t>1?'e':''}`:''}</span>
        <div class="pw-min"><span class="pw-minbar"><i style="width:${mn/90*100}%"></i></span><b class="num">${mn}′</b></div></div>`;
      return `<tr><td class="num">${fmt(g.date)}</td>""")
rep("""}).join('')}</tbody></table></div>`:'<p class="sub">In den ausgewählten Wettbewerben nicht im Spielberichtsbogen.</p>'}""",
    """}).join('')}${ALS_SPIELER ? '</div>' : '</tbody></table></div>'}`:'<p class="sub">In den ausgewählten Wettbewerben nicht im Spielberichtsbogen.</p>'}""")

rep("</style>\n</head>", """.pw-treff { display: block; }
.pw-spiele { display: grid; gap: 8px; margin-top: 8px; }
.pw-spiel { display: grid; gap: 4px; border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; }
.pw-spiel-k { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.pw-min { display: flex; align-items: center; gap: 8px; }
.pw-minbar { flex: 1; height: 6px; border-radius: 3px; background: color-mix(in srgb, var(--muted) 25%, transparent); overflow: hidden; }
.pw-minbar i { display: block; height: 100%; background: var(--accent); }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
