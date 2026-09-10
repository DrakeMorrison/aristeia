const CACHE = 'meridian-v4';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Navigations must revalidate with the server — an HTTP-cached index.html
  // can otherwise pin an old app version long after a deploy. Offline still
  // works: the failed fetch falls through to the SW cache below.
  const req = e.request.mode === 'navigate'
    ? new Request(e.request.url, { cache: 'no-cache' })
    : e.request;
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

// Lock-screen notification taps: focus the app if a window exists, else open
// one. Stop/Pause action buttons (Android) are relayed to an open window as a
// message, or carried in the hash for a fresh one to act on at load.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const action = e.action === 'stop' || e.action === 'pause' ? e.action : '';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const client = list.find(c => 'focus' in c);
      if (client) {
        if (action) client.postMessage({ type: 'timer-action', action });
        return client.focus();
      }
      return self.clients.openWindow(action ? './#' + action : './');
    }).catch(() => {})
  );
});
