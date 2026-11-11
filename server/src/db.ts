import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Eine SQLite-Datei für alles. Reicht für ein Trainerteam (und später einige Spieler) gut aus
 * und lässt sich als einzelne Datei sichern.
 */
export type Db = DatabaseSync;

const MIGRATIONS: string[] = [
  `CREATE TABLE users (
     id INTEGER PRIMARY KEY,
     email TEXT NOT NULL UNIQUE COLLATE NOCASE,
     name TEXT NOT NULL,
     role TEXT NOT NULL CHECK (role IN ('trainer','co-trainer')),
     pw_hash TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at INTEGER NOT NULL
   );
   CREATE TABLE invites (
     token_hash TEXT PRIMARY KEY,
     role TEXT NOT NULL,
     created_by INTEGER NOT NULL REFERENCES users(id),
     expires_at INTEGER NOT NULL,
     used_at INTEGER
   );
   CREATE TABLE login_attempts (
     key TEXT NOT NULL,
     at INTEGER NOT NULL
   );
   CREATE INDEX login_attempts_key ON login_attempts(key, at);
   CREATE TABLE app_state (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     version INTEGER NOT NULL,
     json TEXT NOT NULL,
     updated_by INTEGER REFERENCES users(id),
     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE app_state_history (
     version INTEGER PRIMARY KEY,
     json TEXT NOT NULL,
     updated_by INTEGER,
     updated_at TEXT NOT NULL
   );`,
];

export function openDb(file: string): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (v INTEGER NOT NULL)');
  const row = db.prepare('SELECT v FROM schema_version').get() as { v: number } | undefined;
  let v = row?.v ?? 0;
  if (!row) db.prepare('INSERT INTO schema_version (v) VALUES (0)').run();
  for (; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.prepare('UPDATE schema_version SET v = ?').run(v + 1);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return db;
}

/** Sicherung als eigene Datei (konsistent auch während des Betriebs). Behält die letzten `keep` Tage. */
export function backup(db: Db, dir: string, keep = 14, now = new Date()): string {
  mkdirSync(dir, { recursive: true });
  const day = now.toISOString().slice(0, 10);
  const file = join(dir, `coachai-${day}.db`);
  if (!existsSync(file)) db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const old = readdirSync(dir).filter((f) => /^coachai-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().reverse().slice(keep);
  for (const f of old) unlinkSync(join(dir, f));
  return file;
}
