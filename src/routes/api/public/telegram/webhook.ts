import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

const BOT = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TG_API = `https://api.telegram.org/bot${BOT}`;
const SUPA_URL = process.env.SUPABASE_URL!;
const SUPA_ANON = process.env.SUPABASE_PUBLISHABLE_KEY!;
const SUPA_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VE_MIN_LAT = -1, VE_MAX_LAT = 14, VE_MIN_LNG = -74, VE_MAX_LNG = -59;

// ── In-memory sessions (2h TTL, no DB required) ──────────────────────────
type Session = { state: string; draft: Record<string, unknown>; at: number };
const sessions = new Map<number, Session>();
const SESSION_TTL = 2 * 60 * 60 * 1000;

function getSession(chatId: number): Session | null {
  const s = sessions.get(chatId);
  if (!s) return null;
  if (Date.now() - s.at > SESSION_TTL) { sessions.delete(chatId); return null; }
  return s;
}
function setSession(chatId: number, state: string, draft: Record<string, unknown>) {
  sessions.set(chatId, { state, draft, at: Date.now() });
}
function clearSession(chatId: number) { sessions.delete(chatId); }

// ── Telegram API ──────────────────────────────────────────────────────────
async function tg(method: string, body: unknown) {
  const res = await fetch(`${TG_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error("[tg]", method, res.status, await res.text().catch(() => ""));
  return res;
}
const send = (chat_id: number, text: string, extra: Record<string, unknown> = {}) =>
  tg("sendMessage", { chat_id, text, parse_mode: "HTML", ...extra });

// ── Keyboards ──────────────────────────────────────────────────────────────
const CATEGORIES = [
  { slug: "missing",        name: "🔴 Desaparecidos" },
  { slug: "medical",        name: "🟠 Heridos / Médica" },
  { slug: "rescue",         name: "🟡 Rescate / Atrapados" },
  { slug: "shelter",        name: "🔵 Refugio / Ayuda" },
  { slug: "infrastructure", name: "🟣 Infraestructura" },
  { slug: "evacuation",     name: "🟢 Punto de encuentro" },
  { slug: "blocked_road",   name: "⚫ Vías bloqueadas" },
  { slug: "hospital",       name: "🩺 Centro médico" },
];
const URGENCIES = [
  { v: "critical", n: "🔴 Crítico" },
  { v: "high",     n: "🟠 Alto" },
  { v: "medium",   n: "🟡 Medio" },
  { v: "low",      n: "🟢 Bajo" },
];
const ikb = (rows: { text: string; callback_data: string }[][]) => ({
  reply_markup: { inline_keyboard: rows },
});
function categoryKb() {
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < CATEGORIES.length; i += 2)
    rows.push(CATEGORIES.slice(i, i + 2).map((c) => ({ text: c.name, callback_data: `cat:${c.slug}` })));
  return ikb(rows);
}
const urgencyKb = () => ikb([URGENCIES.map((u) => ({ text: u.n, callback_data: `urg:${u.v}` }))]);
const mediaKb = (hasAny: boolean) => ({
  reply_markup: {
    keyboard: [
      [{ text: hasAny ? "✅ Listo, continuar" : "⏭️ Omitir foto/video" }],
      [{ text: "❌ Cancelar" }],
    ],
    resize_keyboard: true, one_time_keyboard: false,
  },
});
const locationKb = () => ({
  reply_markup: {
    keyboard: [
      [{ text: "📍 Compartir mi ubicación", request_location: true }],
      [{ text: "✏️ Escribir dirección" }],
      [{ text: "❌ Cancelar" }],
    ],
    resize_keyboard: true, one_time_keyboard: false,
  },
});
const confirmKb = () => ({
  reply_markup: {
    keyboard: [[{ text: "✅ Confirmar y publicar" }, { text: "❌ Cancelar" }]],
    resize_keyboard: true, one_time_keyboard: true,
  },
});
const removeKb = () => ({ reply_markup: { remove_keyboard: true } });

// ── Supabase helpers (direct fetch, no createClient) ──────────────────────
async function supabaseCount(table: string, filter = ""): Promise<number> {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?select=id&limit=1${filter ? "&" + filter : ""}`, {
    headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}`, Prefer: "count=exact", Range: "0-0" },
  });
  const m = (res.headers.get("content-range") ?? "").match(/\/(\d+)$/);
  return m ? parseInt(m[1]) : 0;
}
async function supabaseSelect(table: string, query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` },
  });
  return res.ok ? res.json() : [];
}
async function supabaseInsert(table: string, body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}`,
      "Content-Type": "application/json", Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  return res.ok ? null : await res.text();
}

// ── File upload ───────────────────────────────────────────────────────────
async function downloadAndStore(fileId: string, ext: string, ct: string): Promise<string | null> {
  if (!SUPA_SVC) return null;
  const infoRes = await tg("getFile", { file_id: fileId });
  if (!infoRes.ok) return null;
  const info = await infoRes.json() as { result?: { file_path?: string } };
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
async function uploadPhoto(sizes: { file_id: string; width?: number; height?: number }[]) {
  if (!sizes.length) return null;
  const sorted = [...sizes].sort((a, b) => (a.width ?? 0) * (a.height ?? 0) - (b.width ?? 0) * (b.height ?? 0));
  const url = await downloadAndStore(sorted[sorted.length - 1].file_id, "jpg", "image/jpeg");
  if (!url) return null;
  const thumb = sorted.length > 1 ? await downloadAndStore(sorted[0].file_id, "jpg", "image/jpeg") : url;
  return { url, thumb: thumb ?? url };
}
async function uploadVideo(video: { file_id: string; thumb?: { file_id: string }; thumbnail?: { file_id: string } }) {
  const url = await downloadAndStore(video.file_id, "mp4", "video/mp4");
  if (!url) return null;
  const tid = video.thumbnail?.file_id ?? video.thumb?.file_id;
  const thumb = tid ? await downloadAndStore(tid, "jpg", "image/jpeg") : url;
  return { url, thumb: thumb ?? url };
}

// ── Geocoding (text address fallback) ────────────────────────────────────
async function geocodeText(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(`${address}, Venezuela`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ve`, {
      headers: { "User-Agent": "VenezuelaSeLevanta/1.0 (venezuelaselevanta.info)" },
    });
    if (!res.ok) return null;
    const data = await res.json() as { lat: string; lon: string }[];
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { return null; }
}

// ── Commands ──────────────────────────────────────────────────────────────
async function handleStart(chatId: number, name?: string) {
  clearSession(chatId);
  await send(chatId,
    `<b>Venezuela Se Levanta 🇻🇪</b>\n\nHola${name ? ` ${name}` : ""}. Soy el bot de reportes ciudadanos del terremoto.\n\n` +
    `/reportar — publicar un incidente en el mapa\n` +
    `/buscar [nombre] — buscar persona desaparecida\n` +
    `/estado — cifras actuales del mapa\n` +
    `/cancelar — cancelar operación actual\n\n` +
    `🌐 https://venezuelaselevanta.info`,
    removeKb(),
  );
}

async function startReport(chatId: number) {
  setSession(chatId, "awaiting_category", {});
  await send(chatId, "1/6 · Elige la <b>categoría</b> del incidente:", categoryKb());
}

async function cancelFlow(chatId: number) {
  clearSession(chatId);
  await send(chatId, "❌ Cancelado. Usa /reportar para empezar de nuevo.", removeKb());
}

async function handleBuscar(chatId: number, query: string) {
  if (!query || query.length < 2) {
    return send(chatId, "Escribe /buscar seguido del nombre. Ejemplo:\n<code>/buscar Juan García</code>");
  }
  const enc = encodeURIComponent(`%${query}%`);
  const data = await supabaseSelect("missing_persons",
    `select=name,age,last_seen_location,status&name=ilike.${enc}&limit=5&order=report_date.desc`
  );
  if (!data.length) {
    return send(chatId,
      `🔍 Sin resultados para «${query}».\n\n` +
      `Ver todos: https://venezuelaselevanta.info/desaparecidos`
    );
  }
  const ST: Record<string, string> = { missing: "🔴 Desaparecido/a", found: "✅ Encontrado/a", deceased: "⚫ Fallecido/a" };
  const lines = data.map((r) =>
    `• <b>${r.name}</b>${r.age ? `, ${r.age} años` : ""}` +
    `${r.last_seen_location ? `\n  📍 ${r.last_seen_location}` : ""}` +
    `\n  ${ST[r.status as string] ?? String(r.status)}`
  ).join("\n\n");
  await send(chatId,
    `🔍 Resultados para «${query}»:\n\n${lines}\n\n` +
    `🌐 <a href="https://venezuelaselevanta.info/desaparecidos">Ver todos</a>`
  );
}

async function handleEstado(chatId: number) {
  const [totalR, totalM, missingM] = await Promise.all([
    supabaseCount("reports"),
    supabaseCount("missing_persons"),
    supabaseCount("missing_persons", "status=eq.missing"),
  ]);
  await send(chatId,
    `📊 <b>Estado del mapa — Venezuela Se Levanta</b>\n\n` +
    `📋 Reportes de crisis: <b>${totalR.toLocaleString("es")}</b>\n` +
    `👥 Personas registradas: <b>${totalM.toLocaleString("es")}</b>\n` +
    `🔴 Sin encontrar: <b>${missingM.toLocaleString("es")}</b>\n\n` +
    `🌐 https://venezuelaselevanta.info`
  );
}

function buildSummary(draft: Record<string, unknown>): string {
  const catName = CATEGORIES.find(c => c.slug === draft.category)?.name ?? String(draft.category ?? "");
  const urgName = URGENCIES.find(u => u.v === draft.urgency)?.n ?? String(draft.urgency ?? "");
  const n = (Array.isArray(draft.media_urls) ? draft.media_urls : []).length;
  const loc = draft.address
    ? String(draft.address)
    : (draft.lat != null ? `${Number(draft.lat).toFixed(4)}, ${Number(draft.lng).toFixed(4)}` : "(sin ubicación)");
  return `📋 <b>Resumen del reporte</b>\n\n` +
    `Categoría: ${catName}\n` +
    `Título: <b>${draft.title}</b>\n` +
    `Descripción: ${draft.description ?? "(ninguna)"}\n` +
    `Urgencia: ${urgName}\n` +
    `Ubicación: ${loc}\n` +
    `Adjuntos: ${n > 0 ? `${n} archivo(s)` : "ninguno"}\n\n` +
    `¿Confirmar y publicar en el mapa?`;
}

async function finalizeReport(chatId: number, draft: Record<string, unknown>, name: string) {
  const mediaUrls = (draft.media_urls as string[] | undefined) ?? [];
  const mediaThumbs = (draft.media_thumbs as string[] | undefined) ?? [];
  const err = await supabaseInsert("reports", {
    title: String(draft.title ?? "Reporte vía Telegram").slice(0, 120),
    description: (draft.description as string | null) ?? null,
    category: String(draft.category ?? "infrastructure"),
    urgency: String(draft.urgency ?? "medium"),
    status: "active",
    address: (draft.address as string | null) ?? null,
    lat: draft.lat != null ? Number(draft.lat) : 10.48,
    lng: draft.lng != null ? Number(draft.lng) : -66.9,
    reporter_name: `${name} (Telegram)`,
    photo_url: mediaUrls[0] ?? null,
    media_urls: mediaUrls,
    media_thumbs: mediaThumbs,
  });
  clearSession(chatId);
  if (err) {
    await send(chatId, `⚠️ No se pudo guardar el reporte: ${err}`, removeKb());
    return;
  }
  await send(chatId,
    `✅ <b>¡Reporte publicado!</b>${mediaUrls.length ? `\n📎 ${mediaUrls.length} adjunto(s).` : ""}\n` +
    `Ya aparece en el mapa. Gracias por ayudar a Venezuela 🇻🇪\n\n` +
    `/reportar para otro | /estado para ver cifras`,
    removeKb(),
  );
}

// ── Main update processor ─────────────────────────────────────────────────
async function processUpdate(update: Record<string, unknown>) {
  // Callback queries (inline keyboards)
  const cb = update.callback_query as {
    id: string; data: string;
    message: { chat: { id: number } };
    from: { first_name?: string };
  } | undefined;

  if (cb) {
    await tg("answerCallbackQuery", { callback_query_id: cb.id });
    const chatId = cb.message.chat.id;
    const session = getSession(chatId);
    if (!session) {
      await send(chatId, "La sesión expiró. Usa /reportar para empezar de nuevo.");
      return;
    }
    if (cb.data.startsWith("cat:") && session.state === "awaiting_category") {
      setSession(chatId, "awaiting_title", { ...session.draft, category: cb.data.slice(4) });
      await send(chatId, "2/6 · Escribe un <b>título breve</b> (ej: «Edificio colapsado en Av. Bolívar»).");
      return;
    }
    if (cb.data.startsWith("urg:") && session.state === "awaiting_urgency") {
      setSession(chatId, "awaiting_media", { ...session.draft, urgency: cb.data.slice(4), media_urls: [], media_thumbs: [] });
      await send(chatId,
        "5/6 · ¿Adjuntar <b>fotos o videos</b>?\n\nEnvía uno o varios archivos. Cuando termines pulsa «✅ Listo, continuar».",
        mediaKb(false),
      );
      return;
    }
    return;
  }

  const msg = (update.message ?? update.edited_message) as {
    chat: { id: number }; from?: { first_name?: string }; text?: string;
    location?: { latitude: number; longitude: number };
    photo?: { file_id: string; width?: number; height?: number }[];
    video?: { file_id: string; thumb?: { file_id: string }; thumbnail?: { file_id: string } };
  } | undefined;
  if (!msg) return;

  const chatId = msg.chat.id;
  const fromName = msg.from?.first_name ?? "Anónimo";
  const text = (msg.text ?? "").trim();

  // Global commands (always handled)
  if (text === "/start" || text.startsWith("/start ")) return handleStart(chatId, fromName);
  if (text === "/reportar") return startReport(chatId);
  if (text === "/cancelar" || text === "❌ Cancelar") return cancelFlow(chatId);
  if (text === "/ayuda" || text === "/help") {
    return send(chatId,
      "Comandos disponibles:\n" +
      "/reportar — crear reporte en el mapa\n" +
      "/buscar [nombre] — buscar desaparecidos\n" +
      "/estado — cifras actuales\n" +
      "/cancelar — cancelar operación\n\n" +
      "🌐 https://venezuelaselevanta.info"
    );
  }
  if (text.startsWith("/buscar")) {
    return handleBuscar(chatId, text.replace(/^\/buscar\s*/i, "").trim());
  }
  if (text === "/estado") return handleEstado(chatId);

  const session = getSession(chatId);
  if (!session) {
    return send(chatId, "Usa /reportar para publicar un incidente. /ayuda para más información.");
  }

  // Flow states
  if (session.state === "awaiting_title" && text && !text.startsWith("/")) {
    setSession(chatId, "awaiting_description", { ...session.draft, title: text.slice(0, 120) });
    return send(chatId, "3/6 · Agrega una <b>descripción</b> con más detalles (o envía «-» para omitir).");
  }

  if (session.state === "awaiting_description" && text && !text.startsWith("/")) {
    setSession(chatId, "awaiting_urgency", { ...session.draft, description: text === "-" ? null : text.slice(0, 1000) });
    return send(chatId, "4/6 · Elige la <b>urgencia</b>:", urgencyKb());
  }

  if (session.state === "awaiting_media") {
    const cur = (session.draft.media_urls as string[]) ?? [];
    const curT = (session.draft.media_thumbs as string[]) ?? [];

    if (msg.photo?.length) {
      const up = await uploadPhoto(msg.photo);
      if (!up) { await send(chatId, "⚠️ No se pudo subir la foto. Intenta de nuevo.", mediaKb(cur.length > 0)); return; }
      const next = [...cur, up.url], nextT = [...curT, up.thumb];
      setSession(chatId, "awaiting_media", { ...session.draft, media_urls: next, media_thumbs: nextT });
      return send(chatId, `📎 ${next.length} adjunto(s). Envía más o pulsa «✅ Listo, continuar».`, mediaKb(true));
    }
    if (msg.video) {
      await send(chatId, "⏳ Subiendo video…");
      const up = await uploadVideo(msg.video as never);
      if (!up) { await send(chatId, "⚠️ No se pudo subir el video.", mediaKb(cur.length > 0)); return; }
      const next = [...cur, up.url], nextT = [...curT, up.thumb];
      setSession(chatId, "awaiting_media", { ...session.draft, media_urls: next, media_thumbs: nextT });
      return send(chatId, `📎 ${next.length} adjunto(s). Envía más o pulsa «✅ Listo, continuar».`, mediaKb(true));
    }
    if (text === "✅ Listo, continuar" || text === "/listo") {
      setSession(chatId, "awaiting_location", session.draft);
      return send(chatId, "6/6 · Comparte la <b>ubicación</b> del incidente.\n\nUsa el botón 📍 o escribe la dirección si no tienes GPS.", locationKb());
    }
    if (text === "⏭️ Omitir foto/video" || text === "-") {
      setSession(chatId, "awaiting_location", { ...session.draft, media_urls: [], media_thumbs: [] });
      return send(chatId, "6/6 · Comparte la <b>ubicación</b> del incidente.\n\nUsa el botón 📍 o escribe la dirección si no tienes GPS.", locationKb());
    }
    return send(chatId, "Envía fotos/videos, o usa los botones inferiores.", mediaKb(cur.length > 0));
  }

  if (session.state === "awaiting_location") {
    if (msg.location) {
      const { latitude: lat, longitude: lng } = msg.location;
      if (lat < VE_MIN_LAT || lat > VE_MAX_LAT || lng < VE_MIN_LNG || lng > VE_MAX_LNG) {
        return send(chatId, "⚠️ La ubicación está fuera de Venezuela. Por favor comparte la ubicación correcta o escribe la dirección.", locationKb());
      }
      const draft = { ...session.draft, lat, lng };
      setSession(chatId, "awaiting_confirm", draft);
      return send(chatId, buildSummary(draft), confirmKb());
    }
    if (text === "✏️ Escribir dirección") {
      setSession(chatId, "awaiting_text_location", session.draft);
      return send(chatId, "Escribe la dirección o zona del incidente\n(ej: <i>Catia La Mar, cerca del mercado municipal</i>):", removeKb());
    }
    return send(chatId, "Usa el botón 📍 para compartir ubicación, o «✏️ Escribir dirección» si no tienes GPS.", locationKb());
  }

  if (session.state === "awaiting_text_location" && text && !text.startsWith("/")) {
    await send(chatId, "⏳ Buscando coordenadas…");
    const coords = await geocodeText(text);
    const draft = {
      ...session.draft,
      address: text.slice(0, 200),
      lat: coords?.lat ?? 10.48,
      lng: coords?.lng ?? -66.9,
    };
    setSession(chatId, "awaiting_confirm", draft);
    const note = coords ? "" : "\n⚠️ <i>No se encontraron coordenadas exactas. El marcador aparecerá aproximado.</i>\n";
    return send(chatId, note + buildSummary(draft), confirmKb());
  }

  if (session.state === "awaiting_confirm") {
    if (text === "✅ Confirmar y publicar") return finalizeReport(chatId, session.draft, fromName);
    if (text === "❌ Cancelar") return cancelFlow(chatId);
    return send(chatId, "Pulsa «✅ Confirmar y publicar» o «❌ Cancelar».", confirmKb());
  }
}

// ── Route ──────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!BOT) return new Response("Bot not configured", { status: 500 });
        const expected = createHash("sha256").update(BOT).digest("hex").slice(0, 64);
        const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (got !== expected) return new Response("Unauthorized", { status: 401 });
        try { await processUpdate(await request.json()); } catch (err) { console.error("[telegram]", err); }
        return Response.json({ ok: true });
      },
      GET: async () => Response.json({ ok: true, bot: "@VenezuelaSeLevantabot" }),
    },
  },
});
