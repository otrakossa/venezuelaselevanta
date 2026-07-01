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
import { guardPublicApi } from "@/lib/api-rate-limit";

const SAFE_COLS =
  "id,center_name,center_address,lat,lng,category,categories,title,description,quantity,urgency,status,contact_name,created_at,updated_at";

export const Route = createFileRoute("/api/needs.json")({
  server: {
    handlers: {
      OPTIONS: async () => optionsHandler(),
      GET: async ({ request }) => {
        const _rl = guardPublicApi(request, "json");
        if (_rl.response) return _rl.response;
        try {
          const url = new URL(request.url);
          const sp = url.searchParams;
          const limit = parseLimit(sp);
          const cursor = decodeCursor(sp.get("cursor"));
          const q =
            `needs?select=${SAFE_COLS}&order=created_at.desc,id.desc&limit=${limit}` +
            commonFilters(sp, { allow: ["category", "urgency", "status", "since"] }) +
            cursorClause(cursor);
          const rows = await supaFetch(q);
          const next = nextCursorFromRows(rows, limit);
          return jsonResponse(
            {
              metadata: metadata({
                title: "Venezuela Se Levanta — Necesidades",
                description: "Necesidades publicadas por comunidades y centros (sin datos privados del reportante).",
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
