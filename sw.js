// The hub's worker. Each app registers its own worker on first open, which then
// takes over that app's more specific scope; until then this one serves the
// app's page, so an app can be opened offline before it was ever visited.
const CACHE = 'aristeia-v2';
const APPS = ['meridian', 'gnomon', 'pharmakon', 'halteres', 'nbacking', 'peira', 'kleio'];
const CORE = ['./', './index.html', './sync.js', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './vendor/automerge.js', './vendor/automerge.wasm', ...APPS.map(a => './' + a + '/')];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // The apps share an origin, so only ever clear this worker's own caches.
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('aristeia-') && k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;
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
