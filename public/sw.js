const CACHE_VERSION = "v3";
const PAGE_CACHE = `noticeboard-pages-${CACHE_VERSION}`;
const ASSET_CACHE = `noticeboard-assets-${CACHE_VERSION}`;
const DATA_CACHE = `noticeboard-data-${CACHE_VERSION}`;
const STATIC_ASSETS = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGE_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.endsWith(CACHE_VERSION)).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Network-first for page navigations
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Stale-while-revalidate for API data (notices, events, meetings, etc.)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      caches.open(DATA_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request)
            .then((res) => {
              if (res.ok) {
                const clone = res.clone();
                cache.put(request, clone);
              }
              return res;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // Never cache Next.js dev chunks — always fetch from network
  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first for static assets and uploaded files
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok && url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|css|js|woff2?|pdf)$/)) {
          const clone = res.clone();
          caches.open(ASSET_CACHE).then((cache) => cache.put(request, clone));
        }
        return res;
      });
    })
  );
});
