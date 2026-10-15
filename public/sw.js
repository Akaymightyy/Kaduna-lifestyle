// public/sw.js — Service Worker for Kaduna Lifestyle PWA
// Caches the app shell (HTML, JS, CSS, fonts) for offline use.
// Uses a cache-first strategy for static assets and network-first for API calls.

const CACHE_NAME = "kaduna-lifestyle-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/data/kaduna.json",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable.png",
];

// ---- Install: pre-cache the app shell ----
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((e) => {
        console.warn("[SW] Some app shell assets failed to cache:", e.message);
      });
    })
  );
  self.skipWaiting();
});

// ---- Activate: clean old caches ----
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// ---- Fetch: cache-first for same-origin GETs, network-first for Firebase ----
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Don't intercept Firebase API calls (they need fresh data)
  if (url.hostname.includes("firebaseio.com") || url.hostname.includes("googleapis.com")) {
    return;
  }

  // Don't intercept Vercel hot-reload / HMR (dev only)
  if (url.pathname.startsWith("/@vite") || url.pathname.startsWith("/__vite")) {
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Return cached + fetch in background to update
        fetch(event.request).then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
        }).catch(() => {});
        return cached;
      }
      // Not cached — fetch from network
      return fetch(event.request).then((res) => {
        // Cache successful same-origin responses
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback — try to return the cached index.html
        return caches.match("/index.html");
      });
    })
  );
});
