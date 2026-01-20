
const CACHE_NAME = 'comic-studio-offline-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Bangers&family=Open+Sans:wght@400;600;700&display=swap'
];

// List of domains allowed for dynamic caching (CDNs)
const DYNAMIC_WHITELIST = [
  'esm.sh',
  'googleapis.com',
  'gstatic.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy: Cache First, falling back to Network for whitelisted CDNs
  const isCDN = DYNAMIC_WHITELIST.some(domain => url.hostname.includes(domain));

  if (isCDN || STATIC_ASSETS.includes(event.request.url) || event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          // Cache the new asset dynamically
          if (networkResponse.ok && (isCDN || event.request.mode === 'navigate')) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, cacheCopy);
            });
          }
          return networkResponse;
        }).catch(() => {
           // Fallback for navigation if completely offline
           if (event.request.mode === 'navigate') {
             return caches.match('/index.html');
           }
        });
      })
    );
  }
});
