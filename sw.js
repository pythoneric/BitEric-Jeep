// Bump CACHE_NAME only on structural changes (new URLs to precache, or a
// cache-strategy change). Everyday jeep.html edits are picked up automatically
// by the network-first-with-cache-refresh pattern below: the SW serves fresh
// when online AND writes the response back into the cache on every successful
// local fetch, so an offline reopen after a deploy lands on the latest version
// the user has seen — not whatever was frozen at install time.
const CACHE_NAME = 'biteric-jeep-v3';

const urlsToCache = [
  'jeep.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;700&family=JetBrains+Mono:wght@400;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('jeep.html') || event.request.url.includes('manifest.json') || event.request.url.includes('icon-')) {
    // Network-first for local files, refreshing the cache on success.
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first for CDN (URLs are version-pinned)
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});