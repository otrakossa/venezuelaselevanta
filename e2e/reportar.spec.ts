// ── Fase 3: E2E del flujo /reportar (web) ──────────────────────────────────
// Sirve el build SSR real. La ubicación se fija de forma determinista con el
// override de geolocalización de Playwright + "Usar mi ubicación" (evita el
// click sobre el mapa Leaflet, que sería frágil). Toda la red externa se corta.
import { test, expect } from "@playwright/test";
import { stubExternal, stubGeocode, captureReportSubmits } from "./support/network";

// Caracas — coincide con el centro venezolano y la dirección mockeada.
test.use({
  geolocation: { latitude: 10.5, longitude: -66.9 },
  permissions: ["geolocation"],
});

test.beforeEach(async ({ page }) => {
  await stubExternal(page);
  await stubGeocode(page);
});

test("publica un reporte recorriendo los 3 pasos con cascada DIVIPOL", async ({ page }) => {
  const submits = captureReportSubmits(page);

  await page.goto("/reportar");

  // ── Paso 1: Qué pasa ──
  await expect(page.getByText("Paso 1 de 3")).toBeVisible();
  await page.getByRole("button", { name: "Personas atrapadas / Rescate" }).click();
  await page.getByRole("button", { name: "Crítico" }).click();
  await page.getByPlaceholder("Ej. Edificio colapsado en Av. Bolívar").fill("Edificio colapsado en El Centro");
  await page.getByPlaceholder(/Detalla lo que ocurre/).fill("Varias personas atrapadas en el sótano");
  await page.getByRole("button", { name: "Continuar" }).click();

  // ── Paso 2: Dónde ──
  await expect(page.getByText("Paso 2 de 3")).toBeVisible();
  await page.getByRole("button", { name: "Usar mi ubicación" }).click();
  await expect(page.getByText("10.50000, -66.90000")).toBeVisible();

  // Cascada DIVIPOL: estado → municipio → parroquia.
  const selects = page.getByRole("combobox");
  await selects.first().selectOption("Distrito Capital");
  await selects.nth(1).selectOption("Libertador");
  await page.getByPlaceholder("Ej: Catedral").fill("Catedral");
  await page.getByRole("button", { name: "Continuar" }).click();

  // ── Paso 3: Evidencia y envío ──
  await expect(page.getByText("Paso 3 de 3")).toBeVisible();
  await page.getByPlaceholder("Anónimo").fill("María");
  // El resumen refleja lo capturado.
  await expect(page.getByText("Edificio colapsado en El Centro")).toBeVisible();
  await expect(page.getByText("Distrito Capital · Libertador · Catedral")).toBeVisible();

  await page.getByRole("button", { name: "Enviar reporte" }).click();

  // Éxito: toast + reset al paso 1.
  await expect(page.getByText(/Reporte enviado/)).toBeVisible();
  await expect(page.getByText("Paso 1 de 3")).toBeVisible();

  // El payload enviado al endpoint es el esperado.
  expect(submits).toHaveLength(1);
  expect(submits[0]).toMatchObject({
    title: "Edificio colapsado en El Centro",
    category: "rescue",
    urgency: "critical",
    status: "active",
    state: "Distrito Capital",
    municipality: "Libertador",
    parish: "Catedral",
    lat: 10.5,
    lng: -66.9,
    reporter_name: "María",
  });
});
