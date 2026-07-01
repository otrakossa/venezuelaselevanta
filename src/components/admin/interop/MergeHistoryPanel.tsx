import { useEffect, useState, useCallback } from "react";
import { sbx } from "./_client";
import { Loader2, RefreshCw, History as HistoryIcon, Bot, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

type MergeRow = {
  id: string;
  canonical_id: string;
  deleted_id: string;
  score: number | null;
  reason: string | null;
  moved_comments: number | null;
  moved_found_votes: number | null;
  auto: boolean;
  merged_by: string | null;
  created_at: string;
  deleted_snapshot: { name?: string | null; id_number?: string | null } | null;
};

const REASON_LABEL: Record<string, string> = {
  exact_id_number: "Misma cédula",
  name_age_location: "Nombre + edad + ubicación",
};

export function MergeHistoryPanel() {
  const [rows, setRows] = useState<MergeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const { data, error } = await sbx
      .from("missing_merge_log")
      .select("id,canonical_id,deleted_id,score,reason,moved_comments,moved_found_votes,auto,merged_by,created_at,deleted_snapshot")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) setErr(error.message);
    else setRows((data ?? []) as MergeRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/40 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <HistoryIcon className="h-3.5 w-3.5 text-[color:var(--sunrise)]" /> Historial de fusiones
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Últimas 30 fusiones (automáticas y manuales) con snapshot del registro eliminado, para auditoría.
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
              <th className="px-3 py-2">Cuándo</th>
              <th className="px-3 py-2">Origen</th>
              <th className="px-3 py-2">Motivo</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2">Registro eliminado</th>
              <th className="px-3 py-2 text-right">Movidos</th>
              <th className="px-3 py-2">Ganador</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30 align-top">
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: es })}
                </td>
                <td className="px-3 py-2">
                  {r.auto ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-bold">
                      <Bot className="h-3 w-3" /> Auto
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted font-bold">
                      <User className="h-3 w-3" /> Manual
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{r.reason ? (REASON_LABEL[r.reason] ?? r.reason) : "—"}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  {r.score != null ? `${Math.round(r.score * 100)}%` : "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="font-semibold truncate max-w-[220px]">
                    {r.deleted_snapshot?.name ?? "(sin nombre)"}
                  </div>
                  {r.deleted_snapshot?.id_number && (
                    <div className="text-[10px] text-muted-foreground">CI {r.deleted_snapshot.id_number}</div>
                  )}
                  <div className="text-[10px] text-muted-foreground font-mono">{r.deleted_id.slice(0, 8)}</div>
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                  💬 {r.moved_comments ?? 0} · ✅ {r.moved_found_votes ?? 0}
                </td>
                <td className="px-3 py-2">
                  <a
                    href={`/desaparecidos?person=${r.canonical_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-[11px] font-semibold"
                  >
                    Ver ganador →
                  </a>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground text-xs">
                  Aún no hay fusiones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
