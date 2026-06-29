import { useEffect, useState, useCallback } from "react";
import { sbx } from "./_client";
import { Loader2, RefreshCw, Combine, ShieldX, ExternalLink, PlayCircle, History } from "lucide-react";
import { toast } from "sonner";

type Person = {
  id: string;
  name: string | null;
  age: number | null;
  last_seen_location: string | null;
  photo_url: string | null;
  status: string | null;
  id_number: string | null;
  contact_phone: string | null;
  source_label: string | null;
  created_at: string | null;
};

type QueueRow = {
  id: string;
  canonical_id: string;
  duplicate_id: string;
  score: number;
  reason: string;
  status: string;
  created_at: string;
  canonical?: Person;
  duplicate?: Person;
};

type RunStats = { detected: number; auto_merged: number; queued: number } | null;

const fmt = (n: number) => n.toLocaleString("es-VE");

const REASON_LABEL: Record<string, string> = {
  exact_id_number: "Misma cédula",
  name_age_location: "Nombre + edad + ubicación",
};

export function DuplicatesPanel() {
  const [items, setItems] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [autoMergedCount, setAutoMergedCount] = useState<number | null>(null);
  const [lastRun, setLastRun] = useState<RunStats>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // 1. Pull pending pairs
    const { data: rows, error } = await sbx
      .from("missing_dedupe_queue")
      .select("id,canonical_id,duplicate_id,score,reason,status,created_at")
      .eq("status", "pending")
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const queue = (rows ?? []) as QueueRow[];

    // 2. Hydrate both sides in one query
    const ids = Array.from(new Set(queue.flatMap((q) => [q.canonical_id, q.duplicate_id])));
    let people = new Map<string, Person>();
    if (ids.length > 0) {
      const { data: persons, error: pErr } = await sbx
        .from("missing_persons")
        .select("id,name,age,last_seen_location,photo_url,status,id_number,contact_phone,source_label,created_at")
        .in("id", ids);
      if (pErr) toast.error(pErr.message);
      else for (const p of (persons ?? []) as Person[]) people.set(p.id, p);
    }
    setItems(
      queue.map((q) => ({
        ...q,
        canonical: people.get(q.canonical_id),
        duplicate: people.get(q.duplicate_id),
      })).filter((q) => q.canonical && q.duplicate),
    );

    // 3. Audit counter for visibility
    const { count } = await sbx
      .from("missing_merge_log")
      .select("id", { count: "exact", head: true })
      .eq("auto", true);
    setAutoMergedCount(typeof count === "number" ? count : null);

    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runNow = async () => {
    setRunning(true);
    const { data, error } = await sbx.rpc<RunStats[]>("dedupe_missing_persons_run");
    setRunning(false);
    if (error) return toast.error(error.message);
    const stats = Array.isArray(data) ? data[0] ?? null : (data as RunStats);
    setLastRun(stats);
    toast.success(`Detectados: ${stats?.detected ?? 0} · Auto-fusión: ${stats?.auto_merged ?? 0} · En cola: ${stats?.queued ?? 0}`);
    void load();
  };

  const merge = async (q: QueueRow, winner: "canonical" | "duplicate") => {
    const winnerId = winner === "canonical" ? q.canonical_id : q.duplicate_id;
    const loserId  = winner === "canonical" ? q.duplicate_id : q.canonical_id;
    if (!confirm("Esto eliminará permanentemente el registro perdedor (los comentarios y votos se mueven al ganador). ¿Confirmas?")) return;
    setBusy(q.id);
    const { error } = await sbx.rpc("merge_missing_persons", {
      p_canonical_id: winnerId,
      p_duplicate_id: loserId,
      p_auto: false,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Fusionado");
    setItems((rs) => rs.filter((x) => x.id !== q.id));
  };

  const dismiss = async (q: QueueRow) => {
    setBusy(q.id);
    const { error } = await sbx
      .from("missing_dedupe_queue")
      .update({ status: "dismissed", reviewed_at: new Date().toISOString() })
      .eq("id", q.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    setItems((rs) => rs.filter((x) => x.id !== q.id));
  };

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <p className="text-xs font-semibold">Deduplicación automática</p>
          <p className="text-[11px] text-muted-foreground">
            Se ejecuta cada 8 horas. Fusiona en automático cuando coincide la cédula (score 1.0).
            Pares por nombre + edad + ubicación quedan aquí para revisión humana.
            {autoMergedCount != null && <> Auto-fusiones históricas: <b>{fmt(autoMergedCount)}</b>.</>}
          </p>
        </div>
        <button
          onClick={runNow}
          disabled={running}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
          Ejecutar ahora
        </button>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md border border-border text-xs hover:bg-muted disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Recargar
        </button>
      </div>

      {lastRun && (
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <History className="h-3 w-3" />
          Última corrida: {lastRun.detected} detectados · {lastRun.auto_merged} auto-fusión · {lastRun.queued} encolados.
        </div>
      )}

      <div className="text-[11px] text-muted-foreground">{fmt(items.length)} pares pendientes de revisión</div>

      <div className="space-y-3">
        {items.map((q) => {
          const a = q.canonical!;
          const b = q.duplicate!;
          // Suggest the "better" record as canonical
          const qA = qualityScore(a);
          const qB = qualityScore(b);
          const recommended: "canonical" | "duplicate" = qA >= qB ? "canonical" : "duplicate";
          return (
            <div key={q.id} className="bg-card border border-border rounded-lg p-3">
              <div className="flex flex-wrap items-center gap-2 mb-2 text-[11px] text-muted-foreground">
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                  Score {Math.round(q.score * 100)}%
                </span>
                <span className="px-2 py-0.5 rounded bg-muted font-semibold">
                  {REASON_LABEL[q.reason] ?? q.reason}
                </span>
                <span className="ml-auto">
                  Ganador sugerido: <b>{recommended === "canonical" ? "Izquierda" : "Derecha"}</b>
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SideCard p={a} recommended={recommended === "canonical"} q={qA} />
                <SideCard p={b} recommended={recommended === "duplicate"} q={qB} />
              </div>
              <div className="flex flex-wrap gap-2 mt-3 justify-end">
                <button
                  onClick={() => dismiss(q)}
                  disabled={busy === q.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-semibold border border-border hover:bg-muted disabled:opacity-50"
                >
                  <ShieldX className="h-3.5 w-3.5" /> No es duplicado
                </button>
                <button
                  onClick={() => merge(q, "canonical")}
                  disabled={busy === q.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  <Combine className="h-3.5 w-3.5" /> Mantener izquierda
                </button>
                <button
                  onClick={() => merge(q, "duplicate")}
                  disabled={busy === q.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  <Combine className="h-3.5 w-3.5" /> Mantener derecha
                </button>
                {busy === q.id && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </div>
          );
        })}
        {!loading && items.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            No hay pares pendientes. La próxima corrida automática es cada 8 horas, o usa "Ejecutar ahora".
          </div>
        )}
      </div>
    </div>
  );
}

function qualityScore(p: Person): number {
  return (p.photo_url ? 3 : 0)
    + (p.id_number ? 3 : 0)
    + (p.contact_phone ? 2 : 0)
    + (p.last_seen_location ? 2 : 0)
    + (p.age != null ? 1 : 0)
    + (p.status === "found" ? 5 : 0);
}

function SideCard({ p, recommended, q }: { p: Person; recommended: boolean; q: number }) {
  return (
    <div className={`border rounded-lg p-2 flex gap-2 ${recommended ? "border-emerald-500/50 bg-emerald-500/5" : "border-border"}`}>
      {p.photo_url
        ? <img src={p.photo_url} className="h-16 w-16 rounded object-cover shrink-0" alt="" loading="lazy" />
        : <div className="h-16 w-16 rounded bg-muted shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm truncate">{p.name ?? "(sin nombre)"}</div>
        <div className="text-[11px] text-muted-foreground">
          {p.age != null && <>{p.age} años · </>}{p.status ?? "—"}
          {p.id_number && <> · CI {p.id_number}</>}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{p.last_seen_location ?? "—"}</div>
        <div className="text-[10px] text-muted-foreground italic flex items-center gap-1 mt-0.5">
          {p.source_label ?? "(sin fuente)"} · calidad {q}
          <a
            href={`/desaparecidos?person=${p.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
