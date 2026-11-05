// End-to-End-Prüfung der Vorschau mit Playwright (Chromium).
// Aufruf: Vorschau starten (npm run dev) und dann `npm run e2e` bzw. BASE_URL=… node scripts/e2e.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173/';
const OUT = path.resolve('scripts/out');
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` – ${detail}` : ''}`);
};

function zipEntries(buf) {
  const out = new Map();
  let i = 0;
  while (i < buf.length - 4 && buf.readUInt32LE(i) === 0x04034b50) {
    const method = buf.readUInt16LE(i + 8);
    const size = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extra = buf.readUInt16LE(i + 28);
    const name = buf.toString('utf8', i + 30, i + 30 + nameLen);
    const start = i + 30 + nameLen + extra;
    const data = buf.subarray(start, start + size);
    out.set(name, method === 8 ? inflateRawSync(data).toString('utf8') : data.toString('utf8'));
    i = start + size;
  }
  return out;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('dialog', (d) => d.accept());

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.goto(BASE + '#/');
await page.waitForSelector('.match-card');

// 1. Historischer Beispielfall
const top = await page.locator('.match-card').innerText();
check('Referenzfall auf der Übersicht', /TSG Wilhelmshöhe/.test(top) && /GSV Eintracht Baunatal/.test(top) && /Freitag, 23\.10\.2026/.test(top) && /19:00/.test(top));
check('Als historische Referenz gekennzeichnet, nicht als nächstes Spiel', /Historische Referenz/.test(top) && !/nächstes Spiel/i.test(await page.content()));
await page.screenshot({ path: `${OUT}/01-uebersicht.png`, fullPage: true });

// 3. Daten prüfen
await page.getByRole('link', { name: 'Vorbereitung starten' }).click();
await page.getByRole('button', { name: 'Beispieldaten laden' }).click();
await page.waitForSelector('text=Widersprüche');
const dataText = await page.locator('.main').innerText();
check('Widersprüchliche Tabellenwerte sichtbar', /Punkte von GSV Eintracht Baunatal/.test(dataText) && /widersprüchlich/.test(dataText));
check('Veraltete Quelle trotz neuerem Abruf erkannt', /Vereinsportal \(Beispieldaten\): Datenstand „nach dem 12\. Spieltag“ ist älter/.test(dataText));
check('Pokal-/Testspiele getrennt erkannt', /Pokal-\/Testspiel\(e\) erkannt/.test(dataText));
await page.screenshot({ path: `${OUT}/02-daten.png`, fullPage: true });

// 4. Fragebogen ausfüllen und nach Neuladen fortsetzen
await page.locator('.stepper a', { hasText: 'Fragebogen' }).click();
await page.locator('#q2_aufbau textarea').fill('Viel über die linke Seite, lange Bälle auf die Spitze.');
await page.locator('#q8_ausfaelle').getByRole('button', { name: 'Nicht bekannt' }).click();
await page.waitForTimeout(500);
await page.reload();
await page.waitForSelector('#q2_aufbau');
const q2 = await page.locator('#q2_aufbau textarea').inputValue();
check('Antwort nach Neuladen erhalten', q2.includes('linke Seite'));
check('„Nicht bekannt“ als gültige Antwort', /Nicht bekannt – rückgängig/.test(await page.locator('#q8_ausfaelle').innerText()));
const q1Text = await page.locator('#q1_grundordnung').innerText();
check('Fehlende Gegnerbeobachtung bleibt offen', /offen/.test(q1Text));

// 5. Kader ausdrücklich bearbeiten
await page.locator('#q12_kader').getByRole('button', { name: 'Kader bearbeiten' }).click();
await page.locator('#q12_kader input[aria-label="Name Spieler 1"]').fill('Max Keller (Kapitän)');
await page.locator('#q12_kader').getByRole('button', { name: '+ Spieler hinzufügen' }).click();
await page.locator('#q12_kader input[aria-label="Name Spieler 19"]').fill('Neuer Spieler');
check('Kader bearbeitet', /vom Trainer geprüft/.test(await page.locator('#q12_kader').innerText()));

// 6. Drei Botschaften und Leitmotiv
const raws = ['Mutig anlaufen – wir jagen den Ball gemeinsam', 'Ruhe am Ball: wir spielen flach durchs Zentrum', 'Standards verteidigen wir mit voller Konzentration'];
const missions = page.locator('#q14_auftrag fieldset.mission');
for (let i = 0; i < 3; i++) {
  await missions.nth(i).locator('textarea').fill(raws[i]);
  await missions.nth(i).getByRole('button', { name: /regelbasiert, keine KI/ }).click();
}
const h1 = await missions.nth(0).getByLabel('Überschrift').inputValue();
check('Regelbasierte Übernahme aus Trainertext', h1 === 'Mutig anlaufen', h1);
await page.getByLabel('Leitmotiv (schwarzer Kasten)').fill('Unser Platz. Unser Spiel.');
await page.getByLabel('Merksatz 1').fill('Jeder für jeden.');
await page.getByLabel('Merksatz 2').fill('Laut sein.');
await page.screenshot({ path: `${OUT}/03-fragebogen.png`, fullPage: true });

// Kleidung bestätigen, Ablauf und Abweichungen bestätigen
await page.locator('#q11_kleidung').getByRole('button', { name: 'Vorausgefüllte Kombination bestätigen' }).click();
await page.locator('#q9_abweichungen').getByRole('button', { name: /Keine Abweichung/ }).click();
await page.locator('#q10_ablauf').getByRole('button', { name: 'Berechneten Ablauf verwenden' }).click();
const sched = await page.locator('#q10_ablauf').innerText();
check('Heimspiel-Zeitplan berechnet', /17:20/.test(sched) && /18:00–18:20/.test(sched) && /Traineransprache/.test(sched));

// 7. Alle elf Dossierseiten
await page.locator('.stepper a', { hasText: 'Dossier' }).click();
await page.waitForSelector('.slide-tab');
const tabs = page.locator('.slide-tab');
const n = await tabs.count();
check('Elf Dossierseiten', n === 11, String(n));
for (let i = 0; i < n; i++) {
  await tabs.nth(i).click();
  await page.waitForTimeout(80);
  if ([0, 2, 3, 5, 7, 10].includes(i)) await page.locator('.slide-frame').screenshot({ path: `${OUT}/04-folie-${String(i + 1).padStart(2, '0')}.png` });
}
await tabs.nth(2).click();
check('Konflikt auf Folie 3 markiert', /widersprüchlich/.test(await page.locator('.slide-frame').innerText()));
await tabs.nth(7).click();
check('Fehlende Beobachtungen auf Folie 8 als offen markiert', /Keine Beobachtung erfasst/.test(await page.locator('.slide-frame').innerText()));
// Text bearbeiten
await page.getByLabel('Fußnote').fill('Beobachtungen aus zwei Spielen.');
await page.waitForTimeout(100);
check('Text im Dossier bearbeitet', /Beobachtungen aus zwei Spielen/.test(await page.locator('.slide-frame').innerText()));
await page.getByRole('button', { name: 'Entwurf speichern' }).click();
check('Entwurf gespeichert', await page.locator('.toast').isVisible());
await page.screenshot({ path: `${OUT}/05-dossier.png`, fullPage: true });

// 8. Bestätigen und im Archiv wieder öffnen
await page.locator('.stepper a', { hasText: 'Export' }).click();
await page.getByText('Mir ist bewusst').click();
await page.getByRole('button', { name: /Dossier bestätigen/ }).click();
await page.waitForSelector('text=eingefroren');
const archivedUrl = page.url();
const archText = await page.locator('.main').innerText();
check('Bestätigtes Dossier im Archiv geöffnet', /Bestätigtes Dossier · V1/i.test(archText) && /Unser Platz\. Unser Spiel\./.test(archText));
await page.screenshot({ path: `${OUT}/06-archiv.png`, fullPage: false });

// 10. Echte PPTX-Datei
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PPTX herunterladen' }).click()]);
const pptxPath = `${OUT}/${dl.suggestedFilename()}`;
await dl.saveAs(pptxPath);
const buf = readFileSync(pptxPath);
const entries = zipEntries(buf);
const slideFiles = [...entries.keys()].filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
check('PPTX heruntergeladen', statSync(pptxPath).size > 20000, `${dl.suggestedFilename()} (${Math.round(statSync(pptxPath).size / 1024)} KB)`);
check("PPTX-Dateiname", /^Dossier_TSG_Wilhelmshoehe_GSV_Eintracht_Baunatal_23\.10\.2026_V1\.pptx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
check('PPTX enthält 11 Folien mit nativen Tabellen', slideFiles.length === 11 && entries.get('ppt/slides/slide3.xml').includes('<a:tbl>'));
check('PPTX enthält Trainerbotschaften', entries.get('ppt/slides/slide11.xml').includes('Mutig anlaufen'));

// 9. Druckansicht / PDF
const printUrl = archivedUrl.replace('#/archiv/', '#/druck/');
const pp = await ctx.newPage();
await pp.goto(printUrl);
await pp.waitForSelector('.print-page');
check('Druckansicht mit 11 Seiten', (await pp.locator('.print-page').count()) === 11);
await pp.emulateMedia({ media: 'print' });
const pdfPath = `${OUT}/dossier.pdf`;
await pp.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
const pdf = readFileSync(pdfPath, 'latin1');
const pdfPages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
check('PDF aus Druckansicht mit 11 Seiten', pdfPages === 11, `${pdfPages} Seiten`);
await pp.close();

// Erhaltung bestätigter Versionen
await page.getByRole('button', { name: 'Als neue Version bearbeiten' }).click();
await page.waitForSelector('.slide-tab');
await page.locator('.slide-tab').nth(10).click();
await page.getByLabel('Leitmotiv').fill('GEÄNDERTES MOTTO');
await page.goto(BASE + '#/mannschaft');
await page.getByLabel('Mannschaftsname').first().fill('TSG Wilhelmshöhe Umbenannt');
await page.waitForTimeout(400);
await page.goto(archivedUrl);
await page.waitForSelector('text=eingefroren');
const frozenText = await page.locator('.main').innerText();
check('Bestätigte Version bleibt unverändert', /Unser Platz\. Unser Spiel\./.test(frozenText) && !/GEÄNDERTES MOTTO/.test(frozenText) && !/Umbenannt/.test(frozenText));
await page.goto(BASE + '#/mannschaft');
await page.getByLabel('Mannschaftsname').first().fill('TSG Wilhelmshöhe');

// 2. Neue Begegnung (auswärts, ohne Fahrzeit)
await page.goto(BASE + '#/spiel/neu');
await page.getByLabel('Gegner *').fill('SV Grünau');
await page.getByRole('radio', { name: 'Auswärtsspiel' }).click();
await page.getByLabel('Spieltag').fill('15');
await page.getByLabel('Datum').fill('2026-10-30');
await page.getByLabel('Anstoß').fill('15:00');
await page.getByLabel('Spielort').fill('Sportplatz Grünau');
await page.getByRole('button', { name: 'Begegnung anlegen' }).click();
await page.waitForSelector('text=Keine automatische Recherche in der Vorschau');
check('Neue Begegnung ohne Demo-Button (keine Live-Recherche versprochen)', (await page.getByRole('button', { name: 'Beispieldaten laden' }).count()) === 0);
check('Fehlende Fahrzeit erkannt', /Keine aktuelle Fahrzeit für diese Fahrt/.test(await page.locator('.main').innerText()));
await page.locator('.stepper a', { hasText: 'Fragebogen' }).click();
await page.waitForSelector('#q2_aufbau');
const fresh = await page.evaluate(() => [...document.querySelectorAll('textarea')].map((t) => t.value).join('|'));
check('Neue Begegnung ohne alte Gegnerantworten', !/linke Seite/.test(fresh) && !/Mutig anlaufen/.test(fresh));
check('Leitmotiv für neues Spiel offen', (await page.getByLabel('Leitmotiv (schwarzer Kasten)').inputValue()) === '');
check('Kein Beispielantworten-Button bei neuer Begegnung', (await page.getByRole('button', { name: 'Beispielantworten einsetzen' }).count()) === 0);
const awaySched = await page.locator('#q10_ablauf').innerText();
check('Auswärts ohne Fahrzeit: übrige Zeiten berechnet, Abfahrt offen', /13:25/.test(awaySched) && /offen/.test(awaySched));
await page.getByLabel('Fahrzeit für genau diese Fahrt (Minuten)').first().fill('40');
await page.waitForTimeout(150);
const awaySched2 = await page.locator('#q10_ablauf').innerText();
check('Auswärts mit Fahrzeit 40 Min.: Abfahrt 12:45, Treffpunkt 12:35', /12:45/.test(awaySched2) && /12:35/.test(awaySched2));
await page.locator('.stepper a', { hasText: 'Dossier' }).click();
await page.waitForSelector('.slide-tab');
await page.locator('.slide-tab').nth(3).click();
await page.locator('.slide-frame').screenshot({ path: `${OUT}/07-neues-spiel-folie4.png` });

// Eigene Mannschaft anlegen
await page.goto(BASE + '#/mannschaft/neu');
await page.getByLabel('Mannschaftsname *').fill('SV Teststadt U19');
await page.getByRole('button', { name: 'Mannschaft anlegen' }).click();
await page.waitForSelector('text=Zeitmuster Heimspiele');
check('Eigene Mannschaft mit eigenen (leeren) Standards', /Noch kein Zeitmuster/.test(await page.locator('.main').innerText()));
await page.goto(BASE + '#/');
check('Übersicht der neuen Mannschaft ohne Referenzspiel', /Noch keine Begegnung angelegt/.test(await page.locator('.main').innerText()));
// zurück zur TSG
await page.locator('.team-select').selectOption({ label: 'TSG Wilhelmshöhe' });

// Schmale Bildschirme
const dossierState = await page.evaluate(() => JSON.parse(localStorage.getItem('coachai:v1')).dossiers.map((d) => `${d.matchId.slice(0, 12)}:V${d.version}:${d.status}`));
console.log('Dossiers:', dossierState.join(', '));
check('Neue Version nach Bestätigung ist V2', dossierState.some((x) => x.startsWith('spiel-refere') && x.includes(':V2:entwurf')));
const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const mp = await mobile.newPage();
mp.on('pageerror', (e) => errors.push(e.message));
await mp.goto(BASE);
await mp.evaluate((s) => localStorage.setItem('coachai:v1', s), await page.evaluate(() => localStorage.getItem('coachai:v1')));
await mp.reload();
const routes = ['#/', '#/mannschaft', '#/archiv', '#/spiel/spiel-referenz-tsg-baunatal-2026-10-23/daten', '#/spiel/spiel-referenz-tsg-baunatal-2026-10-23/fragebogen', '#/spiel/spiel-referenz-tsg-baunatal-2026-10-23/dossier', '#/spiel/spiel-referenz-tsg-baunatal-2026-10-23/export'];
for (const r of routes) {
  await mp.goto(BASE + r);
  await mp.waitForTimeout(250);
  const { sw, iw } = await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  check(`Schmaler Bildschirm ohne horizontales Scrollen: ${r}`, sw <= iw + 1, `${sw}px / ${iw}px`);
  await mp.screenshot({ path: `${OUT}/mobil-${r.replace(/[^a-z]+/gi, '_')}.png`, fullPage: false });
}
const small = await mp.evaluate(() =>
  [...document.querySelectorAll('button, a.btn, .slide-tab')]
    .filter((e) => e.offsetParent)
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.height < 36).length,
);
check('Touchflächen ausreichend groß (≥ 36 px)', small === 0, `${small} zu kleine Elemente`);

check('Keine Laufzeitfehler in der Konsole', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden.`);
process.exit(failed.length ? 1 : 0);
