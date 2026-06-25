import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { MapView } from "@/components/MapView";
import { CategoryFilter } from "@/components/CategoryFilter";
import { CATEGORY_MAP, URGENCY_LABELS, STATUS_LABELS } from "@/lib/categories";
import { useReports } from "@/hooks/useReports";
import { format } from "date-fns";
import { Filter, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Venezuela Se Levanta — venezuelaselevanta.info" },
      { name: "description", content: "Plataforma ciudadana de respuesta al terremoto de Venezuela. Reporta y consulta incidentes en tiempo real." },
      { property: "og:title", content: "Venezuela Se Levanta — venezuelaselevanta.info" },
      { property: "og:description", content: "Venezuela Se Levanta: mapa colaborativo de respuesta al terremoto. venezuelaselevanta.info" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { reports, loading } = useReports();
  const [active, setActive] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const toggle = (slug: string) =>
    setActive((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));

  const visible = useMemo(
    () => (active.length === 0 ? reports : reports.filter((r) => active.includes(r.category))),
    [reports, active],
  );

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-7rem)]">
      <div className="flex-1 relative">
        <div className="absolute top-3 left-3 right-3 z-[400] flex flex-col gap-2 pointer-events-none">
          <div className="flex items-center justify-between gap-2 pointer-events-auto">
            <button
              onClick={() => setShowFilters((s) => !s)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-md text-xs font-semibold shadow-md"
            >
              <Filter className="h-3.5 w-3.5" />
              Filtros {active.length > 0 && `(${active.length})`}
            </button>
            <div className="bg-card/95 border border-border rounded-md px-3 py-1.5 text-xs font-medium shadow-md">
              {visible.length} reportes
            </div>
          </div>
          {showFilters && (
            <div className="bg-card border border-border rounded-md p-3 shadow-md pointer-events-auto">
              <CategoryFilter active={active} onToggle={toggle} />
              {active.length > 0 && (
                <button
                  onClick={() => setActive([])}
                  className="mt-2 text-[11px] text-muted-foreground hover:text-foreground underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>
        <ClientOnly
          fallback={
            <div className="h-full flex items-center justify-center bg-muted">
              <AlertTriangle className="h-8 w-8 text-vzla-red animate-pulse" />
            </div>
          }
        >
          <MapView reports={visible} />
        </ClientOnly>
      </div>

      <aside className="w-full lg:w-80 border-l border-border bg-card overflow-y-auto max-h-[40vh] lg:max-h-none">
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3">
          <h2 className="font-bold text-sm">Reportes recientes</h2>
          <p className="text-[11px] text-muted-foreground">{loading ? "Cargando..." : `${visible.length} incidentes`}</p>
        </div>
        <ul className="divide-y divide-border">
          {visible.slice(0, 30).map((r) => {
            const cat = CATEGORY_MAP[r.category];
            return (
              <li key={r.id} className="p-3 hover:bg-muted/50 transition">
                <div className="flex items-start gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0"
                    style={{ background: cat?.color, color: "white" }}
                  >
                    {cat?.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-xs truncate">{r.title}</span>
                      {r.verified && <span className="text-[9px] bg-emerald-500 text-white px-1 rounded">✓</span>}
                    </div>
                    {r.location_text && (
                      <div className="text-[10px] text-muted-foreground truncate">📍 {r.location_text}</div>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded text-white font-semibold"
                        style={{ background: URGENCY_LABELS[r.urgency].color }}
                      >
                        {URGENCY_LABELS[r.urgency].label}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {STATUS_LABELS[r.status]} · {format(new Date(r.created_at), "dd MMM HH:mm")}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
          {visible.length === 0 && !loading && (
            <li className="p-6 text-center text-xs text-muted-foreground">No hay reportes</li>
          )}
        </ul>
      </aside>
    </div>
  );
}
