"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
    if (isLocalhost) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => undefined);
      if ("caches" in window) {
        caches.keys()
          .then((keys) => Promise.all(keys.filter((key) => key.startsWith("fieldforce-")).map((key) => caches.delete(key))))
          .catch(() => undefined);
      }
      return;
    }

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline support is best-effort until the full sync engine is implemented.
      });
    }
  }, []);

  return null;
}
