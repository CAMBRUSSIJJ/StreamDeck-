const CACHE = 'nexus-deck-v1.0.0';
const ASSETS = [
  '/', '/index.html', '/styles.css', '/manifest.webmanifest',
  '/js/app.js', '/js/core/profiles.js', '/js/ui/icons.js', '/js/core/editor.js', '/js/core/widgets.js', '/js/core/crypto.js', '/js/core/realtime.js', '/js/core/local.js', '/js/core/store.js', '/js/core/protocol.js',
  '/assets/icons/icon.svg', '/assets/icons/icon-192.png', '/assets/icons/icon-512.png'
];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match('/index.html'))));
});
