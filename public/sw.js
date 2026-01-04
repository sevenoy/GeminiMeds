const VERSION = 'v1.0.0';
const CACHE_NAME = `meds-cache-${VERSION}`;

const CRITICAL_ASSETS = [
    '/meds/',
    '/meds/index.html',
    '/meds/manifest.json'
];

// Install event: pre-cache critical resources
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching critical assets');
            return cache.addAll(CRITICAL_ASSETS);
        })
    );
    self.skipWaiting();
});

// Fetch event: Cache-First strategy
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip Supabase API calls
    if (event.request.url.includes('supabase.co')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            // Cache hit, return cached response
            if (response) {
                return response;
            }

            // Cache miss, fetch from network
            return fetch(event.request).then((response) => {
                // Only cache successful GET requests
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            }).catch(() => {
                // Network failed, return offline page if available
                return caches.match('/meds/index.html');
            });
        })
    );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Message event: handle skip waiting
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
