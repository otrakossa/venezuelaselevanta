import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useReports";
import { useAdminRole } from "@/hooks/useAdminRole";
import { AdminNav } from "@/components/admin/AdminNav";
import { getSystemHealth, type SystemHealth } from "@/lib/system-health.functions";
import {
  Activity, AlertTriangle, CheckCircle2, Cpu, HardDrive, Database,
  MemoryStick, RefreshCw, ShieldCheck, Clock, Copy,
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
  const fetchHealth = useServerFn(getSystemHealth);

  const [data, setData] = useState<SystemHealth | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autorefresh, setAutorefresh] = useState(true);
  const [history, setHistory] = useState<{ t: number; memPct: number | null; cpuPct: number | null; diskPct: number | null }[]>([]);
  const [showSql, setShowSql] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const h = await fetchHealth();
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
  };

  useEffect(() => {
    if (!isAdmin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autorefresh && isAdmin) {
      timerRef.current = setInterval(load, 15000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorefresh, isAdmin]);

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
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <ShieldCheck className="h-12 w-12 text-[color:var(--sunrise)] mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2">Sin permisos</h1>
      </div>
    );
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
            Memoria, CPU, disco y base de datos del servidor — útil para anticipar saturación.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={autorefresh}
              onChange={(e) => setAutorefresh(e.target.checked)}
            />
            Auto-refresh 15s
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <MetricCard
              icon={<MemoryStick className="h-4 w-4" />}
              title="Memoria del sistema"
              pct={data.memory.os?.usedPct ?? null}
              primary={data.memory.os ? `${data.memory.os.usedMB} / ${data.memory.os.totalMB} MB` : "No disponible"}
              secondary={data.memory.os ? `${data.memory.os.freeMB} MB libres` : undefined}
              tip="Si pasa de 90% sostenido, aumenta la RAM del VPS o reduce el footprint."
            />
            <MetricCard
              icon={<HardDrive className="h-4 w-4" />}
              title="Disco"
              pct={data.disk?.usedPct ?? null}
              warn={75}
              crit={90}
              primary={data.disk ? `${data.disk.usedGB} / ${data.disk.totalGB} GB` : "No disponible"}
              secondary={data.disk ? `${data.disk.freeGB} GB libres · ${data.disk.path}` : undefined}
              tip="Sobre 90% riesgo alto: amplía el disco o limpia logs/builds antiguos."
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
              tip="Load sostenido > nº de cores indica que necesitas más CPU."
            />
            <MetricCard
              icon={<Activity className="h-4 w-4" />}
              title="Proceso Node (RSS)"
              pct={data.memory.os ? +((data.memory.process.rssMB / data.memory.os.totalMB) * 100).toFixed(1) : null}
              primary={`${data.memory.process.rssMB} MB RSS`}
              secondary={`heap ${data.memory.process.heapUsedMB} / ${data.memory.process.heapTotalMB} MB`}
              tip="Crecimiento monotónico = posible fuga de memoria; revisa logs y reinicia con PM2."
            />
            <MetricCard
              icon={<Database className="h-4 w-4" />}
              title="Base de datos"
              pct={null}
              primary={data.database?.sizePretty ?? (data.database?.error ? "RPC no disponible" : "—")}
              secondary={
                data.database?.tables?.length
                  ? `${data.database.tables.length} tablas medidas`
                  : data.database?.error
              }
              tip={
                data.database?.error
                  ? "Crea la función admin_db_stats() (ver SQL abajo) para ver tamaño y top tablas."
                  : "Vigila el crecimiento mensual y crea índices/limpia tablas grandes."
              }
            />
          </div>

          {/* Top tables */}
          {data.database?.tables && data.database.tables.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden mb-4">
              <div className="bg-muted/40 px-3 py-2 text-xs font-bold flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" /> Top tablas por tamaño
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/20 text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-semibold">Tabla</th>
                      <th className="text-right px-3 py-1.5 font-semibold">Filas</th>
                      <th className="text-right px-3 py-1.5 font-semibold">Tamaño (MB)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.database.tables.slice(0, 12).map((t) => (
                      <tr key={t.name} className="border-t border-border">
                        <td className="px-3 py-1.5 font-mono">{t.name}</td>
                        <td className="px-3 py-1.5 text-right">{t.rows.toLocaleString("es-VE")}</td>
                        <td className="px-3 py-1.5 text-right">{t.sizeMB.toLocaleString("es-VE")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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

          {/* SQL helper */}
          <div className="border border-dashed border-border rounded-lg p-3 mb-4">
            <button
              onClick={() => setShowSql((v) => !v)}
              className="text-xs font-bold text-[color:var(--sunrise)] hover:underline"
            >
              {showSql ? "Ocultar" : "Mostrar"} SQL para habilitar métricas de la base de datos
            </button>
            {showSql && (
              <div className="mt-3">
                <p className="text-[11px] text-muted-foreground mb-2">
                  Ejecuta este SQL <b>una sola vez</b> en la base de datos de producción (psql) para que esta página pueda leer el tamaño de la BD y top tablas.
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
