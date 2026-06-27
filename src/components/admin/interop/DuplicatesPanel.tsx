import { useEffect, useState } from "react";
import { sbx } from "./_client";
import { Loader2, RefreshCw, Combine, ShieldX, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Candidate = {
  a_id: string; b_id: string;
  a_name: string; b_name: string;
  a_age: number | null; b_age: number | null;
  a_location: string | null; b_location: string | null;
  a_source: string | null; b_source: string | null;
  a_photo: string | null; b_photo: string | null;
  a_status: string | null; b_status: string | null;
  name_sim: number; loc_sim: number;
};

const fmt = (n: number) => n.toLocaleString("es-VE");

// quality score for picking winner
function quality(c: Candidate, side: "a" | "b"): number {
  const photo = side === "a" ? c.a_photo : c.b_photo;
  const loc   = side === "a" ? c.a_location : c.b_location;
  const age   = side === "a" ? c.a_age : c.b_age;
  const status = side === "a" ? c.a_status : c.b_status;
  return (photo ? 3 : 0) + (loc ? 2 : 0) + (age != null ? 1 : 0) + (status === "found" ? 5 : 0);
}

export function DuplicatesPanel() {
  const [days, setDays] = useState(30);
  const [items, setItems] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const { data, error } = await sbx.rpc("find_duplicate_candidates", { p_since: since, p_limit: 100 });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as Candidate[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [days]);

  const merge = async (c: Candidate, winner: "a" | "b") => {
    if (!confirm(`Fusionar: el ganador queda y el otro se elimina. ¿Confirmas?`)) return;
    const winnerId = winner === "a" ? c.a_id : c.b_id;
    const loserId  = winner === "a" ? c.b_id : c.a_id;
    const key = `${c.a_id}:${c.b_id}`;
    setBusy(key);
    const { error } = await sbx.rpc("merge_missing_persons", { p_winner_id: winnerId, p_loser_id: loserId });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Fusionado");
    setItems((rs) => rs.filter((x) => !(x.a_id === c.a_id && x.b_id === c.b_id)));
  };

  const whitelist = async (c: Candidate) => {
    const key = `${c.a_id}:${c.b_id}`;
    setBusy(key);
    const { error } = await sbx.from("dedupe_whitelist").insert({ a_id: c.a_id, b_id: c.b_id });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Marcado como no duplicado");
    setItems((rs) => rs.filter((x) => !(x.a_id === c.a_id && x.b_id === c.b_id)));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">
          Pares candidatos a duplicado entre desaparecidos creados en los últimos <b>{days} días</b>,
          por similitud de nombre (≥55%) + edad ±2 + ubicación.
        </p>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="px-2 py-1.5 rounded-md border border-input bg-background text-xs">
          <option value="7">Últimos 7 días</option>
          <option value="30">Últimos 30 días</option>
          <option value="90">Últimos 90 días</option>
          <option value="365">Último año</option>
        </select>
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs hover:bg-muted disabled:opacity-50">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Re-escanear
        </button>
      </div>

      <div className="text-[11px] text-muted-foreground">{fmt(items.length)} pares</div>

      <div className="space-y-3">
        {items.map((c) => {
          const key = `${c.a_id}:${c.b_id}`;
          const qa = quality(c, "a");
          const qb = quality(c, "b");
          const recommended: "a" | "b" = qa >= qb ? "a" : "b";
          return (
            <div key={key} className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2 text-[11px] text-muted-foreground">
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                  Nombre {Math.round(c.name_sim * 100)}%
                </span>
                {c.loc_sim > 0 && (
                  <span className="px-2 py-0.5 rounded bg-muted font-semibold">
                    Ubic. {Math.round(c.loc_sim * 100)}%
                  </span>
                )}
                <span className="ml-auto">Sugerido como ganador: <b>{recommended === "a" ? "Izquierda" : "Derecha"}</b></span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SideCard c={c} side="a" recommended={recommended === "a"} q={qa} />
                <SideCard c={c} side="b" recommended={recommended === "b"} q={qb} />
              </div>
              <div className="flex flex-wrap gap-2 mt-3 justify-end">
                <button onClick={() => whitelist(c)} disabled={busy === key}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-semibold border border-border hover:bg-muted disabled:opacity-50">
                  <ShieldX className="h-3.5 w-3.5" /> No es duplicado
                </button>
                <button onClick={() => merge(c, "a")} disabled={busy === key}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">
                  <Combine className="h-3.5 w-3.5" /> Fusionar → Izq
                </button>
                <button onClick={() => merge(c, "b")} disabled={busy === key}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">
                  <Combine className="h-3.5 w-3.5" /> Fusionar → Der
                </button>
                {busy === key && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </div>
          );
        })}
        {!loading && items.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            No se encontraron pares candidatos en el rango.
          </div>
        )}
      </div>
    </div>
  );
}

function SideCard({ c, side, recommended, q }: { c: Candidate; side: "a" | "b"; recommended: boolean; q: number }) {
  const id   = side === "a" ? c.a_id : c.b_id;
  const name = side === "a" ? c.a_name : c.b_name;
  const age  = side === "a" ? c.a_age : c.b_age;
  const loc  = side === "a" ? c.a_location : c.b_location;
  const src  = side === "a" ? c.a_source : c.b_source;
  const ph   = side === "a" ? c.a_photo : c.b_photo;
  const st   = side === "a" ? c.a_status : c.b_status;
  return (
    <div className={`border rounded-lg p-2 flex gap-2 ${recommended ? "border-emerald-500/50 bg-emerald-500/5" : "border-border"}`}>
      {ph
        ? <img src={ph} className="h-16 w-16 rounded object-cover shrink-0" alt="" loading="lazy" />
        : <div className="h-16 w-16 rounded bg-muted shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm truncate">{name}</div>
        <div className="text-[11px] text-muted-foreground">
          {age != null && <>{age} años · </>}{st ?? "—"}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{loc ?? "—"}</div>
        <div className="text-[10px] text-muted-foreground italic flex items-center gap-1 mt-0.5">
          {src ?? "(sin fuente)"} · calidad {q}
          <a href={`/desaparecidos?focus=${id}`} target="_blank" rel="noopener noreferrer" className="ml-auto hover:text-foreground">
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
