import { Link, useRouterState } from "@tanstack/react-router";
import { Map, Users, HandHeart, PackageOpen, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Mapa", icon: Map },
  { to: "/desaparecidos", label: "Personas", icon: Users },
  // FAB sits in the middle slot
  { to: "/necesidades", label: "Necesidades", icon: HandHeart },
  { to: "/ofertas", label: "Ayudar", icon: PackageOpen },
] as const;

/**
 * Mobile-only bottom tab bar with a centered FAB for "Reportar".
 * Hidden on lg+ where the desktop header nav takes over.
 */
export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      {/* Spacer so page content never sits under the bar */}
      <div className="h-20 lg:hidden" aria-hidden />

      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-[1100] bg-card/95 backdrop-blur border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegación principal"
      >
        <div className="relative grid grid-cols-5 h-16 select-none">
          {TABS.slice(0, 2).map((t) => (
            <TabLink key={t.to} {...t} active={pathname === t.to} />
          ))}

          {/* Center FAB */}
          <div className="flex items-start justify-center">
            <Link
              to="/reportar"
              aria-label="Reportar incidente"
              className={cn(
                "relative -mt-7 h-16 w-16 rounded-full flex items-center justify-center touch-manipulation",
                "bg-[color:var(--sunrise)] text-white shadow-xl shadow-[color:var(--sunrise)]/45",
                "ring-4 ring-card active:scale-95 transition-transform",
              )}
            >
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-[color:var(--sunrise)] opacity-50 animate-ping" />
              <Plus className="h-7 w-7 relative pointer-events-none" strokeWidth={2.5} />
            </Link>
          </div>

          {TABS.slice(2).map((t) => (
            <TabLink key={t.to} {...t} active={pathname === t.to} />
          ))}
        </div>
      </nav>
    </>
  );
}

function TabLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors min-h-[48px] min-w-[44px]",
        active
          ? "text-[color:var(--sunrise)]"
          : "text-muted-foreground active:text-foreground",
      )}
    >
      <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_2px_4px_color-mix(in_oklab,var(--sunrise)_60%,transparent)]")} />
      <span className="leading-none">{label}</span>
    </Link>
  );
}
