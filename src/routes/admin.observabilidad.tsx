import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useReports";
import { useAdminRole } from "@/hooks/useAdminRole";
import { supabase } from "@/integrations/supabase/client";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminOnlyNotice } from "@/components/admin/AdminOnlyNotice";
import type { SystemHealth, ScraperRun, TableStat } from "@/lib/system-health.types";
import {
  Activity, AlertTriangle, CheckCircle2, Cpu, HardDrive, Database,
  MemoryStick, RefreshCw, ShieldCheck, Clock, Copy, Network, Users,
  Archive, Globe, ChevronDown, ChevronRight, Server, XCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/observabilidad")({
  ssr: false,
  head: () => ({ meta: [{ title: "Observabilidad — Admin" }] }),
  component: ObservabilityPage,
});

type Level = "ok" | "warn" | "crit";

function level(pct: number | null | undefined, warn = 70, crit = 90): Level {
  if (pct == null) return "ok";
  if (pct >= crit) return "crit";
  if (pct >= warn) return "warn";
  return "ok";
}

const LEVEL_STYLES: Record<Level, { bar: string; text: string; bg: string; label: string }> = {
  ok:   { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", label: "Saludable" },
  warn: { bar: "bg-amber-500",   text: "text-amber-700",   bg: "bg-amber-50 border-amber-200",     label: "Atención" },
  crit: { bar: "bg-red-600",     text: "text-red-700",     bg: "bg-red-50 border-red-200",         label: "Crítico" },
};

function fmtUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtDuration(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s % 60);
  return `${m}m ${rs}s`;
}

function fmtRelative(iso: string | null) {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

const SQL_SETUP = `-- Crear función helper para métricas de la BD (ejecutar 1 sola vez en la BD de producción)
create or replace function public.admin_db_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'forbidden';
  end if;

  select jsonb_build_object(
    'size_bytes', pg_database_size(current_database()),
    'size_pretty', pg_size_pretty(pg_database_size(current_database())),
    'tables', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'name', relname,
          'rows', n_live_tup,
          'size_bytes', pg_total_relation_size(format('public.%I', relname))
        ) order by pg_total_relation_size(format('public.%I', relname)) desc)
        from pg_stat_user_tables
        where schemaname = 'public'
      ),
      '[]'::jsonb
    )
  ) into result;
  return result;
end;
$$;

grant execute on function public.admin_db_stats() to authenticated;`;

function ObservabilityPage() {
  const { isAuthenticated, userId } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole(userId);

  const [data, setData] = useState<SystemHealth | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autorefresh, setAutorefresh] = useState(true);
  const [history, setHistory] = useState<{ t: number; memPct: number | null; cpuPct: number | null; diskPct: number | null }[]>([]);
  const [showSql, setShowSql] = useState(false);
  const [showAllTables, setShowAllTables] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated || roleLoading || !isAdmin) return;
    setLoading(true);
    setErr(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error("Sesión no disponible. Vuelve a iniciar sesión.");

      const response = await fetch("/api/public/admin/health", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : `HTTP ${response.status}`,
        );
      }

      const h = payload as SystemHealth;
      setData(h);
      setHistory((prev) => {
        const next = [
          ...prev,
          {
            t: Date.now(),
            memPct: h.memory.os?.usedPct ?? null,
            cpuPct: h.cpu.loadPctPerCore,
            diskPct: h.disk?.usedPct ?? null,
          },
        ];
        return next.slice(-30);
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isAdmin, roleLoading]);

  useEffect(() => {
    if (!isAuthenticated || roleLoading || !isAdmin) return;
    load();
  }, [isAuthenticated, roleLoading, isAdmin, load]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autorefresh && isAuthenticated && !roleLoading && isAdmin) {
      timerRef.current = setInterval(load, 30000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autorefresh, isAuthenticated, roleLoading, isAdmin, load]);

  const overall = useMemo<Level>(() => {
    if (!data) return "ok";
    const levels: Level[] = [
      level(data.memory.os?.usedPct),
      level(data.disk?.usedPct, 75, 90),
      level(data.cpu.loadPctPerCore, 75, 100),
    ];
    if (levels.includes("crit")) return "crit";
    if (levels.includes("warn")) return "warn";
    return "ok";
  }, [data]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <ShieldCheck className="h-12 w-12 text-vzla-blue mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2">Acceso restringido</h1>
        <Link to="/auth" className="inline-block bg-primary text-primary-foreground px-5 py-2.5 rounded-md font-semibold text-sm">
          Iniciar sesión
        </Link>
      </div>
    );
  }
  if (roleLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Verificando permisos...</div>;
  }
  if (!isAdmin) {
    return <AdminOnlyNotice section="Observabilidad" />;
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
      <AdminNav />

      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-[color:var(--sunrise)]" />
            Observabilidad
          </h1>
          <p className="text-[11px] text-muted-foreground">
            Estado del VPS, base de datos, scrapers y servicios externos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={autorefresh}
              onChange={(e) => setAutorefresh(e.target.checked)}
            />
            Auto-refresh 30s
          </label>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-foreground text-background text-xs font-bold disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Overall banner */}
      {data && (
        <div className={`mb-4 rounded-lg border px-4 py-3 flex items-center gap-3 ${LEVEL_STYLES[overall].bg}`}>
          {overall === "ok" ? (
            <CheckCircle2 className={`h-5 w-5 ${LEVEL_STYLES[overall].text}`} />
          ) : (
            <AlertTriangle className={`h-5 w-5 ${LEVEL_STYLES[overall].text}`} />
          )}
          <div className="flex-1">
            <div className={`font-bold text-sm ${LEVEL_STYLES[overall].text}`}>
              Estado general: {LEVEL_STYLES[overall].label}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Última lectura: {new Date(data.timestamp).toLocaleTimeString()} · Uptime proceso: {fmtUptime(data.node.uptimeSec)} · Node {data.node.version}
            </div>
          </div>
        </div>
      )}

      {err && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Error al leer métricas: {err}
        </div>
      )}

      {data && (
        <>
          {/* ═══════════════════ VPS ═══════════════════ */}
          <SectionHeader icon={<Server className="h-4 w-4" />} title="VPS" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <MetricCard
              icon={<MemoryStick className="h-4 w-4" />}
              title="Memoria del sistema"
              pct={data.memory.os?.usedPct ?? null}
              primary={data.memory.os ? `${data.memory.os.usedMB} / ${data.memory.os.totalMB} MB` : "No disponible"}
              secondary={data.memory.os ? `${data.memory.os.freeMB} MB libres` : undefined}
              tip="Si pasa de 90% sostenido, aumenta la RAM del VPS."
            />
            <MetricCard
              icon={<HardDrive className="h-4 w-4" />}
              title="Disco"
              pct={data.disk?.usedPct ?? null}
              warn={75}
              crit={90}
              primary={data.disk ? `${data.disk.usedGB} / ${data.disk.totalGB} GB` : "No disponible"}
              secondary={data.disk ? `${data.disk.freeGB} GB libres · ${data.disk.path}` : undefined}
              tip="Sobre 90%: amplía disco o limpia logs/builds."
            />
            <MetricCard
              icon={<Cpu className="h-4 w-4" />}
              title="CPU (load 1 min / core)"
              pct={data.cpu.loadPctPerCore}
              warn={75}
              crit={100}
              primary={
                data.cpu.loadavg
                  ? `${data.cpu.loadavg[0].toFixed(2)} / ${data.cpu.loadavg[1].toFixed(2)} / ${data.cpu.loadavg[2].toFixed(2)}`
                  : "No disponible"
              }
              secondary={data.cpu.cores ? `${data.cpu.cores} cores` : undefined}
              tip="Load > nº de cores = necesitas más CPU."
            />
            <MetricCard
              icon={<Activity className="h-4 w-4" />}
              title="Proceso Node (RSS)"
              pct={data.memory.os ? +((data.memory.process.rssMB / data.memory.os.totalMB) * 100).toFixed(1) : null}
              primary={`${data.memory.process.rssMB} MB RSS`}
              secondary={`heap ${data.memory.process.heapUsedMB} / ${data.memory.process.heapTotalMB} MB`}
              tip="Crecimiento sostenido = posible fuga de memoria."
            />
            <MetricCard
              icon={<Clock className="h-4 w-4" />}
              title="Uptime del proceso"
              pct={null}
              primary={fmtUptime(data.node.uptimeSec)}
              secondary={`PID ${data.node.pid} · Node ${data.node.version}`}
              tip="Reinicios frecuentes = revisar logs de PM2."
            />
            {data.network && data.network.interfaces.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold mb-1.5">
                  <Network className="h-4 w-4" /> Red I/O (acumulado)
                </div>
                <div className="space-y-1.5">
                  {data.network.interfaces.slice(0, 4).map((iface) => (
                    <div key={iface.name} className="text-[11px] flex items-center justify-between">
                      <span className="font-mono text-muted-foreground">{iface.name}</span>
                      <span className="tabular-nums">
                        ↓ {iface.rxMB.toLocaleString("es-VE")} MB · ↑ {iface.txMB.toLocaleString("es-VE")} MB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* History sparkline */}
          {history.length > 1 && (
            <div className="border border-border rounded-lg p-3 mb-4">
              <div className="text-xs font-bold mb-2">Tendencia (últimas {history.length} lecturas)</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Spark title="Memoria %" color="#1A8FE3" series={history.map((h) => h.memPct ?? 0)} />
                <Spark title="CPU %/core" color="#FF6B35" series={history.map((h) => h.cpuPct ?? 0)} />
                <Spark title="Disco %" color="#CA8A04" series={history.map((h) => h.diskPct ?? 0)} />
              </div>
            </div>
          )}

          {/* ═══════════════════ Base de datos ═══════════════════ */}
          <SectionHeader icon={<Database className="h-4 w-4" />} title="Base de datos" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard
              label="Tamaño total"
              value={data.database?.sizePretty ?? (data.database?.error ? "N/A" : "—")}
              hint={data.database?.error}
            />
            <StatCard
              label="Conexiones totales"
              value={data.database?.connections?.total ?? "—"}
              hint={
                data.database?.connections
                  ? `${data.database.connections.active} activas · ${data.database.connections.idle} idle`
                  : undefined
              }
            />
            <StatCard
              label="Esperando"
              value={data.database?.connections?.waiting ?? "—"}
              hint="Bloqueos si crece"
              alarm={(data.database?.connections?.waiting ?? 0) > 5}
            />
            <StatCard
              label="Índices sin usar"
              value={data.database?.unusedIndexes?.length ?? "—"}
              hint="Candidatos a eliminar"
            />
          </div>

          {/* Unused indexes */}
          {data.database?.unusedIndexes && data.database.unusedIndexes.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden mb-4">
              <div className="bg-muted/40 px-3 py-2 text-xs font-bold">Índices sin usar (top por tamaño)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/20 text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-semibold">Tabla</th>
                      <th className="text-left px-3 py-1.5 font-semibold">Índice</th>
                      <th className="text-right px-3 py-1.5 font-semibold">MB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.database.unusedIndexes.slice(0, 10).map((i) => (
                      <tr key={`${i.table}.${i.index}`} className="border-t border-border">
                        <td className="px-3 py-1.5 font-mono">{i.table}</td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">{i.index}</td>
                        <td className="px-3 py-1.5 text-right">{i.sizeMB.toLocaleString("es-VE")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top tables + expandable full stats */}
          {data.database?.tables && data.database.tables.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden mb-4">
              <div className="bg-muted/40 px-3 py-2 text-xs font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5" /> Tablas ({data.database.tables.length})
                </span>
                <button
                  onClick={() => setShowAllTables((v) => !v)}
                  className="inline-flex items-center gap-1 text-[10px] hover:underline"
                >
                  {showAllTables ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {showAllTables ? "Ver menos" : "Ver todas + I/O"}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/20 text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-semibold">Tabla</th>
                      <th className="text-right px-3 py-1.5 font-semibold">Filas</th>
                      <th className="text-right px-3 py-1.5 font-semibold">MB</th>
                      {showAllTables && (
                        <>
                          <th className="text-right px-3 py-1.5 font-semibold">Dead</th>
                          <th className="text-right px-3 py-1.5 font-semibold">Ins</th>
                          <th className="text-right px-3 py-1.5 font-semibold">Upd</th>
                          <th className="text-right px-3 py-1.5 font-semibold">Del</th>
                          <th className="text-right px-3 py-1.5 font-semibold">Seq</th>
                          <th className="text-right px-3 py-1.5 font-semibold">Idx</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(showAllTables ? data.database.tables : data.database.tables.slice(0, 12)).map((t: TableStat) => (
                      <tr key={t.name} className="border-t border-border">
                        <td className="px-3 py-1.5 font-mono">{t.name}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{t.rows.toLocaleString("es-VE")}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{t.sizeMB.toLocaleString("es-VE")}</td>
                        {showAllTables && (
                          <>
                            <td className={`px-3 py-1.5 text-right tabular-nums ${t.deadRows > t.rows * 0.2 ? "text-amber-700 font-bold" : ""}`}>
                              {t.deadRows.toLocaleString("es-VE")}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{t.inserts.toLocaleString("es-VE")}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{t.updates.toLocaleString("es-VE")}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{t.deletes.toLocaleString("es-VE")}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{t.seqScans.toLocaleString("es-VE")}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{t.idxScans.toLocaleString("es-VE")}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══════════════════ App / Usuarios ═══════════════════ */}
          <SectionHeader icon={<Users className="h-4 w-4" />} title="App y usuarios" />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
            <StatCard label="Usuarios auth" value={data.appStats?.authUsers ?? "—"} />
            <StatCard label="Nuevos (24h)" value={data.appStats?.authUsers24h ?? "—"} accent="text-emerald-700" />
            <StatCard label="Visitas hoy" value={data.appStats?.visitors?.today ?? "—"} />
            <StatCard label="Ayer" value={data.appStats?.visitors?.yesterday ?? "—"} />
            <StatCard label="Últ. 7 días" value={data.appStats?.visitors?.week ?? "—"} />
            <StatCard
              label="Total histórico"
              value={data.appStats?.visitors?.total ?? "—"}
              hint={data.appStats?.visitors ? `${data.appStats.visitors.uniqueTotal.toLocaleString("es-VE")} únicos` : undefined}
            />
          </div>

          {/* ═══════════════════ Scrapers ═══════════════════ */}
          <SectionHeader icon={<RefreshCw className="h-4 w-4" />} title="Scrapers" />
          <div className="border border-border rounded-lg overflow-hidden mb-4">
            {data.appStats?.scraperRuns && data.appStats.scraperRuns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Fuente</th>
                      <th className="text-left px-3 py-2 font-semibold">Estado</th>
                      <th className="text-left px-3 py-2 font-semibold">Última corrida</th>
                      <th className="text-right px-3 py-2 font-semibold">Duración</th>
                      <th className="text-right px-3 py-2 font-semibold">Vistos</th>
                      <th className="text-right px-3 py-2 font-semibold">Insertados</th>
                      <th className="text-right px-3 py-2 font-semibold">Matches</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.appStats.scraperRuns.map((r: ScraperRun) => (
                      <tr key={r.source} className="border-t border-border">
                        <td className="px-3 py-2 font-mono">{r.source}</td>
                        <td className="px-3 py-2"><ScraperBadge status={r.status} /></td>
                        <td className="px-3 py-2 text-muted-foreground">{fmtRelative(r.finishedAt ?? r.startedAt)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtDuration(r.durationMs)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.seen ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold">{r.inserted ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.matches ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.appStats.scraperRuns.some((r) => r.error) && (
                  <div className="border-t border-border bg-red-50 px-3 py-2 text-[11px] text-red-800 space-y-0.5">
                    {data.appStats.scraperRuns.filter((r) => r.error).map((r) => (
                      <div key={r.source}><b>{r.source}:</b> {r.error}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-muted-foreground">Sin corridas registradas.</div>
            )}
          </div>

          {/* ═══════════════════ Servicios externos ═══════════════════ */}
          <SectionHeader icon={<Globe className="h-4 w-4" />} title="Servicios externos" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {data.externalServices.map((svc) => (
              <div
                key={svc.name}
                className={`rounded-lg border p-3 flex items-center gap-3 ${
                  svc.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
                }`}
              >
                {svc.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{svc.name}</div>
                  <div className="text-[10.5px] text-muted-foreground truncate">{svc.url}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xs font-bold ${svc.ok ? "text-emerald-700" : "text-red-700"}`}>
                    {svc.statusCode ?? "ERR"}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground tabular-nums">
                    {svc.latencyMs != null ? `${svc.latencyMs} ms` : "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ═══════════════════ Backup ═══════════════════ */}
          <SectionHeader icon={<Archive className="h-4 w-4" />} title="Backup de la base de datos" />
          <BackupCard backup={data.backup} />

          {/* SQL helper */}
          <div className="border border-dashed border-border rounded-lg p-3 mt-6 mb-4">
            <button
              onClick={() => setShowSql((v) => !v)}
              className="text-xs font-bold text-[color:var(--sunrise)] hover:underline"
            >
              {showSql ? "Ocultar" : "Mostrar"} SQL para habilitar métricas de la base de datos
            </button>
            {showSql && (
              <div className="mt-3">
                <p className="text-[11px] text-muted-foreground mb-2">
                  Ejecuta este SQL <b>una sola vez</b> en la base de datos de producción (psql).
                </p>
                <div className="relative">
                  <pre className="text-[10.5px] bg-muted p-3 rounded overflow-auto max-h-80">
                    <code>{SQL_SETUP}</code>
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(SQL_SETUP);
                      toast.success("SQL copiado");
                    }}
                    className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded bg-background border border-border text-[10px]"
                  >
                    <Copy className="h-3 w-3" /> Copiar
                  </button>
                </div>
              </div>
            )}
          </div>

          {data.errors.length > 0 && (
            <div className="text-[11px] text-muted-foreground">
              <b>Notas del runtime:</b>
              <ul className="list-disc pl-5">
                {data.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────── helpers UI ───────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-2">
      <div className="flex items-center gap-1.5 text-sm font-bold text-foreground/80">
        {icon} {title}
      </div>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function StatCard({
  label, value, hint, accent, alarm,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
  alarm?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${alarm ? "border-red-200 bg-red-50" : "border-border bg-card"}`}>
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold leading-tight mt-0.5 ${accent ?? (alarm ? "text-red-700" : "")}`}>
        {typeof value === "number" ? value.toLocaleString("es-VE") : value}
      </div>
      {hint && <div className="text-[10.5px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function ScraperBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const style =
    s === "ok" || s === "success" || s === "completed"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : s === "running" || s === "started"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-red-100 text-red-800 border-red-200";
  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${style}`}>
      {status}
    </span>
  );
}

function BackupCard({ backup }: { backup: SystemHealth["backup"] }) {
  if (!backup || !backup.lastFile) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-3 mb-4">
        <XCircle className="h-5 w-5 text-red-600" />
        <div>
          <div className="text-sm font-bold text-red-800">No hay backups registrados</div>
          <div className="text-[11px] text-red-700">Configura el cron de <code>scripts/backup-supabase.sh</code>.</div>
        </div>
      </div>
    );
  }
  const ageHours = backup.lastModified
    ? (Date.now() - new Date(backup.lastModified).getTime()) / 3_600_000
    : Infinity;
  const stale = ageHours > 25;
  return (
    <div className={`rounded-lg border p-3 flex items-center gap-3 mb-4 ${
      stale ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"
    }`}>
      {stale ? (
        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
      ) : (
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-bold ${stale ? "text-red-800" : "text-emerald-800"}`}>
          {backup.lastFile}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {backup.lastSizeMB != null && <>{backup.lastSizeMB.toLocaleString("es-VE")} MB · </>}
          {fmtRelative(backup.lastModified)}
          {backup.lastModified && <> · {new Date(backup.lastModified).toLocaleString()}</>}
        </div>
      </div>
      {stale && (
        <span className="text-[10px] font-bold text-red-700 uppercase shrink-0">Obsoleto (&gt;25h)</span>
      )}
    </div>
  );
}

function MetricCard({
  icon, title, pct, primary, secondary, tip, warn = 70, crit = 90,
}: {
  icon: React.ReactNode;
  title: string;
  pct: number | null;
  primary: string;
  secondary?: string;
  tip?: string;
  warn?: number;
  crit?: number;
}) {
  const lv = level(pct, warn, crit);
  const st = LEVEL_STYLES[lv];
  return (
    <div className={`rounded-lg border p-3 ${pct == null ? "border-border bg-card" : st.bg}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          {icon} {title}
        </div>
        {pct != null && (
          <span className={`text-[10px] font-bold ${st.text}`}>{pct}%</span>
        )}
      </div>
      <div className="text-lg font-bold leading-tight">{primary}</div>
      {secondary && <div className="text-[11px] text-muted-foreground">{secondary}</div>}
      {pct != null && (
        <div className="h-1.5 mt-2 rounded-full bg-black/10 overflow-hidden">
          <div
            className={`h-full ${st.bar} transition-all`}
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>
      )}
      {tip && <div className="text-[10.5px] text-muted-foreground mt-2 italic">{tip}</div>}
    </div>
  );
}

function Spark({ title, color, series }: { title: string; color: string; series: number[] }) {
  const w = 200, h = 40;
  const max = Math.max(100, ...series);
  const pts = series
    .map((v, i) => `${(i / Math.max(1, series.length - 1)) * w},${h - (v / max) * h}`)
    .join(" ");
  const last = series[series.length - 1] ?? 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-muted-foreground">{title}</span>
        <span className="font-bold" style={{ color }}>{last.toFixed(1)}%</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-10">
        <polyline fill="none" stroke={color} strokeWidth="2" points={pts} />
      </svg>
    </div>
  );
}
