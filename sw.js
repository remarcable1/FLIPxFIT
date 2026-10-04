/* FLIP x FIT – Service Worker
   Der Cache-Name enthält die App-Version. Bei jedem Release mit index.html,
   version.json und FLIP_APP_VERSION erhöhen – dann werden alte Caches
   (z. B. "flip-stix-v53") beim Aktivieren automatisch gelöscht. */
const CACHE_NAME = 'flip-x-fit-v64';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // version.json must always come from the network so the app can
  // detect a new deployment.
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // HTML/navigation requests: network-first, so an old index.html
  // is never served while the device is online.
  if (event.request.mode === 'navigate' ||
      url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() =>
          caches.match('./index.html').then(cached => cached || Response.error())
        )
    );
    return;
  }

  // Static assets: cache-first, with network fallback.
  event.respondWith(
    caches.match(event.request)
      .then(cached =>
        cached ||
        fetch(event.request).then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
      )
      .catch(() =>
        event.request.mode === 'navigate'
          ? caches.match('./index.html')
          : Response.error()
      )
  );
});
