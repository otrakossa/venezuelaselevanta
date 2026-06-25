import { createFileRoute } from "@tanstack/react-router";
import { ReportForm } from "@/components/ReportForm";
import { useReports } from "@/hooks/useReports";

export const Route = createFileRoute("/reportar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reportar incidente — VenezuelaSOS" },
      { name: "description", content: "Reporta un incidente para que la comunidad y rescatistas puedan responder." },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { reports } = useReports();
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Reportar un incidente</h1>
        <p className="text-sm text-muted-foreground">
          Tu reporte ayuda a coordinar la respuesta. No necesitas cuenta para reportar.
        </p>
      </div>
      <ReportForm existingReports={reports} />
    </div>
  );
}
