// ── Fase 2: webhook de Telegram (integración transporte ↔ núcleo) ──────────
// POST de Updates de Telegram falsos a la ruta REAL (invocada in-process, sin
// servidor) con el header x-telegram-bot-api-secret-token válido. Se asertan
// los sendMessage salientes (Bot API, vía MSW), las escrituras a Supabase y la
// persistencia de sesión en channel_sessions. La sesión usa el SessionStore
// REAL (memoria + persistencia), por eso cada test usa un chatId distinto.
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { Route } from "@/routes/api/public/telegram/webhook";
import { server } from "../setup/msw.server";
import { recordTelegram } from "../mocks/handlers/telegram";
import { recordInserts } from "../mocks/handlers/supabase";

const SECRET = createHash("sha256").update("test-bot-token").digest("hex").slice(0, 64);

// TanStack Start puede entregar el handler como función o como { handler }.
type HandlerDef = ((ctx: { request: Request }) => Promise<Response>) | { handler: (ctx: { request: Request }) => Promise<Response> };
function resolve(def: HandlerDef) {
  return typeof def === "function" ? def : def.handler;
}
const handlers = (Route as unknown as { options: { server: { handlers: { POST: HandlerDef; GET: HandlerDef } } } }).options.server.handlers;
const POST = resolve(handlers.POST);
const GET = resolve(handlers.GET);

const URL = "https://venezuelaselevanta.info/api/public/telegram/webhook";

function req(update: unknown, secret = SECRET) {
  return new Request(URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
    body: JSON.stringify(update),
  });
}
const post = (update: unknown, secret?: string) => POST({ request: req(update, secret) });

// Delay pequeño para drenar escrituras fire-and-forget (registerUser, saveToDB).
const tick = () => new Promise((r) => setTimeout(r, 15));

// ── Builders de Update de Telegram ─────────────────────────────────────────
const message = (chatId: number, text: string) => ({
  update_id: 1,
  message: { message_id: 1, chat: { id: chatId }, from: { first_name: "Lucía" }, text },
});
const callback = (chatId: number, data: string) => ({
  update_id: 2,
  callback_query: { id: "cb1", data, message: { chat: { id: chatId } } },
});
const locationUpdate = (chatId: number, lat: number, lng: number) => ({
  update_id: 3,
  message: {
    message_id: 3,
    chat: { id: chatId },
    from: { first_name: "Lucía" },
    location: { latitude: lat, longitude: lng },
  },
});

describe("webhook de Telegram", () => {
  it("rechaza con 401 si el secret es inválido", async () => {
    const res = await post(message(1001, "/estado"), "secret-malo");
    expect(res.status).toBe(401);
  });

  it("GET responde el health check", async () => {
    const res = await GET({ request: new Request(URL) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("un comando produce respuesta saliente por la Bot API", async () => {
    const tg = recordTelegram();
    server.use(tg.handler);

    const res = await post(message(1002, "/estado"));
    expect(res.status).toBe(200);
    expect(tg.sendMessages).toHaveLength(1);
    expect(tg.sendMessages[0].chat_id).toBe(1002);
    expect(tg.sendMessages[0].parse_mode).toBe("HTML");
    expect(tg.sendMessages[0].text).toContain("Estado del mapa");
  });

  it("persiste la sesión en channel_sessions tras iniciar un flujo", async () => {
    const ins = recordInserts();
    server.use(ins.handler);

    await post(message(1003, "/reportar"));
    await tick(); // saveToDB es fire-and-forget

    const sessionWrite = ins.calls.find((c) => c.table === "channel_sessions");
    expect(sessionWrite).toBeTruthy();
    expect(sessionWrite!.body).toMatchObject({ session_key: "telegram:1003" });
    expect((sessionWrite!.body.data as { state: string }).state).toBe("awaiting_category");
  });

  it("ejecuta una secuencia completa de usuario y publica el reporte", async () => {
    const tg = recordTelegram();
    const ins = recordInserts();
    server.use(tg.handler, ins.handler);
    const C = 1004;

    await post(message(C, "/reportar")); // 1/6
    await post(callback(C, "cat:medical")); // 2/6
    await post(message(C, "Herido grave")); // 3/6 (título corto, sin Gemini)
    await post(message(C, "Edificio en Av. Bolívar")); // 4/6
    await post(callback(C, "urg:critical")); // 5/6
    await post(message(C, "✅ Listo, continuar")); // 6/6
    await post(locationUpdate(C, 10.5, -66.9)); // confirmación
    const res = await post(message(C, "✅ Confirmar y publicar")); // publica

    expect(res.status).toBe(200);
    const reportWrite = ins.calls.find((c) => c.table === "reports");
    expect(reportWrite).toBeTruthy();
    expect(reportWrite!.body).toMatchObject({
      category: "medical",
      urgency: "critical",
      title: "Herido grave",
      status: "active",
      lat: 10.5,
      lng: -66.9,
    });
    expect(tg.sendMessages.at(-1)!.text).toContain("Reporte publicado");
    expect(tg.sendMessages.length).toBeGreaterThanOrEqual(8);
  });
});
