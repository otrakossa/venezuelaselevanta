// ── MSW: Nominatim (geocoding OpenStreetMap) ───────────────────────────────
// URL fija (src/bot/core/geocode.ts). Default Fase 0: centro de Caracas.
// Nominatim devuelve lat/lon como STRINGS (geocodeText hace parseFloat).
import { http, HttpResponse } from "msw";

export const nominatimHandlers = [
  http.get("https://nominatim.openstreetmap.org/search", () =>
    HttpResponse.json([{ lat: "10.5", lon: "-66.9" }]),
  ),
];
