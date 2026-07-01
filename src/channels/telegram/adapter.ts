// ── Adaptador de canal: Telegram ──────────────────────────────────────────
// Único módulo con detalles específicos de Telegram (verify SHA-256, parsing
// de updates, envío, subida de media a Storage, registro de usuarios y
// broadcast admin). Traduce hacia/desde los tipos agnósticos de @/channels/types.
import { createHash } from "crypto";
import type {
  Capabilities,
  IncomingMedia,
  IncomingMessage,
  OutgoingMessage,
  ReplyMarkup,
  StoredMedia,
} from "@/channels/types";

const BOT = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TG_API = `https://api.telegram.org/bot${BOT}`;
const SUPA_URL = process.env.SUPABASE_URL!;
const SUPA_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ADMIN_IDS = new Set(
  (process.env.TELEGRAM_ADMIN_IDS ?? "")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0),
);

export const channel = "telegram";
export const capabilities: Capabilities = {
  inlineButtons: true,
  replyKeyboard: true,
  requestLocation: true,
  media: true,
};

// ── Telegram API ──────────────────────────────────────────────────────────
async function tg(method: string, body: unknown): Promise<Response> {
  const res = await fetch(`${TG_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error("[tg]", method, res.status, await res.text().catch(() => ""));
  return res;
}

// Traduce el markup abstracto al formato nativo de Telegram.
function toMarkup(m?: ReplyMarkup): Record<string, unknown> {
  if (!m) return {};
  if (m.kind === "inline")
    return {
      reply_markup: {
        inline_keyboard: m.rows.map((r) => r.map((b) => ({ text: b.text, callback_data: b.data }))),
      },
    };
  if (m.kind === "keyboard")
    return {
      reply_markup: {
        keyboard: m.rows.map((r) =>
          r.map((b) => (b.requestLocation ? { text: b.text, request_location: true } : { text: b.text })),
        ),
        resize_keyboard: true,
        one_time_keyboard: m.oneTime ?? false,
      },
    };
  if (m.kind === "remove") return { reply_markup: { remove_keyboard: true } };
  return {};
}

function sendMessage(chatId: number, text: string, markup?: ReplyMarkup): Promise<Response> {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...toMarkup(markup) });
}

// ── Subida de archivos (Telegram CDN → Supabase Storage) ──────────────────
async function downloadAndStore(fileId: string, ext: string, ct: string): Promise<string | null> {
  if (!SUPA_SVC) return null;
  const infoRes = await tg("getFile", { file_id: fileId });
  if (!infoRes.ok) return null;
  const info = (await infoRes.json()) as { result?: { file_path?: string } };
  const fp = info.result?.file_path;
  if (!fp) return null;
  const dl = await fetch(`https://api.telegram.org/file/bot${BOT}/${fp}`);
  if (!dl.ok) return null;
  const key = `telegram/${crypto.randomUUID()}.${ext}`;
  const up = await fetch(`${SUPA_URL}/storage/v1/object/report-media/${key}`, {
    method: "POST",
    headers: { apikey: SUPA_SVC, Authorization: `Bearer ${SUPA_SVC}`, "Content-Type": ct },
    body: await dl.arrayBuffer(),
  });
  return up.ok ? `/api/public/media/${key}` : null;
}

async function uploadPhoto(
  sizes: { file_id: string; width?: number; height?: number }[],
): Promise<StoredMedia | null> {
  if (!sizes.length) return null;
  const sorted = [...sizes].sort(
    (a, b) => (a.width ?? 0) * (a.height ?? 0) - (b.width ?? 0) * (b.height ?? 0),
  );
  const url = await downloadAndStore(sorted[sorted.length - 1].file_id, "jpg", "image/jpeg");
  if (!url) return null;
  const thumb = sorted.length > 1 ? await downloadAndStore(sorted[0].file_id, "jpg", "image/jpeg") : url;
  return { url, thumb: thumb ?? url };
}

async function uploadVideo(video: {
  file_id: string;
  thumb?: { file_id: string };
  thumbnail?: { file_id: string };
}): Promise<StoredMedia | null> {
  const url = await downloadAndStore(video.file_id, "mp4", "video/mp4");
  if (!url) return null;
  const tid = video.thumbnail?.file_id ?? video.thumb?.file_id;
  const thumb = tid ? await downloadAndStore(tid, "jpg", "image/jpeg") : url;
  return { url, thumb: thumb ?? url };
}

// ── Registro de usuarios + broadcast (solo Telegram) ──────────────────────
function registerUser(chatId: number, firstName: string, username?: string): void {
  if (!SUPA_SVC) return;
  fetch(`${SUPA_URL}/rest/v1/bot_users`, {
    method: "POST",
    headers: {
      apikey: SUPA_SVC,
      Authorization: `Bearer ${SUPA_SVC}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      chat_id: chatId,
      first_name: firstName || null,
      username: username || null,
      last_seen: new Date().toISOString(),
    }),
  }).catch(() => {});
}

async function getAllBotUsers(): Promise<number[]> {
  if (!SUPA_SVC) return [];
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/bot_users?select=chat_id&limit=10000`, {
      headers: { apikey: SUPA_SVC, Authorization: `Bearer ${SUPA_SVC}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { chat_id: number }[];
    return data.map((r) => r.chat_id);
  } catch {
    return [];
  }
}

async function executeBroadcast(adminChatId: number, message: string): Promise<void> {
  const users = await getAllBotUsers();
  if (!users.length) {
    await sendMessage(adminChatId, "⚠️ No hay usuarios registrados aún.");
    return;
  }
  await sendMessage(adminChatId, `📡 Enviando a <b>${users.length}</b> usuarios…`);
  let sent = 0,
    failed = 0;
  for (let i = 0; i < users.length; i += 25) {
    const batch = users.slice(i, i + 25);
    const results = await Promise.allSettled(
      batch.map((id) => sendMessage(id, `📢 <b>ALERTA — Venezuela Se Levanta</b>\n\n${message}`)),
    );
    sent += results.filter((r) => r.status === "fulfilled").length;
    failed += results.filter((r) => r.status === "rejected").length;
    if (i + 25 < users.length) await new Promise((r) => setTimeout(r, 1100));
  }
  await sendMessage(adminChatId, `✅ Broadcast completado: <b>${sent}</b> enviados, <b>${failed}</b> fallaron.`);
}

// Comandos específicos de Telegram (/myid, /broadcast). Devuelve true si los
// consume; el motor agnóstico nunca los ve.
export async function tryHandleTelegramAdmin(incoming: IncomingMessage): Promise<boolean> {
  const text = incoming.text;
  const chatId = Number(incoming.externalUserId);
  if (text === "/myid") {
    await sendMessage(
      chatId,
      `Tu chat ID es: <code>${chatId}</code>\n\nAgrega este número a TELEGRAM_ADMIN_IDS en el .env para acceder al broadcast.`,
    );
    return true;
  }
  if (text.startsWith("/broadcast")) {
    if (!ADMIN_IDS.has(chatId)) {
      await sendMessage(chatId, "Comando no disponible.");
      return true;
    }
    const m = text.replace(/^\/broadcast\s*/i, "").trim();
    if (!m) {
      await sendMessage(chatId, "Escribe el mensaje: /broadcast <mensaje de emergencia>");
      return true;
    }
    executeBroadcast(chatId, m); // sin await — continúa en background
    return true;
  }
  return false;
}

// ── Contrato ChannelAdapter ────────────────────────────────────────────────
export function isConfigured(): boolean {
  return !!BOT;
}

export function verify(request: Request): boolean {
  const expected = createHash("sha256").update(BOT).digest("hex").slice(0, 64);
  const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  return got === expected;
}

export async function parseIncoming(update: unknown): Promise<IncomingMessage | null> {
  const u = update as Record<string, unknown>;

  const cb = u.callback_query as
    | { id: string; data: string; message: { chat: { id: number } } }
    | undefined;
  if (cb) {
    await tg("answerCallbackQuery", { callback_query_id: cb.id });
    return {
      channel,
      externalUserId: String(cb.message.chat.id),
      text: "",
      callbackData: cb.data,
      fromName: "Anónimo",
    };
  }

  const msg = (u.message ?? u.edited_message) as
    | {
        chat: { id: number };
        from?: { first_name?: string; username?: string };
        text?: string;
        location?: { latitude: number; longitude: number };
        photo?: { file_id: string; width?: number; height?: number }[];
        video?: { file_id: string; thumb?: { file_id: string }; thumbnail?: { file_id: string } };
      }
    | undefined;
  if (!msg) return null;

  const chatId = msg.chat.id;
  // Registrar usuario en background (fire and forget)
  registerUser(chatId, msg.from?.first_name ?? "", msg.from?.username);

  const incoming: IncomingMessage = {
    channel,
    externalUserId: String(chatId),
    text: (msg.text ?? "").trim(),
    fromName: msg.from?.first_name ?? "Anónimo",
    username: msg.from?.username,
  };
  if (msg.location) incoming.location = { lat: msg.location.latitude, lng: msg.location.longitude };
  if (msg.photo?.length) incoming.media = { kind: "photo", raw: msg.photo };
  else if (msg.video) incoming.media = { kind: "video", raw: msg.video };
  return incoming;
}

export async function send(externalUserId: string, msg: OutgoingMessage): Promise<void> {
  await sendMessage(Number(externalUserId), msg.text, msg.markup);
}

export async function storeMedia(media: IncomingMedia): Promise<StoredMedia | null> {
  if (media.kind === "photo")
    return uploadPhoto(media.raw as { file_id: string; width?: number; height?: number }[]);
  if (media.kind === "video")
    return uploadVideo(
      media.raw as { file_id: string; thumb?: { file_id: string }; thumbnail?: { file_id: string } },
    );
  return null;
}
