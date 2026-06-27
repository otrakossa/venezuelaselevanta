// ── Fase 3: smoke — la home carga (con la red externa cortada) ─────────────
import { test, expect } from "@playwright/test";
import { stubExternal } from "./support/network";

test.beforeEach(async ({ page }) => {
  await stubExternal(page);
});

test("la home responde", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Venezuela Se Levanta|VSL/i);
});
