import sys
p = sys.argv[1]
s = open(p).read()

def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# Hilfsfunktion: Upload-Feld für eine Grafik
rep("function vUebung() {", r"""function imgSlot(key, label, hint) {
  const url = state.imgs[key];
  if (url) return `<div class="sketch"><img src="${url}" alt="${esc(label)}">
    <div class="row"><label class="btn ghost small" for="img-${key}">Ersetzen</label><button class="btn ghost small" data-imgdel="${key}">Entfernen</button></div>
    <input type="file" accept="image/*" id="img-${key}" data-img="${key}" class="visually-hidden"></div>`;
  return `<label class="imgdrop" for="img-${key}" data-imgdrop="${key}"><b>${esc(label)} hochladen</b><span class="note">${hint}</span>
    <input type="file" accept="image/*" id="img-${key}" data-img="${key}" class="visually-hidden"></label>`;
}
function vUebung() {""")
# Übungsseite: Skizze oben rechts
rep("""    <div class="grid"><div class="card"><h3>Erfahrungen</h3>""", """    <div class="grid"><div class="card"><h3>Skizze</h3>${imgSlot('ex-'+e.id, 'Skizze', 'Foto einer Handskizze oder Grafik aus einem Taktiktool, als Bild (JPG, PNG). Datei hierher ziehen oder antippen.')}</div>
      <div class="card"><h3>Erfahrungen</h3>""")
# Einzeltraining: Vorschaubild je Übung und Grafik zur ganzen Einheit
rep("<div><h4>${id?exLink(id):esc(name)}</h4>", "<div class=\"tl-main\">${id && state.imgs['ex-'+id] ? `<a href=\"#uebung\" data-setex=\"${id}\"><img class=\"tl-thumb\" src=\"${state.imgs['ex-'+id]}\" alt=\"Skizze\"></a>` : ''}<div><h4>${id?exLink(id):esc(name)}</h4>")
rep("${noteLine(exNotes[id])}`:`<span class=\"note\">${min} min</span>`}</div>", "${noteLine(exNotes[id])}`:`<span class=\"note\">${min} min</span>`}</div></div>")
rep("""          <div class="exdrop" data-exdrop="${e.id}">Übung oder Einheit von rechts hierher ziehen oder dort antippen</div></div></div>""",
    """          <div class="exdrop" data-exdrop="${e.id}">Übung oder Einheit von rechts hierher ziehen oder dort antippen</div></div></div>
      <div class="card"><h3>Grafik zum Training</h3><p class="sub" style="margin:0">Zum Beispiel der Platzaufbau oder ein Plan für die ganze Einheit. Skizzen zu einzelnen Übungen lädst du bei der Übung hoch, sie erscheinen dann hier im Ablauf.</p>
        ${imgSlot('tr-'+e.id, 'Grafik', 'Bild (JPG, PNG). Datei hierher ziehen oder antippen.')}</div>""")
# Übung erfassen: Skizze gleich mitgeben
rep("""      <label class="fl" for="ue-v">Variationen<textarea id="ue-v" rows="2"></textarea></label>
    </div></div>`;""", """      <label class="fl" for="ue-v">Variationen<textarea id="ue-v" rows="2"></textarea></label>
      <div class="fl"><span>Skizze</span>${imgSlot('new', 'Skizze', 'Foto oder Grafik, optional')}</div>
    </div></div>`;""")
# Ereignisse: Datei wählen, ziehen, entfernen
rep("  else if (d.comp) {", "  else if (d.img) { const f = t.files && t.files[0]; if (f && f.type.startsWith('image/')) { state.imgs[d.img] = URL.createObjectURL(f); render(); } }\n  else if (d.comp) {")
rep("  else if (d.more) {", "  else if (d.imgdel) { delete state.imgs[d.imgdel]; render(); }\n  else if (d.more) {")
rep("document.addEventListener('drop', e => {", """document.addEventListener('dragover', e => { const z = e.target.closest && e.target.closest('[data-imgdrop]'); if (z) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('[data-imgdrop]'); if (z) z.classList.remove('over'); });
document.addEventListener('drop', e => {
  const z = e.target.closest && e.target.closest('[data-imgdrop]');
  if (z) { e.preventDefault(); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) { state.imgs[z.dataset.imgdrop] = URL.createObjectURL(f); render(); } return; }
""")
rep("include:{}, comp:", "include:{}, imgs:{}, comp:")
rep("/* ---- Runde 8 ---- */", """/* ---- Skizzen ---- */
.imgdrop { display: grid; gap: 4px; place-items: center; text-align: center; border: 2px dashed var(--line); border-radius: 10px; padding: 18px 12px; cursor: pointer; background: var(--bg); }
.imgdrop:hover, .imgdrop.over { border-color: var(--accent); background: var(--accent-soft); }
.imgdrop b { color: var(--accent); }
.sketch { display: grid; gap: 8px; }
.sketch img { width: 100%; max-height: 420px; object-fit: contain; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
.tl-main { display: flex; gap: 12px; align-items: start; min-width: 0; }
.tl-thumb { width: 96px; height: 72px; object-fit: cover; border-radius: 6px; border: 1px solid var(--line); background: #fff; flex: none; }
/* ---- Runde 8 ---- */""")
open(p, 'w').write(s)
print('ok')
