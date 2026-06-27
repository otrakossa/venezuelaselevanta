// ── Fase 0: spec trivial para validar que Playwright parsea el config ──────
// La cobertura real de la web llega en la Fase 3. Este spec solo confirma que
// el harness de Playwright está bien cableado (se valida con `--list`).
import { test, expect } from "@playwright/test";

test("la home responde", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Venezuela Se Levanta|VSL/i);
});
