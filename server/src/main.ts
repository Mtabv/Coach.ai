import { createServer } from 'node:http';
import { join } from 'node:path';
import { backup, openDb } from './db.js';
import { createHandler } from './app.js';

/** Start des 11Plan-Servers. Alle Einstellungen kommen aus Umgebungsvariablen (deploy/.env). */
const env = process.env;
const dataDir = env.COACHAI_DATEN || './daten';
const db = openDb(join(dataDir, 'coachai.db'));

const handler = createHandler(db, {
  publicDir: env.COACHAI_FRONTEND || './dist',
  setupToken: env.COACHAI_EINRICHTUNGSSCHLUESSEL || '',
  datendienstUrl: env.COACHAI_DATENDIENST_URL || 'http://datendienst:8000',
  datendienstKey: env.COACHAI_DATENDIENST_KEY || '',
  secureCookies: env.COACHAI_HTTPS !== '0',
  publicUrl: env.COACHAI_ADRESSE || 'http://localhost:3000',
});

const port = Number(env.PORT || 3000);
createServer(handler).listen(port, () => console.log(`11Plan läuft auf Port ${port}`));

// Tägliche Sicherung der Datenbank (zusätzlich zu den Hetzner-Backups), 14 Tage aufbewahrt.
const doBackup = () => { try { console.log('Sicherung:', backup(db, join(dataDir, 'sicherungen'))); } catch (e) { console.error('Sicherung fehlgeschlagen', e); } };
doBackup();
setInterval(doBackup, 6 * 3600e3).unref();
