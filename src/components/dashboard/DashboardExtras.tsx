import { useEffect, useMemo, useState } from "react";
import type { Report } from "@/lib/types";
import { ArrowRight, Clock, AlertTriangle, Scale, Activity } from "lucide-react";

import { SUPA_URL, SUPA_ANON } from "@/lib/supabase-rest";

type RangeKey = "24h" | "7d" | "30d" | "all";
const RANGE_MS: Record<RangeKey, number> = {
  "24h": 86_400_000,
  "7d": 7 * 86_400_000,
  "30d": 30 * 86_400_000,
  all: Number.POSITIVE_INFINITY,
};

const CAT_META: Record<string, { emoji: string; label: string; color: string }> = {
  medicine:   { emoji: "💊", label: "Medicinas",   color: "#DC2626" },
  food:       { emoji: "🍎", label: "Alimentos",   color: "#16A34A" },
  water:      { emoji: "💧", label: "Agua",        color: "#2563EB" },
  volunteers: { emoji: "🤝", label: "Voluntarios", color: "#EA580C" },
  equipment:  { emoji: "🔧", label: "Equipos",     color: "#7C3AED" },
  blood:      { emoji: "🩸", label: "Sangre",      color: "#B91C1C" },
  money:      { emoji: "💰", label: "Dinero",      color: "#CA8A04" },
  hygiene:    { emoji: "🧼", label: "Higiene",     color: "#0EA5E9" },
  diapers:    { emoji: "👶", label: "Pañales",     color: "#DB2777" },
  other:      { emoji: "📦", label: "Otro",        color: "#6B7280" },
};
const CAT_ORDER = Object.keys(CAT_META);

type NeedRow = { category: string | null; status: string | null; created_at: string };
type OfferRow = { category: string | null; status: string | null; need_id: string | null; created_at: string };

export function DashboardExtras({ reports }: { reports: Report[] }) {
  const [range, setRange] = useState<RangeKey>("7d");
  const [needs, setNeeds] = useState<NeedRow[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const h = { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` };
        const [n, o] = await Promise.all([
          fetch(`${SUPA_URL}/rest/v1/needs?select=category,status,created_at&limit=5000`, { headers: h }),
          fetch(`${SUPA_URL}/rest/v1/offers?select=category,status,need_id,created_at&limit=5000`, { headers: h }),
        ]);
        if (!cancelled && n.ok) setNeeds(await n.json());
        if (!cancelled && o.ok) setOffers(await o.json());
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const now = Date.now();
  const cutoff = now - RANGE_MS[range];

  const inRange = useMemo(
    () => reports.filter((r) => new Date(r.created_at).getTime() >= cutoff),
    [reports, cutoff],
  );

  // ── A. Funnel + stuck ──────────────────────────────────────────────
  const funnel = useMemo(() => {
    const active = inRange.filter((r) => r.status === "active").length;
    const attending = inRange.filter((r) => r.status === "attending").length;
    const resolved = inRange.filter((r) => r.status === "resolved").length;
    const total = active + attending + resolved;
    const pickup = total ? Math.round(((attending + resolved) / total) * 100) : 0;
    const close = (attending + resolved) ? Math.round((resolved / (attending + resolved)) * 100) : 0;

    // Median resolve time (created → updated) for resolved
    const durations = inRange
      .filter((r) => r.status === "resolved")
      .map((r) => new Date(r.updated_at).getTime() - new Date(r.created_at).getTime())
      .filter((d) => d > 0)
      .sort((a, b) => a - b);
    const median = durations.length ? durations[Math.floor(durations.length / 2)] : 0;

    return { active, attending, resolved, total, pickup, close, median };
  }, [inRange]);

  const stuck = useMemo(() => {
    return reports
      .filter((r) => r.status === "active" && now - new Date(r.updated_at).getTime() > 86_400_000)
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
      .slice(0, 8);
  }, [reports, now]);

  // ── B. Heatmap hour × day ──────────────────────────────────────────
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    for (const r of inRange) {
      const d = new Date(r.created_at);
      const dow = d.getDay(); // 0=Sun
      const h = d.getHours();
      grid[dow][h]++;
      if (grid[dow][h] > max) max = grid[dow][h];
    }
    return { grid, max };
  }, [inRange]);

  // ── C. Needs vs Offers ─────────────────────────────────────────────
  const balance = useMemo(() => {
    const fNeeds = needs.filter((n) => new Date(n.created_at).getTime() >= cutoff && n.status !== "fulfilled");
    const fOffers = offers.filter((o) => new Date(o.created_at).getTime() >= cutoff && o.status !== "cancelled");
    const need: Record<string, number> = {};
    const offer: Record<string, number> = {};
    for (const n of fNeeds) {
      const k = n.category ?? "other";
      need[k] = (need[k] ?? 0) + 1;
    }
    for (const o of fOffers) {
      const k = o.category ?? "other";
      offer[k] = (offer[k] ?? 0) + 1;
    }
    const rows = CAT_ORDER
      .map((c) => ({ cat: c, need: need[c] ?? 0, offer: offer[c] ?? 0 }))
      .filter((r) => r.need > 0 || r.offer > 0)
      .sort((a, b) => (b.need + b.offer) - (a.need + a.offer));
    const max = rows.reduce((m, r) => Math.max(m, r.need, r.offer), 0) || 1;

    const matched = fOffers.filter((o) => o.need_id).length;
    const matchRate = fOffers.length ? Math.round((matched / fOffers.length) * 100) : 0;

    return { rows, max, totalNeeds: fNeeds.length, totalOffers: fOffers.length, matched, matchRate };
  }, [needs, offers, cutoff]);

  return (
    <div className="space-y-4">
      {/* Filtro temporal */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-card border border-border rounded-2xl p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="h-4 w-4 text-[var(--sunrise)]" />
          <span className="font-semibold text-foreground">Vista temporal</span>
          <span>aplica a embudo, heatmap y balance</span>
        </div>
        <div className="flex gap-1 bg-muted/60 rounded-lg p-0.5">
          {(["24h", "7d", "30d", "all"] as RangeKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setRange(k)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                range === k ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {k === "all" ? "Todo" : k}
            </button>
          ))}
        </div>
      </div>

      {/* Embudo + Estancados */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-display text-base mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--sky)]" /> Embudo de respuesta
          </h3>
          <FunnelBar label="Recibidos" value={funnel.total} max={funnel.total} color="#1A8FE3" />
          <div className="text-[10px] text-muted-foreground text-center my-0.5">
            <ArrowRight className="inline h-3 w-3 -rotate-90" /> {funnel.pickup}% atendidos
          </div>
          <FunnelBar label="En atención + resueltos" value={funnel.attending + funnel.resolved} max={funnel.total} color="#EAB308" />
          <div className="text-[10px] text-muted-foreground text-center my-0.5">
            <ArrowRight className="inline h-3 w-3 -rotate-90" /> {funnel.close}% cerrados
          </div>
          <FunnelBar label="Resueltos" value={funnel.resolved} max={funnel.total} color="#16A34A" />
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 gap-2 text-center">
            <Mini value={funnel.active} label="Activos" color="#DC2626" />
            <Mini value={funnel.attending} label="En curso" color="#EAB308" />
            <Mini value={fmtDuration(funnel.median)} label="Mediana cierre" color="#16A34A" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-display text-base mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[var(--sunrise)]" /> Reportes estancados
            <span className="text-[10px] font-normal text-muted-foreground">activos &gt; 24 h sin movimiento</span>
          </h3>
          {stuck.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center">
              Nada estancado 🎉 — todos los activos tuvieron movimiento en las últimas 24 h.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
              {stuck.map((r) => (
                <a
                  key={r.id}
                  href={`/?report=${r.id}`}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{r.title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {r.state ?? r.address ?? "—"} · sin movimiento {ago(now - new Date(r.updated_at).getTime())}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Heatmap hora × día */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-display text-base">Patrón de reportes · hora × día</h3>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>Menos</span>
            {[0.15, 0.35, 0.55, 0.75, 1].map((o) => (
              <span key={o} className="w-3 h-3 rounded-sm" style={{ background: `rgba(255,107,53,${o})` }} />
            ))}
            <span>Más</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="grid" style={{ gridTemplateColumns: "auto repeat(24, minmax(14px, 1fr))" }}>
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="text-[9px] text-muted-foreground text-center">
                  {h % 3 === 0 ? h : ""}
                </div>
              ))}
              {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((dow, dIdx) => (
                <DayRow key={dow} label={dow} cells={heatmap.grid[dIdx]} max={heatmap.max} />
              ))}
            </div>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground mt-2">
          Total en rango: {inRange.length} reportes · pico horario: {heatmap.max} reportes/hora
        </div>
      </div>

      {/* Necesidades vs Ofrecimientos */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-end justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-display text-base flex items-center gap-2">
            <Scale className="h-4 w-4 text-[var(--gold)]" /> Necesidades vs Ofrecimientos
          </h3>
          <div className="flex gap-2 text-[10px]">
            <span className="px-2 py-0.5 rounded-md bg-red-500/15 text-red-700 dark:text-red-400 font-semibold">
              {balance.totalNeeds} necesidades
            </span>
            <span className="px-2 py-0.5 rounded-md bg-green-500/15 text-green-700 dark:text-green-400 font-semibold">
              {balance.totalOffers} ofrecimientos
            </span>
            <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-400 font-semibold">
              {balance.matchRate}% con match
            </span>
          </div>
        </div>
        {balance.rows.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">
            Sin necesidades ni ofrecimientos en este rango.
          </div>
        ) : (
          <div className="space-y-2.5">
            {balance.rows.map((r) => {
              const meta = CAT_META[r.cat] ?? CAT_META.other;
              const gap = r.need - r.offer;
              const gapColor = gap > 0 ? "#DC2626" : gap < 0 ? "#16A34A" : "#6B7280";
              return (
                <div key={r.cat}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium flex items-center gap-1.5">
                      <span>{meta.emoji}</span> {meta.label}
                    </span>
                    <span className="tabular-nums font-semibold" style={{ color: gapColor }}>
                      {gap > 0 ? `faltan ${gap}` : gap < 0 ? `+${-gap} disponibles` : "balanceado"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Necesidades (izquierda) */}
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[10px] tabular-nums text-muted-foreground w-6 text-right">{r.need}</span>
                      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden flex justify-end">
                        <div
                          className="h-full rounded-l-full"
                          style={{ width: `${(r.need / balance.max) * 100}%`, background: "#DC2626" }}
                        />
                      </div>
                    </div>
                    {/* Ofrecimientos (derecha) */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-r-full"
                          style={{ width: `${(r.offer / balance.max) * 100}%`, background: "#16A34A" }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground w-6">{r.offer}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DayRow({ label, cells, max }: { label: string; cells: number[]; max: number }) {
  return (
    <>
      <div className="text-[10px] text-muted-foreground pr-1.5 flex items-center font-medium">{label}</div>
      {cells.map((c, h) => {
        const o = max ? c / max : 0;
        return (
          <div
            key={h}
            title={`${label} ${h}:00 — ${c} reportes`}
            className="h-5 m-[1px] rounded-sm border border-border/30"
            style={{ background: c ? `rgba(255,107,53,${0.15 + o * 0.85})` : "transparent" }}
          />
        );
      })}
    </>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums font-semibold" style={{ color }}>{value}</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Mini({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div>
      <div className="text-base font-bold tabular-nums leading-none" style={{ color }}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function fmtDuration(ms: number): string {
  if (!ms) return "—";
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.round(ms / 60_000)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

function ago(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}
