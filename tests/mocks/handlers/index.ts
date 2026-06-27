// ── Agregador de handlers MSW por servicio ─────────────────────────────────
// Cada test puede sobreescribir handlers puntuales con `server.use(...)`.
import { geminiHandlers } from "./gemini";
import { supabaseHandlers } from "./supabase";
import { nominatimHandlers } from "./nominatim";
import { usgsHandlers } from "./usgs";
import { telegramHandlers } from "./telegram";

export const handlers = [
  ...geminiHandlers,
  ...supabaseHandlers,
  ...nominatimHandlers,
  ...usgsHandlers,
  ...telegramHandlers,
];
