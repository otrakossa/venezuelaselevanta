// ── Config de Vitest ───────────────────────────────────────────────────────
// Dos proyectos:
//   • "core" — núcleo del bot + webhook. Node + MSW (intercepta todo el I/O).
//     `test.env` puebla process.env ANTES del module-load (data.ts/nlp.ts leen
//     env al importar). Valores FALSOS; el I/O real lo corta MSW.
//   • "db"   — RPC de matching contra Supabase LOCAL real (Fase 4). Sin MSW;
//     se conecta como superusuario al Postgres local (puerto 54322).
//
// `bun run test` corre SOLO "core" (no necesita Docker) → seguro en CI y local.
// `bun run test:db` corre SOLO "db" (requiere `supabase start`).
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
            BOT_NEEDS_FLOW: "1",
            BOT_HELP_FLOW: "1",
          },
        },
      },
      {
        resolve: { alias },
        test: {
          name: "db",
          environment: "node",
          include: ["tests/db/**/*.test.ts"],
          // Conexión directa como superusuario al Postgres local de Supabase.
          // Puerto 54322 y credenciales por defecto del stack local.
          env: {
            DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
          },
        },
      },
    ],
  },
});
