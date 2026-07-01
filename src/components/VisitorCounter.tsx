import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { SUPA_URL, SUPA_ANON } from "@/lib/supabase-rest";

type Stats = {
  total_unique_visitors: number;
  total_visits: number;
  visitors_30d: number;
  visitors_today: number;
};

export function VisitorCounter({ compact = false }: { compact?: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${SUPA_URL}/rest/v1/page_views_stats?select=*`, {
          headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` },
        });
        if (!res.ok) return;
        const rows: Stats[] = await res.json();
        if (!cancelled && rows[0]) setStats(rows[0]);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!stats) return null;
  const total = stats.total_unique_visitors.toLocaleString("es-VE");

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5 text-[var(--sunrise)]" />
        <span className="tabular-nums font-semibold text-foreground">{total}</span>
        <span>personas nos han visitado</span>
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs shadow-sm">
      <Users className="h-4 w-4 text-[var(--sunrise)]" />
      <span className="tabular-nums font-bold text-foreground">{total}</span>
      <span className="text-muted-foreground">visitantes</span>
      <span className="text-muted-foreground/60">·</span>
      <span className="tabular-nums font-semibold text-foreground">
        {stats.visitors_today.toLocaleString("es-VE")}
      </span>
      <span className="text-muted-foreground">hoy</span>
    </div>
  );
}
