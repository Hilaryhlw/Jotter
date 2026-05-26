// Jotter Service Worker — offline-first
const CACHE = 'jotter-v4';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400;1,600&family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap'
];

// Install: cache core assets immediately
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE))
      .catch(() => {}) // don't block install if font CDN is offline
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Core app files (index.html, sw.js, manifest, icon): cache-first
// - Google Fonts CSS/woff: cache-first (fonts rarely change)
// - Book cover images (openlibrary, googleapis): network-first, cache fallback
// - Google Books API calls: network-only (live data, don't cache)
// - Everything else: network-first, cache fallback
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Google Books API — always network only (live search, never cache)
  if (url.hostname === 'www.googleapis.com') {
    return; // let it fall through to browser default
  }

  // Core app files — cache first, then network
  const isCore = CORE.some(c => e.request.url.endsWith(c.replace('./','')))
    || url.pathname === '/'
    || url.pathname.endsWith('index.html')
    || url.pathname.endsWith('manifest.json')
    || url.pathname.endsWith('icon.svg')
    || url.pathname.endsWith('sw.js');

  if (isCore) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const net = fetch(e.request).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        });
        return cached || net;
      })
    );
    return;
  }

  // Google Fonts — cache first (immutable once loaded)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Book cover images — network first, fall back to cache
  if (url.hostname === 'covers.openlibrary.org' ||
      url.hostname === 'books.google.com' ||
      url.hostname === 'openlibrary.org') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Default: network first, cache fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
