import { Link, useRouterState } from "@tanstack/react-router";
import { Map, FilePlus, Users, BarChart3, ShieldCheck, Moon, Sun, LogOut, Heart, HandHeart, HeartPulse, PackageOpen, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useEffect, useState } from "react";
import { useReports, useAuth } from "@/hooks/useReports";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Mapa", icon: Map },
  { to: "/reportar", label: "Reportar", icon: FilePlus },
  { to: "/desaparecidos", label: "Desaparecidos", icon: Users },
  { to: "/pacientes", label: "Atendidos", icon: HeartPulse },
  { to: "/necesidades", label: "Necesidades", icon: HandHeart },
  { to: "/ofertas", label: "¡Quiero ayudar!", icon: PackageOpen },
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
    <header
      className="bg-header text-header-foreground sticky top-0 z-[1000] border-b border-white/5"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between gap-2 h-14">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <span className="animate-heartbeat shrink-0">
              <Logo size={30} withWordmark={false} variant="light" />
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

          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-1.5 bg-[color:var(--sunrise)]/15 border border-[color:var(--sunrise)]/40 rounded-full px-2.5 py-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[color:var(--sunrise)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[color:var(--sunrise)]" />
              </span>
              <span className="text-[11px] font-semibold">{activeCount}</span>
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

        {/* Desktop nav only — mobile uses BottomNav */}
        <nav className="hidden lg:flex gap-1 pb-1.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-[color:var(--sunrise)] text-white"
                    : "text-header-foreground/80 hover:bg-white/10",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
          <Link
            to="/donar"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition-all ml-auto shadow-md",
              pathname === "/donar"
                ? "bg-[color:var(--sunrise)] text-white ring-2 ring-[color:var(--sunrise)]/40"
                : "bg-[color:var(--sunrise)] text-white hover:opacity-90 hover:scale-105",
            )}
          >
            <HandHeart className="h-3.5 w-3.5" />
            Donar
          </Link>
          <Link
            to="/que-es"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
              pathname === "/que-es"
                ? "bg-[color:var(--cream)] text-[color:var(--midnight)]"
                : "text-header-foreground/80 hover:bg-white/10",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Qué es
          </Link>
          <Link
            to="/admin"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
              pathname === "/admin"
                ? "bg-[color:var(--sky)] text-white"
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

