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

const SAFE_COLS =
  "id,center_name,center_address,lat,lng,category,categories,title,description,quantity,urgency,status,contact_name,created_at,updated_at";

export const Route = createFileRoute("/api/needs.geojson")({
  server: {
    handlers: {
      OPTIONS: async () => optionsHandler(),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const sp = url.searchParams;
          const limit = parseLimit(sp);
          const cursor = decodeCursor(sp.get("cursor"));
          const q =
            `needs?select=${SAFE_COLS}&lat=not.is.null&lng=not.is.null` +
            `&order=created_at.desc,id.desc&limit=${limit}` +
            commonFilters(sp, { allow: ["category", "urgency", "status", "since"] }) +
            bboxClause(sp, "lat", "lng") +
            cursorClause(cursor);
          const rows = await supaFetch(q);
          const next = nextCursorFromRows(rows, limit);
          const features = rows.map((r) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [Number(r.lng), Number(r.lat)] },
            properties: { ...r, lat: undefined, lng: undefined },
          }));
          return geojsonResponse(
            {
              type: "FeatureCollection",
              metadata: metadata({
                title: "Venezuela Se Levanta — Necesidades georreferenciadas",
                description: "Solo necesidades con ubicación.",
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
