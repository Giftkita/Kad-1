/* sw-admin.js — hanya untuk notifikasi jualan dalam admin.html (Android perlukan service worker untuk paparkan notifikasi).
   Tiada pengendali 'fetch' — tidak ubah atau cache apa-apa page website. */
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) if (w.url.indexOf('admin.html') > -1) return w.focus();
    return self.clients.openWindow('/admin.html');
  }));
});
