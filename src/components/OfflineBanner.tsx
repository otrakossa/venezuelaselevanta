import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { countQueued, flushQueue } from "@/lib/offline-queue";

export function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = async () => setQueued(await countQueued());

  useEffect(() => {
    refresh();
    const on = () => { setOnline(true); void trySync(); };
    const off = () => setOnline(false);
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

  if (online && queued === 0) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[960] px-3 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-semibold border"
      style={{
        top: "calc(env(safe-area-inset-top) + 0.5rem)",
        background: online ? "hsl(var(--card))" : "#0D2B45",
        color: online ? "hsl(var(--foreground))" : "#fff",
        borderColor: online ? "hsl(var(--border))" : "#FF6B35",
      }}
    >
      {!online && <><CloudOff className="h-3.5 w-3.5" /> Sin conexión</>}
      {queued > 0 && (
        <>
          <span className="opacity-80">·</span>
          <span>{queued} en cola</span>
          {online && (
            <button onClick={trySync} disabled={syncing} className="ml-1 flex items-center gap-1 text-[color:var(--sunrise)]">
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} /> Sincronizar
            </button>
          )}
        </>
      )}
    </div>
  );
}
