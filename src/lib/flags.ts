/**
 * Feature flags del frontend.
 *
 * Gated por variables `VITE_FEATURE_*` que Vite inyecta en BUILD time (igual que
 * el resto de `VITE_*`). Ausente o vacío ⇒ apagado, así que el código puede
 * desplegarse sin activar la mejora.
 *
 * Convención de valores "encendido" alineada con los flags del bot
 * (`BOT_NEEDS_FLOW` / `BOT_HELP_FLOW`): `1` / `true` / `on` / `yes`
 * (case-insensitive).
 *
 * Para activar en producción: poner la variable en el `.env` del VPS y
 * reconstruir el bundle (`bun run build`), porque estos valores se inlinean al
 * compilar — no se leen en runtime.
 */
function on(v: unknown): boolean {
  return typeof v === "string" && ["1", "true", "on", "yes"].includes(v.trim().toLowerCase());
}

export const flags = {
  /** Camino rápido del formulario de reporte: auto-GPS + campos opcionales colapsados. */
  quickReport: on(import.meta.env.VITE_FEATURE_QUICK_REPORT),
  /** Pestañas + buscador cruzado entre Desaparecidos y Atendidos. */
  peopleLink: on(import.meta.env.VITE_FEATURE_PEOPLE_LINK),
  /** Nav de escritorio compacta con menú "Más". */
  navMore: on(import.meta.env.VITE_FEATURE_NAV_MORE),
} as const;
