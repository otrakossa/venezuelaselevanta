import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, X, Hospital } from "lucide-react";
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
import { useHealthCenters, normalizeText } from "@/hooks/useHealthCenters";

type Props = {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
};

export function HealthCenterPicker({
  value,
  onChange,
  placeholder = "Buscar centro de salud…",
  required,
  className,
}: Props) {
  const { centers, loading } = useHealthCenters();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const HARD_RENDER_CAP = 200;
  const nQuery = normalizeText(query);
  const { matches, total } = useMemo(() => {
    if (!centers.length) return { matches: [], total: 0 };
    if (!nQuery) return { matches: centers.slice(0, 100), total: centers.length };
    const starts: typeof centers = [];
    const includes: typeof centers = [];
    for (const c of centers) {
      const n = normalizeText(c.name);
      const hay = normalizeText(`${c.name} ${c.city ?? ""} ${c.state ?? ""} ${c.address ?? ""}`);
      if (n.startsWith(nQuery)) starts.push(c);
      else if (hay.includes(nQuery)) includes.push(c);
    }
    const rank = (a: typeof centers[number], b: typeof centers[number]) => {
      const ag = a.city || a.state ? 0 : 1;
      const bg = b.city || b.state ? 0 : 1;
      if (ag !== bg) return ag - bg;
      return a.name.localeCompare(b.name);
    };
    starts.sort(rank);
    includes.sort(rank);
    const all = [...starts, ...includes];
    return { matches: all.slice(0, HARD_RENDER_CAP), total: all.length };
  }, [centers, nQuery]);
  const filtered = matches;
  const truncated = total > filtered.length;


  const exactMatch = useMemo(
    () =>
      !!query.trim() &&
      centers.some((c) => normalizeText(c.name) === nQuery),
    [centers, nQuery, query],
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
            <Hospital className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={cn("flex-1 truncate", !value && "text-muted-foreground")}>
              {value || placeholder}
            </span>
            {value && (
              <X
                className="h-4 w-4 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={loading ? "Cargando centros…" : "Escribe para buscar…"}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                {loading ? "Cargando…" : "Sin resultados."}
              </CommandEmpty>
              {filtered.length > 0 && (
                <CommandGroup heading={`${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`}>
                  {filtered.map((c) => {
                    const selected = value === c.name;
                    const sub = [c.city, c.state].filter(Boolean).join(" · ");
                    return (
                      <CommandItem
                        key={c.id}
                        value={c.id}
                        onSelect={() => {
                          onChange(c.name);
                          setOpen(false);
                          setQuery("");
                        }}
                        className="flex items-start gap-2"
                      >
                        <Check
                          className={cn(
                            "h-4 w-4 mt-0.5 shrink-0",
                            selected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{c.name}</div>
                          {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              {query.trim() && !exactMatch && (
                <CommandGroup heading="¿No lo encuentras?">
                  <CommandItem
                    value={`__new__${query}`}
                    onSelect={() => {
                      onChange(query.trim());
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Usar “{query.trim()}” como nuevo centro
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
