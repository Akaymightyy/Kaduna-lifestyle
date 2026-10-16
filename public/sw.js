// public/sw.js — Service Worker for Kaduna Lifestyle (v2, safe).
// v1 served an OLD index.html first (cache-first), so after every update Chrome could mix old and new
// game files and the game froze. v2 rules:
//   - the page, scripts, styles and data ALWAYS come from the network first (cache only if offline)
//   - only the hashed /assets/ files and /models/ files are cached (their names change when they change)
//   - big files (over ~6 MB, like the car models) are never stored, so they can't fill the phone
const CACHE_NAME = "kaduna-lifestyle-v2";

self.addEventListener("install", () => { self.skipWaiting(); });

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                       // Firebase, fonts, etc: browser handles it
  if (req.headers.has("range")) return;                                   // never touch partial downloads
  if (url.pathname.startsWith("/@vite") || url.pathname.startsWith("/__vite")) return;

  const immutable = url.pathname.startsWith("/assets/") || url.pathname.startsWith("/models/");
  if (!immutable) {
    // network first, cache only as an offline fallback
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok && res.status === 200) { const c = res.clone(); caches.open(CACHE_NAME).then((ca) => ca.put(req, c)).catch(() => {}); }
        return res;
      }).catch(() => caches.match(req).then((m) => m || caches.match("/index.html")))
    );
    return;
  }
  // cache first for hashed assets / models
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const len = Number(res.headers.get("content-length") || 0);
      if (res.ok && res.status === 200 && len < 6 * 1024 * 1024) { const c = res.clone(); caches.open(CACHE_NAME).then((ca) => ca.put(req, c)).catch(() => {}); }
      return res;
    }))
  );
});
