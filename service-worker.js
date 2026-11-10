const CACHE_NAME = "copper-belt-app-v1-3-20261110";
const APP_BASE = new URL("./", self.registration.scope);
const ROOT_URL = APP_BASE.href;
const INDEX_URL = new URL("index.html", APP_BASE).href;
const APP_ASSETS = [
  new URL("manifest.json", APP_BASE).href,
  new URL("app-icon-192.png", APP_BASE).href,
  new URL("app-icon-512.png", APP_BASE).href
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const assetUrl of [ROOT_URL, INDEX_URL]) {
      const response = await fetch(assetUrl, { cache: "reload" });
      if (!response || !response.ok) {
        throw new Error("Unable to cache application shell: " + assetUrl);
      }
      await cache.put(assetUrl, response.clone());
    }
    for (const assetUrl of APP_ASSETS) {
      try {
        const response = await fetch(assetUrl, { cache: "reload" });
        if (response && response.ok) await cache.put(assetUrl, response.clone());
      } catch (_) {}
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("copper-belt-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          await cache.put(request, response.clone());
          if (requestUrl.pathname === new URL(ROOT_URL).pathname) {
            await cache.put(ROOT_URL, response.clone());
          }
        }
        return response;
      } catch (_) {
        return (
          await cache.match(request, { ignoreSearch: true }) ||
          await cache.match(ROOT_URL) ||
          await cache.match(INDEX_URL)
        );
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
