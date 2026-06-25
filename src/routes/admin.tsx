import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useReports, useAuth } from "@/hooks/useReports";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_MAP, CATEGORIES, URGENCY_LABELS, STATUS_LABELS } from "@/lib/categories";
import { toast } from "sonner";
import { ShieldCheck, Trash2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin — VenezuelaSOS" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { isAuthenticated } = useAuth();
  const { reports } = useReports();
  const [filters, setFilters] = useState({ category: "", urgency: "", status: "" });

  const filtered = useMemo(
    () =>
      reports.filter(
        (r) =>
          (!filters.category || r.category === filters.category) &&
          (!filters.urgency || r.urgency === filters.urgency) &&
          (!filters.status || r.status === filters.status),
      ),
    [reports, filters],
  );

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <ShieldCheck className="h-12 w-12 text-vzla-blue mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2">Acceso restringido</h1>
        <p className="text-sm text-muted-foreground mb-4">
          El panel de moderación requiere una cuenta de voluntario verificado.
        </p>
        <Link to="/auth" className="inline-block bg-primary text-primary-foreground px-5 py-2.5 rounded-md font-semibold text-sm">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  const verify = async (id: string, verified: boolean) => {
    const { error } = await supabase.from("reports").update({ verified: !verified }).eq("id", id);
    if (error) toast.error(error.message);
  };
  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("reports").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
  };
  const del = async (id: string) => {
    if (!confirm("¿Eliminar este reporte?")) return;
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Eliminado");
  };

  const select = "px-2 py-1.5 rounded-md border border-input bg-background text-xs";

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Panel de moderación</h1>
        <div className="text-xs text-muted-foreground">
          {filtered.length} / {reports.length} reportes
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select className={select} value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
          <option value="">Todas las categorías</option>
          {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.emoji} {c.name}</option>)}
        </select>
        <select className={select} value={filters.urgency} onChange={(e) => setFilters({ ...filters, urgency: e.target.value })}>
          <option value="">Toda urgencia</option>
          {Object.entries(URGENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className={select} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Reporte</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2">Urgencia</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => {
              const cat = CATEGORY_MAP[r.category];
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 max-w-[260px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold truncate">{r.title}</span>
                      {r.verified && <span className="text-[9px] bg-emerald-500 text-white px-1 rounded">✓</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{r.location_text}</div>
                  </td>
                  <td className="px-3 py-2"><span className="inline-flex items-center gap-1">{cat?.emoji}<span className="hidden md:inline">{cat?.name}</span></span></td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 rounded text-white text-[10px] font-semibold" style={{ background: URGENCY_LABELS[r.urgency].color }}>
                      {URGENCY_LABELS[r.urgency].label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} className={select}>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{format(new Date(r.created_at), "dd/MM HH:mm")}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => verify(r.id, r.verified)} className="p-1.5 rounded hover:bg-muted" title={r.verified ? "Quitar verificación" : "Verificar"}>
                        <CheckCircle2 className={`h-4 w-4 ${r.verified ? "text-emerald-500" : "text-muted-foreground"}`} />
                      </button>
                      <button onClick={() => del(r.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
