// ── MSW: Supabase REST (PostgREST) + RPC ───────────────────────────────────
// La base es process.env.SUPABASE_URL (= test.env de vitest.config). Defaults
// inocuos de Fase 0: GET → [], POST/PATCH → ok. Las Fases 1/2 sobreescriben
// por tabla con `server.use(...)` para asertar bodies y devolver filas.
import { http, HttpResponse } from "msw";

const SUPA_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";

export const supabaseHandlers = [
  // RPC: /rest/v1/rpc/<fn>  (antes que :table para que no lo capture el genérico)
  http.post(`${SUPA_URL}/rest/v1/rpc/:fn`, () => HttpResponse.json([])),

  // SELECT / COUNT
  http.get(`${SUPA_URL}/rest/v1/:table`, () => HttpResponse.json([])),

  // INSERT (return=minimal → 201 sin body; representation lo refina cada test)
  http.post(`${SUPA_URL}/rest/v1/:table`, () =>
    new HttpResponse(null, { status: 201 }),
  ),

  // UPDATE
  http.patch(`${SUPA_URL}/rest/v1/:table`, () =>
    new HttpResponse(null, { status: 204 }),
  ),
];
