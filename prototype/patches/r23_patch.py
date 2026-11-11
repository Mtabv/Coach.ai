import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# Gespräche eines Tages und ihre Darstellung
rep("function vGespraeche() {", r"""/** Gespräche an einem Tag: geplante immer, geführte als erledigt. Nur für das Trainerteam sichtbar. */
function talksOn(iso) { return Object.entries(talks).flatMap(([pid,l])=>l.filter(t=>t.date===iso).map(t=>({...t, pid}))).sort((a,b)=>(a.time||'').localeCompare(b.time||'')); }
function talkChip(t, small) {
  const q = P(t.pid), done = t.status==='geführt';
  return `<a class="tchip ${done?'done':''} ${small?'sm':''}" href="#gespraech" data-talk="${t.pid}|${t.code}" title="${done?'Gespräch geführt':'Gespräch geplant'}: ${esc(q.name)} · ${esc(guideFor(t.code).label)}">${av(q,'sm')}<span>${t.time?`<b>${esc(t.time)}</b> `:''}${done?'✓ ':''}Gespräch ${esc(small ? q.name.split(' ').slice(-1)[0] : q.name)}${small?'':`<small>${esc(guideFor(t.code).label)}</small>`}</span></a>`;
}
function vGespraeche() {""")
# Kalender Woche: unter den Terminen, vor Diensten
rep("      ${state.showEv ? dutiesOn(iso).map(d=>dutyChip(d)).join('') : ''}", "      ${talksOn(iso).map(t=>talkChip(t)).join('')}\n      ${state.showEv ? dutiesOn(iso).map(d=>dutyChip(d)).join('') : ''}")
# Kalender Monat
rep("      ${state.showAbs && n && evs.length ? `<span class=\"chip\" style=\"color:var(--warn)\">TW ${c.tw} · Feld ${c.fp}</span>`:''}</div>`;",
    "      ${talksOn(iso).map(t=>talkChip(t, true)).join('')}${state.showAbs && n && evs.length ? `<span class=\"chip\" style=\"color:var(--warn)\">TW ${c.tw} · Feld ${c.fp}</span>`:''}</div>`;")
# Dashboard-Wochenleiste: Tage mit Gespräch sind keine Ruhetage
rep("  const cols = days.map(iso => events.some(e=>e.date===iso)", "  const cols = days.map(iso => (events.some(e=>e.date===iso) || talksOn(iso).length)")
rep("    if (!evs.length) return `<div class=\"sday rest", "    if (!evs.length && !talksOn(iso).length) return `<div class=\"sday rest")
rep("""      ${abs.length && iso>=TODAY ? `<div class="abs"><b>fehlen:</b> ${abs.map(a=>P(a.pid).name.split(' ').slice(1).join(' ')).join(', ')}</div>` : ''}""",
    """      ${talksOn(iso).map(t=>talkChip(t)).join('')}
      ${abs.length && iso>=TODAY ? `<div class="abs"><b>fehlen:</b> ${abs.map(a=>P(a.pid).name.split(' ').slice(1).join(' ')).join(', ')}</div>` : ''}""")
# Legende
rep("<span>Doppelklick auf ein Training öffnet es.</span>", "<span><i style=\"background:var(--warn)\"></i>Spielergespräch (nur Trainerteam)</span><span>Doppelklick auf ein Training öffnet es.</span>")
# Uhrzeit beim Planen
rep("""style="width:auto;max-width:200px"></label>""", """style="width:auto;max-width:200px"></label>
        <label class="fl" for="talk-time">Uhrzeit, optional<input type="text" id="talk-time" data-text="${k('zeit')}" value="${esc(state.texts[k('zeit')]||'')}" placeholder="z. B. 20:30, nach dem Training" style="max-width:260px"></label>""")
rep("const entry = {date: d.talksave==='geführt' ? TODAY : (k('datum') || addDays(TODAY, 2)), code: t.code,",
    "const entry = {date: d.talksave==='geführt' ? TODAY : (k('datum') || addDays(TODAY, 2)), time: d.talksave==='geführt' ? '' : k('zeit'), code: t.code,")
rep("`Gespräch für den ${fmt(entry.date)} vorgemerkt. Es steht auf dem Dashboard unter Administratives.`",
    "`Gespräch für den ${fmt(entry.date)}${entry.time?', '+entry.time:''} vorgemerkt. Es steht im Kalender und auf dem Dashboard unter Administratives.`")
rep("/* ---- Masken ---- */", """/* ---- Gespräche im Kalender ---- */
.tchip { display: flex; gap: 6px; align-items: center; text-decoration: none; color: var(--ink); background: var(--warn-soft); border: 1px solid var(--warn); border-left-width: 5px; border-radius: 8px; padding: 5px 7px; font-size: 13px; line-height: 1.25; min-width: 0; }
.tchip span { min-width: 0; overflow-wrap: anywhere; }
.tchip small { display: block; color: var(--muted); font-size: 12px; }
.tchip.done { opacity: .7; border-style: dashed; border-left-style: solid; }
.tchip.sm { padding: 1px 5px; font-size: 12px; border-left-width: 3px; border-radius: 4px; }
.tchip.sm .av { display: none; }
.tchip:hover { box-shadow: 0 0 0 2px var(--warn); }
/* ---- Masken ---- */""")
open(p, 'w').write(s); print('ok')
