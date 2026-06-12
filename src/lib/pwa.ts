export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    if (!import.meta.env.PROD) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        )
        .then(() => {
          if (!("caches" in window)) {
            return undefined;
          }
          return caches
            .keys()
            .then((keys) =>
              Promise.all(
                keys
                  .filter((key) => key.startsWith("mortgage-rate-checker-"))
                  .map((key) => caches.delete(key)),
              ),
            );
        })
        .catch((error) => {
          console.warn("Service worker cleanup failed", error);
        });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  });
}
