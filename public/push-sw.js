// Dedicated Service Worker for Web Push notifications.
// Scope: /push-scope/  (does not conflict with the main PWA SW at /)

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Venezuela Se Levanta", body: "Nuevo aviso" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }
  const { title, body, url = "/", tag = "vsl-push", icon = "/icon-192.png" } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: "/icon-192.png",
      tag,
      renotify: true,
      data: { url },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        try {
          const u = new URL(w.url);
          if (u.origin === self.location.origin) {
            w.focus();
            return w.navigate ? w.navigate(url) : w.postMessage({ type: "navigate", url });
          }
        } catch (_) {}
      }
      return self.clients.openWindow(url);
    }),
  );
});
