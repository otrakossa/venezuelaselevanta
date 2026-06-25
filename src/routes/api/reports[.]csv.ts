import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value).replace(/"/g, '""');
  return `"${s}"`;
}

async function fetchReports() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const res = await fetch(
    `${url}/rest/v1/reports?select=*&order=created_at.desc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Record<string, unknown>[]>;
}

export const Route = createFileRoute("/api/reports.csv")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        let data: Record<string, unknown>[];
        try {
          data = await fetchReports();
        } catch (err) {
          return new Response(`error,${String(err)}`, {
            status: 500,
            headers: { "Content-Type": "text/csv; charset=utf-8", ...CORS },
          });
        }

        const headers = [
          "id", "titulo", "descripcion", "categoria", "urgencia", "estado_reporte",
          "latitud", "longitud", "direccion", "estado", "municipio", "parroquia",
          "reportero", "personas_afectadas", "verificado", "fecha_creacion",
        ];
        const hxl = [
          "#id", "#report+title", "#description", "#report+type", "#severity", "#status",
          "#geo+lat", "#geo+lon", "#loc+name", "#adm1+name", "#adm2+name", "#adm3+name",
          "#contact+name", "#affected+num", "#verified", "#date+created",
        ];

        const rows = data.map((r) =>
          [
            r.id, r.title, r.description, r.category, r.urgency, r.status,
            r.lat, r.lng, r.address, r.state, r.municipality, r.parish,
            r.reporter_name, r.affected_count, r.verified, r.created_at,
          ].map(csvCell).join(","),
        );

        const csv = [headers.join(","), hxl.join(","), ...rows].join("\n");

        return new Response(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="venezuelaselevanta-reportes.csv"',
            "Cache-Control": "public, max-age=300",
            ...CORS,
          },
        });
      },
    },
  },
});
