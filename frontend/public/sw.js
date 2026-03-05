const CACHE_NAME = 'play-infinity-m-v1';

self.addEventListener('install', (e) => {
    console.log('[ServiceWorker] Install');
});

self.addEventListener('activate', (e) => {
    console.log('[ServiceWorker] Activate');
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => {
            // Offline fallback handling if needed
            return new Response("Offline");
        })
    );
});
