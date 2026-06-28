import { createFileRoute } from "@tanstack/react-router";
import {
  CORS,
  commonFilters,
  cursorClause,
  decodeCursor,
  errorResponse,
  jsonResponse,
  linkHeader,
  metadata,
  nextCursorFromRows,
  optionsHandler,
  parseLimit,
  supaFetch,
} from "@/lib/api-public";

const SAFE_COLS = "id,name,type,lat,lng,address,city,state,phone,osm_id,osm_type,created_at";

export const Route = createFileRoute("/api/health-centers.json")({
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
            `health_centers?select=${SAFE_COLS}&order=created_at.desc,id.desc&limit=${limit}` +
            commonFilters(sp, { allow: ["state", "city", "since"] }) +
            cursorClause(cursor);
          const rows = await supaFetch(q);
          const next = nextCursorFromRows(rows, limit);
          return jsonResponse(
            {
              metadata: metadata({
                title: "Venezuela Se Levanta — Centros de salud",
                description: "Directorio de centros médicos activos.",
                count: rows.length,
                nextCursor: next,
              }),
              data: rows,
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
