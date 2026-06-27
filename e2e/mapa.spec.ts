// ── Fase 3 (2/2): home/mapa — filtros (estado en la URL, shareable) ────────
// Los filtros del mapa viven en los search params de la URL (cat/urg/trust),
// así que se asertan de forma robusta sin depender del canvas de Leaflet.
import { test, expect, type Route } from "@playwright/test";
import { stubExternal } from "./support/network";

const reports = [
  {
    id: "r1", title: "Edificio colapsado", category: "medical", urgency: "critical",
    status: "active", lat: 10.5, lng: -66.9, address: "Caracas", verified: true,
    confirm_count: 5, dispute_count: 0, created_at: new Date().toISOString(),
  },
  {
    id: "r2", title: "Refugio disponible", category: "shelter", urgency: "low",
    status: "active", lat: 10.4, lng: -66.8, address: "Caracas", verified: false,
    confirm_count: 0, dispute_count: 0, created_at: new Date().toISOString(),
  },
];

test.beforeEach(async ({ page }) => {
  await stubExternal(page);
  await page.route(/\/rest\/v1\/reports/, (route: Route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reports) });
    return route.fallback();
  });
});

test("los filtros del mapa se reflejan en la URL (compartibles)", async ({ page }) => {
  await page.goto("/");

  // La barra de chips de categoría renderiza.
  await expect(page.getByRole("button", { name: "Todos" }).first()).toBeVisible();

  // Filtro de confianza → ?trust=verified
  await page.getByRole("button", { name: "Verificados" }).click();
  await expect(page).toHaveURL(/trust=verified/);

  // Chip de categoría (🟠 Heridos) → ?cat=medical
  await page.getByRole("button", { name: /Heridos/ }).click();
  await expect(page).toHaveURL(/cat=medical/);
});

test("abrir ?report=<id> muestra el detalle del reporte", async ({ page }) => {
  await page.goto("/?report=r1");
  // El panel de detalle muestra el título del reporte enfocado.
  await expect(page.getByText("Edificio colapsado")).toBeVisible();
});
