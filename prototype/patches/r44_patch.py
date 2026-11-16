import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:110]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# ---- Bilder (Skizzen, Trikotfotos) dauerhaft speichern ----
# Vorher wurde nur eine vorläufige Browser-Adresse (blob:…) gespeichert: gilt nur auf dem Gerät und nur,
# solange die Seite offen ist. Jetzt wird das Bild verkleinert (max. 1600 px, JPEG) und selbst gespeichert.
rep("function imgSlot(key, label, hint) {", """/** Bilddatei verkleinern und als Daten-Adresse liefern (wird mit den Eingaben gespeichert und geteilt). */
function bildVerkleinern(file, max = 1600) {
  return new Promise((ok, fehler) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * f)); c.height = Math.max(1, Math.round(img.naturalHeight * f));
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); fehler(new Error('Bild konnte nicht gelesen werden')); };
    img.src = url;
  });
}
async function bildSetzen(ziel, key, file) {
  if (!file || !(file.type.startsWith('image/') || /\\.(heic|heif|jpe?g|png|webp|gif)$/i.test(file.name))) return;
  state.flash = 'Bild wird verarbeitet …'; render();
  try { ziel[key] = await bildVerkleinern(file); state.flash = null; }
  catch (e) { state.flash = 'Das Bild konnte nicht gelesen werden. Bitte als JPG oder PNG versuchen (auf dem iPhone: Einstellungen › Kamera › Formate › „Maximale Kompatibilität“).'; }
  render();
}
/** Alte, nicht mehr gültige Browser-Adressen entfernen – solche Bilder müssen einmal neu hochgeladen werden. */
function toteBilderEntfernen() {
  for (const ziel of [state.imgs, state.kitPhoto]) if (ziel) for (const [k, v] of Object.entries(ziel)) if (typeof v === 'string' && v.startsWith('blob:')) delete ziel[k];
}
function imgSlot(key, label, hint) {""")
# Zwei Wege: Bild/Datei wählen und (auf dem Handy) direkt fotografieren
rep("""    <div class="row"><label class="btn ghost small" for="img-${key}">Ersetzen</label><button class="btn ghost small" data-imgdel="${key}">Entfernen</button></div>
    <input type="file" accept="image/*" id="img-${key}" data-img="${key}" class="visually-hidden"></div>`;
  return `<label class="imgdrop" for="img-${key}" data-imgdrop="${key}"><b>${esc(label)} hochladen</b><span class="note">${hint}</span>
    <input type="file" accept="image/*" id="img-${key}" data-img="${key}" class="visually-hidden"></label>`;""",
    """    <div class="row"><label class="btn ghost small" for="img-${key}">Ersetzen</label><label class="btn ghost small" for="cam-${key}">Neues Foto</label><button class="btn ghost small" data-imgdel="${key}">Entfernen</button></div>
    <input type="file" accept="image/*" id="img-${key}" data-img="${key}" class="visually-hidden"><input type="file" accept="image/*" capture="environment" id="cam-${key}" data-img="${key}" class="visually-hidden"></div>`;
  return `<div class="imgwahl"><label class="imgdrop" for="img-${key}" data-imgdrop="${key}"><b>${esc(label)} hochladen</b><span class="note">${hint}</span>
    <input type="file" accept="image/*" id="img-${key}" data-img="${key}" class="visually-hidden"></label>
    <label class="btn ghost small kamera" for="cam-${key}">📷 Foto aufnehmen</label><input type="file" accept="image/*" capture="environment" id="cam-${key}" data-img="${key}" class="visually-hidden"></div>`;""")
rep("""  else if (d.img) { const f = t.files && t.files[0]; if (f && f.type.startsWith('image/')) { state.imgs[d.img] = URL.createObjectURL(f); render(); } }""",
    """  else if (d.img) { const f = t.files && t.files[0]; t.value = ''; void bildSetzen(state.imgs, d.img, f); }""")
rep("""  else if (d.kitfile) { const f = t.files && t.files[0]; if (f) { state.kitPhoto[d.kitfile] = URL.createObjectURL(f); render(); } }""",
    """  else if (d.kitfile) { const f = t.files && t.files[0]; t.value = ''; void bildSetzen(state.kitPhoto, d.kitfile, f); }""")
rep("""if (f && f.type.startsWith('image/')) { state.imgs[z.dataset.imgdrop] = URL.createObjectURL(f); render(); } return; }""",
    """if (f) void bildSetzen(state.imgs, z.dataset.imgdrop, f); return; }""")
rep("function render() {\n", "function render() {\n  toteBilderEntfernen();\n")
rep("</style>\n</head>", """.imgwahl { display: grid; gap: 8px; }
.imgwahl .kamera { justify-self: start; }
@media (hover: hover) and (pointer: fine) { .imgwahl .kamera { display: none; } }
</style>
</head>""")
open(p, 'w').write(s); print('ok')
