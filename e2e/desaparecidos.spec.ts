// ── Fase 3 (2/2): /desaparecidos — coincidencias suggest_patient_matches ────
import { test, expect, type Route } from "@playwright/test";
import { stubExternal } from "./support/network";

const json = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

test.beforeEach(async ({ page }) => {
  await stubExternal(page);
});

test("muestra coincidencias en hospitales para una persona desaparecida", async ({ page }) => {
  const person = {
    id: "m1", name: "Juan Pérez", age: 30, status: "missing",
    last_seen_location: "Petare, Caracas", last_seen_lat: 10.5, last_seen_lng: -66.9,
    photo_url: null, contact_name: null, contact_phone: null, contact_email: null,
    description: "Camisa azul, 1.70m", report_date: new Date().toISOString(),
    matched_patient_id: null, state: null, municipality: null, parish: null,
  };
  const match = {
    patient_id: "p1", patient_name: "Juan Pérez", patient_age: 31,
    center_name: "Hospital JM de los Ríos", status: "admitted", score: 0.92,
  };

  // useMissing() lista desde Supabase; devolvemos un único registro.
  await page.route(/\/rest\/v1\/missing_persons/, (route) => {
    if (route.request().method() === "GET") return json(route, [person]);
    return route.fallback();
  });
  // El RPC de matching por nombre+edad+sector.
  await page.route(/\/rest\/v1\/rpc\/suggest_patient_matches/, (route) => json(route, [match]));

  await page.goto("/desaparecidos");

  // La tarjeta de la persona aparece.
  await expect(page.getByRole("heading", { name: "Juan Pérez" })).toBeVisible();

  // Desplegar coincidencias → corre la RPC y muestra el candidato.
  await page.getByRole("button", { name: /Buscar coincidencias en hospitales/ }).click();
  await expect(page.getByText("Hospital JM de los Ríos")).toBeVisible();
  await expect(page.getByText("92%")).toBeVisible();
  await expect(page.getByText("31 años")).toBeVisible();
});
