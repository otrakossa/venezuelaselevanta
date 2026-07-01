// ── Config de Vitest ───────────────────────────────────────────────────────
// Proyecto "core" — núcleo del bot + webhook. Node + MSW (intercepta todo el
// I/O). `test.env` puebla process.env ANTES del module-load (data.ts/nlp.ts
// leen env al importar). Valores FALSOS; el I/O real lo corta MSW.
//
// `bun run test` corre el núcleo (no necesita Docker) → seguro en CI y local.
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "core",
          environment: "node",
          setupFiles: ["./tests/setup/vitest.setup.ts"],
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/db/**", "node_modules/**", ".output/**", "dist/**"],
          env: {
            SUPABASE_URL: "http://127.0.0.1:54321",
            SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
            SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
            GEMINI_API_KEY: "test-gemini-key",
            TELEGRAM_BOT_TOKEN: "test-bot-token",
          },
        },
      },
    ],
  },
});
