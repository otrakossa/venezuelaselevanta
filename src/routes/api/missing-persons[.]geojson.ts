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
  "id,name,age,description,last_seen_location,last_seen_lat,last_seen_lng,photo_url,contact_name,status,created_at,updated_at,report_date,found_date,source_url,source_label,state,municipality,parish";

export const Route = createFileRoute("/api/missing-persons.geojson")({
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
            `missing_persons?select=${SAFE_COLS}` +
            `&last_seen_lat=not.is.null&last_seen_lng=not.is.null` +
            `&order=created_at.desc,id.desc&limit=${limit}` +
            commonFilters(sp, { allow: ["state", "municipality", "parish", "status", "since"] }) +
            bboxClause(sp, "last_seen_lat", "last_seen_lng") +
            cursorClause(cursor);
          const rows = await supaFetch(q);
          const next = nextCursorFromRows(rows, limit);
          const features = rows.map((r) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [Number(r.last_seen_lng), Number(r.last_seen_lat)] },
            properties: { ...r, last_seen_lat: undefined, last_seen_lng: undefined },
          }));
          return geojsonResponse(
            {
              type: "FeatureCollection",
              metadata: metadata({
                title: "Venezuela Se Levanta — Desaparecidos (georreferenciados)",
                description: "Solo registros con última ubicación conocida.",
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
