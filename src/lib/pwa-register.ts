// Guarded service worker registration. Refuses in dev, iframe, Lovable preview, and on ?sw=off.
// This module is dynamically imported by the client entry — never at SSR time.

const SW_PATH = "/sw.js";

function isUnsafeContext(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return true;
  if (!("serviceWorker" in navigator)) return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  ) {
    return true;
  }
  if (new URL(window.location.href).searchParams.get("sw") === "off") return true;
  return false;
}

async function unregisterApp(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? "";
          return url.endsWith(SW_PATH);
        })
        .map((r) => r.unregister()),
    );
  } catch {
    /* ignore */
  }
}

export async function registerPWA(): Promise<void> {
  if (isUnsafeContext()) {
    await unregisterApp();
    return;
  }
  try {
    await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  } catch {
    /* ignore */
  }
}

if (typeof window !== "undefined") {
  // Defer to idle so it never competes with first paint.
  window.addEventListener("load", () => {
    void registerPWA();
  });
}
