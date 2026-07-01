import { useEffect, useState, useCallback } from "react";
import { sbx } from "./_client";
import { Loader2, RefreshCw, Check, X, Link2 } from "lucide-react";
import { toast } from "sonner";

type Pair = {
  missing_id: string;
  missing_name: string;
  missing_age: number | null;
  missing_location: string | null;
  missing_source: string | null;
  patient_id: string;
  patient_name: string;
  patient_age: number | null;
  patient_center: string | null;
  score: number;
};

const MAX_PAIRS = 1000;
const PATIENT_SCAN_BATCH = 500;
const fmt = (n: number) => n.toLocaleString("es-VE");

export function MatchQueue() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [loading, setLoading] = useState(false);
  const [minScore, setMinScore] = useState(0.5);
  const [busy, setBusy] = useState<string | null>(null);
  const [patientOffset, setPatientOffset] = useState(0);

  const load = useCallback(async (offset = 0, append = false) => {
    setLoading(true);
    if (!append) setPairs([]);
    const [dismissalsRes, suggsRes] = await Promise.all([
      sbx.from("match_dismissals").select("missing_id,patient_id"),
      sbx.rpc<Array<Record<string, unknown>>>("suggest_patient_matches_all", {
        p_min_score: minScore,
        p_max_pairs: MAX_PAIRS,
        p_patient_offset: offset,
        p_patient_limit: PATIENT_SCAN_BATCH,
      }),
    ]);

    if (suggsRes.error) {
      toast.error(suggsRes.error.message);
      setLoading(false);
      return;
    }

    const dismissed = new Set(
      ((dismissalsRes.data ?? []) as Array<{ missing_id: string; patient_id: string }>)
        .map((d) => `${d.missing_id}:${d.patient_id}`),
    );

    const suggs = (suggsRes.data ?? []) as Array<Record<string, unknown>>;
    const out: Pair[] = [];
    for (const s of suggs) {
      const mid = s.missing_id as string;
      const pid = s.patient_id as string;
      if (dismissed.has(`${mid}:${pid}`)) continue;
      out.push({
        missing_id: mid,
        missing_name: (s.missing_name as string) ?? "",
        missing_age: (s.missing_age as number | null) ?? null,
        missing_location: (s.missing_location as string | null) ?? null,
        missing_source: (s.missing_source as string | null) ?? null,
        patient_id: pid,
        patient_name: (s.patient_name as string) ?? "",
        patient_age: (s.patient_age as number | null) ?? null,
        patient_center: (s.center_name as string | null) ?? null,
        score: Number(s.score),
      });
    }
    setPairs((current) => {
      if (!append) return out;
      const seen = new Set(current.map((p) => `${p.missing_id}:${p.patient_id}`));
      return [...current, ...out.filter((p) => !seen.has(`${p.missing_id}:${p.patient_id}`))];
    });
    setPatientOffset(offset);
    setLoading(false);
  }, [minScore]);

  useEffect(() => { load(0, false); }, [load]);


  const confirm = async (p: Pair) => {
    setBusy(`${p.missing_id}:${p.patient_id}`);
    const { error } = await sbx.rpc("link_missing_to_patient", {
      p_missing_id: p.missing_id, p_patient_id: p.patient_id,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Match confirmado");
    setPairs((rs) => rs.filter((x) => x.missing_id !== p.missing_id));
  };

  const dismiss = async (p: Pair) => {
    const reason = prompt("Motivo (opcional):") ?? null;
    setBusy(`${p.missing_id}:${p.patient_id}`);
    const { error } = await sbx.from("match_dismissals").insert({
      missing_id: p.missing_id, patient_id: p.patient_id, reason,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Sugerencia descartada");
    setPairs((rs) => rs.filter((x) => !(x.missing_id === p.missing_id && x.patient_id === p.patient_id)));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">
          Sugerencias automáticas entre <b>desaparecidos sin match</b> y <b>pacientes registrados</b>, basadas en nombre + edad + ubicación.
        </p>
        <label className="text-xs inline-flex items-center gap-2">
          Score mín:
          <input type="range" min="0.3" max="0.95" step="0.05" value={minScore}
            onChange={(e) => setMinScore(parseFloat(e.target.value))} className="w-24" />
          <b>{Math.round(minScore * 100)}%</b>
        </label>
        <button onClick={() => load(0, false)} disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs hover:bg-muted disabled:opacity-50">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Re-escanear
        </button>
        <button onClick={() => load(patientOffset + PATIENT_SCAN_BATCH, true)} disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs font-bold hover:bg-muted disabled:opacity-50">
          Escanear siguientes {fmt(PATIENT_SCAN_BATCH)}
        </button>
      </div>

      {loading && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Escaneando lote seguro de pacientes contra toda la base de desaparecidos…
        </div>
      )}

      <div className="text-[11px] text-muted-foreground">
        {fmt(pairs.length)} pares candidatos · pacientes escaneados: {fmt(patientOffset + PATIENT_SCAN_BATCH)}
      </div>

      <div className="space-y-2">
        {pairs.map((p) => {
          const key = `${p.missing_id}:${p.patient_id}`;
          return (
            <div key={key} className="bg-card border border-border rounded-lg p-3 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-3 items-center">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Desaparecido</div>
                <div className="font-bold text-sm">{p.missing_name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {p.missing_age != null && <>{p.missing_age} años · </>}
                  {p.missing_location ?? "—"}
                </div>
                {p.missing_source && <div className="text-[10px] text-muted-foreground italic">{p.missing_source}</div>}
              </div>
              <Link2 className="h-4 w-4 text-[color:var(--sunrise)] mx-auto" />
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Paciente</div>
                <div className="font-bold text-sm">{p.patient_name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {p.patient_age != null && <>{p.patient_age} años · </>}
                  {p.patient_center ?? "—"}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                  {Math.round(p.score * 100)}%
                </span>
                <div className="flex gap-1">
                  <button onClick={() => confirm(p)} disabled={busy === key}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">
                    {busy === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Confirmar
                  </button>
                  <button onClick={() => dismiss(p)} disabled={busy === key}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-muted hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50">
                    <X className="h-3 w-3" /> Descartar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {!loading && pairs.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Sin sugerencias por encima del umbral. Baja el score mínimo o re-escanea.
          </div>
        )}
      </div>
    </div>
  );
}
