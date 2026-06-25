import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

export function CategoryFilter({
  active,
  onToggle,
}: {
  active: string[];
  onToggle: (slug: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((c) => {
        const isOn = active.length === 0 || active.includes(c.slug);
        return (
          <button
            key={c.slug}
            onClick={() => onToggle(c.slug)}
            className={cn(
              "flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border font-medium transition-all",
              isOn ? "text-white shadow-sm" : "bg-muted text-muted-foreground border-transparent opacity-60",
            )}
            style={isOn ? { background: c.color, borderColor: c.color } : undefined}
          >
            <span>{c.emoji}</span>
            <span className="hidden sm:inline">{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}
