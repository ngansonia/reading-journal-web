// Service Worker for "Between Pages" Reading Journal
// This file makes the app work offline and load faster

// Version number - change this when you update your app to force a refresh
const CACHE_VERSION = 'v4';
const CACHE_NAME = `between-pages-${CACHE_VERSION}`;

// Files that make up the "app shell" - the core files needed to run the app
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  // Google Fonts (cached for offline use)
  'https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap',
  // Supabase JS client
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Install event - runs when the service worker is first installed
// This is where we cache the app shell
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell...');
        return cache.addAll(APP_SHELL);
      })
      .then(() => {
        // Skip waiting and activate immediately
        // This means updates take effect right away
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache app shell:', error);
      })
  );
});

// Activate event - runs when the service worker takes control
// This is where we clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        // Delete any old caches that don't match our current version
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - runs every time the app requests a file
// This is where we serve cached files or fetch from network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (like POST)
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // For the app shell (HTML, manifest), use cache-first strategy
  // This makes the app load instantly
  if (event.request.mode === 'navigate' ||
      APP_SHELL.some(file => url.pathname.endsWith(file.replace('/', '')))) {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached version immediately
            // Also fetch fresh version in background for next time
            fetchAndCache(event.request);
            return cachedResponse;
          }
          // Not in cache, fetch from network
          return fetchAndCache(event.request);
        })
    );
    return;
  }

  // For images (book covers), use cache-first with network fallback
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Not cached, fetch and cache for later
          return fetch(event.request)
            .then((response) => {
              // Only cache successful responses
              if (response.ok) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => cache.put(event.request, responseClone));
              }
              return response;
            })
            .catch(() => {
              // If fetch fails, return a placeholder
              // (You could return a cached placeholder image here)
              return new Response('', { status: 404 });
            });
        })
    );
    return;
  }

  // For Google Fonts and other external resources
  if (url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request)
            .then((response) => {
              if (response.ok) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => cache.put(event.request, responseClone));
              }
              return response;
            });
        })
    );
    return;
  }

  // For Supabase API calls, always pass through to network (don't cache)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in')) {
    return;
  }

  // For API calls (Open Library), use network-first
  // We want fresh data, but fall back to cache if offline
  if (url.hostname.includes('openlibrary.org')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful API responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // Default: network-first for everything else
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

// Helper function to fetch and update cache
function fetchAndCache(request) {
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => cache.put(request, responseClone));
      }
      return response;
    });
}

// Listen for messages from the main app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
