/* ==========================================================================
   WAVEORA — sw.js
   Caches the static app shell (HTML/CSS/JS/icons) for offline use.
   Your music library itself lives in IndexedDB in the browser, which
   persists independently of this cache and is available offline too.
   ========================================================================== */
const CACHE_NAME = 'waveora-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/variables.css',
  './css/global.css',
  './css/layout.css',
  './css/dashboard.css',
  './css/player.css',
  './css/library.css',
  './css/playlist.css',
  './css/discover.css',
  './css/statistics.css',
  './css/settings.css',
  './css/animations.css',
  './css/responsive.css',
  './js/utils.js',
  './js/storage.js',
  './js/indexeddb.js',
  './js/notifications.js',
  './js/theme.js',
  './js/audio-engine.js',
  './js/visualizer.js',
  './js/library.js',
  './js/favorites.js',
  './js/playlists.js',
  './js/history.js',
  './js/search.js',
  './js/statistics.js',
  './js/queue.js',
  './js/player.js',
  './js/command-center.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return; // never intercept cross-origin (e.g. Google Fonts) — let network handle it

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(response => {
          if (response && response.status === 200){
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached || caches.match('./index.html'));
      return cached || networkFetch;
    })
  );
});
