const CACHE_NAME = "notes-app-cache-v1";

const APP_SHELL = ["/", "/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of APP_SHELL) {
        try {
          await cache.add(url);
        } catch (error) {
          console.warn("Nie udało się zapisać zasobu w cache:", url, error);
        }
      }

      await self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => key.startsWith("notes-app-cache-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();
    })
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          }

          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match("/");
          if (cachedPage) return cachedPage;

          return new Response(
            "Jesteś offline. Połącz się z internetem i otwórz notatnik ponownie.",
            {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            }
          );
        })
    );

    return;
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;

      try {
        const response = await fetch(request);

        if (response.ok && url.pathname.startsWith("/_next/static/")) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }

        return response;
      } catch {
        return new Response("", { status: 503 });
      }
    })
  );
});
