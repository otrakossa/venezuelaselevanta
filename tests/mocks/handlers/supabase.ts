// ── MSW: Supabase REST (PostgREST) + RPC ───────────────────────────────────
// La base es process.env.SUPABASE_URL (= test.env de vitest.config). Defaults
// inocuos de Fase 0: GET → [], POST/PATCH → ok. Las Fases 1/2 sobreescriben
// por tabla con `server.use(...)` para asertar bodies y devolver filas.
import { http, HttpResponse } from "msw";

export const SUPA_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";

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

// ── Overrides / capturas para tests (server.use(...)) ──────────────────────
export interface InsertCall {
  table: string;
  body: Record<string, unknown>;
}

/** Captura todos los INSERT (POST). Devuelve 201 (éxito); si el caller pide
 *  return=representation, responde la(s) fila(s) con un id sintético. */
export function recordInserts() {
  const calls: InsertCall[] = [];
  const handler = http.post(
    `${SUPA_URL}/rest/v1/:table`,
    async ({ request, params }) => {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      calls.push({ table: String(params.table), body });
      const prefer = request.headers.get("Prefer") ?? "";
      if (prefer.includes("return=representation")) {
        const arr = Array.isArray(body) ? body : [body];
        return HttpResponse.json(
          arr.map((b, i) => ({ id: `gen-${i + 1}`, ...(b as object) })),
        );
      }
      return new HttpResponse(null, { status: 201 });
    },
  );
  return { calls, handler };
}

/** Hace fallar todos los INSERT a una tabla (status 400 + texto de error). */
export const insertErrorHandler = (table: string, msg = "boom") =>
  http.post(`${SUPA_URL}/rest/v1/${table}`, () =>
    new HttpResponse(msg, { status: 400 }),
  );

export interface PatchCall {
  table: string;
  search: string;
  body: Record<string, unknown>;
}

/** Captura todos los PATCH (UPDATE). Devuelve 204 (éxito). */
export function recordPatches() {
  const calls: PatchCall[] = [];
  const handler = http.patch(
    `${SUPA_URL}/rest/v1/:table`,
    async ({ request, params }) => {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      calls.push({
        table: String(params.table),
        search: new URL(request.url).search,
        body,
      });
      return new HttpResponse(null, { status: 204 });
    },
  );
  return { calls, handler };
}

/** GET a una tabla → devuelve `rows` (ignora el query string). */
export const selectHandler = (table: string, rows: unknown[]) =>
  http.get(`${SUPA_URL}/rest/v1/${table}`, () => HttpResponse.json(rows));

/** RPC (POST /rpc/<fn>) → devuelve `rows`. */
export const rpcHandler = (fn: string, rows: unknown[]) =>
  http.post(`${SUPA_URL}/rest/v1/rpc/${fn}`, () => HttpResponse.json(rows));

/** COUNT: GET con header content-range `0-0/<total>`. `pick` permite variar
 *  el total según el query (p.ej. status=eq.missing) para /estado. */
export const countHandler = (
  table: string,
  pick: (search: URLSearchParams) => number,
) =>
  http.get(`${SUPA_URL}/rest/v1/${table}`, ({ request }) => {
    const total = pick(new URL(request.url).searchParams);
    return new HttpResponse(null, {
      status: 200,
      headers: { "content-range": `0-0/${total}` },
    });
  });
