
// Minimal Service Worker for PWA Installability
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Required for PWA install criteria
  // We pass through all requests to the network
  event.respondWith(fetch(event.request));
});
