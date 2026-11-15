import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Nachbereitung: unser Plan nach Spielphasen aus der Vorbereitung, bewertet 1–5 mit Begründung ----
rep('  <div class="card"><span class="label-src">Spielernoten</span>',
    '  ${phasenBewertung(g)}\n  <div class="card"><span class="label-src">Spielernoten</span>')
rep("function postProgress(g) {", """const PHASEN_NB = [['u1_grundordnung','Grundordnung'],['u2_ballbesitz','Eigener Ballbesitz'],['u3_ballverlust','Umschalten nach Ballverlust'],['u4_gegnerball','Gegen den Ball'],['u5_ballgewinn','Umschalten nach Ballgewinn'],['u6_standards','Standards']];
const phasenNote = (g, q) => ((state.phaseRating || {})[g.id] || {})[q] || '';
/** Was wir uns in der Gegnervorbereitung je Spielphase vorgenommen haben – und wie gut es geklappt hat. */
function phasenBewertung(g) {
  const plan = q => String(state.texts['e-' + q + '-' + g.id] ?? '').trim();
  const leer = PHASEN_NB.every(([q]) => !plan(q));
  return `<div class="card phasen-nb"><span class="label-src">Gegnervorbereitung</span><h3>Unser Plan nach Spielphasen</h3>
    <p class="sub">Was wir uns vorgenommen hatten, und wie gut es umgesetzt wurde: 1 = gar nicht, 5 = sehr gut.${leer ? ' Für dieses Spiel wurde in der Gegnervorbereitung nichts zu den Spielphasen eingetragen – bewerten kannst du trotzdem.' : ''}</p>
    <div class="phasen-liste">${PHASEN_NB.map(([q, name]) => `<div class="phase-nb">
      <div class="phase-plan"><b>${name}</b><div class="${plan(q) ? 'plan' : 'note'}">${plan(q) ? esc(plan(q)).replace(/\\n/g, '<br>') : 'nichts vorgenommen'}</div></div>
      <label class="fl phase-note" for="ph-${q}">Bewertung<select class="f" id="ph-${q}" data-phrate="${g.id}|${q}" aria-label="Bewertung ${name}">${['–','1','2','3','4','5'].map(n => `<option ${phasenNote(g, q) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="fl phase-grund" for="phg-${q}">Begründung<textarea id="phg-${q}" rows="5" data-text="nb-ph-${q}-${g.id}" aria-label="Begründung ${name}" placeholder="Was hat geklappt, was nicht? Woran lag es?">${esc(state.texts['nb-ph-' + q + '-' + g.id] ?? '')}</textarea></label>
    </div>`).join('')}</div></div>`;
}
document.addEventListener('change', ev => {
  const t = ev.target; if (!t.dataset || !t.dataset.phrate) return;
  const [gid, q] = t.dataset.phrate.split('|');
  state.phaseRating = state.phaseRating || {}; state.phaseRating[gid] = state.phaseRating[gid] || {};
  if (t.value === '–') delete state.phaseRating[gid][q]; else state.phaseRating[gid][q] = t.value;
});
function postProgress(g) {""")
# Zählt für „Nachbereitung fertig“ wie die Prinzipien
rep("  const prinz = Object.keys(state.rating || {}).filter(k => k.startsWith(g.id+'|')).length;",
    "  const prinz = Object.keys(state.rating || {}).filter(k => k.startsWith(g.id+'|')).length + Object.keys((state.phaseRating || {})[g.id] || {}).length;")
rep("</style>\n</head>", """.phasen-liste { display: grid; gap: 14px; }
.phase-nb { display: grid; grid-template-columns: minmax(0, 1.2fr) 110px minmax(0, 1.6fr); gap: 12px; align-items: start; padding-top: 12px; border-top: 1px solid var(--line); }
.phase-nb:first-child { border-top: 0; padding-top: 0; }
.phase-plan .plan { margin-top: 4px; white-space: normal; }
.phase-plan .note { margin-top: 4px; }
@media (max-width: 760px) { .phase-nb { grid-template-columns: 1fr; } }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
