// PDF-Dienst: rendert die Folien eines Spieltagsdossiers mit Chrome genau wie in der Vorschau und liefert
// eine fertige PDF-Datei (13,33 × 7,5 Zoll je Seite, randlos). Nur intern erreichbar (über die App).
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';

const PORT = Number(process.env.PORT || 8300);
const APP = (process.env.APP_URL || 'http://app:3000').replace(/\/$/, '');
const MAX = 40 * 1024 * 1024;
const CHROME = process.env.CHROME_PFAD || undefined;

let browser = null;
async function holeBrowser() {
  if (browser && browser.isConnected()) return browser;
  browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'] });
  return browser;
}

async function pdf(inhaltJson) {
  const b = await holeBrowser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  try {
    const page = await ctx.newPage();
    await page.addInitScript((j) => { window.__druckInhalt = JSON.parse(j); }, inhaltJson);
    await page.goto(`${APP}/#/pdfausgabe`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__pdfFertig === true, null, { timeout: 45000 });
    await page.emulateMedia({ media: 'print' });
    return await page.pdf({ preferCSSPageSize: true, printBackground: true });
  } finally { await ctx.close(); }
}

let laeuft = Promise.resolve();
createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/status') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true}'); }
  if (req.method !== 'POST' || req.url !== '/pdf') { res.writeHead(404); return res.end(); }
  let n = 0; const teile = [];
  for await (const c of req) { n += c.length; if (n > MAX) { res.writeHead(413); return res.end('zu groß'); } teile.push(c); }
  const json = Buffer.concat(teile).toString('utf8');
  // Nacheinander erzeugen: spart Speicher auf dem kleinen Server
  const auftrag = laeuft.then(() => pdf(json));
  laeuft = auftrag.catch(() => {});
  try {
    const datei = await auftrag;
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': datei.length });
    res.end(datei);
  } catch (e) {
    console.error('PDF fehlgeschlagen:', e.message);
    if (browser) { await browser.close().catch(() => {}); browser = null; }
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('PDF konnte nicht erzeugt werden.');
  }
}).listen(PORT, () => console.log(`PDF-Dienst läuft auf Port ${PORT}`));
