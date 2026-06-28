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

const SAFE_COLS =
  "id,need_id,category,title,description,quantity,contact_name,location_desc,status,state,city,address,created_at";

export const Route = createFileRoute("/api/offers.json")({
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
            `offers?select=${SAFE_COLS}&order=created_at.desc,id.desc&limit=${limit}` +
            commonFilters(sp, { allow: ["category", "status", "state", "city", "since"] }) +
            cursorClause(cursor);
          const rows = await supaFetch(q);
          const next = nextCursorFromRows(rows, limit);
          return jsonResponse(
            {
              metadata: metadata({
                title: "Venezuela Se Levanta — Ofertas de ayuda",
                description: "Ofertas publicadas por la ciudadanía (sin teléfono/contacto privado).",
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
