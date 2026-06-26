// Guarded service worker registration. Refuses in dev, iframe, Lovable preview, and on ?sw=off.
// This module is dynamically imported by the client entry — never at SSR time.
//
// Also handles two operational hazards:
//  1) Stale SW serving old HTML/chunks after deploy → forces SKIP_WAITING on
//     any waiting worker and reloads once when control changes.
//  2) ChunkLoadError (the classic "página en blanco" after deploy) → unregisters
//     all SWs, clears caches, and reloads once. Without this, returning users
//     stay broken until they manually clear cache.

const SW_PATH = "/sw.js";
const RELOAD_FLAG = "__vsl_sw_reloaded";

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

async function nukeCachesAndReload(): Promise<void> {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === "chunk") return;
    sessionStorage.setItem(RELOAD_FLAG, "chunk");
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    /* ignore */
  } finally {
    window.location.reload();
  }
}

function isChunkLoadError(err: unknown): boolean {
  const msg =
    (err instanceof Error ? `${err.name} ${err.message}` : String(err ?? "")).toLowerCase();
  return (
    msg.includes("chunkloaderror") ||
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("error loading dynamically imported module")
  );
}

function installChunkErrorGuard(): void {
  const onError = (e: ErrorEvent) => {
    if (isChunkLoadError(e.error ?? e.message)) {
      void nukeCachesAndReload();
    }
  };
  const onRejection = (e: PromiseRejectionEvent) => {
    if (isChunkLoadError(e.reason)) {
      void nukeCachesAndReload();
    }
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
}

export async function registerPWA(): Promise<void> {
  if (isUnsafeContext()) {
    await unregisterApp();
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });

    // Force any waiting worker to activate immediately so users always get the
    // newest build without a second navigation.
    const pokeWaiting = () => {
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    };
    pokeWaiting();
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener("statechange", () => {
        if (nw.state === "installed" && navigator.serviceWorker.controller) pokeWaiting();
      });
    });

    // When the new SW takes control, reload once so the page picks up fresh chunks.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (sessionStorage.getItem(RELOAD_FLAG) === "sw") return;
      sessionStorage.setItem(RELOAD_FLAG, "sw");
      window.location.reload();
    });

    // Periodically check for updates while the tab is open.
    setInterval(() => {
      reg.update().catch(() => undefined);
    }, 30 * 60 * 1000);
  } catch {
    /* ignore */
  }
}

if (typeof window !== "undefined") {
  // Chunk guard runs in ALL contexts (preview included) — it's the only line of
  // defense when a deploy yanks chunks out from under a long-lived tab.
  installChunkErrorGuard();
  // Defer SW registration to load so it never competes with first paint.
  window.addEventListener("load", () => {
    void registerPWA();
  });
}
