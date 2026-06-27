// ── Webhook de Telegram: wrapper delgado (verify → parse → engine → send) ──
// Toda la lógica vive en el núcleo agnóstico (@/bot/core) y el adaptador de
// canal (@/channels/telegram). Añadir un canal = nuevo ChannelAdapter + ruta
// delgada como esta, con CERO cambios en @/bot/core/flows.
import { createFileRoute } from "@tanstack/react-router";
import * as telegram from "@/channels/telegram/adapter";
import { handle } from "@/bot/core/engine";
import * as sessions from "@/bot/core/session";
import type { EngineCtx } from "@/bot/core/types";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!telegram.isConfigured()) return new Response("Bot not configured", { status: 500 });
        if (!telegram.verify(request)) return new Response("Unauthorized", { status: 401 });
        try {
          const incoming = await telegram.parseIncoming(await request.json());
          if (incoming && !(await telegram.tryHandleTelegramAdmin(incoming))) {
            const key = `${incoming.channel}:${incoming.externalUserId}`;
            const ctx: EngineCtx = {
              channel: incoming.channel,
              externalUserId: incoming.externalUserId,
              fromName: incoming.fromName,
              capabilities: telegram.capabilities,
              send: (text, markup) => telegram.send(incoming.externalUserId, { text, markup }),
              storeMedia: (m) => telegram.storeMedia(m),
              getSession: () => sessions.getOrLoad(key),
              setSession: (state, draft, history, userName) =>
                sessions.set(key, state, draft, history, userName),
              clearSession: () => sessions.clear(key),
            };
            await handle(incoming, ctx);
          }
        } catch (err) {
          console.error("[telegram]", err);
        }
        return Response.json({ ok: true });
      },
      GET: async () => Response.json({ ok: true, bot: "@VenezuelaSeLevantabot" }),
    },
  },
});
