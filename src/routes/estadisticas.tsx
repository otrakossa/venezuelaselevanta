import { createFileRoute } from "@tanstack/react-router";
import { useReports, useMissing } from "@/hooks/useReports";
import { useUSGSQuakes, quakeColor } from "@/hooks/useUSGSQuakes";
import { CATEGORIES, CATEGORY_MAP, STATUS_LABELS } from "@/lib/categories";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  PieChart, Pie, AreaChart, Area, Legend,
} from "recharts";
import {
  AlertCircle, Users, MapPin, Download, Activity,
  ShieldCheck, CheckCircle2, Clock, Flame, Waves, TrendingUp,
  HeartPulse, ChevronDown, ChevronUp, Search, Handshake, Package,
  MessageSquare, ThumbsUp, Building2, UserCheck, Skull,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardExtras } from "@/components/dashboard/DashboardExtras";
import { SolidarityCounter } from "@/components/SolidarityCounter";

import { SUPA_URL, SUPA_ANON } from "@/lib/supabase-rest";

type PatientZone = { state: string | null; sector: string | null };
type ExtraCounts = {
  patients: number;
  needs: number;
  needsOpen: number;
  needsUrgent: number;
  offers: number;
  offersMatched: number;
  healthCenters: number;
  comments: number;
  votes: number;
};



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
  const { missing, counts: missingCounts } = useMissing();
  const { data: quakes = [] } = useUSGSQuakes(true);
  const [patientZones, setPatientZones] = useState<PatientZone[]>([]);
  const [extras, setExtras] = useState<ExtraCounts>({
    patients: 0, needs: 0, needsOpen: 0, needsUrgent: 0,
    offers: 0, offersMatched: 0, healthCenters: 0, comments: 0, votes: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const h = { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` };
    const headCount = async (path: string): Promise<number> => {
      try {
        const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
          headers: { ...h, Prefer: "count=exact", Range: "0-0" },
        });
        const cr = res.headers.get("content-range");
        if (!cr) return 0;
        const total = cr.split("/")[1];
        return total && total !== "*" ? Number(total) : 0;
      } catch { return 0; }
    };
    (async () => {
      try {
        const res = await fetch(
          `${SUPA_URL}/rest/v1/patients?select=state,sector&limit=10000`,
          { headers: h },
        );
        if (res.ok) {
          const data = (await res.json()) as PatientZone[];
          if (!cancelled) setPatientZones(data);
        }
      } catch { /* ignore */ }
      const [patients, needs, needsOpen, needsUrgent, offers, offersMatched, healthCenters, comments, votes] = await Promise.all([
        headCount("patients?select=id"),
        headCount("needs?select=id"),
        headCount("needs?select=id&status=neq.fulfilled"),
        headCount("needs?select=id&urgency=in.(critical,high)"),
        headCount("offers?select=id"),
        headCount("offers?select=id&need_id=not.is.null"),
        headCount("health_centers?select=id"),
        headCount("report_comments?select=id"),
        headCount("report_votes?select=id"),
      ]);
      if (!cancelled) setExtras({ patients, needs, needsOpen, needsUrgent, offers, offersMatched, healthCenters, comments, votes });
    })();
    return () => { cancelled = true; };
  }, []);


  const stats = useMemo(() => {
    const total = reports.length;
    const active = reports.filter((r) => r.status === "active").length;
    const attending = reports.filter((r) => r.status === "attending").length;
    const resolved = reports.filter((r) => r.status === "resolved").length;
    const critical = reports.filter((r) => r.urgency === "critical" || r.urgency === "high").length;
    const help = reports.filter((r) => r.category === "shelter" || r.category === "hospital").length;
    const rescue = reports.filter((r) => r.category === "rescue").length;
    const missingActive = missingCounts.missing;
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

    // Top estados y municipios usando campos DIVIPOL
    const stateMap = new Map<string, number>();
    const muniMap = new Map<string, number>();
    reports.forEach((r) => {
      if (r.state) stateMap.set(r.state, (stateMap.get(r.state) ?? 0) + 1);
      if (r.state && r.municipality) {
        const k = `${r.municipality} — ${r.state}`;
        muniMap.set(k, (muniMap.get(k) ?? 0) + 1);
      }
    });
    const topStates = Array.from(stateMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    const topMunicipalities = Array.from(muniMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

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
      byStatus, topZones, topStates, topMunicipalities, urgencyByCategory, resolveRate,
    };
  }, [reports, missingCounts, quakes]);

  const patientStats = useMemo(() => {
    const total = patientZones.length;
    const sectorMap = new Map<string, { count: number; state: string | null }>();
    const stateMap = new Map<string, number>();
    let withSector = 0;
    let withState = 0;
    for (const p of patientZones) {
      if (p.state) {
        stateMap.set(p.state, (stateMap.get(p.state) ?? 0) + 1);
        withState++;
      }
      if (p.sector) {
        const key = `${p.sector}|||${p.state ?? ""}`;
        const prev = sectorMap.get(key);
        sectorMap.set(key, { count: (prev?.count ?? 0) + 1, state: p.state });
        withSector++;
      }
    }
    const topSectors = Array.from(sectorMap.entries())
      .map(([k, v]) => ({ name: k.split("|||")[0], state: v.state, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
    const byState = Array.from(stateMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    // grouped: state -> sectors
    const grouped = new Map<string, { sector: string; count: number }[]>();
    for (const [k, v] of sectorMap.entries()) {
      const sector = k.split("|||")[0];
      const stateKey = v.state ?? "Sin estado";
      const arr = grouped.get(stateKey) ?? [];
      arr.push({ sector, count: v.count });
      grouped.set(stateKey, arr);
    }
    const groupedSorted = Array.from(grouped.entries())
      .map(([state, sectors]) => ({
        state,
        total: sectors.reduce((a, b) => a + b.count, 0),
        sectors: sectors.sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.total - a.total);
    return { total, topSectors, byState, grouped: groupedSorted, withSector, withState };
  }, [patientZones]);


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
            <h1 className="font-display text-2xl sm:text-3xl leading-tight">Centro de Control</h1>
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
          {stats.total} reportes · {missingCounts.all.toLocaleString("es-VE")} fichas de desaparecidos · {extras.patients.toLocaleString("es-VE")} atendidos · CC BY 4.0
        </div>
      </div>

      {/* Contador de solidaridad — motivacional */}
      <SolidarityCounter variant="kpi" />

      {/* KPI grid — Reportes */}
      <SectionHeader icon={Activity} title="Reportes ciudadanos" subtitle="Situación operativa en tiempo real" />
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
        <StatCard icon={ShieldCheck} color="#0D9488" label="Verificados" value={stats.verified} hint="≥ 3 confirmaciones" />
        <StatCard
          icon={Waves}
          color="#DC2626"
          label="Sismos 24h"
          value={stats.quakes24h}
          hint={stats.maxMag > 0 ? `Máx M${stats.maxMag.toFixed(1)}` : "Sin eventos"}
        />
        <StatCard
          icon={TrendingUp}
          color={stats.delta24h >= 0 ? "#16A34A" : "#DC2626"}
          label="Nuevos 24h"
          value={stats.last24h}
          hint={`${stats.delta24h >= 0 ? "+" : ""}${stats.delta24h} vs. ayer`}
        />
      </div>

      {/* KPI grid — Personas */}
      <SectionHeader icon={Users} title="Personas" subtitle="Desaparecidos y atendidos en centros de salud" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Search} color="#9333EA" label="Desaparecidos activos" value={missingCounts.missing} accent />
        <StatCard icon={UserCheck} color="#16A34A" label="Localizados" value={missingCounts.found} hint={missingCounts.all > 0 ? `${Math.round((missingCounts.found / missingCounts.all) * 100)}% del total` : undefined} />
        <StatCard icon={Skull} color="#6B7280" label="Fallecidos confirmados" value={missingCounts.deceased} />
        <StatCard icon={Users} color="#1A8FE3" label="Total fichas" value={missingCounts.all} />
        <StatCard icon={HeartPulse} color="#DC2626" label="Atendidos" value={extras.patients} hint="Centros de salud" />
        <StatCard icon={Building2} color="#0D9488" label="Centros de salud" value={extras.healthCenters} />
        <StatCard icon={MessageSquare} color="#7C3AED" label="Comentarios" value={extras.comments} hint="En fichas y reportes" />
        <StatCard icon={ThumbsUp} color="#EA580C" label="Validaciones" value={extras.votes} hint="Votos ciudadanos" />
      </div>

      {/* KPI grid — Ayuda mutua */}
      <SectionHeader icon={Handshake} title="Ayuda mutua" subtitle="Necesidades publicadas y ofrecimientos recibidos" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Package} color="#DC2626" label="Necesidades" value={extras.needs} hint={`${extras.needsOpen} abiertas`} />
        <StatCard icon={Flame} color="#EA580C" label="Urgentes / críticas" value={extras.needsUrgent} accent />
        <StatCard icon={Handshake} color="#16A34A" label="Ofrecimientos" value={extras.offers} />
        <StatCard
          icon={CheckCircle2}
          color="#1A8FE3"
          label="Con match"
          value={extras.offersMatched}
          hint={extras.offers > 0 ? `${Math.round((extras.offersMatched / extras.offers) * 100)}% conectados` : undefined}
        />
      </div>


      {/* Tendencias y distribución */}
      <SectionHeader icon={TrendingUp} title="Tendencias y distribución" subtitle="Evolución temporal, estado y categorías de reporte" />

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

      {/* DIVIPOL: estados y municipios */}
      <SectionHeader icon={MapPin} title="Distribución geográfica (DIVIPOL)" subtitle="Estados y municipios con más reportes" />
      <div className="grid lg:grid-cols-2 gap-4">

        {([
          { title: "Top estados (DIVIPOL)", data: stats.topStates, gradient: "linear-gradient(90deg, var(--sky), var(--sunrise))" },
          { title: "Top municipios (DIVIPOL)", data: stats.topMunicipalities, gradient: "linear-gradient(90deg, var(--gold), var(--sunrise))" },
        ] as const).map((panel) => (
          <div key={panel.title} className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-display text-base mb-3">{panel.title}</h3>
            {panel.data.length === 0 ? (
              <div className="text-xs text-muted-foreground py-8 text-center">
                Aún no hay reportes con estado/municipio. Aparecerán cuando los nuevos reportes seleccionen su DIVIPOL.
              </div>
            ) : (
              <div className="space-y-2">
                {panel.data.map((z, i) => {
                  const max = panel.data[0].count || 1;
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
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: panel.gradient }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Operación, heatmap y balance ayuda */}
      <SectionHeader icon={Clock} title="Operación y respuesta" subtitle="Embudo, estancados, patrones horarios y balance de ayuda" />
      <DashboardExtras reports={reports} />

      {/* Atendidos por zona */}
      <SectionHeader icon={HeartPulse} title="Atendidos por zona" subtitle="Distribución geográfica de pacientes en centros de salud" />
      <PatientZonesSection stats={patientStats} />

      {/* Urgencia × categoría + Sismos */}
      <SectionHeader icon={Waves} title="Urgencia y sismicidad" subtitle="Composición de urgencia y actividad sísmica USGS" />
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

function PatientZonesSection({ stats }: {
  stats: {
    total: number;
    topSectors: { name: string; state: string | null; count: number }[];
    byState: { name: string; count: number }[];
    grouped: { state: string; total: number; sectors: { sector: string; count: number }[] }[];
    withSector: number;
    withState: number;
  };
}) {
  const [open, setOpen] = useState(false);
  if (stats.total === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-display text-base mb-2 flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-primary" /> Atendidos por zona
        </h3>
        <p className="text-xs text-muted-foreground py-6 text-center">
          Aún no hay atendidos registrados con datos de zona.
        </p>
      </div>
    );
  }
  const max = stats.topSectors[0]?.count || 1;
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display text-base flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-primary" /> Atendidos por zona
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {stats.total.toLocaleString("es-VE")} atendidos · {stats.grouped.length} estado{stats.grouped.length === 1 ? "" : "s"} · {stats.topSectors.length} sector{stats.topSectors.length === 1 ? "" : "es"} con presencia
          </p>
        </div>
        <div className="flex gap-2">
          <Kpi value={stats.byState.length} label="Estados" />
          <Kpi value={stats.topSectors.length} label="Sectores" />
        </div>
      </div>

      {stats.topSectors.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Top 15 sectores
          </div>
          <div className="space-y-1.5">
            {stats.topSectors.map((z, i) => {
              const pct = (z.count / max) * 100;
              return (
                <div key={`${z.name}-${z.state ?? ""}-${i}`}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="truncate flex items-center gap-1.5 min-w-0">
                      <span className="w-4 h-4 rounded-full bg-[var(--midnight)] text-[10px] text-[var(--cream)] grid place-items-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium">{z.name}</span>
                      {z.state && <span className="text-muted-foreground text-[10px] truncate">· {z.state}</span>}
                    </span>
                    <span className="font-semibold tabular-nums shrink-0">{z.count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: "linear-gradient(90deg, var(--sky), var(--sunrise))",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-xs font-semibold text-primary flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-border hover:bg-muted/50 transition"
      >
        {open ? <>Ocultar desglose <ChevronUp className="h-3.5 w-3.5" /></> : <>Ver desglose por Estado → Sector <ChevronDown className="h-3.5 w-3.5" /></>}
      </button>

      {open && (
        <div className="grid sm:grid-cols-2 gap-3">
          {stats.grouped.map((g) => (
            <div key={g.state} className="border border-border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm truncate">{g.state}</span>
                <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{g.total}</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {g.sectors.map((s) => (
                  <div key={s.sector} className="flex items-center justify-between text-[11px]">
                    <span className="truncate">{s.sector}</span>
                    <span className="font-semibold tabular-nums shrink-0 text-muted-foreground">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-muted/40 border border-border/60 rounded-lg px-2.5 py-1.5 text-center min-w-[60px]">
      <div className="text-base font-bold tabular-nums leading-none">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
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
