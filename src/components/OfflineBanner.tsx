import { useEffect, useRef, useState } from "react";
import { CloudOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { countQueued, flushQueue } from "@/lib/offline-queue";

export function OfflineBanner() {
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [restored, setRestored] = useState(false);
  const wasOffline = useRef(false);
  const retryTimer = useRef<number | null>(null);
  const queryClient = useQueryClient();

  const refresh = async () => setQueued(await countQueued());

  const trySync = async () => {
    if (syncing) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const c = await countQueued();
    if (c === 0) return;
    setSyncing(true);
    const res = await flushQueue();
    setSyncing(false);
    await refresh();
    window.dispatchEvent(new Event("queue:changed"));

    if (res.ok > 0) {
      toast.success(`✅ ${res.ok} reporte(s) sincronizado(s)`, { icon: <CheckCircle2 className="h-4 w-4" /> });
      // Force-refresh any cached report queries so the new rows appear immediately.
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    }
    if (res.dropped > 0) {
      toast.error(`${res.dropped} reporte(s) descartado(s) tras varios intentos fallidos`);
    }
    if (res.failed > 0) {
      // Schedule a backoff retry while still online.
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
      retryTimer.current = window.setTimeout(() => { void trySync(); }, 30_000);
    }
  };

  useEffect(() => {
    refresh();
    // Attempt sync on mount in case items were left over from a previous session.
    void trySync();

    const on = () => {
      setOnline(true);
      if (wasOffline.current) {
        setRestored(true);
        window.setTimeout(() => setRestored(false), 2500);
      }
      wasOffline.current = false;
      void trySync();
    };
    const off = () => {
      setOnline(false);
      wasOffline.current = true;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void trySync();
      }
    };
    const onFocus = () => { if (navigator.onLine) void trySync(); };

    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("queue:changed", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("queue:changed", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!online) {
    return (
      <div
        className="fixed left-0 right-0 z-[960] px-3 py-2 flex items-center justify-center gap-2 text-xs font-semibold text-white shadow-lg"
        style={{ top: "calc(env(safe-area-inset-top) + 0px)", background: "#FF6B35" }}
      >
        <CloudOff className="h-3.5 w-3.5" />
        ⚡ Sin conexión — mostrando datos guardados
        {queued > 0 && <span className="opacity-90">· {queued} en cola</span>}
      </div>
    );
  }

  if (restored) {
    return (
      <div
        className="fixed left-0 right-0 z-[960] px-3 py-2 flex items-center justify-center gap-2 text-xs font-semibold text-white shadow-lg"
        style={{ top: "calc(env(safe-area-inset-top) + 0px)", background: "#16a34a" }}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        ✓ Conexión restaurada{queued > 0 ? ` — sincronizando ${queued}…` : ""}
      </div>
    );
  }

  if (queued > 0) {
    return (
      <div
        className="fixed left-1/2 -translate-x-1/2 z-[960] px-3 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-semibold border bg-card text-foreground"
        style={{ top: "calc(env(safe-area-inset-top) + 0.5rem)" }}
      >
        <span>{queued} en cola</span>
        <button
          onClick={trySync}
          disabled={syncing}
          className="ml-1 flex items-center gap-1 text-[color:var(--sunrise)] disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando…" : "Sincronizar"}
        </button>
      </div>
    );
  }

  return null;
}
