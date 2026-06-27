// ── Interceptación de red para los E2E (determinismo + jamás tocar prod) ───
// El cliente del navegador apunta al Supabase de PRODUCCIÓN (hardcodeado en
// src/integrations/supabase/client.ts). Aquí cortamos TODA llamada externa con
// page.route()/routeWebSocket() para que ninguna salga del navegador.
import type { Page, Route, WebSocketRoute } from "@playwright/test";

// PNG transparente 1×1 para los tiles de OSM (evita llamadas externas y ruido).
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const json = (route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) =>
  route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });

/** Corta todo el I/O externo de una página. Llamar en beforeEach ANTES de goto. */
export async function stubExternal(page: Page): Promise<void> {
  // Tiles de OpenStreetMap → PNG 1×1.
  await page.route(/tile\.openstreetmap\.org/, (r) =>
    r.fulfill({ status: 200, contentType: "image/png", body: PNG_1x1 }),
  );
  // USGS (sismos) → colección vacía.
  await page.route(/earthquake\.usgs\.gov/, (r) =>
    json(r, { type: "FeatureCollection", features: [] }),
  );
  // Nominatim directo (fallback del cliente) → vacío.
  await page.route(/nominatim\.openstreetmap\.org/, (r) => json(r, {}));
  // Supabase REST/RPC → lecturas vacías (NUNCA producción).
  await page.route(/\/\/[^/]*\.supabase\.co\/rest\//, (r) =>
    json(r, [], 200, { "content-range": "0-0/0" }),
  );
  // Supabase storage/auth/functions → respuesta inocua.
  await page.route(/\/\/[^/]*\.supabase\.co\/(storage|auth|functions)\//, (r) => json(r, {}));
  // Realtime (websocket) → interceptado y NO conectado al servidor real.
  await page.routeWebSocket(/supabase\.co\/realtime/, (_ws: WebSocketRoute) => {
    /* sin connectToServer() → bloqueado */
  });
}

/** Mockea el proxy de geocoding same-origin (/api/public/geocode). */
export async function stubGeocode(page: Page): Promise<void> {
  await page.route(/\/api\/public\/geocode/, (r) =>
    json(r, {
      display_name: "Av. Bolívar, Catedral, Caracas, Distrito Capital, Venezuela",
      address: { road: "Av. Bolívar", suburb: "Catedral", city: "Caracas", state: "Distrito Capital" },
    }),
  );
}

/** Intercepta el POST de reportes y captura los payloads enviados. */
export function captureReportSubmits(page: Page): Array<Record<string, unknown>> {
  const submissions: Array<Record<string, unknown>> = [];
  void page.route(/\/api\/public\/reports/, async (route) => {
    if (route.request().method() === "POST") {
      submissions.push(JSON.parse(route.request().postData() ?? "{}"));
      return json(route, { id: "r-test-1" }, 201);
    }
    return route.fallback();
  });
  return submissions;
}
