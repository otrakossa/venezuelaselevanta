import { useEffect, useRef, useState } from "react";
import { HandHeart, Sparkles } from "lucide-react";
import { SUPA_URL, SUPA_ANON } from "@/lib/supabase-rest";
import { cn } from "@/lib/utils";

type SolidarityStats = {
  total_solidarity: number;
  contributions: number;
  visits: number;
  visits_today: number;
  reports: number;
  needs: number;
  offers: number;
  report_comments: number;
  missing_comments: number;
  report_votes: number;
  found_votes: number;
  contacts: number;
};

let cached: { data: SolidarityStats; ts: number } | null = null;
const TTL_MS = 60_000;

async function fetchSolidarity(): Promise<SolidarityStats | null> {
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.data;
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/solidarity_stats?select=*`, {
      headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` },
    });
    if (!res.ok) return null;
    const rows: SolidarityStats[] = await res.json();
    const row = rows[0];
    if (!row) return null;
    cached = { data: row, ts: Date.now() };
    return row;
  } catch {
    return null;
  }
}

function useSolidarity(): SolidarityStats | null {
  const [stats, setStats] = useState<SolidarityStats | null>(cached?.data ?? null);
  useEffect(() => {
    let cancel = false;
    fetchSolidarity().then((s) => {
      if (!cancel && s) setStats(s);
    });
    return () => {
      cancel = true;
    };
  }, []);
  return stats;
}

/** Small rolling number animation from 0 up to target. */
function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  const start = useRef<number | null>(null);
  useEffect(() => {
    if (!target) return;
    let raf = 0;
    start.current = null;
    const step = (ts: number) => {
      if (start.current === null) start.current = ts;
      const elapsed = ts - start.current;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function formatNum(n: number) {
  return n.toLocaleString("es-VE");
}

/* -------------------------------------------------------------------------- */

export function SolidarityCounter({
  variant = "footer",
  className,
}: {
  variant?: "footer" | "hero" | "kpi";
  className?: string;
}) {
  const stats = useSolidarity();
  const target = stats?.total_solidarity ?? 0;
  const count = useCountUp(target);

  if (!stats) return null;

  if (variant === "hero") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-white/25 bg-gradient-to-br from-white/15 via-white/10 to-white/5 backdrop-blur px-4 py-3 sm:px-5 sm:py-4",
          "flex items-center gap-3 sm:gap-4 shadow-lg shadow-black/20",
          className,
        )}
      >
        <span className="relative grid place-items-center h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-[color:var(--sunrise)]/90 text-white shrink-0 animate-heartbeat">
          <HandHeart className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-display font-black text-2xl sm:text-3xl text-white tabular-nums leading-none tracking-tight">
              {formatNum(count)}
            </span>
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[color:var(--gold)]">
              gestos de solidaridad
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-white/75 mt-1 leading-snug">
            Venezolanos que ya visitaron, reportaron, ofrecieron ayuda o dieron pistas. Súmate.
          </p>
        </div>
        <Sparkles
          className="hidden sm:block h-4 w-4 text-[color:var(--gold)]/70 absolute right-3 top-3"
          aria-hidden
        />
      </div>
    );
  }

  if (variant === "kpi") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border bg-card",
          className,
        )}
      >
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: "linear-gradient(90deg, var(--sunrise), var(--gold))" }}
        />
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid place-items-center h-12 w-12 rounded-xl bg-[color:var(--sunrise)]/10 text-[color:var(--sunrise)] shrink-0 animate-heartbeat">
              <HandHeart className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Solidaridad activa
              </div>
              <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                <span className="font-display font-black text-3xl sm:text-4xl tabular-nums leading-none tracking-tight">
                  {formatNum(count)}
                </span>
                <span className="text-xs text-muted-foreground">gestos acumulados</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-snug">
                Suma total de visitas, reportes, necesidades, ofertas, comentarios y votos.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <Stat label="Visitas" value={stats.visits} />
            <Stat label="Reportes" value={stats.reports} />
            <Stat label="Ofertas" value={stats.offers} />
            <Stat label="Necesidades" value={stats.needs} />
            <Stat label="Comentarios" value={stats.report_comments + stats.missing_comments} />
            <Stat label="Votos" value={stats.report_votes + stats.found_votes} />
            <Stat label="Mensajes" value={stats.contacts} />
            <Stat label="Hoy" value={stats.visits_today} highlight />
          </div>
        </div>
      </div>
    );
  }

  // footer variant (default) — compact pill
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-[color:var(--cream)]/80",
        className,
      )}
      title="Suma de visitas + reportes + ofertas + necesidades + comentarios + votos"
    >
      <HandHeart className="h-3.5 w-3.5 text-[color:var(--sunrise)] animate-heartbeat" />
      <span className="tabular-nums font-bold text-[color:var(--cream)]">
        {formatNum(count)}
      </span>
      <span>gestos de solidaridad</span>
    </span>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-background px-2.5 py-1.5",
        highlight && "border-[color:var(--sunrise)]/40 bg-[color:var(--sunrise)]/5",
      )}
    >
      <div className="text-muted-foreground leading-none">{label}</div>
      <div className="font-semibold tabular-nums text-foreground mt-1">
        {formatNum(value)}
      </div>
    </div>
  );
}

export default SolidarityCounter;
