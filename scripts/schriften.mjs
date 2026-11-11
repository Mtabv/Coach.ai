// Legt die Schriften der Teamzentrale (Barlow Condensed, Source Sans 3) nach dist/schriften,
// damit sie vom eigenen Server kommen und nicht von Google.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
const ziel = 'dist/schriften';
mkdirSync(ziel, { recursive: true });
const css = [];
for (const [paket, familie, gewichte] of [['barlow-condensed', 'Barlow Condensed', [500, 600, 700]], ['source-sans-3', 'Source Sans 3', [400, 600, 700]]]) {
  for (const w of gewichte) {
    for (const teil of ['latin', 'latin-ext']) {
      const datei = `${paket}-${teil}-${w}-normal.woff2`;
      copyFileSync(`node_modules/@fontsource/${paket}/files/${datei}`, `${ziel}/${datei}`);
      css.push(`@font-face{font-family:'${familie}';font-style:normal;font-weight:${w};font-display:swap;src:url(/schriften/${datei}) format('woff2');${teil === 'latin' ? 'unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;' : ''}}`);
    }
  }
}
writeFileSync(`${ziel}/schriften.css`, css.join('\n') + '\n');
console.log('Schriften:', css.length, 'Dateien');
