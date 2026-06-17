const CACHE_NAME = "fieldforce-shell-v1";
const APP_SHELL = [
  "/dashboard",
  "/manifest.webmanifest",
  "/assets/fieldforce-logo.png",
  "/assets/fieldforce-mark.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => cached || caches.match("/dashboard"))
    )
  );
});

// TODO: add a background sync queue for offline mutations in a later phase.
