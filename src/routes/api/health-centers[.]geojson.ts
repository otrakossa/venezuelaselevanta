import { createFileRoute } from "@tanstack/react-router";
import {
  bboxClause,
  commonFilters,
  errorResponse,
  geojsonResponse,
  metadata,
  optionsHandler,
  parseLimit,
  supaFetch,
} from "@/lib/api-public";
import { guardPublicApi } from "@/lib/api-rate-limit";

const SAFE_COLS = "id,name,type,lat,lng,address,city,state,phone,osm_id,osm_type,created_at";

export const Route = createFileRoute("/api/health-centers.geojson")({
  server: {
    handlers: {
      OPTIONS: async () => optionsHandler(),
      GET: async ({ request }) => {
        const _rl = guardPublicApi(request, "geojson");
        if (_rl.response) return _rl.response;
        try {
          const url = new URL(request.url);
          const sp = url.searchParams;
          const limit = parseLimit(sp);
          const q =
            `health_centers?select=${SAFE_COLS}&order=name.asc&limit=${limit}` +
            commonFilters(sp, { allow: ["state", "city"] }) +
            bboxClause(sp, "lat", "lng");
          const rows = await supaFetch(q);
          const features = rows.map((r) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [Number(r.lng), Number(r.lat)] },
            properties: { ...r, lat: undefined, lng: undefined },
          }));
          return geojsonResponse({
            type: "FeatureCollection",
            metadata: metadata({
              title: "Venezuela Se Levanta — Centros de salud",
              description: "Directorio de centros médicos georreferenciados.",
              count: features.length,
            }),
            features,
          });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
