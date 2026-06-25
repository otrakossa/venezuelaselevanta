import { useEffect, useRef, useState } from "react";
import { CloudOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { countQueued, flushQueue } from "@/lib/offline-queue";

export function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [restored, setRestored] = useState(false);
  const wasOffline = useRef(false);

  const refresh = async () => setQueued(await countQueued());

  useEffect(() => {
    refresh();
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
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("queue:changed", refresh);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("queue:changed", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trySync = async () => {
    if (syncing) return;
    const c = await countQueued();
    if (c === 0) return;
    setSyncing(true);
    const res = await flushQueue();
    setSyncing(false);
    await refresh();
    if (res.ok > 0) toast.success(`✅ ${res.ok} reporte(s) sincronizado(s)`, { icon: <CheckCircle2 className="h-4 w-4" /> });
    if (res.failed > 0) toast.error(`${res.failed} reporte(s) no se pudieron sincronizar`);
  };

  if (!online) {
    return (
      <div
        className="fixed left-0 right-0 z-[960] px-3 py-2 flex items-center justify-center gap-2 text-xs font-semibold text-white shadow-lg"
        style={{
          top: "calc(env(safe-area-inset-top) + 0px)",
          background: "#FF6B35",
        }}
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
        style={{
          top: "calc(env(safe-area-inset-top) + 0px)",
          background: "#16a34a",
        }}
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> ✓ Conexión restaurada
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
        <button onClick={trySync} disabled={syncing} className="ml-1 flex items-center gap-1 text-[color:var(--sunrise)]">
          <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} /> Sincronizar
        </button>
      </div>
    );
  }

  return null;
}

