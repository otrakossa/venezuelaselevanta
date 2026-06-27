// ── Fase 0: smoke del harness ──────────────────────────────────────────────
// Prueba de una sola vez que: (a) el env de test está poblado antes del
// module-load, (b) el alias `@/` resuelve un módulo del núcleo del bot, y
// (c) MSW intercepta el fetch saliente (Nominatim) sin red real.
import { describe, it, expect } from "vitest";
import { geocodeText } from "@/bot/core/geocode";

describe("harness smoke (Fase 0)", () => {
  it("puebla el env de test antes del module-load", () => {
    expect(process.env.SUPABASE_URL).toBe("http://127.0.0.1:54321");
    expect(process.env.GEMINI_API_KEY).toBeTruthy(); // no vacío → camino con Gemini
  });

  it("resuelve el alias @/ e intercepta fetch con MSW (Nominatim)", async () => {
    const r = await geocodeText("Caracas");
    expect(r).toEqual({ lat: 10.5, lng: -66.9 });
  });
});
