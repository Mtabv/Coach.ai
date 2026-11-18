import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as webpush from 'web-push';
import type { Db } from './db.js';

/**
 * Push-Nachrichten über den Browser (Web Push). Funktioniert, wenn die Seite auf dem Startbildschirm liegt
 * (iPhone ab iOS 16.4) bzw. im Browser (Android, Desktop). Die Schlüssel (VAPID) erzeugt der Server beim
 * ersten Start selbst und legt sie im Datenordner ab – kein Drittanbieter-Konto nötig.
 */
export interface PushDienst {
  schluessel: string;
  abonnieren(userId: number, abo: unknown): void;
  abbestellen(endpoint: string): void;
  /** An alle Geräte dieser Benutzer senden. Abgelaufene Abos werden entfernt. */
  senden(userIds: number[], n: { title: string; body: string; url?: string }): Promise<number>;
}

export function pushDienst(db: Db, schluesselDatei: string, kontakt: string): PushDienst {
  let k: { publicKey: string; privateKey: string };
  if (existsSync(schluesselDatei)) k = JSON.parse(readFileSync(schluesselDatei, 'utf8'));
  else { k = webpush.generateVAPIDKeys(); writeFileSync(schluesselDatei, JSON.stringify(k), { mode: 0o600 }); }
  webpush.setVapidDetails(kontakt, k.publicKey, k.privateKey);
  return {
    schluessel: k.publicKey,
    abonnieren(userId, abo) {
      const a = abo as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
      if (typeof a?.endpoint !== 'string' || !/^https:\/\//.test(a.endpoint) || typeof a.keys?.p256dh !== 'string' || typeof a.keys?.auth !== 'string') throw new Error('Ungültiges Abo');
      db.prepare('INSERT INTO push_abos (endpoint, user_id, json, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, json = excluded.json')
        .run(a.endpoint, userId, JSON.stringify({ endpoint: a.endpoint, keys: { p256dh: a.keys.p256dh, auth: a.keys.auth } }), Date.now());
    },
    abbestellen(endpoint) { db.prepare('DELETE FROM push_abos WHERE endpoint = ?').run(endpoint); },
    async senden(userIds, n) {
      if (!userIds.length) return 0;
      const rows = db.prepare(`SELECT endpoint, json FROM push_abos WHERE user_id IN (${userIds.map(() => '?').join(',')})`).all(...userIds) as { endpoint: string; json: string }[];
      let ok = 0;
      await Promise.all(rows.map(async (r) => {
        try { await webpush.sendNotification(JSON.parse(r.json), JSON.stringify(n), { TTL: 6 * 3600 }); ok++; }
        catch (e) { const c = (e as { statusCode?: number }).statusCode; if (c === 404 || c === 410) db.prepare('DELETE FROM push_abos WHERE endpoint = ?').run(r.endpoint); }
      }));
      return ok;
    },
  };
}

/** HTML aus Mitteilungen entfernen (Push zeigt nur Text). */
export const reinerText = (t: string) => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
