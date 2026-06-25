import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/reports.geojson")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient<Database>(url, key, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await supabase
          .from("reports")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        const reports = data ?? [];
        const features = reports
          .filter((r) => typeof r.lng === "number" && typeof r.lat === "number")
          .map((r) => ({
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [Number(r.lng), Number(r.lat)],
            },
            properties: {
              id: r.id,
              title: r.title,
              description: r.description,
              category: r.category,
              urgency: r.urgency,
              status: r.status,
              address: r.address,
              reporter_name: r.reporter_name,
              affected_count: r.affected_count,
              verified: r.verified,
              confirm_count: r.confirm_count,
              dispute_count: r.dispute_count,
              created_at: r.created_at,
            },
          }));

        const body = {
          type: "FeatureCollection",
          metadata: {
            generated: new Date().toISOString(),
            title: "Venezuela Se Levanta — Reportes de crisis",
            description:
              "Datos de reportes ciudadanos del terremoto de Venezuela. Licencia CC BY 4.0.",
            license: "https://creativecommons.org/licenses/by/4.0/",
            source: "https://venezuelaselevanta.info",
            count: features.length,
          },
          features,
        };

        return new Response(JSON.stringify(body), {
          status: 200,
          headers: {
            "Content-Type": "application/geo+json; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            ...CORS,
          },
        });
      },
    },
  },
});
