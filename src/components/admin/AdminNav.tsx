import { Link, useRouterState } from "@tanstack/react-router";
import { ShieldCheck, Link2, Activity, ArrowLeft } from "lucide-react";

const ITEMS: { to: string; label: string; icon: typeof ShieldCheck; exact?: boolean }[] = [
  { to: "/admin", label: "Moderación", icon: ShieldCheck, exact: true },
  { to: "/admin/interop", label: "Interoperabilidad", icon: Link2 },
  { to: "/admin/observabilidad", label: "Observabilidad", icon: Activity },
];

export function AdminNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to || pathname === to + "/" : pathname.startsWith(to);

  return (
    <div className="mb-4 border-b border-border">
      <div className="flex items-center justify-between gap-2 mb-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Volver al sitio
        </Link>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Admin
        </span>
      </div>
      <nav className="flex gap-1 overflow-x-auto -mb-px">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const active = isActive(it.to, it.exact);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                active
                  ? "border-[color:var(--sunrise)] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
