import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, MapPin, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { normalizeText } from "@/hooks/useHealthCenters";
import { type Site, siteTypeLabel, useSites } from "@/hooks/useSites";

type Props = {
  value: string;
  onSelect: (sel: { site: Site | null; name: string }) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
};

/**
 * Selector de "punto/sitio" (sites): busca puntos existentes o crea uno nuevo.
 * Mismo patrón que HealthCenterPicker (Popover + Command), pero sobre `sites`.
 * onSelect entrega el site existente, o site=null + el nombre tecleado (nuevo).
 */
export function SitePicker({ value, onSelect, placeholder = "Punto / centro…", required, className }: Props) {
  const { sites, loading } = useSites();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const HARD_RENDER_CAP = 200;
  const nQuery = normalizeText(query);
  const { matches, total } = useMemo(() => {
    if (!sites.length) return { matches: [] as Site[], total: 0 };
    if (!nQuery) return { matches: sites.slice(0, 100), total: sites.length };
    const starts: Site[] = [];
    const includes: Site[] = [];
    for (const s of sites) {
      const n = normalizeText(s.name);
      const hay = normalizeText(
        `${s.name} ${s.parish ?? ""} ${s.municipality ?? ""} ${s.state ?? ""}`,
      );
      if (n.startsWith(nQuery)) starts.push(s);
      else if (hay.includes(nQuery)) includes.push(s);
    }
    const all = [...starts, ...includes];
    return { matches: all.slice(0, HARD_RENDER_CAP), total: all.length };
  }, [sites, nQuery]);
  const truncated = total > matches.length;

  const exactMatch = useMemo(
    () => !!query.trim() && sites.some((s) => normalizeText(s.name) === nQuery),
    [sites, nQuery, query],
  );

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-required={required}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-input bg-background text-sm text-left hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={cn("flex-1 truncate", !value && "text-muted-foreground")}>
              {value || placeholder}
            </span>
            {value && (
              <X
                className="h-4 w-4 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect({ site: null, name: "" });
                }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={loading ? "Cargando puntos…" : "Escribe para buscar o crear…"}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>{loading ? "Cargando…" : "Sin resultados."}</CommandEmpty>
              {matches.length > 0 && (
                <CommandGroup
                  heading={
                    nQuery
                      ? `${total} resultado${total === 1 ? "" : "s"}${truncated ? ` · mostrando ${matches.length}` : ""}`
                      : `Escribe para buscar entre ${sites.length} puntos`
                  }
                >
                  {matches.map((s) => {
                    const selected = value === s.name;
                    const loc = [s.parish, s.municipality, s.state].filter(Boolean).join(", ");
                    const sub = `${siteTypeLabel(s.type)}${loc ? ` · ${loc}` : ""}`;
                    return (
                      <CommandItem
                        key={s.id}
                        value={s.id}
                        onSelect={() => {
                          onSelect({ site: s, name: s.name });
                          setOpen(false);
                          setQuery("");
                        }}
                        className="flex items-start gap-2"
                      >
                        <Check className={cn("h-4 w-4 mt-0.5 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{s.name}</div>
                          <div className="text-[11px] truncate text-muted-foreground">{sub}</div>
                        </div>
                      </CommandItem>
                    );
                  })}
                  {truncated && (
                    <div className="px-3 py-2 text-[11px] text-muted-foreground italic">
                      Afina la búsqueda para ver más resultados.
                    </div>
                  )}
                </CommandGroup>
              )}
              {query.trim() && !exactMatch && (
                <CommandGroup heading="¿No lo encuentras?">
                  <CommandItem
                    value={`__new__${query}`}
                    onSelect={() => {
                      onSelect({ site: null, name: query.trim() });
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crear punto nuevo “{query.trim()}”
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
