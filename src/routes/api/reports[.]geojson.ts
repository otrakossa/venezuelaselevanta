import { createFileRoute } from "@tanstack/react-router";
import {
  CORS,
  bboxClause,
  commonFilters,
  cursorClause,
  decodeCursor,
  errorResponse,
  geojsonResponse,
  linkHeader,
  metadata,
  nextCursorFromRows,
  optionsHandler,
  parseLimit,
  supaFetch,
} from "@/lib/api-public";
import { guardPublicApi } from "@/lib/api-rate-limit";

const SAFE_COLS =
  "id,title,description,category,urgency,status,address,lat,lng,reporter_name,photo_url,affected_count,verified,created_at,updated_at,media_urls,media_thumbs,confirm_count,dispute_count,state,municipality,parish,external_id,source";

export const Route = createFileRoute("/api/reports.geojson")({
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
          const cursor = decodeCursor(sp.get("cursor"));
          const q =
            `reports?select=${SAFE_COLS}&hidden=is.false` +
            `&order=created_at.desc,id.desc&limit=${limit}` +
            commonFilters(sp, { allow: ["state", "municipality", "parish", "category", "urgency", "status", "since"] }) +
            bboxClause(sp, "lat", "lng") +
            cursorClause(cursor);
          const rows = await supaFetch(q);
          const next = nextCursorFromRows(rows, limit);
          const features = rows
            .filter((r) => typeof r.lng === "number" && typeof r.lat === "number")
            .map((r) => ({
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: [Number(r.lng), Number(r.lat)] },
              properties: { ...r, lat: undefined, lng: undefined },
            }));
          return geojsonResponse(
            {
              type: "FeatureCollection",
              metadata: metadata({
                title: "Venezuela Se Levanta — Reportes",
                description: "Reportes ciudadanos georreferenciados.",
                count: features.length,
                nextCursor: next,
              }),
              features,
            },
            200,
            { ...CORS, ...linkHeader(`${url.origin}${url.pathname}`, sp, next) },
          );
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
