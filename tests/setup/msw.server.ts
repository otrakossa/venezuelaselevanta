// ── Servidor MSW (Node) para los tests de núcleo/integración ───────────────
// Intercepta todo el I/O del bot a nivel de red (Gemini, Supabase, Nominatim,
// USGS, Telegram). NO se toca código de producción: el seam es `fetch` global.
import { setupServer } from "msw/node";
import { handlers } from "../mocks/handlers";

export const server = setupServer(...handlers);
