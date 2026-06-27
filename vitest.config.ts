// ── Config de Vitest para los tests de núcleo/integración del bot ──────────
// NO importa el config de Vite de la app a propósito: el plugin de TanStack
// Start + nitro no aplican en modo test y solo añadirían fragilidad. Solo
// replicamos el alias `@/` (igual que tsconfig.json) y corremos en Node.
//
// `test.env` puebla process.env ANTES de cargar cualquier módulo, lo cual es
// imprescindible porque src/bot/core/{data,nlp}.ts leen el env en module-load
// (`const SUPA_URL = process.env.SUPABASE_URL!`). Son valores FALSOS: el I/O
// real lo intercepta MSW (ver tests/setup). GEMINI_API_KEY va NO vacío para
// que el camino "con Gemini" se ejercite (geminiJSON corta si está vacío).
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    include: ["tests/**/*.test.ts"],
    // tests/db/** corre contra Supabase local (Fase 4): otro proyecto, sin MSW.
    exclude: ["tests/db/**", "node_modules/**", ".output/**", "dist/**"],
    env: {
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
      GEMINI_API_KEY: "test-gemini-key",
      TELEGRAM_BOT_TOKEN: "test-bot-token",
      // Flujos gated activados para poder testearlos (Fase 1).
      BOT_NEEDS_FLOW: "1",
      BOT_HELP_FLOW: "1",
    },
  },
});
