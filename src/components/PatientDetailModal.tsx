import { useEffect, useState } from "react";
import { X, Hospital, MapPin, Phone, User, CalendarDays, Loader2, ExternalLink, IdCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type PatientFull = {
  id: string;
  name: string;
  age: number | null;
  sex: string | null;
  id_number: string | null;
  phone: string | null;
  address: string | null;
  state: string | null;
  sector: string | null;
  center_name: string | null;
  center_address: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
  source_url?: string | null;
  source_label?: string | null;
};

export function PatientDetailModal({
  patientId,
  open,
  onClose,
  onConfirmMatch,
  onDismissMatch,
  missingPersonName,
}: {
  patientId: string | null;
  open: boolean;
  onClose: () => void;
  onConfirmMatch?: (patient: PatientFull) => void;
  onDismissMatch?: (patientId: string) => void;
  missingPersonName?: string;
}) {
  const [patient, setPatient] = useState<PatientFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !patientId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setPatient(null);
      const { data, error } = await (supabase as any)
        .from("patients")
        .select(
          "id,name,age,sex,id_number,phone,address,state,sector,center_name,center_address,status,notes,created_at,source_url,source_label"
        )
        .eq("id", patientId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setError("No se pudo cargar la información del paciente.");
      } else {
        setPatient(data as PatientFull);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, patientId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1300] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden border border-border">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-sky-600 to-sky-700 text-white px-5 py-4 pr-12">
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute top-3 right-3 h-9 w-9 grid place-items-center rounded-full bg-white/15 hover:bg-white/25 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-90">
            <Hospital className="h-4 w-4" /> Paciente atendido
          </div>
          <h2 className="text-xl font-black leading-tight mt-1 truncate">
            {loading ? "Cargando…" : patient?.name ?? "—"}
          </h2>
          {patient && (
            <div className="text-xs opacity-90 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {patient.age != null && <span>{patient.age} años</span>}
              {patient.sex && <><span className="opacity-60">•</span><span className="capitalize">{patient.sex}</span></>}
              {patient.status && <><span className="opacity-60">•</span><span className="capitalize">{patient.status}</span></>}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando información…
            </div>
          )}

          {error && (
            <div className="text-sm text-rose-700 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 text-center">
              {error}
            </div>
          )}

          {patient && !loading && (
            <>
              {/* Comparador rápido */}
              {missingPersonName && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <div className="font-bold mb-1">Comparación rápida</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="opacity-70">Desaparecido</div>
                      <div className="font-semibold truncate">{missingPersonName}</div>
                    </div>
                    <div>
                      <div className="opacity-70">Paciente</div>
                      <div className="font-semibold truncate">{patient.name}</div>
                    </div>
                  </div>
                </div>
              )}

              <DataRow icon={<IdCard className="h-4 w-4" />} label="Cédula" value={patient.id_number} />
              <DataRow icon={<User className="h-4 w-4" />} label="Edad / sexo" value={[
                patient.age != null ? `${patient.age} años` : null,
                patient.sex,
              ].filter(Boolean).join(" · ") || null} />
              <DataRow icon={<Hospital className="h-4 w-4" />} label="Centro de salud" value={patient.center_name} />
              <DataRow icon={<MapPin className="h-4 w-4" />} label="Ubicación" value={[
                patient.center_address,
                patient.sector,
                patient.state,
              ].filter(Boolean).join(", ") || patient.address || null} />
              <DataRow icon={<Phone className="h-4 w-4" />} label="Teléfono" value={patient.phone} />
              <DataRow icon={<CalendarDays className="h-4 w-4" />} label="Registrado" value={
                patient.created_at ? new Date(patient.created_at).toLocaleString("es-VE") : null
              } />

              {patient.notes && (
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Notas</div>
                  <div className="text-sm whitespace-pre-wrap">{patient.notes}</div>
                </div>
              )}

              {patient.source_url && (
                <a
                  href={patient.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-sky-700 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Fuente {patient.source_label ? `· ${patient.source_label}` : "original"}
                </a>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {patient && !loading && (onConfirmMatch || onDismissMatch) && (
          <div className="border-t border-border bg-muted/30 p-3 space-y-2">
            <div className="text-[11px] text-center text-muted-foreground leading-relaxed">
              Revisa con cuidado. Antes de confirmar, contacta al centro de salud si es posible.
            </div>
            <div className="flex gap-2">
              {onDismissMatch && (
                <button
                  type="button"
                  onClick={() => { onDismissMatch(patient.id); onClose(); }}
                  className="flex-1 h-10 rounded-lg border border-border bg-card text-sm font-bold hover:bg-muted"
                >
                  No es
                </button>
              )}
              {onConfirmMatch && (
                <button
                  type="button"
                  onClick={() => { onConfirmMatch(patient); }}
                  className="flex-1 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black inline-flex items-center justify-center gap-2"
                >
                  ✅ Es mi familiar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DataRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 text-sm">
      <div className="mt-0.5 text-muted-foreground shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-semibold break-words">{value}</div>
      </div>
    </div>
  );
}
