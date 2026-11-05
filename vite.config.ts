import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative Pfade, damit der Build auch unter einem Unterpfad (z. B. als Artefakt) läuft.
  base: './',
  plugins: [react()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
