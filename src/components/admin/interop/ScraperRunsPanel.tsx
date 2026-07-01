import { useEffect, useState, useCallback } from "react";
import { sbx } from "./_client";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, Clock, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

type RunRow = {
  id: string;
  source_label: string;
  status: "running" | "success" | "error" | "partial";
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  records_seen: number | null;
  records_inserted: number | null;
  records_skipped: number | null;
  matches_created: number | null;
  error_message: string | null;
};

const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString("es-VE"));
const fmtDur = (ms: number | null) => {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
};

const STATUS_META: Record<RunRow["status"], { pill: string; label: string; icon: typeof CheckCircle2 }> = {
  running: { pill: "bg-sky-100 text-sky-700 border-sky-200",       label: "En curso", icon: Loader2 },
  success: { pill: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Éxito",    icon: CheckCircle2 },
  partial: { pill: "bg-amber-100 text-amber-700 border-amber-200",  label: "Parcial",  icon: AlertTriangle },
  error:   { pill: "bg-rose-100 text-rose-700 border-rose-200",     label: "Error",    icon: AlertTriangle },
};

export function ScraperRunsPanel() {
  const [rows, setRows] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const { data, error } = await sbx
      .from("scraper_runs")
      .select("id,source_label,status,started_at,finished_at,duration_ms,records_seen,records_inserted,records_skipped,matches_created,error_message")
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) setErr(error.message);
    else setRows((data ?? []) as RunRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/40 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-[color:var(--sunrise)]" /> Corridas de scraper
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Última ejecución de los sincronizadores (localizapacientes.com, etc.). Errores quedan registrados aquí.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs hover:bg-muted disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refrescar
        </button>
      </div>

      {err && <div className="text-xs text-rose-600 bg-rose-50 border-b border-rose-200 p-2">{err}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-left">
            <tr>
              <th className="px-3 py-2">Fuente</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right"><Clock className="h-3 w-3 inline" /> Inicio</th>
              <th className="px-3 py-2 text-right">Duración</th>
              <th className="px-3 py-2 text-right">Vistos</th>
              <th className="px-3 py-2 text-right">Insertados</th>
              <th className="px-3 py-2 text-right">Matches</th>
              <th className="px-3 py-2">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const m = STATUS_META[r.status];
              const Icon = m.icon;
              return (
                <tr key={r.id} className="hover:bg-muted/30 align-top">
                  <td className="px-3 py-2 font-semibold">{r.source_label}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-bold ${m.pill}`}>
                      <Icon className={`h-3 w-3 ${r.status === "running" ? "animate-spin" : ""}`} />
                      {m.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(r.started_at), { addSuffix: true, locale: es })}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                    {fmtDur(r.duration_ms)}
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(r.records_seen)}</td>
                  <td className="px-3 py-2 text-right">{fmt(r.records_inserted)}</td>
                  <td className="px-3 py-2 text-right">{fmt(r.matches_created)}</td>
                  <td className="px-3 py-2 text-rose-600 max-w-[260px]">
                    {r.error_message ? (
                      <span title={r.error_message} className="line-clamp-2 break-words">{r.error_message}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground text-xs">
                  Aún no se han registrado corridas. El cron de sincronización las poblará automáticamente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
