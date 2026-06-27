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

export interface TgSendMessage {
  chat_id: number;
  text: string;
  parse_mode?: string;
  reply_markup?: unknown;
}

/** Captura los sendMessage salientes a la Bot API (ignora answerCallbackQuery,
 *  getFile, etc.). Para tests del webhook (Fase 2). */
export function recordTelegram() {
  const sendMessages: TgSendMessage[] = [];
  const handler = http.post(
    "https://api.telegram.org/bot:token/:method",
    async ({ request, params }) => {
      if (String(params.method) === "sendMessage") {
        sendMessages.push((await request.json().catch(() => ({}))) as TgSendMessage);
      }
      return HttpResponse.json({ ok: true, result: {} });
    },
  );
  return { sendMessages, handler };
}
