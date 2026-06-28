import { createFileRoute, redirect } from "@tanstack/react-router";

// Alias histórico: el menú usa la etiqueta "Atendidos" pero la ruta canónica
// es /pacientes. Redirigimos para que cualquier enlace o bot que apunte a
// /atendidos no caiga en un 404.
export const Route = createFileRoute("/atendidos")({
  beforeLoad: () => {
    throw redirect({ to: "/pacientes" });
  },
});
