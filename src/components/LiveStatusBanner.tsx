import { useEffect, useMemo, useState } from "react";
import { Activity, Phone, X } from "lucide-react";
import { useReports, useMissing } from "@/hooks/useReports";

const DISMISS_KEY = "vsl-live-banner-dismissed";

/**
 * Banner contextual con el pulso de la respuesta: reportes activos,
 * desaparecidos, encontrados y línea de emergencia oficial.
 * Sticky bajo el header, dismissible y persistente por sesión.
 */
export function LiveStatusBanner() {
  const { reports } = useReports();
  const { missing, counts } = useMissing();
  const [hidden, setHidden] = useState(true); // empezar oculto para evitar flash

  useEffect(() => {
    setHidden(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const stats = useMemo(() => {
    const activeReports = reports.filter((r) => r.status === "active").length;
    const lastUpdate = [...reports, ...missing]
      .map((x) => new Date((x as { updated_at?: string }).updated_at ?? x.created_at).getTime())
      .reduce((a, b) => (b > a ? b : a), 0);
    return { activeReports, lastUpdate };
  }, [reports, missing]);

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    sessionStorage.setItem(DISMISS_KEY, "1");
  };

  const updateLabel = counts.lastUpdate
    ? new Date(counts.lastUpdate).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-[color:var(--midnight)] text-[color:var(--cream)] border-b border-white/10"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 flex items-center gap-2 sm:gap-4 text-xs sm:text-[13px]">
        <Activity className="h-3.5 w-3.5 text-[color:var(--gold)] shrink-0 hidden sm:block" aria-hidden />
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-x-auto no-scrollbar">
          <Stat label="activos" value={counts.activeReports} tone="sunrise" />
          <Sep />
          <Stat label="desaparecidos" value={counts.stillMissing} tone="rose" />
          <Sep />
          <Stat label="reunidos" value={counts.found} tone="emerald" />
          <Sep />
          <span className="whitespace-nowrap text-white/65">
            Actualizado <span className="text-white/90 font-semibold">{updateLabel}</span>
          </span>
        </div>
        <a
          href="tel:171"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[color:var(--sunrise)] text-white font-bold px-3 py-1 text-[11px] hover:opacity-90 transition shrink-0"
          aria-label="Llamar a emergencias 171"
        >
          <Phone className="h-3 w-3" aria-hidden /> 171
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Ocultar banner de estado"
          className="p-1.5 -mr-1 rounded-full hover:bg-white/10 transition shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "sunrise" | "rose" | "emerald" }) {
  const colorVar = tone === "sunrise" ? "var(--sunrise)" : tone === "rose" ? "#fb7185" : "#34d399";
  return (
    <span className="whitespace-nowrap">
      <span className="font-display text-sm sm:text-base font-bold" style={{ color: colorVar }}>
        {value.toLocaleString("es-VE")}
      </span>{" "}
      <span className="text-white/75">{label}</span>
    </span>
  );
}

function Sep() {
  return <span aria-hidden className="text-white/20">·</span>;
}
