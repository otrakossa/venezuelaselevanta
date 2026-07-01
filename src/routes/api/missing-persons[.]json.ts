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
  "id,name,age,description,last_seen_location,last_seen_lat,last_seen_lng,photo_url,contact_name,status,outcome,outcome_note,outcome_set_at,created_at,updated_at,report_date,found_date,source_url,source_label,state,municipality,parish";

export const Route = createFileRoute("/api/missing-persons.json")({
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
            `missing_persons?select=${SAFE_COLS}` +
            `&order=created_at.desc,id.desc&limit=${limit}` +
            commonFilters(sp, { allow: ["state", "municipality", "parish", "status", "since"] }) +
            cursorClause(cursor);
          const rows = await supaFetch(q);
          const next = nextCursorFromRows(rows, limit);
          return jsonResponse(
            {
              metadata: metadata({
                title: "Venezuela Se Levanta — Personas desaparecidas",
                description: "Registro consolidado de personas desaparecidas (sin datos de contacto sensibles).",
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
