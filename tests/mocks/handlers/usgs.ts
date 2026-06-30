// ── MSW: USGS earthquakes (FeatureCollection) ──────────────────────────────
// Usado por la web (mapa). Default Fase 0: colección vacía.
import { http, HttpResponse } from "msw";

export const usgsHandlers = [
  http.get("https://earthquake.usgs.gov/fdsnws/event/1/query", () =>
    HttpResponse.json({ type: "FeatureCollection", features: [] }),
  ),
];
