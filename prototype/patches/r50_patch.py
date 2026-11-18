import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Dienst und Abwesenheit: Hinweis „heute Dienst“ und „du bist nicht da – bitte umlegen“ ----
rep("function pvStart(me) {", """/** Tage, an denen ein Dienst wirklich anfällt: Termin-Dienste am Termin, Zeitraum-Dienste an Trainings- und Spieltagen. */
const dienstTage = d => d.ev ? (EV(d.ev) ? [EV(d.ev).date] : []) : dutyDates(d).filter(iso => events.some(e => e.date === iso && (e.type === 'tr' || e.type === 'gm')));
const abwesendAm = (pid, iso) => absentOn(iso).some(a => a.pid === pid);
/** Eigene Dienste, die mit eigenen Abwesenheiten kollidieren (ab heute). */
const dienstKonflikte = pid => duties.filter(d => dienstOk(d) && d.who.includes(pid)).map(d => ({ d, tage: dienstTage(d).filter(iso => iso >= TODAY && abwesendAm(pid, iso)) })).filter(x => x.tage.length);
function dienstHinweise() {
  const kon = dienstKonflikte(ME);
  const heute = duties.filter(d => dienstOk(d) && d.who.includes(ME) && dienstTage(d).includes(TODAY) && !abwesendAm(ME, TODAY));
  return kon.map(({ d, tage }) => {
    const istHeute = tage[0] === TODAY;
    return `<div class="pt pw-warnung"><span>⚠️ <b>Achtung${istHeute ? ', heute' : ''}:</b> Du hast <b>${esc(d.title.split(' (')[0])}</b>, bist aber ${tage.length === 1 ? `am ${wochentag(tage[0])} ${fmt(tage[0])}` : `an ${tage.length} Tagen (${tage.map(t => wochentag(t) + ' ' + fmt(t)).join(', ')})`} nicht da${istHeute ? ' und hast ihn noch nicht umgelegt' : ''}. Bitte gib den Dienst an jemanden ab, der da ist – er bekommt eine Mitteilung.</span>${dienstAbgeben(d)}</div>`;
  }).join('') + heute.map(d => `<div class="pt pw-heute"><span>🧺 <b>Denk dran:</b> Du hast heute ${esc(d.title.split(' (')[0])}${d.title.includes('(') ? ` (${esc(d.title.split(' (')[1].replace(/\\)$/, ''))})` : ''}.</span></div>`).join('');
}
function pvStart(me) {""")
rep("""    ${mitteilungen}""", """    ${mitteilungen}
    ${dienstHinweise()}""")
# Nach dem Eintragen einer Abwesenheit: direkt auf einen Konflikt hinweisen
rep("  else if (d.abssave) {", "  else if (d.abssave) { setTimeout(() => { if (location.hash === '#spielersicht' && dienstKonflikte(ME).length) { const w = document.querySelector('.pw-warnung'); if (w) w.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, 50);")
# Trainer: im Dienste-Überblick sichtbar, wo jemand eingeteilt ist, aber fehlt
rep("""${out.length?`<br><span class="note">ausgetragen, abwesend: ${out.map(id=>plink(P(id))).join(', ')}</span>`:''}""",
    """${out.length?`<br><span class="note">ausgetragen, abwesend: ${out.map(id=>plink(P(id))).join(', ')}</span>`:''}${d.who.filter(id => dienstTage(d).some(iso => iso >= TODAY && abwesendAm(id, iso))).map(id => `<br><span class="pill warn">${esc(P(id) ? P(id).name : '')} ist an einem Diensttag nicht da – noch nicht umgelegt</span>`).join('')}""")

rep("</style>\n</head>", """.pw-warnung { border-color: var(--warn) !important; background: color-mix(in srgb, var(--warn) 10%, transparent); }
.pw-heute { border-color: var(--accent) !important; }
</style>
</head>""")
# ---- Ab 17 Uhr: Dienst von jemandem, der heute nicht da ist, automatisch an einen anwesenden Spieler ----
# Übergang, bis der Server das um 17 Uhr selbst erledigt: läuft, sobald die Teamzentrale nach 17 Uhr offen ist.
# Die Auswahl ist zufällig, aber für Dienst und Tag fest (alle Geräte wählen dieselbe Person).
rep("function pvStart(me) {", """function autoUmlegen() {
  if (new Date().getHours() < 17) return;
  state.autoUmgelegt = state.autoUmgelegt || {};
  for (const d of duties) {
    if (!dienstOk(d) || !dienstTage(d).includes(TODAY)) continue;
    for (const alt of d.who.filter(pid => abwesendAm(pid, TODAY))) {
      const k = d.id + '|' + TODAY + '|' + alt;
      if (state.autoUmgelegt[k]) continue;
      const frei = players.filter(p => !d.who.includes(p.id) && !abwesendAm(p.id, TODAY));
      if (!frei.length) continue;
      let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      const neu = frei[h % frei.length].id, titel = esc(d.title.split(' (')[0]);
      d.who = d.who.map(x => x === alt ? neu : x);
      state.autoUmgelegt[k] = { neu, am: new Date().toISOString() };
      mitteilen(neu, `Dir wurde für heute automatisch der <b>${titel}</b> zugewiesen, weil ${esc(P(alt) ? P(alt).name : 'jemand')} nicht da ist.`);
      mitteilen(alt, `Dein <b>${titel}</b> für heute wurde automatisch an ${esc(P(neu).name)} übergeben, weil du abwesend bist.`);
    }
  }
}
function pvStart(me) {""")
rep("  faktenFuerSpiel();\n", "  faktenFuerSpiel();\n  autoUmlegen();\n")
open(p, 'w').write(s); print('ok')
