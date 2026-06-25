import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

export const Route = createFileRoute("/api/reports.geojson")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        let reports: Record<string, unknown>[];
        try {
          reports = await fetchReports();
        } catch (err) {
          return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        const features = reports
          .filter((r) => typeof r.lng === "number" && typeof r.lat === "number")
          .map((r) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [Number(r.lng), Number(r.lat)] },
            properties: {
              id: r.id, title: r.title, description: r.description,
              category: r.category, urgency: r.urgency, status: r.status,
              address: r.address, state: r.state, municipality: r.municipality, parish: r.parish,
              reporter_name: r.reporter_name,
              affected_count: r.affected_count, verified: r.verified,
              confirm_count: r.confirm_count, dispute_count: r.dispute_count,
              created_at: r.created_at,
            },
          }));

        const body = {
          type: "FeatureCollection",
          metadata: {
            generated: new Date().toISOString(),
            title: "Venezuela Se Levanta — Reportes de crisis",
            description: "Datos de reportes ciudadanos del terremoto de Venezuela. Licencia CC BY 4.0.",
            license: "https://creativecommons.org/licenses/by/4.0/",
            source: "https://venezuelaselevanta.info",
            count: features.length,
          },
          features,
        };

        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/geo+json; charset=utf-8", "Cache-Control": "public, max-age=300", ...CORS },
        });
      },
    },
  },
});
