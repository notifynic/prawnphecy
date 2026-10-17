/*
 * Keeps a copy of the app on the phone, so it opens with no signal. The page itself is fetched fresh when there
 * is a connection and taken from the copy when there is not; everything else the app is built from is named for
 * its contents, so a kept copy of it never goes stale and is used at once. Nothing here touches the journal,
 * which lives in the browser's own storage.
 */
const CACHE = 'pocket-tarot-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['./', './manifest.webmanifest', './icon.svg'])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)))),
    ]),
  );
});

// The page says what it loaded before this worker was in charge, so the first visit is enough to work offline.
self.addEventListener('message', (event) => {
  const urls = Array.isArray(event.data?.keep) ? event.data.keep.filter((url) => typeof url === 'string' && new URL(url).origin === self.location.origin) : [];
  if (urls.length) event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(urls.map((url) => cache.add(url).catch(() => undefined)))));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const keep = (response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  };
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(keep).catch(() => caches.match(request).then((hit) => hit ?? caches.match('./'))));
    return;
  }
  event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request).then(keep)));
});
