// RGTime service worker — network-first with cache fallback so the clock page opens at the door with no signal.
// Punches themselves are queued in localStorage by the app (see client.ts rgSyncQueue); this only keeps the shell reachable.
const CACHE = 'rgtime-v1';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/rg', '/rg-manifest.webmanifest', '/rg-icon.svg']).catch(() => undefined)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined); } return res; })
    .catch(async () => (await caches.match(req)) || (req.mode === 'navigate' ? (await caches.match('/rg')) : undefined) || new Response('offline', { status: 503 })));
});
