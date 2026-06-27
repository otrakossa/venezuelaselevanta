// ── Config de Playwright para los E2E de la web (Fase 3) ───────────────────
// La app es SSR (TanStack Start + nitro node-server). Se sirve el build de
// producción (`.output/server/index.mjs`) para máxima fidelidad. Las llamadas
// externas (Supabase, Nominatim, USGS, Storage) se interceptan con page.route()
// dentro de cada spec — ver e2e/support/network.ts (Fase 3).
//
// Nota Fase 0: el config y un spec trivial existen; la ejecución real con
// navegadores + build se valida en la Fase 3 (`bunx playwright install`).
import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Sirve el build de prod. Requiere `bun run build` previo (lo encadena el CI).
    command: `node .output/server/index.mjs`,
    url: baseURL,
    // Env FALSO para que el server arranque sin tocar prod. Da igual: el
    // navegador intercepta toda la red (ver e2e/support/network.ts), así que
    // las rutas API ni siquiera se invocan.
    env: {
      PORT: String(PORT),
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
