// ── Fase 3 (2/2): /ofertas — matching por cercanía + fallback de vocabulario ─
import { test, expect, type Route } from "@playwright/test";
import { stubExternal } from "./support/network";

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

test.beforeEach(async ({ page }) => {
  await stubExternal(page);
});

test("sugiere necesidades por cercanía y vincula la oferta (open→partial, available→matched)", async ({ page }) => {
  const offer = {
    id: "o1", need_id: null, category: "water", title: "Tengo agua potable",
    description: null, quantity: "50 bidones", contact_name: "Pedro", contact_phone: "0412-1112233",
    contact_info: null, location_desc: null, status: "available",
    created_at: new Date().toISOString(),
    state: "Distrito Capital", municipality: "Libertador", parish: "Catedral", lat: 10.5, lng: -66.9,
  };
  const suggestion = {
    need_id: "n1", title: "Agua para Hospital JM", category: "water", urgency: "critical",
    status: "open", center_name: "Hospital JM de los Ríos", tier: 0, distance_km: 2,
  };

  const offerPatches: Array<Record<string, unknown>> = [];
  const needPatches: Array<Record<string, unknown>> = [];

  await page.route(/\/rest\/v1\/offers\?/, (route) => {
    const method = route.request().method();
    if (method === "GET") return json(route, [offer]);
    if (method === "PATCH") {
      offerPatches.push(JSON.parse(route.request().postData() ?? "{}"));
      return route.fulfill({ status: 204 });
    }
    return route.fallback();
  });
  await page.route(/\/rest\/v1\/needs\?/, (route) => {
    const method = route.request().method();
    if (method === "GET") return json(route, []); // sin lista manual; usamos la sugerencia
    if (method === "PATCH") {
      needPatches.push(JSON.parse(route.request().postData() ?? "{}"));
      return route.fulfill({ status: 204 });
    }
    return route.fallback();
  });
  await page.route(/\/rest\/v1\/rpc\/suggest_needs_for_offer/, (route) => json(route, [suggestion]));

  await page.goto("/ofertas");

  // La oferta aparece como "Disponible" y se puede vincular.
  await expect(page.getByText("Tengo agua potable")).toBeVisible();
  await page.getByRole("button", { name: "Vincular" }).click();

  // El modal muestra la sugerencia por cercanía (tier 0 → "Misma parroquia").
  await expect(page.getByText("Sugeridas por cercanía")).toBeVisible();
  const suggestionBtn = page.getByRole("button", { name: /Agua para Hospital JM/ });
  await expect(suggestionBtn).toBeVisible();
  await expect(page.getByText("Misma parroquia")).toBeVisible();

  await suggestionBtn.click();

  // Vinculación: offer→matched y need open→partial.
  await expect(page.getByText("Oferta vinculada")).toBeVisible();
  expect(offerPatches).toHaveLength(1);
  expect(offerPatches[0]).toMatchObject({ need_id: "n1", status: "matched" });
  expect(needPatches).toHaveLength(1);
  expect(needPatches[0]).toMatchObject({ status: "partial" });
});

test("una categoría/estado fuera de vocabulario NO tumba la página (fallback catMeta)", async ({ page }) => {
  const weird = {
    id: "o2", need_id: null, category: "banana", title: "Oferta rara",
    description: null, quantity: null, contact_name: "Ana", contact_phone: null,
    contact_info: null, location_desc: null, status: "estado_invalido",
    created_at: new Date().toISOString(),
    state: null, municipality: null, parish: null, lat: null, lng: null,
  };
  await page.route(/\/rest\/v1\/offers\?/, (route) => json(route, [weird]));

  await page.goto("/ofertas");

  // La página renderiza con el fallback "Otro" y trata el estado raro como "Disponible".
  await expect(page.getByRole("heading", { name: "Ofrecimiento de ayuda" })).toBeVisible();
  await expect(page.getByText("Oferta rara")).toBeVisible();
  // exact: para no chocar con el chip de filtro "📦 Otro" ni el tab "Disponibles".
  await expect(page.getByText("Otro", { exact: true })).toBeVisible(); // CATEGORY_FALLBACK.label
  await expect(page.getByText("Disponible", { exact: true })).toBeVisible(); // normalizeStatus fallback
});
