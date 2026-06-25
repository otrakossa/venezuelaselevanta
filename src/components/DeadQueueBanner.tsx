import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { listDead, clearDead } from "@/lib/offline-queue";

export function DeadQueueBanner() {
  const [count, setCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    const refresh = async () => {
      try {
        const items = await listDead();
        if (!cancelled) setCount(items.length);
      } catch {
        // ignore
      }
    };

    void refresh();

    const onDropped = () => {
      setDismissed(false);
      void refresh();
    };
    window.addEventListener("queue:dropped", onDropped);

    return () => {
      cancelled = true;
      window.removeEventListener("queue:dropped", onDropped);
    };
  }, []);

  if (dismissed || count === 0) return null;

  const handleClear = async () => {
    try {
      await clearDead();
    } finally {
      setCount(0);
    }
  };

  return (
    <div className="bg-amber-100 border-b border-amber-300 text-amber-900 px-4 py-2 text-sm flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1">
        {count} reporte{count === 1 ? "" : "s"} no pudieron enviarse. Revisa tu conexión y limpia la cola para intentar de nuevo.
      </span>
      <button
        onClick={handleClear}
        className="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
      >
        Limpiar cola
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Descartar"
        className="p-1 hover:bg-amber-200 rounded"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
