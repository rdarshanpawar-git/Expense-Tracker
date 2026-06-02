self.addEventListener('install', (e) => {
    e.waitUntil(
      caches.open('expense-store').then((cache) => cache.addAll([
        './',
        './index.html',
        './app.js',
        './style.css',
        './rupee-icon.svg',
        './icon-192.png'
      ]))
    );
  });
  
  self.addEventListener('fetch', (e) => {
    e.respondWith(
      caches.match(e.request).then((response) => response || fetch(e.request))
    );
  });
