import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

function deriveSecret(apiKey: string) {
  return createHash("sha256").update(`telegram-webhook:${apiKey}`).digest("base64url");
}
function safeEqual(a: string, b: string) {
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

const CATEGORIES = [
  { slug: "missing", name: "🔴 Personas desaparecidas" },
  { slug: "medical", name: "🟠 Heridos / Médica" },
  { slug: "rescue", name: "🟡 Rescate / Atrapados" },
  { slug: "shelter", name: "🔵 Refugio / Ayuda" },
  { slug: "infrastructure", name: "🟣 Infraestructura dañada" },
  { slug: "evacuation", name: "🟢 Punto de encuentro" },
  { slug: "blocked_road", name: "⚫ Vías bloqueadas" },
  { slug: "hospital", name: "🩺 Centro médico" },
];
const URGENCIES = [
  { v: "critical", n: "🔴 Crítico" },
  { v: "high", n: "🟠 Alto" },
  { v: "medium", n: "🟡 Medio" },
  { v: "low", n: "🟢 Bajo" },
];

async function tg(method: string, body: unknown) {
  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": process.env.TELEGRAM_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error("tg", method, res.status, await res.text());
  return res;
}

const send = (chat_id: number, text: string, extra: Record<string, unknown> = {}) =>
  tg("sendMessage", { chat_id, text, parse_mode: "HTML", ...extra });

const ikb = (rows: { text: string; callback_data: string }[][]) => ({
  reply_markup: { inline_keyboard: rows },
});

function categoryKb() {
  const rows = [];
  for (let i = 0; i < CATEGORIES.length; i += 2) {
    rows.push(
      CATEGORIES.slice(i, i + 2).map((c) => ({ text: c.name, callback_data: `cat:${c.slug}` })),
    );
  }
  return ikb(rows);
}
const urgencyKb = () =>
  ikb([URGENCIES.map((u) => ({ text: u.n, callback_data: `urg:${u.v}` }))]);

const mediaKb = (hasAny: boolean) => ({
  reply_markup: {
    keyboard: [
      hasAny
        ? [{ text: "✅ Listo, continuar" }]
        : [{ text: "⏭️ Omitir foto/video" }],
      [{ text: "❌ Cancelar" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
});

const locationKb = () => ({
  reply_markup: {
    keyboard: [
      [{ text: "📍 Compartir mi ubicación", request_location: true }],
      [{ text: "❌ Cancelar" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
});

const removeKb = () => ({ reply_markup: { remove_keyboard: true } });

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getSession(chatId: number) {
  const db = await getAdmin();
  const { data } = await db.from("telegram_sessions").select("*").eq("chat_id", chatId).maybeSingle();
  return data as { chat_id: number; state: string; draft: Record<string, unknown> } | null;
}

async function setSession(chatId: number, state: string, draft: Record<string, unknown>) {
  const db = await getAdmin();
  await db.from("telegram_sessions").upsert({
    chat_id: chatId, state, draft: draft as never, updated_at: new Date().toISOString(),
  });
}

async function clearSession(chatId: number) {
  const db = await getAdmin();
  await db.from("telegram_sessions").delete().eq("chat_id", chatId);
}

async function handleStart(chatId: number, name?: string) {
  await clearSession(chatId);
  await send(
    chatId,
    `<b>Venezuela Se Levanta</b> 🇻🇪\n\nHola${name ? ` ${name}` : ""}. Soy el bot para reportar incidentes del terremoto.\n\nUsa /reportar para crear un reporte ciudadano. Puedes adjuntar foto o video. Tu información aparecerá en el mapa en tiempo real.\n\nOtros comandos:\n/reportar — nuevo reporte\n/cancelar — cancelar reporte actual\n/ayuda — ayuda`,
    removeKb(),
  );
}

async function startReport(chatId: number) {
  await setSession(chatId, "awaiting_category", {});
  await send(chatId, "1/5 · Elige la <b>categoría</b> del incidente:", categoryKb());
}

async function cancelFlow(chatId: number) {
  await clearSession(chatId);
  await send(chatId, "❌ Reporte cancelado. Usa /reportar para empezar de nuevo.", removeKb());
}

// Download a single Telegram file (by file_id) and upload it to storage.
// Returns the public proxy URL or null on failure.
async function downloadAndStore(
  fileId: string,
  fallbackExt: string,
  fallbackContentType: string,
): Promise<string | null> {
  try {
    const infoRes = await tg("getFile", { file_id: fileId });
    if (!infoRes.ok) return null;
    const info = (await infoRes.json()) as { result?: { file_path?: string } };
    const filePath = info.result?.file_path;
    if (!filePath) return null;

    const dl = await fetch(`${GATEWAY_URL}/file/${filePath}`, {
      headers: {
        Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": process.env.TELEGRAM_API_KEY!,
      },
    });
    if (!dl.ok) return null;
    const bytes = new Uint8Array(await dl.arrayBuffer());
    const contentType = dl.headers.get("content-type") || fallbackContentType;
    const ext = filePath.split(".").pop()?.toLowerCase() || fallbackExt;
    const key = `telegram/${crypto.randomUUID()}.${ext}`;

    const db = await getAdmin();
    const { error } = await db.storage
      .from("report-media")
      .upload(key, bytes, { contentType, upsert: false });
    if (error) {
      console.error("storage upload", error);
      return null;
    }
    return `/api/public/media/${key}`;
  } catch (err) {
    console.error("downloadAndStore", err);
    return null;
  }
}

// Upload a Telegram photo: stores the highest-resolution version as the full
// media, and the smallest as a fast-loading thumbnail.
async function uploadTelegramPhoto(
  sizes: { file_id: string; file_size?: number; width?: number; height?: number }[],
): Promise<{ url: string; thumb: string } | null> {
  if (sizes.length === 0) return null;
  const sorted = [...sizes].sort(
    (a, b) => (a.width ?? 0) * (a.height ?? 0) - (b.width ?? 0) * (b.height ?? 0),
  );
  const smallest = sorted[0];
  const largest = sorted[sorted.length - 1];
  const fullUrl = await downloadAndStore(largest.file_id, "jpg", "image/jpeg");
  if (!fullUrl) return null;
  // If only one size, reuse the full image as its own thumbnail.
  if (smallest.file_id === largest.file_id) return { url: fullUrl, thumb: fullUrl };
  const thumbUrl = await downloadAndStore(smallest.file_id, "jpg", "image/jpeg");
  return { url: fullUrl, thumb: thumbUrl ?? fullUrl };
}

// Upload a Telegram video: stores the video plus its JPEG poster (if any) as
// the thumbnail. Falls back to using the video URL itself when no poster.
async function uploadTelegramVideo(video: {
  file_id: string;
  thumb?: { file_id: string };
  thumbnail?: { file_id: string };
}): Promise<{ url: string; thumb: string } | null> {
  const fullUrl = await downloadAndStore(video.file_id, "mp4", "video/mp4");
  if (!fullUrl) return null;
  const thumbId = video.thumbnail?.file_id ?? video.thumb?.file_id;
  let thumbUrl: string | null = null;
  if (thumbId) thumbUrl = await downloadAndStore(thumbId, "jpg", "image/jpeg");
  return { url: fullUrl, thumb: thumbUrl ?? fullUrl };
}

async function finalizeReport(chatId: number, draft: Record<string, unknown>, reporterName: string) {
  const db = await getAdmin();
  const mediaUrls = Array.isArray(draft.media_urls) ? (draft.media_urls as string[]) : [];
  const mediaThumbs = Array.isArray(draft.media_thumbs) ? (draft.media_thumbs as string[]) : [];
  const { error } = await db.from("reports").insert({
    title: String(draft.title ?? "Reporte vía Telegram").slice(0, 120),
    description: (draft.description as string | undefined) ?? null,
    category: String(draft.category ?? "infrastructure"),
    urgency: String(draft.urgency ?? "medium"),
    status: "active",
    address: (draft.address as string | undefined) ?? null,
    lat: Number(draft.lat),
    lng: Number(draft.lng),
    reporter_name: `${reporterName} (Telegram)`,
    photo_url: mediaUrls[0] ?? null,
    media_urls: mediaUrls,
    media_thumbs: mediaThumbs,
  });
  await clearSession(chatId);
  if (error) {
    await send(chatId, `⚠️ No se pudo guardar el reporte: ${error.message}`, removeKb());
    return;
  }
  await send(
    chatId,
    `✅ <b>¡Reporte enviado!</b>${mediaUrls.length ? `\n📎 ${mediaUrls.length} adjunto${mediaUrls.length === 1 ? "" : "s"}.` : ""}\nGracias por ayudar. Ya aparece en el mapa colaborativo.\n\nUsa /reportar para enviar otro.`,
    removeKb(),
  );
}

async function processUpdate(update: Record<string, unknown>) {
  // Callback (inline keyboards)
  const cb = update.callback_query as
    | { id: string; data: string; message: { chat: { id: number } }; from: { first_name?: string } }
    | undefined;
  if (cb) {
    await tg("answerCallbackQuery", { callback_query_id: cb.id });
    const chatId = cb.message.chat.id;
    const session = await getSession(chatId);
    if (!session) return;
    if (cb.data.startsWith("cat:") && session.state === "awaiting_category") {
      const slug = cb.data.slice(4);
      await setSession(chatId, "awaiting_title", { ...session.draft, category: slug });
      await send(chatId, "2/5 · Escribe un <b>título breve</b> (ej: «Edificio colapsado en Av. Bolívar»).");
      return;
    }
    if (cb.data.startsWith("urg:") && session.state === "awaiting_urgency") {
      const urg = cb.data.slice(4);
      await setSession(chatId, "awaiting_media", { ...session.draft, urgency: urg, media_urls: [] });
      await send(
        chatId,
        "4/5 · ¿Quieres adjuntar <b>fotos y/o videos</b>?\n\nEnvía uno o varios (también funciona enviar un álbum). Cuando termines, pulsa «✅ Listo, continuar» o «⏭️ Omitir» si no tienes.",
        mediaKb(false),
      );
      return;
    }
    return;
  }

  const msg = (update.message ?? update.edited_message) as
    | {
        chat: { id: number };
        from?: { first_name?: string };
        text?: string;
        location?: { latitude: number; longitude: number };
        photo?: { file_id: string; file_size?: number }[];
        video?: { file_id: string };
      }
    | undefined;
  if (!msg) return;
  const chatId = msg.chat.id;
  const fromName = msg.from?.first_name ?? "Anónimo";
  const text = (msg.text ?? "").trim();

  if (text === "/start") return handleStart(chatId, fromName);
  if (text === "/reportar") return startReport(chatId);
  if (text === "/cancelar" || text === "❌ Cancelar") return cancelFlow(chatId);
  if (text === "/ayuda") {
    return send(
      chatId,
      "Comandos:\n/reportar — nuevo reporte (acepta varias fotos/videos)\n/cancelar — cancelar reporte actual\n/start — menú\n\nMapa: https://venezuelaselevanta.info",
    );
  }

  const session = await getSession(chatId);
  if (!session) {
    return send(chatId, "Usa /reportar para enviar un reporte ciudadano. /ayuda para más.");
  }

  if (session.state === "awaiting_title" && text) {
    await setSession(chatId, "awaiting_description", { ...session.draft, title: text.slice(0, 120) });
    return send(chatId, "3/5 · Agrega una <b>descripción</b> (o envía «-» para omitir).");
  }

  if (session.state === "awaiting_description" && text) {
    const desc = text === "-" ? null : text.slice(0, 1000);
    await setSession(chatId, "awaiting_urgency", { ...session.draft, description: desc });
    return send(chatId, "Elige la <b>urgencia</b>:", urgencyKb());
  }

  if (session.state === "awaiting_media") {
    const current = Array.isArray(session.draft.media_urls)
      ? (session.draft.media_urls as string[])
      : [];

    // Photo
    if (msg.photo && msg.photo.length > 0) {
      const largest = msg.photo[msg.photo.length - 1];
      const uploaded = await uploadTelegramFile(largest.file_id, "image");
      if (!uploaded) {
        await send(chatId, "⚠️ No se pudo subir la foto. Intenta de nuevo.", mediaKb(current.length > 0));
        return;
      }
      const next = [...current, uploaded.url];
      await setSession(chatId, "awaiting_media", { ...session.draft, media_urls: next });
      return send(
        chatId,
        `📎 ${next.length} adjunto${next.length === 1 ? "" : "s"}. Envía más o pulsa «✅ Listo, continuar».`,
        mediaKb(true),
      );
    }
    // Video
    if (msg.video) {
      await send(chatId, "⏳ Subiendo video…");
      const uploaded = await uploadTelegramFile(msg.video.file_id, "video");
      if (!uploaded) {
        await send(chatId, "⚠️ No se pudo subir el video. Intenta de nuevo.", mediaKb(current.length > 0));
        return;
      }
      const next = [...current, uploaded.url];
      await setSession(chatId, "awaiting_media", { ...session.draft, media_urls: next });
      return send(
        chatId,
        `📎 ${next.length} adjunto${next.length === 1 ? "" : "s"}. Envía más o pulsa «✅ Listo, continuar».`,
        mediaKb(true),
      );
    }
    // Continue
    if (text === "✅ Listo, continuar" || text === "/listo") {
      await setSession(chatId, "awaiting_location", session.draft);
      return send(
        chatId,
        "5/5 · Comparte la <b>ubicación</b> del incidente (botón abajo).",
        locationKb(),
      );
    }
    // Skip (no media yet)
    if (text === "⏭️ Omitir foto/video" || text === "/omitir" || text === "-") {
      await setSession(chatId, "awaiting_location", { ...session.draft, media_urls: [] });
      return send(
        chatId,
        "5/5 · Comparte la <b>ubicación</b> del incidente (botón abajo).",
        locationKb(),
      );
    }
    return send(
      chatId,
      "Envía fotos o videos, o pulsa el botón inferior cuando termines.",
      mediaKb(current.length > 0),
    );
  }

  if (session.state === "awaiting_location" && msg.location) {
    const draft = {
      ...session.draft,
      lat: msg.location.latitude,
      lng: msg.location.longitude,
    };
    return finalizeReport(chatId, draft, fromName);
  }

  if (session.state === "awaiting_location") {
    return send(chatId, "Por favor comparte tu ubicación con el botón 📍, o /cancelar.", locationKb());
  }
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.TELEGRAM_API_KEY;
        if (!apiKey) return new Response("Not configured", { status: 500 });
        const expected = deriveSecret(apiKey);
        const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!safeEqual(got, expected)) return new Response("Unauthorized", { status: 401 });
        const update = await request.json();
        try {
          await processUpdate(update);
        } catch (err) {
          console.error("telegram webhook error", err);
        }
        return Response.json({ ok: true });
      },
      GET: async () => Response.json({ ok: true, info: "Telegram webhook endpoint" }),
    },
  },
});
