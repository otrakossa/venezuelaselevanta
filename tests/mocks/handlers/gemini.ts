// ── MSW: Gemini 2.5 Flash (generateContent) ────────────────────────────────
// La URL es fija (src/bot/core/nlp.ts); MSW ignora el ?key=… del query.
// `geminiJsonResponse(obj)` envuelve un objeto en la forma candidates→text que
// `geminiJSON()` parsea, para que los tests devuelvan intención/extracción.
import { http, HttpResponse } from "msw";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/** Envuelve `text` en la forma de respuesta de Gemini (candidates→parts→text). */
function wrap(text: string) {
  return HttpResponse.json({
    candidates: [{ content: { parts: [{ text }] } }],
  });
}

/** Respuesta válida de Gemini cuyo texto es el JSON `obj` (intent/extract). */
export function geminiJsonResponse(obj: unknown) {
  return wrap(JSON.stringify(obj));
}

/** Respuesta de chat libre (geminiConverse) con `text` como contenido. */
export function geminiTextResponse(text: string) {
  return wrap(text);
}

// Default Fase 0: intención desconocida (no enruta a ningún flujo por error).
export const geminiHandlers = [
  http.post(GEMINI_URL, () => geminiJsonResponse({ intent: "unknown" })),
];
