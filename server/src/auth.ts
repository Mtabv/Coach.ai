import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Db } from './db.js';

export type Role = 'trainer' | 'co-trainer';
export interface User { id: number; email: string; name: string; role: Role }

const SCRYPT = { N: 16384, r: 8, p: 1, len: 64 };
const SESSION_DAYS = 30;
const INVITE_DAYS = 7;

/** Passwort-Hash mit scrypt und zufälligem Salz. Das Passwort selbst wird nie gespeichert. */
export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, SCRYPT.len, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(pw, Buffer.from(salt, 'base64'), expected.length, { N: +n, r: +r, p: +p });
  return timingSafeEqual(expected, actual);
}

export function checkPasswordRules(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < 10) return 'Das Passwort braucht mindestens 10 Zeichen.';
  if (pw.length > 200) return 'Das Passwort ist zu lang.';
  return null;
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const token = () => randomBytes(32).toString('base64url');

export function countUsers(db: Db): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
}

export function createUser(db: Db, u: { email: string; name: string; role: Role; password: string }): User {
  const r = db.prepare('INSERT INTO users (email, name, role, pw_hash) VALUES (?, ?, ?, ?)').run(u.email.trim(), u.name.trim(), u.role, hashPassword(u.password));
  return { id: Number(r.lastInsertRowid), email: u.email.trim(), name: u.name.trim(), role: u.role };
}

export function findUserByEmail(db: Db, email: string): (User & { pw_hash: string }) | undefined {
  return db.prepare('SELECT id, email, name, role, pw_hash FROM users WHERE email = ?').get(email.trim()) as (User & { pw_hash: string }) | undefined;
}

export function createSession(db: Db, userId: number, now = Date.now()): { token: string; maxAge: number } {
  const t = token();
  const maxAge = SESSION_DAYS * 86400;
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha(t), userId, now + maxAge * 1000);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  return { token: t, maxAge };
}

export function userForSession(db: Db, t: string | undefined, now = Date.now()): User | null {
  if (!t) return null;
  const row = db.prepare('SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').get(sha(t), now) as User | undefined;
  return row ?? null;
}

export function deleteSession(db: Db, t: string | undefined): void {
  if (t) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(t));
}

export function createInvite(db: Db, by: number, role: Role, now = Date.now()): string {
  const t = token();
  db.prepare('INSERT INTO invites (token_hash, role, created_by, expires_at) VALUES (?, ?, ?, ?)').run(sha(t), role, by, now + INVITE_DAYS * 86400e3);
  return t;
}

export function openInvite(db: Db, t: string, now = Date.now()): { role: Role } | null {
  const row = db.prepare('SELECT role FROM invites WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?').get(sha(t), now) as { role: Role } | undefined;
  return row ?? null;
}

export function useInvite(db: Db, t: string, now = Date.now()): void {
  db.prepare('UPDATE invites SET used_at = ? WHERE token_hash = ?').run(now, sha(t));
}

/** Höchstens `max` Versuche je Schlüssel (IP und E-Mail) in `windowMs`. */
export function tooManyAttempts(db: Db, key: string, now = Date.now(), max = 8, windowMs = 15 * 60e3): boolean {
  db.prepare('DELETE FROM login_attempts WHERE at < ?').run(now - windowMs);
  const n = (db.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key = ?').get(key) as { n: number }).n;
  return n >= max;
}
export function noteAttempt(db: Db, key: string, now = Date.now()): void {
  db.prepare('INSERT INTO login_attempts (key, at) VALUES (?, ?)').run(key, now);
}
export function clearAttempts(db: Db, key: string): void {
  db.prepare('DELETE FROM login_attempts WHERE key = ?').run(key);
}
