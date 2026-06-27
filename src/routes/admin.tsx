import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useState, useMemo } from "react";
import { useReports, useAuth } from "@/hooks/useReports";
import { useAdminRole } from "@/hooks/useAdminRole";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_MAP, CATEGORIES, URGENCY_LABELS, STATUS_LABELS } from "@/lib/categories";
import { toast } from "sonner";
import { ShieldCheck, Trash2, CheckCircle2, EyeOff, Eye, Search, Clock } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin — Venezuela Se Levanta" }] }),
  component: AdminPage,
});

type Tab = "pending" | "all" | "hidden";

function AdminPage() {
  const { isAuthenticated, userId } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole(userId);
  const { reports } = useReports({ includeHidden: true });
  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ category: "", urgency: "", status: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (tab === "pending" && (r.verified || r.hidden)) return false;
      if (tab === "hidden" && !r.hidden) return false;
      if (tab === "all" && r.hidden) return false;
      if (filters.category && r.category !== filters.category) return false;
      if (filters.urgency && r.urgency !== filters.urgency) return false;
      if (filters.status && r.status !== filters.status) return false;
      if (q) {
        const hay = `${r.title} ${r.description ?? ""} ${r.address ?? ""} ${r.reporter_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, tab, filters, search]);

  const counts = useMemo(() => ({
    pending: reports.filter((r) => !r.verified && !r.hidden).length,
    all: reports.filter((r) => !r.hidden).length,
    hidden: reports.filter((r) => r.hidden).length,
  }), [reports]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <ShieldCheck className="h-12 w-12 text-vzla-blue mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2">Acceso restringido</h1>
        <p className="text-sm text-muted-foreground mb-4">
          El panel de moderación requiere una cuenta de moderador.
        </p>
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
        <h1 className="text-xl font-bold mb-2">Sin permisos de moderación</h1>
        <p className="text-sm text-muted-foreground">
          Tu cuenta está activa, pero no tiene rol de <b>admin</b> ni <b>moderator</b>. Contacta al equipo si necesitas acceso.
        </p>
      </div>
    );
  }

  const verify = async (id: string, verified: boolean) => {
    const next = !verified;
    const { error } = await supabase
      .from("reports")
      .update({ verified: next, verified_by: next ? userId : null, verified_at: next ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(next ? "Verificado" : "Verificación retirada");
  };

  const bulkVerify = async () => {
    if (selected.size === 0) return toast.error("Selecciona al menos uno");
    const ids = Array.from(selected);
    const { error } = await supabase
      .from("reports")
      .update({ verified: true, verified_by: userId, verified_at: new Date().toISOString() })
      .in("id", ids);
    if (error) toast.error(error.message);
    else { toast.success(`${ids.length} verificados`); setSelected(new Set()); }
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("reports").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const toggleHide = async (id: string, hidden: boolean) => {
    if (!hidden) {
      const reason = window.prompt("Motivo (spam, duplicado, fake, etc.):", "spam");
      if (!reason) return;
      const { error } = await supabase
        .from("reports")
        .update({ hidden: true, hidden_reason: reason, hidden_at: new Date().toISOString() })
        .eq("id", id);
      if (error) toast.error(error.message);
      else toast.success("Reporte oculto");
    } else {
      const { error } = await supabase
        .from("reports")
        .update({ hidden: false, hidden_reason: null, hidden_at: null })
        .eq("id", id);
      if (error) toast.error(error.message);
      else toast.success("Reporte restaurado");
    }
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar este reporte de forma permanente? Considera ocultarlo en su lugar.")) return;
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Eliminado");
  };

  const toggleSel = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const selectAllVisible = () => setSelected(new Set(filtered.map((r) => r.id)));
  const clearSel = () => setSelected(new Set());

  const select = "px-2 py-1.5 rounded-md border border-input bg-background text-xs";

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Panel de moderación</h1>
          <p className="text-[11px] text-muted-foreground">Verifica, oculta o elimina reportes. {filtered.length} de {reports.length} visibles.</p>
        </div>
        <Link
          to="/admin/interop"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[color:var(--sunrise)] text-white text-xs font-bold hover:opacity-90"
        >
          🔗 Interoperabilidad
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 border-b border-border">
        {([
          { k: "pending", label: "Pendientes", icon: <Clock className="h-3.5 w-3.5" /> },
          { k: "all", label: "Todos", icon: <Eye className="h-3.5 w-3.5" /> },
          { k: "hidden", label: "Ocultos", icon: <EyeOff className="h-3.5 w-3.5" /> },
        ] as { k: Tab; label: string; icon: React.ReactNode }[]).map((t) => (
          <button
            key={t.k}
            onClick={() => { setTab(t.k); clearSel(); }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
              tab === t.k ? "border-[color:var(--sunrise)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon} {t.label}
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{counts[t.k]}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar título, dirección, autor..."
            className="w-full pl-7 pr-2 py-1.5 rounded-md border border-input bg-background text-xs"
          />
        </div>
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

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-[color:var(--gold)]/15 border border-[color:var(--gold)]/40 rounded-md text-xs">
          <span className="font-semibold">{selected.size} seleccionado(s)</span>
          <button onClick={bulkVerify} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500 text-white font-semibold hover:bg-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Verificar todos
          </button>
          <button onClick={clearSel} className="px-2.5 py-1 rounded border border-border hover:bg-muted">Limpiar</button>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-2 py-2 w-8">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={(e) => (e.target.checked ? selectAllVisible() : clearSel())}
                />
              </th>
              <th className="px-3 py-2">Reporte</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2">Urgencia</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Votos</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => {
              const cat = CATEGORY_MAP[r.category];
              return (
                <tr key={r.id} className={`hover:bg-muted/30 ${r.hidden ? "opacity-60" : ""}`}>
                  <td className="px-2 py-2">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSel(r.id)} />
                  </td>
                  <td className="px-3 py-2 max-w-[260px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold truncate">{r.title}</span>
                      {r.verified && <span className="text-[9px] bg-emerald-500 text-white px-1 rounded">✓</span>}
                      {r.hidden && <span className="text-[9px] bg-rose-500 text-white px-1 rounded">OCULTO</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{r.address}</div>
                    {r.hidden && r.hidden_reason && (
                      <div className="text-[10px] text-rose-600 truncate">Motivo: {r.hidden_reason}</div>
                    )}
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
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-emerald-600 font-semibold">👍 {r.confirm_count ?? 0}</span>
                    <span className="mx-1 text-muted-foreground">·</span>
                    <span className="text-rose-600 font-semibold">👎 {r.dispute_count ?? 0}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{format(new Date(r.created_at), "dd/MM HH:mm")}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => verify(r.id, r.verified)} className="p-1.5 rounded hover:bg-muted" title={r.verified ? "Quitar verificación" : "Verificar"}>
                        <CheckCircle2 className={`h-4 w-4 ${r.verified ? "text-emerald-500" : "text-muted-foreground"}`} />
                      </button>
                      <button onClick={() => toggleHide(r.id, !!r.hidden)} className="p-1.5 rounded hover:bg-muted" title={r.hidden ? "Restaurar" : "Ocultar (spam/fake)"}>
                        {r.hidden ? <Eye className="h-4 w-4 text-blue-500" /> : <EyeOff className="h-4 w-4 text-amber-500" />}
                      </button>
                      <button onClick={() => del(r.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive" title="Eliminar permanente">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Sin reportes en esta vista</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
