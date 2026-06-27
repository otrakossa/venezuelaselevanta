import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { ChevronUp, ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Leyenda colapsable del mapa: explica colores e iconos de cada categoría
 * y el marcador de personas desaparecidas. Plegada por defecto en mobile.
 */
export function MapLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute bottom-3 right-3 z-[400] pointer-events-auto">
      <div
        className={cn(
          "rounded-xl bg-white/95 backdrop-blur border border-border shadow-lg overflow-hidden transition-all",
          open ? "w-[260px]" : "w-auto",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="map-legend-body"
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-[color:var(--midnight)] hover:bg-black/5 transition min-h-[44px]"
        >
          <span className="inline-flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" aria-hidden /> Leyenda
          </span>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
        {open && (
          <div id="map-legend-body" className="px-3 pb-3 pt-1 max-h-[50vh] overflow-y-auto">
            <ul className="space-y-1.5">
              {CATEGORIES.map((c) => (
                <li key={c.slug} className="flex items-center gap-2 text-[12px]">
                  <span
                    aria-hidden
                    className="h-6 w-6 rounded-full grid place-items-center text-sm shadow"
                    style={{ background: c.color, color: "white" }}
                  >
                    {c.emoji}
                  </span>
                  <span className="text-foreground/85">{c.name}</span>
                </li>
              ))}
              <li className="flex items-center gap-2 text-[12px] pt-1.5 border-t border-border/60 mt-1.5">
                <span
                  aria-hidden
                  className="h-6 w-6 rounded-full grid place-items-center text-[11px] font-black text-white shadow"
                  style={{ background: "#f43f5e" }}
                >
                  N
                </span>
                <span className="text-foreground/85">Persona desaparecida</span>
              </li>
              <li className="flex items-center gap-2 text-[12px]">
                <span
                  aria-hidden
                  className="h-4 w-4 rounded-full"
                  style={{ background: "#f59e0b", opacity: 0.6, border: "1px solid white" }}
                />
                <span className="text-foreground/85">Sismo (USGS)</span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
