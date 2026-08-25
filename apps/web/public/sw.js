// Bumped v1 -> v2 so the activate handler purges the old cache, which could
// hold a stale /api/auth/me 401 that kept users stuck on the sign-in page.
const CACHE_NAME = 'sermon-smith-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/icon.svg'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.error('Service Worker: Error caching static assets', error);
      });
    })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
  );
  // Do not claim an already-running page. WebKit can finish activation while
  // the first document is still open; taking that document over mid-session
  // means its auth bootstrap goes directly to the network while later AI/Bible
  // requests suddenly originate inside the worker. Besides defeating browser
  // request controls, that creates a mixed network lifecycle for real Safari
  // users. The active worker takes control on the next navigation/reload,
  // where every request follows one consistent policy from the first byte.
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip cross-origin requests
  if (!request.url.startsWith(self.location.origin)) {
    return;
  }

  // NEVER cache or serve API/auth traffic from the SW — it must always hit the
  // network so session state is real-time. The web app now talks to the API
  // same-origin (vercel.json proxies /api/* to Railway), so these requests are
  // same-origin and would otherwise fall into the cache-first branch below.
  // That replayed a stale /api/auth/me 401 right after login, so the app thought
  // the user was logged out and bounced back to the sign-in page (the reported
  // "Welcome back" toast then stuck-on-login bug). Caching authenticated API
  // responses is also a cross-account data-leak risk. Always let the browser do
  // a normal, credentialed network fetch for these.
  const apiUrl = new URL(request.url);
  if (request.method !== 'GET' || apiUrl.pathname.startsWith('/api/')) {
    return;
  }

  // For navigation requests (HTML pages), try network first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response and cache it
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request);
        })
    );
    return;
  }

  // For all other requests, try cache first, then network
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response and update cache in background
        fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
          })
          .catch(() => {
            // Silently fail - we already have cached version
          });
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch((error) => {
          console.error('Service Worker: Fetch failed', error);
          throw error;
        });
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
