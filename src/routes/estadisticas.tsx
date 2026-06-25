import { createFileRoute } from "@tanstack/react-router";
import { useReports, useMissing } from "@/hooks/useReports";
import { useUSGSQuakes, quakeColor } from "@/hooks/useUSGSQuakes";
import { CATEGORIES, CATEGORY_MAP, STATUS_LABELS } from "@/lib/categories";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  PieChart, Pie, AreaChart, Area, Legend,
} from "recharts";
import {
  AlertCircle, Users, MapPin, Download, Activity,
  ShieldCheck, CheckCircle2, Clock, Flame, Waves, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/estadisticas")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — Venezuela Se Levanta" },
      { name: "description", content: "Indicadores en tiempo real de la respuesta al terremoto en Venezuela." },
    ],
  }),
  component: StatsPage,
});

const URGENCY_COLOR: Record<string, string> = {
  critical: "#DC2626",
  high: "#EA580C",
  medium: "#EAB308",
  low: "#16A34A",
};

function StatsPage() {
  const { reports } = useReports();
  const { missing } = useMissing();
  const { data: quakes = [] } = useUSGSQuakes(true);

  const stats = useMemo(() => {
    const total = reports.length;
    const active = reports.filter((r) => r.status === "active").length;
    const attending = reports.filter((r) => r.status === "attending").length;
    const resolved = reports.filter((r) => r.status === "resolved").length;
    const critical = reports.filter((r) => r.urgency === "critical" || r.urgency === "high").length;
    const help = reports.filter((r) => r.category === "shelter" || r.category === "hospital").length;
    const rescue = reports.filter((r) => r.category === "rescue").length;
    const missingActive = missing.filter((m) => m.status === "missing").length;
    const verified = reports.filter((r) => (r.confirm_count ?? 0) >= 3).length;

    const now = Date.now();
    const last24h = reports.filter((r) => now - new Date(r.created_at).getTime() < 86_400_000).length;
    const prev24h = reports.filter((r) => {
      const t = now - new Date(r.created_at).getTime();
      return t >= 86_400_000 && t < 2 * 86_400_000;
    }).length;
    const delta24h = last24h - prev24h;

    const quakes24h = quakes.filter((q) => now - q.time < 86_400_000).length;
    const maxMag = quakes.reduce((m, q) => Math.max(m, q.mag), 0);

    // Serie temporal últimos 14 días
    const days: { day: string; label: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      days.push({
        day: key,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        count: 0,
      });
    }
    const dayIdx = new Map(days.map((d, i) => [d.day, i]));
    reports.forEach((r) => {
      const k = new Date(r.created_at).toISOString().slice(0, 10);
      const i = dayIdx.get(k);
      if (i != null) days[i].count++;
    });

    // Sparkline últimos 7 días
    const last7 = days.slice(-7).map((d) => ({ v: d.count }));

    // Por categoría
    const byCategory = CATEGORIES.map((c) => ({
      name: c.name.split(" ")[0],
      slug: c.slug,
      count: reports.filter((r) => r.category === c.slug).length,
      color: c.color,
    }));

    // Por estado (donut)
    const byStatus = (["active", "attending", "resolved"] as const).map((s) => ({
      name: STATUS_LABELS[s],
      value: reports.filter((r) => r.status === s).length,
      color: s === "active" ? "#DC2626" : s === "attending" ? "#EAB308" : "#16A34A",
    }));

    // Top zonas (por último segmento de address)
    const zoneMap = new Map<string, number>();
    reports.forEach((r) => {
      if (!r.address) return;
      const parts = r.address.split(",").map((p) => p.trim()).filter(Boolean);
      const zone = parts[parts.length - 1] || "Sin ubicación";
      zoneMap.set(zone, (zoneMap.get(zone) ?? 0) + 1);
    });
    const topZones = Array.from(zoneMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Urgencia por categoría (stacked)
    const urgencyByCategory = CATEGORIES.slice(0, 6).map((c) => {
      const rs = reports.filter((r) => r.category === c.slug);
      return {
        name: c.name.split(" ")[0],
        critical: rs.filter((r) => r.urgency === "critical").length,
        high: rs.filter((r) => r.urgency === "high").length,
        medium: rs.filter((r) => r.urgency === "medium").length,
        low: rs.filter((r) => r.urgency === "low").length,
      };
    });

    const resolveRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return {
      total, active, attending, resolved, critical, help, rescue, missingActive,
      verified, last24h, delta24h, quakes24h, maxMag, days, last7, byCategory,
      byStatus, topZones, urgencyByCategory, resolveRate,
    };
  }, [reports, missing, quakes]);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: "linear-gradient(90deg, var(--sunrise), var(--gold), var(--sky))" }}
        />
        <div className="p-5 sm:p-6 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-green-600">En vivo</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl leading-tight">Dashboard de crisis</h1>
            <p className="text-sm text-muted-foreground">
              Indicadores en tiempo real — actualizado con cada reporte ciudadano.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <a href="/api/reports.geojson" target="_blank" rel="noopener noreferrer" download>
                <Download className="h-4 w-4" /> GeoJSON
              </a>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <a href="/api/reports.csv" target="_blank" rel="noopener noreferrer" download>
                <Download className="h-4 w-4" /> CSV · HXL
              </a>
            </Button>
          </div>
        </div>
        <div className="px-5 sm:px-6 pb-3 text-[11px] text-muted-foreground">
          {stats.total} reportes · {missing.length} fichas de desaparecidos · CC BY 4.0
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Activity} color="#1A8FE3" label="Total reportes" value={stats.total} sparkline={stats.last7} />
        <StatCard icon={AlertCircle} color="#DC2626" label="Activos" value={stats.active} accent />
        <StatCard icon={Flame} color="#EA580C" label="Críticos / altos" value={stats.critical} />
        <StatCard icon={Clock} color="#EAB308" label="En atención" value={stats.attending} />
        <StatCard
          icon={CheckCircle2}
          color="#16A34A"
          label="Resueltos"
          value={stats.resolved}
          hint={`${stats.resolveRate}% del total`}
        />
        <StatCard icon={Users} color="#9333EA" label="Desaparecidos" value={stats.missingActive} />
        <StatCard icon={ShieldCheck} color="#0D9488" label="Verificados" value={stats.verified} hint="≥ 3 confirmaciones" />
        <StatCard
          icon={Waves}
          color="#DC2626"
          label="Sismos 24h"
          value={stats.quakes24h}
          hint={stats.maxMag > 0 ? `Máx M${stats.maxMag.toFixed(1)}` : "Sin eventos"}
        />
      </div>

      {/* Delta + serie temporal */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-base">Reportes por día · últimos 14 días</h3>
            <div className="flex items-center gap-1 text-xs">
              <TrendingUp className="h-3.5 w-3.5" style={{ color: stats.delta24h >= 0 ? "#16A34A" : "#DC2626" }} />
              <span className="tabular-nums font-semibold" style={{ color: stats.delta24h >= 0 ? "#16A34A" : "#DC2626" }}>
                {stats.delta24h >= 0 ? "+" : ""}{stats.delta24h}
              </span>
              <span className="text-muted-foreground">vs. ayer</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats.days} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradSunrise" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#FF6B35" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<BrandTooltip />} />
              <Area type="monotone" dataKey="count" stroke="#FF6B35" strokeWidth={2} fill="url(#gradSunrise)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-display text-base mb-3">Estado</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stats.byStatus}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  stroke="none"
                >
                  {stats.byStatus.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip content={<BrandTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-2xl font-bold tabular-nums">{stats.total}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Reportes</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1 mt-2 text-[10px]">
            {stats.byStatus.map((s) => (
              <div key={s.name} className="flex items-center gap-1 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="truncate">{s.name}</span>
                <span className="ml-auto font-semibold tabular-nums">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Categoría + Top zonas */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-display text-base mb-3">Reportes por categoría</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.byCategory} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<BrandTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {stats.byCategory.map((d) => <Cell key={d.slug} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-display text-base mb-3">Top 5 zonas afectadas</h3>
          {stats.topZones.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center">Sin datos de ubicación aún.</div>
          ) : (
            <div className="space-y-2">
              {stats.topZones.map((z, i) => {
                const max = stats.topZones[0].count || 1;
                const pct = (z.count / max) * 100;
                return (
                  <div key={z.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="truncate flex items-center gap-1.5 min-w-0">
                        <span className="w-4 h-4 rounded-full bg-[var(--midnight)] text-[10px] text-[var(--cream)] grid place-items-center shrink-0">
                          {i + 1}
                        </span>
                        <span className="truncate">{z.name}</span>
                      </span>
                      <span className="font-semibold tabular-nums shrink-0">{z.count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: "linear-gradient(90deg, var(--sunrise), var(--gold))",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Urgencia × categoría + Sismos */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-display text-base mb-3">Urgencia por categoría</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.urgencyByCategory} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<BrandTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
              <Bar dataKey="critical" stackId="u" fill={URGENCY_COLOR.critical} name="Crítico" />
              <Bar dataKey="high" stackId="u" fill={URGENCY_COLOR.high} name="Alto" />
              <Bar dataKey="medium" stackId="u" fill={URGENCY_COLOR.medium} name="Medio" />
              <Bar dataKey="low" stackId="u" fill={URGENCY_COLOR.low} name="Bajo" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-display text-base mb-3 flex items-center gap-2">
            Sismos recientes <span className="text-[10px] font-normal text-muted-foreground">USGS</span>
          </h3>
          {quakes.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center">Cargando datos USGS…</div>
          ) : (
            <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
              {quakes.slice(0, 8).map((q) => (
                <a
                  key={q.id}
                  href={q.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <span
                    className="shrink-0 grid place-items-center rounded-full text-xs font-bold tabular-nums"
                    style={{
                      width: 36, height: 36,
                      background: quakeColor(q.mag),
                      color: q.mag >= 4 ? "white" : "#0D2B45",
                    }}
                  >
                    {q.mag.toFixed(1)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{q.place}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {timeAgo(q.time)} · {q.depth.toFixed(0)} km prof.
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Últimos reportes */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-display text-base mb-3">Últimos reportes</h3>
        <div className="divide-y divide-border">
          {reports.slice(0, 8).map((r) => {
            const cat = CATEGORY_MAP[r.category];
            const thumb = r.media_thumbs?.[0] ?? r.media_urls?.[0] ?? r.photo_url ?? null;
            return (
              <div key={r.id} className="flex items-center gap-3 py-2.5">
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border"
                  />
                ) : (
                  <span
                    className="w-10 h-10 rounded-lg grid place-items-center text-sm shrink-0"
                    style={{ background: cat?.color, color: "white" }}
                  >
                    {cat?.emoji}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1.5">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{r.address ?? "Sin ubicación"}</span>
                    <span>·</span>
                    <span className="shrink-0">{timeAgo(new Date(r.created_at).getTime())}</span>
                  </div>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full shrink-0 font-semibold"
                  style={{
                    background: URGENCY_COLOR[r.urgency] + "20",
                    color: URGENCY_COLOR[r.urgency],
                  }}
                >
                  {STATUS_LABELS[r.status]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, color, label, value, hint, sparkline, accent,
}: {
  icon: any; color: string; label: string; value: number;
  hint?: string; sparkline?: { v: number }[]; accent?: boolean;
}) {
  return (
    <div
      className="relative bg-card border border-border rounded-2xl p-4 overflow-hidden hover:shadow-md transition-shadow"
      style={accent ? { boxShadow: `inset 3px 0 0 ${color}` } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="w-8 h-8 rounded-lg grid place-items-center shrink-0"
          style={{ background: color + "18", color }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-2xl sm:text-3xl font-bold tabular-nums leading-none" style={{ color }}>
          {value}
        </span>
      </div>
      <div className="text-xs text-muted-foreground mt-2 truncate">{label}</div>
      {hint ? <div className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">{hint}</div> : null}
      {sparkline ? (
        <div className="h-8 -mx-1 -mb-1 mt-1 opacity-70">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline}>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}

function BrandTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[var(--midnight)] text-[var(--cream)] px-2.5 py-1.5 shadow-lg text-xs">
      {label != null ? <div className="font-semibold mb-0.5">{label}</div> : null}
      {payload.map((p: any) => (
        <div key={p.dataKey ?? p.name} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          <span className="opacity-80">{p.name}:</span>
          <span className="font-semibold tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}
