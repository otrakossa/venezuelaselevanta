import { createFileRoute } from "@tanstack/react-router";
import { useReports, useMissing } from "@/hooks/useReports";
import { CATEGORIES, CATEGORY_MAP, STATUS_LABELS } from "@/lib/categories";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, PieChart, Pie, Legend } from "recharts";
import { AlertCircle, Users, MapPin, Building } from "lucide-react";

export const Route = createFileRoute("/estadisticas")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Estadísticas — Venezuela Se Levanta" },
      { name: "description", content: "Estadísticas en tiempo real de la respuesta al terremoto en Venezuela." },
    ],
  }),
  component: StatsPage,
});

function StatsPage() {
  const { reports } = useReports();
  const { missing } = useMissing();

  const stats = useMemo(() => {
    const active = reports.filter((r) => r.status === "activo").length;
    const help = reports.filter((r) => r.category === "ayuda" || r.category === "medico").length;
    const rescue = reports.filter((r) => r.category === "atrapados").length;
    const missingActive = missing.filter((m) => m.status === "desaparecido").length;

    const byCategory = CATEGORIES.map((c) => ({
      name: c.name.split(" ")[0],
      slug: c.slug,
      count: reports.filter((r) => r.category === c.slug).length,
      color: c.color,
    }));

    const byStatus = (["activo", "en_atencion", "resuelto"] as const).map((s) => ({
      name: STATUS_LABELS[s],
      value: reports.filter((r) => r.status === s).length,
      color: s === "activo" ? "#CF142B" : s === "en_atencion" ? "#EAB308" : "#16A34A",
    }));

    return { active, help, rescue, missingActive, byCategory, byStatus };
  }, [reports, missing]);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard en tiempo real</h1>
        <p className="text-sm text-muted-foreground">Actualizado automáticamente con cada reporte.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={AlertCircle} color="#CF142B" label="Reportes activos" value={stats.active} />
        <StatCard icon={Users} color="#9333EA" label="Desaparecidos" value={stats.missingActive} />
        <StatCard icon={MapPin} color="#EAB308" label="Rescates pendientes" value={stats.rescue} />
        <StatCard icon={Building} color="#2563EB" label="Puntos de ayuda" value={stats.help} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-bold text-sm mb-3">Reportes por categoría</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.byCategory}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count">
                {stats.byCategory.map((d) => <Cell key={d.slug} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-bold text-sm mb-3">Estado de los reportes</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={stats.byStatus} dataKey="value" nameKey="name" outerRadius={90} label={(d) => `${d.name}: ${d.value}`}>
                {stats.byStatus.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-bold text-sm mb-3">Últimos reportes</h3>
        <div className="divide-y divide-border">
          {reports.slice(0, 8).map((r) => {
            const cat = CATEGORY_MAP[r.category];
            return (
              <div key={r.id} className="flex items-center gap-3 py-2">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0" style={{ background: cat?.color, color: "white" }}>
                  {cat?.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{r.location_text}</div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{STATUS_LABELS[r.status]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value }: { icon: any; color: string; label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5" style={{ color }} />
        <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
