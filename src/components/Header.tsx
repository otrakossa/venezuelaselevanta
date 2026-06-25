import { Link, useRouterState } from "@tanstack/react-router";
import { Map, FilePlus, Users, BarChart3, ShieldCheck, Moon, Sun, LogOut } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useEffect, useState } from "react";
import { useReports, useAuth } from "@/hooks/useReports";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Mapa", icon: Map },
  { to: "/reportar", label: "Reportar", icon: FilePlus },
  { to: "/desaparecidos", label: "Desaparecidos", icon: Users },
  { to: "/estadisticas", label: "Estadísticas", icon: BarChart3 },
] as const;

export function Header() {
  const { reports } = useReports();
  const { isAuthenticated } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("vsos-dark") === "1";
    setDark(stored);
    document.documentElement.classList.toggle("dark", stored);
  }, []);
  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("vsos-dark", next ? "1" : "0");
  };

  const activeCount = reports.filter((r) => r.status === "active").length;

  return (
    <header className="bg-header text-header-foreground border-b-4 border-vzla-red sticky top-0 z-[1000]">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between gap-2 h-14">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <span className="animate-heartbeat">
              <Logo size={34} withWordmark={false} variant="light" />
            </span>
            <div className="min-w-0 flex flex-col leading-tight">
              <span className="font-display text-base sm:text-lg tracking-tight truncate">
                Venezuela <span className="text-[color:var(--sunrise)]">Se Levanta</span>
              </span>
              <span className="text-[10px] text-header-foreground/60 leading-tight hidden sm:block">
                venezuelaselevanta.info
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 bg-vzla-red/20 border border-vzla-red/40 rounded-full px-3 py-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vzla-red opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-vzla-red"></span>
              </span>
              <span className="text-xs font-semibold">{activeCount} activos</span>
            </div>
            <button
              onClick={toggleDark}
              className="p-2 rounded-md hover:bg-white/10 transition-colors"
              aria-label="Modo oscuro"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {isAuthenticated ? (
              <button
                onClick={() => supabase.auth.signOut()}
                className="p-2 rounded-md hover:bg-white/10 transition-colors"
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 pb-1.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-vzla-red text-white"
                    : "text-header-foreground/80 hover:bg-white/10",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
          <Link
            to="/admin"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ml-auto",
              pathname === "/admin"
                ? "bg-vzla-blue text-white"
                : "text-header-foreground/80 hover:bg-white/10",
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
