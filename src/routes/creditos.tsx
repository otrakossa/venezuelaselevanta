import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/creditos")({
  beforeLoad: () => {
    throw redirect({ to: "/que-es", hash: "equipo" });
  },
});
