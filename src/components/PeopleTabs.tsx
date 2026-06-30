import { Link, useRouterState } from "@tanstack/react-router";
import { Users, HeartPulse } from "lucide-react";
import { flags } from "@/lib/flags";

const PEOPLE_TABS = [
  { to: "/desaparecidos", label: "Desaparecidos", icon: Users },
  { to: "/pacientes", label: "Atendidos", icon: HeartPulse },
] as const;

/**
 * Pestañas para saltar entre las dos mitades de "encontrar a una persona":
 * Desaparecidos ↔ Atendidos en centros de salud. Ambas listas siguen siendo
 * páginas separadas; esto solo enlaza la navegación entre ellas.
 *
 * Oculto salvo que el flag `peopleLink` esté ON.
 */
export function PeopleTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!flags.peopleLink) return null;

  return (
    <nav aria-label="Buscar personas" className="mb-4 inline-flex gap-1 rounded-xl border border-border bg-muted/50 p-1">
      {PEOPLE_TABS.map(({ to, label, icon: Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition min-h-[44px] ${
              active ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
