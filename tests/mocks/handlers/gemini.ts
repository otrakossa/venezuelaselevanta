// ── MSW: Gemini 2.5 Flash (generateContent) ────────────────────────────────
// La URL es fija (src/bot/core/nlp.ts); MSW ignora el ?key=… del query.
// `geminiJsonResponse(obj)` envuelve un objeto en la forma candidates→text que
// `geminiJSON()` parsea, para que los tests devuelvan intención/extracción.
import { http, HttpResponse } from "msw";

export const GEMINI_URL =
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

// ── Overrides para tests (server.use(...)) ─────────────────────────────────
// Gemini se usa por dos vías sobre la MISMA URL: geminiJSON (extracción/intención,
// sin system_instruction) y geminiConverse (chat, CON system_instruction). Este
// handler responde a cada una según el body, para tests del flujo de chat.
export function geminiSplitHandler(opts: { json?: unknown; text?: string }) {
  return http.post(GEMINI_URL, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      system_instruction?: unknown;
    };
    if (body.system_instruction)
      return geminiTextResponse(opts.text ?? "Estoy aquí para ayudarte 🇻🇪");
    return geminiJsonResponse(opts.json ?? { intent: "unknown" });
  });
}

/** Gemini devuelve este JSON (intención o extracción de campos). */
export const geminiJsonHandler = (obj: unknown) =>
  http.post(GEMINI_URL, () => geminiJsonResponse(obj));

/** Gemini responde HTTP de error → geminiJSON cae en catch → null (fallback). */
export const geminiErrorHandler = (status = 500) =>
  http.post(GEMINI_URL, () => new HttpResponse(null, { status }));

/** Gemini falla a nivel de red → fetch rechaza → null (fallback). */
export const geminiNetworkErrorHandler = () =>
  http.post(GEMINI_URL, () => HttpResponse.error());
