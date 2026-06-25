import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/reportes/$id")({
  ssr: false,
  component: RedirectToHome,
});

function RedirectToHome() {
  const { id } = Route.useParams();
  return <Navigate to="/" search={{ report: id }} replace />;
}
