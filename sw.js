// v1 -> v2: v1's STATIC_CACHE_URLS predated the Realtime API migration (still
// listed js/speech/recognition.js, js/speech/synthesis.js, and was missing
// every js/realtime/*.js file entirely), and the fetch handler below was
// pure cache-first with no revalidation -- once any file got cached, it
// stayed frozen at that exact version forever, since CACHE_NAME never
// changed. This caused a real, confirmed incident: HablaBot silently served
// a stale cached session.js through an entire investigation into why
// transcription never worked, while the actual bug had already been fixed
// on disk multiple times over. See docs/DECISIONS.md for the full story.
const CACHE_NAME = 'hablabot-v2';
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/css/mobile.css',
  '/css/animations.css',
  '/js/app.js',
  '/js/ai/prompts.js',
  '/js/realtime/session.js',
  '/js/realtime/session-vocab-bridge.js',
  '/js/realtime/turn-profiles.js',
  '/js/vocabulary/manager.js',
  '/js/vocabulary/spaced-repetition.js',
  '/js/storage/database.js',
  '/js/ui/components.js',
  '/js/ui/state.js',
  '/js/utils/audio.js',
  '/js/utils/config.js',
  '/js/utils/helpers.js',
  '/js/utils/user-manager.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip external API calls (OpenAI, ElevenLabs)
  if (event.request.url.includes('api.openai.com') || 
      event.request.url.includes('api.elevenlabs.io')) {
    return;
  }

  // Handle missing icon files gracefully
  if (event.request.url.includes('/assets/icons/') && event.request.url.endsWith('.png')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Return a simple 1x1 transparent PNG if icon is missing
        const transparentPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
        
        // Convert base64 to blob and return as Response
        const byteCharacters = atob(transparentPng.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });
        
        return new Response(blob, {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'image/png' }
        });
      })
    );
    return;
  }

  // Network-first, cache as fallback -- NOT cache-first. v1's cache-first
  // strategy (checked cache, returned it immediately, never re-checked
  // network once a URL was cached) is what caused the incident described
  // above: once a file was cached, it stayed frozen at that exact version
  // indefinitely, since nothing ever invalidated or revalidated it. This
  // still gives full offline support (falls back to cache when the network
  // fetch fails) while keeping the app fresh whenever a network is available,
  // which is the actually-common case during active development.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Network failed and nothing cached -- try to serve the offline
            // shell for navigation requests.
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Background sync for when connection is restored
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(
      // Handle any queued operations when back online
      handleBackgroundSync()
    );
  }
});

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
      actions: data.actions || []
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});

// Helper function for background sync
async function handleBackgroundSync() {
  try {
    // This would handle any queued vocabulary updates, session data, etc.
    console.log('Service Worker: Handling background sync operations');
    
    // In a real implementation, this would:
    // 1. Check for queued vocabulary updates
    // 2. Sync conversation history
    // 3. Update spaced repetition schedules
    // 4. Handle any failed API calls
    
    return Promise.resolve();
  } catch (error) {
    console.error('Service Worker: Background sync failed', error);
    throw error;
  }
}

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
