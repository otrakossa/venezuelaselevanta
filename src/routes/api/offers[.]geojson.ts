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

const SAFE_COLS = "id,name,type,lat,lng,address,city,state,phone,created_at";

export const Route = createFileRoute("/api/offers.geojson")({
  server: {
    handlers: {
      OPTIONS: async () => optionsHandler(),
      GET: async ({ request }) => {
        const _rl = guardPublicApi(request, "geojson");
        if (_rl.response) return _rl.response;
        // Offers location is text-only; we re-use offers via geocoded city/state isn't worth it.
        // Fallback: 410 — use /api/offers.json with state/city filters instead.
        void SAFE_COLS;
        void bboxClause;
        void commonFilters;
        void metadata;
        void parseLimit;
        void supaFetch;
        try {
          return geojsonResponse(
            {
              type: "FeatureCollection",
              metadata: {
                generated: new Date().toISOString(),
                title: "Ofertas — sin coordenadas",
                description: "Las ofertas no almacenan lat/lng. Usa /api/offers.json (filtros state, city).",
                license: "https://creativecommons.org/licenses/by/4.0/",
                source: "https://venezuelaselevanta.info",
                count: 0,
              },
              features: [],
            },
            200,
          );
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
