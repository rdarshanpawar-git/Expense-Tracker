const CACHE_VERSION = 'expense-store-v1';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './rupee-icon.svg',
  './icon-192.png',
  './icon-512.png',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    }).then(() => {
      // Skip waiting - activate immediately when a new version is ready
      self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old cache versions
          if (cacheName !== CACHE_VERSION) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Claim all clients immediately
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    }).catch(() => {
      // Fallback for offline
      return caches.match('./index.html');
    })
  );
});

// Handle messages from clients for update control
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
