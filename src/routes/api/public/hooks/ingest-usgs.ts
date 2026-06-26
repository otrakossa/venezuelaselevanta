import { createFileRoute } from "@tanstack/react-router";

const USGS_URL =
  "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=1&maxlatitude=13&minlongitude=-74&maxlongitude=-59&minmagnitude=3&orderby=time&limit=100";

interface UsgsFeature {
  id: string;
  properties: { mag: number; place: string; time: number; url: string };
  geometry: { coordinates: [number, number, number] };
}

function urgencyFor(mag: number): "critical" | "high" | "medium" | "low" {
  if (mag >= 5) return "critical";
  if (mag >= 4) return "high";
  if (mag >= 3) return "medium";
  return "low";
}

function inVenezuela(lat: number, lng: number): boolean {
  return lat >= 0.5 && lat <= 12.5 && lng >= -73.5 && lng <= -59.5;
}

export const Route = createFileRoute("/api/public/hooks/ingest-usgs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-ingest-secret") ?? "";
        const expected = process.env.USGS_INGEST_SECRET ?? "";
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY!;

        const usgsRes = await fetch(USGS_URL);
        if (!usgsRes.ok) {
          return new Response(JSON.stringify({ error: "USGS fetch failed" }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
        const data = (await usgsRes.json()) as { features: UsgsFeature[] };

        const rows = data.features
          .filter((f) => f.geometry?.coordinates && typeof f.properties?.mag === "number")
          .map((f) => {
            const lng = f.geometry.coordinates[0];
            const lat = f.geometry.coordinates[1];
            const depth = f.geometry.coordinates[2];
            const mag = f.properties.mag;
            return {
              external_id: `usgs_${f.id}`,
              source: "USGS",
              category: "earthquake",
              urgency: urgencyFor(mag),
              status: "active" as const,
              title: `Sismo M ${mag.toFixed(1)} — ${f.properties.place}`,
              description: `Magnitud ${mag.toFixed(1)} · Profundidad ${depth?.toFixed(1)} km · Fuente: USGS\n${f.properties.url}`,
              address: f.properties.place,
              lat,
              lng,
              verified: true,
              reporter_name: "USGS",
              created_at: new Date(f.properties.time).toISOString(),
            };
          })
          .filter((r) => inVenezuela(r.lat, r.lng));

        if (rows.length === 0) {
          return new Response(JSON.stringify({ inserted: 0, total: 0 }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const insertRes = await fetch(
          `${url}/rest/v1/reports?on_conflict=external_id`,
          {
            method: "POST",
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
              Prefer: "return=representation,resolution=ignore-duplicates",
            },
            body: JSON.stringify(rows),
          },
        );

        const body = await insertRes.text();
        if (!insertRes.ok) {
          return new Response(
            JSON.stringify({ error: "insert failed", status: insertRes.status, body }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        let inserted = 0;
        try {
          inserted = (JSON.parse(body) as unknown[]).length;
        } catch {
          inserted = 0;
        }

        return new Response(
          JSON.stringify({ inserted, total: rows.length }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
