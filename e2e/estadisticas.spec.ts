// ── Fase 3 (2/2): /estadisticas — export GeoJSON + CSV-HXL ─────────────────
import { test, expect, type Route } from "@playwright/test";
import { stubExternal } from "./support/network";

const GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-66.9, 10.5] },
      properties: { id: "r1", title: "Edificio colapsado", category: "rescue" },
    },
  ],
};

// CSV con tags HXL (humanitarian exchange language) en la 2ª fila.
const CSV_HXL =
  "id,title,category\n#id,#report+title,#report+type\nr1,Edificio colapsado,rescue\n";

test.beforeEach(async ({ page }) => {
  await stubExternal(page);
  await page.route(/\/api\/reports\.geojson/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/geo+json",
      headers: { "content-disposition": "attachment; filename=reports.geojson" },
      body: JSON.stringify(GEOJSON),
    }),
  );
  await page.route(/\/api\/reports\.csv/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "text/csv",
      headers: { "content-disposition": "attachment; filename=reports.csv" },
      body: CSV_HXL,
    }),
  );
});

test("ofrece export GeoJSON y CSV-HXL desde el panel", async ({ page }) => {
  await page.goto("/estadisticas");
  await expect(page.getByRole("heading", { name: "Centro de Control" })).toBeVisible();

  // Botones de descarga (los únicos con atributo `download`).
  const geojsonLink = page.locator('a[download][href="/api/reports.geojson"]');
  const csvLink = page.locator('a[download][href="/api/reports.csv"]');
  await expect(geojsonLink).toBeVisible();
  await expect(csvLink).toBeVisible();

  // El contenido de cada endpoint (fetch desde la página → pasa por la misma
  // interceptación que el navegador usaría al descargar).
  const geojsonBody = await page.evaluate(() => fetch("/api/reports.geojson").then((r) => r.text()));
  expect(JSON.parse(geojsonBody).type).toBe("FeatureCollection");

  const csvBody = await page.evaluate(() => fetch("/api/reports.csv").then((r) => r.text()));
  expect(csvBody).toContain("#report+title"); // tag HXL
  expect(csvBody).toContain("Edificio colapsado");
});
