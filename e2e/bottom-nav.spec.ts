// ── Guard de layout móvil: BottomNav + FAB visibles dentro del viewport ─────
// Regresión de https (iOS Safari): el contenedor del mapa usaba `100vh` (viewport
// grande) y empujaba la `BottomNav` (fixed bottom-0) y su FAB detrás de la barra
// del navegador. El fix usa `dvh`. Chromium headless NO emula la barra dinámica
// de iOS (ahí dvh==vh), así que este test NO reproduce el bug específico de iOS:
// es un guard determinista contra que la nav/FAB queden fuera del viewport.
import { test, expect } from "@playwright/test";
import { stubExternal } from "./support/network";

const VIEWPORT = { width: 390, height: 844 }; // iPhone 12/13/14

test.use({ viewport: VIEWPORT, isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await stubExternal(page);
});

test("la BottomNav móvil queda visible y dentro del viewport en el home", async ({ page }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(nav).toBeVisible();

  // La barra completa cae dentro del área visible (no detrás del borde inferior).
  const box = await nav.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(VIEWPORT.height + 1); // +1 por redondeo
});

test("el FAB 'Reportar' es visible y tappable en móvil", async ({ page }) => {
  await page.goto("/");

  const fab = page.getByRole("link", { name: "Reportar incidente" });
  await expect(fab).toBeVisible();

  const box = await fab.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(VIEWPORT.height + 1);

  // Navega a /reportar al tocarlo.
  await fab.click();
  await expect(page).toHaveURL(/\/reportar/);
});
