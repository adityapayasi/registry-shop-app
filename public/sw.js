/**
 * Service Worker for offline support.
 * Compiled JS (not TS) — served as text/javascript, correct MIME.
 * Stale-while-revalidate: serve cached, fetch fresh in background.
 */
var CACHE_NAME = 'registry-shop-v2';
var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.allSettled(
        STATIC_ASSETS.map(function(url) {
          return cache.add(url).catch(function() {});
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      var promises = keys
        .filter(function(k) { return k !== CACHE_NAME; })
        .map(function(k) { return caches.delete(k); });
      return Promise.all(promises);
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var controller = new AbortController();
      var timeout = setTimeout(function() { controller.abort(); }, 5000);
      var fetchPromise = fetch(event.request, { signal: controller.signal }).then(function(response) {
        clearTimeout(timeout);
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return cached;
      });
      return cached || fetchPromise;
    })
  );
});