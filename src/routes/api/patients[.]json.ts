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
  "id,name,age,sex,center_name,center_address,center_lat,center_lng,status,notes,discharged_at,created_at,state,sector,health_center_id";

export const Route = createFileRoute("/api/patients.json")({
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
            `patients?select=${SAFE_COLS}` +
            `&order=created_at.desc,id.desc&limit=${limit}` +
            commonFilters(sp, { allow: ["state", "status", "since"] }) +
            cursorClause(cursor);
          const rows = await supaFetch(q);
          const next = nextCursorFromRows(rows, limit);
          return jsonResponse(
            {
              metadata: metadata({
                title: "Venezuela Se Levanta — Pacientes / Atendidos",
                description: "Registro de personas atendidas en centros de salud (sin PII).",
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
