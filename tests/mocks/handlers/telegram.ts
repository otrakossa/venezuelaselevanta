// ── MSW: Telegram Bot API ──────────────────────────────────────────────────
// El adaptador (src/channels/telegram/adapter.ts) llama a
// https://api.telegram.org/bot<token>/<method> (sendMessage, getFile, …).
// Default Fase 0: { ok: true }. La Fase 2 asertará los sendMessage salientes.
import { http, HttpResponse } from "msw";

export const telegramHandlers = [
  http.post("https://api.telegram.org/bot:token/:method", () =>
    HttpResponse.json({ ok: true, result: {} }),
  ),
  http.get("https://api.telegram.org/bot:token/:method", () =>
    HttpResponse.json({ ok: true, result: {} }),
  ),
];
