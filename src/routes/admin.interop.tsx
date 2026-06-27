import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/useReports";
import { useAdminRole } from "@/hooks/useAdminRole";
import { ShieldCheck, BarChart3, Database, Link2, Copy, ArrowLeft } from "lucide-react";
import { SourcesPanel } from "@/components/admin/interop/SourcesPanel";
import { RecordsExplorer } from "@/components/admin/interop/RecordsExplorer";
import { MatchQueue } from "@/components/admin/interop/MatchQueue";
import { DuplicatesPanel } from "@/components/admin/interop/DuplicatesPanel";

export const Route = createFileRoute("/admin/interop")({
  ssr: false,
  head: () => ({ meta: [{ title: "Interoperabilidad — Admin" }] }),
  component: InteropPage,
});

type Tab = "sources" | "records" | "matches" | "dupes";

const TABS: { k: Tab; label: string; icon: typeof BarChart3 }[] = [
  { k: "sources", label: "Panorama", icon: BarChart3 },
  { k: "records", label: "Registros", icon: Database },
  { k: "matches", label: "Matches", icon: Link2 },
  { k: "dupes",   label: "Duplicados", icon: Copy },
];

function InteropPage() {
  const { isAuthenticated, userId } = useAuth();
  const { isAdmin, loading } = useAdminRole(userId);
  const [tab, setTab] = useState<Tab>("sources");

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
  if (loading) return <div className="p-10 text-center text-sm text-muted-foreground">Verificando permisos...</div>;
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <ShieldCheck className="h-12 w-12 text-[color:var(--sunrise)] mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2">Sin permisos</h1>
        <p className="text-sm text-muted-foreground">Necesitas rol admin o moderator.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="h-3 w-3" /> Volver a moderación
          </Link>
          <h1 className="text-2xl font-bold">Interoperabilidad de fuentes</h1>
          <p className="text-[11px] text-muted-foreground">
            Panorama, registros, matches y duplicados entre plataformas integradas.
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                active ? "border-[color:var(--sunrise)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "sources" && <SourcesPanel />}
      {tab === "records" && <RecordsExplorer />}
      {tab === "matches" && <MatchQueue />}
      {tab === "dupes"   && <DuplicatesPanel />}
    </div>
  );
}
