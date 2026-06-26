import { useRouterState } from "@tanstack/react-router";

/**
 * Barra de progreso superior durante navegación entre rutas.
 * Se muestra cuando el router está cargando una nueva ruta y oculta al terminar.
 */
export function RouteProgress() {
  const isLoading = useRouterState({ select: (s) => s.isLoading || s.isTransitioning });
  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 h-[3px] z-[2000] pointer-events-none"
      style={{
        background: isLoading
          ? "linear-gradient(90deg, transparent, var(--sunrise), transparent)"
          : "transparent",
        backgroundSize: "200% 100%",
        animation: isLoading ? "route-progress 1.2s linear infinite" : "none",
        opacity: isLoading ? 1 : 0,
        transition: "opacity 200ms ease",
      }}
    />
  );
}
