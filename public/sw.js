/* 11Plan Service Worker: zeigt Push-Nachrichten an und öffnet beim Antippen die App. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '11Plan', {
    body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', data: { url: d.url || '/teamzentrale' }, tag: d.tag || undefined,
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/teamzentrale';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((l) => {
    for (const c of l) if (c.url.includes('/teamzentrale') && 'focus' in c) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
