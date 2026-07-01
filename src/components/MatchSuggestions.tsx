import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { HeartbeatLoader } from "@/components/HeartbeatLoader";
import { Link2, Loader2, ChevronDown, ChevronUp, Check, Unlink, Building2, MapPin, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

type Kind = "missing" | "patient";

type Suggestion = {
  id: string;
  name: string;
  age: number | null;
  location: string | null;
  score: number;
  status?: string | null;
};

interface Props {
  kind: Kind;
  /** id of the missing person or the patient that owns this card */
  selfId: string;
  /** id of the linked counterpart, if any */
  matchedId: string | null | undefined;
  /** optional cached display name of the counterpart, to avoid an extra fetch */
  matchedLabel?: string | null;
  onChanged?: () => void;
}

export function MatchSuggestions({ kind, selfId, matchedId, matchedLabel, onChanged }: Props) {
  const navigate = useNavigate();
  const { isMod, isAuthenticated } = useUserRole();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [counterpart, setCounterpart] = useState<{ id: string; name: string; sub?: string | null } | null>(
    matchedId && matchedLabel ? { id: matchedId, name: matchedLabel } : null,
  );

  // Hydrate counterpart label when only the id is known
  useEffect(() => {
    let active = true;
    if (!matchedId) {
      setCounterpart(null);
      return;
    }
    if (counterpart && counterpart.id === matchedId) return;
    (async () => {
      if (kind === "missing") {
        const { data } = await supabase
          .from("patients")
          .select("id,name,center_name")
          .eq("id", matchedId)
          .maybeSingle();
        if (active && data) setCounterpart({ id: data.id, name: data.name, sub: data.center_name });
      } else {
        const { data } = await supabase
          .from("missing_persons")
          .select("id,name,last_seen_location")
          .eq("id", matchedId)
          .maybeSingle();
        if (active && data) setCounterpart({ id: data.id, name: data.name, sub: data.last_seen_location });
      }
    })();
    return () => { active = false; };
  }, [matchedId, kind, counterpart]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const fn = kind === "missing" ? "suggest_patient_matches" : "suggest_missing_matches";
      const arg = kind === "missing" ? { p_missing_id: selfId } : { p_patient_id: selfId };
      const { data, error } = await supabase.rpc(fn, arg);
      if (error) throw error;
      const mapped: Suggestion[] = (data ?? []).map((r: Record<string, unknown>) => ({
        id: (kind === "missing" ? r.patient_id : r.missing_id) as string,
        name: (kind === "missing" ? r.patient_name : r.missing_name) as string,
        age: (kind === "missing" ? r.patient_age : r.missing_age) as number | null,
        location: (kind === "missing" ? r.center_name : r.last_seen_location) as string | null,
        score: Number(r.score ?? 0),
        status: (r.status as string | null) ?? null,
      }));
      setItems(mapped);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar coincidencias");
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && items === null) await loadSuggestions();
  };

  const confirm = async (candidateId: string) => {
    if (!isMod) return;
    setBusyId(candidateId);
    try {
      const p_missing_id = kind === "missing" ? selfId : candidateId;
      const p_patient_id = kind === "missing" ? candidateId : selfId;
      const { error } = await supabase.rpc("link_missing_to_patient", { p_missing_id, p_patient_id });
      if (error) throw error;
      toast.success("Coincidencia confirmada");
      onChanged?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo vincular");
    } finally {
      setBusyId(null);
    }
  };

  const unlink = async () => {
    if (!isMod || !matchedId) return;
    setBusyId("__unlink__");
    try {
      const p_missing_id = kind === "missing" ? selfId : matchedId;
      const { error } = await supabase.rpc("unlink_missing_patient", { p_missing_id });
      if (error) throw error;
      toast.success("Vínculo eliminado");
      setItems(null);
      onChanged?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo desvincular");
    } finally {
      setBusyId(null);
    }
  };

  const goToCounterpart = () => {
    if (!counterpart) return;
    if (kind === "missing") {
      // Linked patient lives on /pacientes filtered by hospital
      navigate({ to: "/pacientes", search: counterpart.sub ? { center: counterpart.sub } : {} });
    } else {
      // Linked missing person — open on map
      navigate({ to: "/", search: { missing: counterpart.id } });
    }
  };

  // Already linked → confirmed pill
  if (matchedId) {
    return (
      <div className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-emerald-700 dark:text-emerald-400">
              {kind === "missing" ? "Localizado/a en hospital" : "Reportado/a como desaparecido/a"}
            </div>
            {counterpart && (
              <button
                type="button"
                onClick={goToCounterpart}
                className="block text-left text-foreground/90 hover:underline truncate"
                title={counterpart.name}
              >
                {counterpart.name}
                {counterpart.sub && <span className="text-muted-foreground"> · {counterpart.sub}</span>}
              </button>
            )}
          </div>
          {isMod && (
            <button
              type="button"
              onClick={unlink}
              disabled={busyId === "__unlink__"}
              className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border border-emerald-600/30 text-emerald-700 hover:bg-emerald-500/15 disabled:opacity-60"
              title="Quitar vínculo"
            >
              {busyId === "__unlink__" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
              Quitar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        className="w-full inline-flex items-center justify-between gap-2 text-[11px] font-semibold px-2.5 py-1.5 rounded-md border border-dashed border-border text-muted-foreground hover:bg-muted/60"
      >
        <span className="inline-flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          {kind === "missing" ? "Buscar coincidencias en hospitales" : "Buscar coincidencias en desaparecidos"}
        </span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2 space-y-1.5">
          {loading && (
            <div className="flex items-center justify-center py-3 text-xs text-muted-foreground gap-2">
              <HeartbeatLoader className="size-4" /> Buscando…
            </div>
          )}
          {!loading && items && items.length === 0 && (
            <div className="text-[11px] text-muted-foreground py-2 text-center">
              Sin coincidencias por nombre + edad.
            </div>
          )}
          {!loading && items && items.map((s) => (
            <div key={s.id} className="flex items-start gap-2 bg-card border border-border/60 rounded-md p-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate">{s.name}</div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                  {s.age != null && <span>{s.age} años</span>}
                  <span className="inline-flex items-center gap-0.5 ml-auto px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                    {Math.round(s.score * 100)}%
                  </span>
                </div>
                {s.location && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5 truncate">
                    {kind === "missing" ? <Building2 className="h-3 w-3 shrink-0" /> : <MapPin className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{s.location}</span>
                  </div>
                )}
              </div>
              {isMod ? (
                <button
                  type="button"
                  onClick={() => confirm(s.id)}
                  disabled={busyId === s.id}
                  className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60"
                  title="Confirmar que son la misma persona"
                >
                  {busyId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Confirmar
                </button>
              ) : (
                <span className="shrink-0 text-[10px] text-muted-foreground italic">
                  {isAuthenticated ? "Solo moderadores" : "Inicia sesión"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
