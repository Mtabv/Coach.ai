import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Optionaler lokaler fussball.de-Dienst (inoffiziell). Der Schlüssel bleibt im Entwicklungsserver
  // und wird nie an den Browser ausgeliefert. Siehe docs/fussballde-anbindung.md.
  const env = loadEnv(mode, process.cwd(), 'COACHAI_');
  const fdUrl = env.COACHAI_FUSSBALLDE_URL || 'http://localhost:8000';
  const fdKey = env.COACHAI_FUSSBALLDE_KEY || '';
  const fdProxy = {
    '/datenquelle/fussballde': {
      target: fdUrl,
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/datenquelle\/fussballde/, ''),
      headers: fdKey ? { 'X-API-Key': fdKey } : {},
    },
  };
  return {
    // Relative Pfade, damit der Build auch unter einem Unterpfad (z. B. als Artefakt) läuft.
    base: './',
    plugins: [react()],
    // Zweiter Einstieg: Speichern und Abgleich für die Teamzentrale (vom Server in die Seite eingebunden).
    build: { manifest: true, rollupOptions: { input: { main: 'index.html', teamzentrale: 'src/teamzentrale/sync.ts' } } },
    server: { host: true, port: 5173, proxy: fdProxy },
    preview: { host: true, port: 4173, proxy: fdProxy },
    test: { environment: 'node', include: ['src/**/*.test.ts', 'server/src/**/*.test.ts'] },
  };
});
