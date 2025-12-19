// Service Worker for caching Baserow API responses
const CACHE_NAME = 'evil-atlas-v1';
const BASEROW_API_BASE = 'https://api.baserow.io/api/database/rows/table';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - intercept Baserow API requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only cache Baserow API requests
  if (url.origin === 'https://api.baserow.io' && url.pathname.includes('/database/rows/table/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Return cached response if available
        if (cachedResponse) {
          console.log('[SW] Serving from cache:', event.request.url);
          // Also fetch fresh data in background to update cache
          fetch(event.request)
            .then((response) => {
              if (response.ok) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, responseClone);
                  console.log('[SW] Cache updated:', event.request.url);
                });
              }
            })
            .catch(() => {
              // Ignore errors in background fetch
            });
          return cachedResponse;
        }
        
        // If not cached, fetch and cache
        return fetch(event.request).then((response) => {
          // Only cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
              console.log('[SW] Cached new response:', event.request.url);
            });
          }
          return response;
        });
      })
    );
  }
});

