import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

const BOT        = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TG_API     = `https://api.telegram.org/bot${BOT}`;
const SUPA_URL   = process.env.SUPABASE_URL!;
const SUPA_ANON  = process.env.SUPABASE_PUBLISHABLE_KEY!;
const SUPA_SVC   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const ADMIN_IDS  = new Set(
  (process.env.TELEGRAM_ADMIN_IDS ?? "")
    .split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0)
);

const VE_MIN_LAT = -1, VE_MAX_LAT = 14, VE_MIN_LNG = -74, VE_MAX_LNG = -59;

// ── Sessions (in-memory + Supabase persistence) ───────────────────────────
type HistoryEntry = { role: "user" | "bot"; text: string };
type Session = {
  state: string;
  draft: Record<string, unknown>;
  history: HistoryEntry[];
  userName?: string;
  at: number;
};
const sessions = new Map<number, Session>();
const SESSION_TTL = 2 * 60 * 60 * 1000;

async function saveSessionToDB(chatId: number, s: Session): Promise<void> {
  if (!SUPA_SVC) return;
  await fetch(`${SUPA_URL}/rest/v1/bot_sessions`, {
    method: "POST",
    headers: {
      apikey: SUPA_SVC, Authorization: `Bearer ${SUPA_SVC}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ chat_id: chatId, data: s, updated_at: new Date().toISOString() }),
  }).catch(e => console.error("[session-save]", e));
}

async function loadSessionFromDB(chatId: number): Promise<Session | null> {
  if (!SUPA_SVC) return null;
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/bot_sessions?chat_id=eq.${chatId}&select=data&limit=1`,
      { headers: { apikey: SUPA_SVC, Authorization: `Bearer ${SUPA_SVC}` } },
    );
    if (!res.ok) return null;
    const rows = await res.json() as { data: Session }[];
    return rows[0]?.data ?? null;
  } catch { return null; }
}

async function deleteSessionFromDB(chatId: number): Promise<void> {
  if (!SUPA_SVC) return;
  await fetch(`${SUPA_URL}/rest/v1/bot_sessions?chat_id=eq.${chatId}`, {
    method: "DELETE",
    headers: { apikey: SUPA_SVC, Authorization: `Bearer ${SUPA_SVC}` },
  }).catch(e => console.error("[session-delete]", e));
}

async function getOrLoadSession(id: number): Promise<Session | null> {
  const cached = sessions.get(id);
  if (cached) {
    if (Date.now() - cached.at > SESSION_TTL) {
      sessions.delete(id);
      deleteSessionFromDB(id).catch(() => {});
      return null;
    }
    return cached;
  }
  // Not in memory — try DB (recovers sessions after PM2 restart)
  const db = await loadSessionFromDB(id);
  if (!db) return null;
  if (Date.now() - db.at > SESSION_TTL) { deleteSessionFromDB(id).catch(() => {}); return null; }
  sessions.set(id, db);
  return db;
}

function setSession(
  id: number,
  state: string,
  draft: Record<string, unknown>,
  history?: HistoryEntry[],
  userName?: string,
) {
  const existing = sessions.get(id);
  const s: Session = {
    state, draft,
    history:  history  ?? existing?.history  ?? [],
    userName: userName ?? existing?.userName,
    at: Date.now(),
  };
  sessions.set(id, s);
  saveSessionToDB(id, s).catch(e => console.error("[session-save]", e));
}

function clearSession(id: number) {
  sessions.delete(id);
  deleteSessionFromDB(id).catch(e => console.error("[session-delete]", e));
}

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

// ── Keyboards ─────────────────────────────────────────────────────────────
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
    rows.push(CATEGORIES.slice(i, i + 2).map(c => ({ text: c.name, callback_data: `cat:${c.slug}` })));
  return ikb(rows);
}
const urgencyKb  = () => ikb([URGENCIES.map(u => ({ text: u.n, callback_data: `urg:${u.v}` }))]);
const mediaKb    = (hasAny: boolean) => ({
  reply_markup: {
    keyboard: [[{ text: hasAny ? "✅ Listo, continuar" : "⏭️ Omitir foto/video" }], [{ text: "❌ Cancelar" }]],
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
const confirmKb    = () => ({ reply_markup: { keyboard: [[{ text: "✅ Confirmar y publicar" }, { text: "❌ Cancelar" }]], resize_keyboard: true, one_time_keyboard: true } });
const mpConfirmKb  = () => ({ reply_markup: { keyboard: [[{ text: "✅ Confirmar y registrar" }, { text: "❌ Cancelar" }]], resize_keyboard: true, one_time_keyboard: true } });
const mpPhotoKb    = (has: boolean) => ({ reply_markup: { keyboard: [[{ text: has ? "✅ Listo, continuar" : "⏭️ Omitir foto" }], [{ text: "❌ Cancelar" }]], resize_keyboard: true, one_time_keyboard: false } });
const mpContactKb  = () => ({ reply_markup: { keyboard: [[{ text: "⏭️ Sin datos de contacto" }], [{ text: "❌ Cancelar" }]], resize_keyboard: true, one_time_keyboard: false } });
const removeKb     = () => ({ reply_markup: { remove_keyboard: true } });

// ── Supabase helpers ──────────────────────────────────────────────────────
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
async function supabasePatch(table: string, filter: string, body: Record<string, unknown>): Promise<boolean> {
  const key = SUPA_SVC || SUPA_ANON;
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      "Content-Type": "application/json", Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

// ── Bot user registry ─────────────────────────────────────────────────────
function registerUser(chatId: number, firstName: string, username?: string) {
  if (!SUPA_SVC) return;
  fetch(`${SUPA_URL}/rest/v1/bot_users`, {
    method: "POST",
    headers: {
      apikey: SUPA_SVC, Authorization: `Bearer ${SUPA_SVC}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ chat_id: chatId, first_name: firstName || null, username: username || null, last_seen: new Date().toISOString() }),
  }).catch(() => {});
}
async function getAllBotUsers(): Promise<number[]> {
  if (!SUPA_SVC) return [];
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/bot_users?select=chat_id&limit=10000`, {
      headers: { apikey: SUPA_SVC, Authorization: `Bearer ${SUPA_SVC}` },
    });
    if (!res.ok) return [];
    const data = await res.json() as { chat_id: number }[];
    return data.map(r => r.chat_id);
  } catch { return []; }
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

// ── Geocoding ─────────────────────────────────────────────────────────────
async function geocodeText(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(`${address}, Venezuela`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ve`,
      { headers: { "User-Agent": "VenezuelaSeLevanta/1.0 (venezuelaselevanta.info)" } },
    );
    if (!res.ok) return null;
    const data = await res.json() as { lat: string; lon: string }[];
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { return null; }
}

// ── Stats cache (5-min TTL) ───────────────────────────────────────────────
interface QuickStats { reports: number; missing: number; searching: number; at: number }
let statsCache: QuickStats | null = null;
const STATS_TTL = 5 * 60 * 1000;

async function getQuickStats(): Promise<{ reports: number; missing: number; searching: number }> {
  if (statsCache && Date.now() - statsCache.at < STATS_TTL) return statsCache;
  try {
    const [reports, missing, searching] = await Promise.all([
      supabaseCount("reports"),
      supabaseCount("missing_persons"),
      supabaseCount("missing_persons", "status=eq.missing"),
    ]);
    statsCache = { reports, missing, searching, at: Date.now() };
    return statsCache;
  } catch {
    return statsCache ?? { reports: 0, missing: 0, searching: 0 };
  }
}

// ── Gemini ────────────────────────────────────────────────────────────────
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

async function geminiJSON<T>(prompt: string): Promise<T | null> {
  if (!GEMINI_KEY) return null;
  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 400, temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) { console.error("[gemini]", res.status, await res.text().catch(() => "")); return null; }
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return JSON.parse(raw) as T;
  } catch (e) { console.error("[gemini]", e); return null; }
}

async function geminiConverse(
  history: HistoryEntry[],
  userMsg: string,
  stats: { reports: number; missing: number; searching: number },
  userName?: string,
): Promise<string | null> {
  if (!GEMINI_KEY) return null;

  const sys =
    `Eres el asistente del sistema "Venezuela Se Levanta", plataforma ciudadana de respuesta al terremoto en Venezuela.\n` +
    `Tu misión: orientar, informar y acompañar a las personas afectadas. Ayudarlas a registrar incidentes y encontrar desaparecidos.\n\n` +
    (userName ? `El usuario se llama ${userName}. Dirígete a él/ella por su nombre cuando sea natural.\n\n` : "") +
    `PERSONALIDAD: Cálido, sereno, venezolano. Habla con cercanía. Infunde calma. Nunca alarmista.\n` +
    `Cuando el usuario quiera reportar o registrar un desaparecido, el sistema lo iniciará automáticamente — responde brevemente confirmando que lo harás.\n\n` +
    `NÚMEROS DE EMERGENCIA:\n• Protección Civil: 171\n• Emergencias/ambulancia: 911\n• Cruz Roja: 0212-557-2021\n• Defensa Civil: 0800-344-6342\n\n` +
    `SI ALGUIEN ESTÁ ATRAPADO:\n• Golpear tuberías con ritmo constante\n• No usar fuego (riesgo de gas)\n• Cubrir boca con ropa\n• Conservar energía, esperar rescate\n\n` +
    `DESPUÉS DE UN SISMO:\n• No mover heridos graves\n• Alejarse de estructuras dañadas\n• Si huele gas: no encender nada, salir\n• Mantener teléfono cargado y escuchar radio AM\n\n` +
    `ESTADÍSTICAS ACTUALES:\n• Reportes: ${stats.reports}\n• Personas registradas: ${stats.missing}\n• Buscando activamente: ${stats.searching}\n\n` +
    `FUNCIONES: /reportar · /registrar_desaparecido · /buscar · /estado · /encontrado\n\n` +
    `Responde en 2-4 oraciones normalmente.`;

  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const h of history.slice(-10))
    contents.push({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] });
  contents.push({ role: "user", parts: [{ text: userMsg }] });

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sys }] },
        contents,
        generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) { console.error("[gemini-chat]", res.status, await res.text().catch(() => "")); return null; }
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch (e) { console.error("[gemini-chat]", e); return null; }
}

// ── Intent detection + field extraction ──────────────────────────────────
type IntentResult = {
  intent: "report" | "search_missing" | "register_missing" | "status" | "help" | "unknown";
  query?: string; category?: string; urgency?: string; title?: string;
};
const VALID_CATS = new Set(["missing","medical","rescue","shelter","infrastructure","evacuation","blocked_road","hospital"]);
const VALID_URGS = new Set(["critical","high","medium","low"]);

async function detectIntent(text: string): Promise<IntentResult | null> {
  const t = text.replace(/"/g, "'").slice(0, 300);
  return geminiJSON<IntentResult>(
    `Eres el asistente de "Venezuela Se Levanta", sistema de crisis post-terremoto.\n` +
    `El usuario escribió: "${t}"\n\n` +
    `Clasifica la intención. Responde SOLO JSON:\n` +
    `{"intent":"report"|"search_missing"|"register_missing"|"status"|"help"|"unknown",` +
    `"query":"nombre si search_missing","category":"missing|medical|rescue|shelter|infrastructure|evacuation|blocked_road|hospital",` +
    `"urgency":"critical|high|medium|low","title":"título si reporte"}`
  );
}

type ReportExtract = { title?: string; description?: string; category?: string; urgency?: string; address?: string };
async function extractReportFields(text: string): Promise<ReportExtract | null> {
  const t = text.replace(/"/g, "'").slice(0, 500);
  return geminiJSON<ReportExtract>(
    `Extrae campos de un reporte de crisis en Venezuela. Mensaje: "${t}"\n\n` +
    `SOLO JSON (omite campos ausentes):\n` +
    `{"title":"máx 100 chars","description":"detalles","category":"missing|medical|rescue|shelter|infrastructure|evacuation|blocked_road|hospital","urgency":"critical|high|medium|low","address":"dirección"}`
  );
}

// ── Commands ──────────────────────────────────────────────────────────────
async function handleStart(chatId: number) {
  clearSession(chatId);
  setSession(chatId, "awaiting_user_name", {});
  await send(chatId,
    `<b>Venezuela Se Levanta 🇻🇪</b>\n\n` +
    `Hola, soy el asistente del sistema ciudadano de respuesta al terremoto.\n\n` +
    `Puedo ayudarte a registrar incidentes, buscar personas desaparecidas y orientarte en esta emergencia.\n\n` +
    `¿Cómo te llamas?`,
    removeKb(),
  );
}

async function startReport(chatId: number) {
  setSession(chatId, "awaiting_category", {});
  await send(chatId, "1/6 · Elige la <b>categoría</b> del incidente:", categoryKb());
}

async function cancelFlow(chatId: number) {
  clearSession(chatId);
  await send(chatId,
    "❌ Cancelado.\n\n/reportar — reportar incidente\n/registrar_desaparecido — registrar persona\n/ayuda — más opciones",
    removeKb(),
  );
}

async function handleBuscar(chatId: number, query: string) {
  if (!query || query.length < 2)
    return send(chatId, "Escribe /buscar seguido del nombre. Ejemplo:\n<code>/buscar Juan García</code>");
  const enc = encodeURIComponent(`%${query}%`);
  const data = await supabaseSelect("missing_persons",
    `select=name,age,last_seen_location,status&name=ilike.${enc}&limit=5&order=report_date.desc`);
  if (!data.length)
    return send(chatId, `🔍 Sin resultados para «${query}».\n\nVer todos: https://venezuelaselevanta.info/desaparecidos`);
  const ST: Record<string, string> = { missing: "🔴 Buscado/a", found: "✅ Encontrado/a", deceased: "⚫ Fallecido/a" };
  const lines = data.map(r =>
    `• <b>${r.name}</b>${r.age ? `, ${r.age} años` : ""}` +
    `${r.last_seen_location ? `\n  📍 ${r.last_seen_location}` : ""}` +
    `\n  ${ST[r.status as string] ?? String(r.status)}`
  ).join("\n\n");
  return send(chatId, `🔍 Resultados para «${query}»:\n\n${lines}\n\n🌐 <a href="https://venezuelaselevanta.info/desaparecidos">Ver todos</a>`);
}

async function handleEstado(chatId: number) {
  const s = await getQuickStats();
  await send(chatId,
    `📊 <b>Estado del mapa — Venezuela Se Levanta</b>\n\n` +
    `📋 Reportes de crisis: <b>${s.reports.toLocaleString("es")}</b>\n` +
    `👥 Personas registradas: <b>${s.missing.toLocaleString("es")}</b>\n` +
    `🔴 Sin encontrar: <b>${s.searching.toLocaleString("es")}</b>\n\n` +
    `🌐 https://venezuelaselevanta.info`
  );
}

// ── Persona encontrada ────────────────────────────────────────────────────
async function handleEncontrado(chatId: number, query: string) {
  if (!query || query.length < 2) {
    return send(chatId,
      "¿Cómo se llama la persona que fue encontrada?\n\n" +
      "Ejemplo: <code>/encontrado Ana López</code>"
    );
  }
  const enc = encodeURIComponent(`%${query}%`);
  const data = await supabaseSelect("missing_persons",
    `select=id,name,age,last_seen_location&name=ilike.${enc}&status=eq.missing&limit=5&order=report_date.desc`
  );
  if (!data.length) {
    return send(chatId,
      `🔍 No encontré a «${query}» en la lista de personas buscadas.\n\n` +
      `Puede que ya esté marcada como encontrada o el nombre sea diferente.\n` +
      `Prueba con otro nombre o visita: https://venezuelaselevanta.info/desaparecidos`
    );
  }
  const lines = data.map(r =>
    `• <b>${r.name}</b>${r.age ? `, ${r.age} años` : ""}${r.last_seen_location ? ` · 📍 ${r.last_seen_location}` : ""}`
  ).join("\n");
  await send(chatId,
    `🔍 Personas buscadas con ese nombre:\n\n${lines}\n\n¿Cuál fue encontrada?`,
    ikb(data.map(r => [{
      text: `✅ ${r.name}${r.age ? `, ${r.age} años` : ""}`,
      callback_data: `found:${r.id}`,
    }]))
  );
}

// ── Broadcast (solo admins) ───────────────────────────────────────────────
async function executeBroadcast(adminChatId: number, message: string): Promise<void> {
  const users = await getAllBotUsers();
  if (!users.length) { await send(adminChatId, "⚠️ No hay usuarios registrados aún."); return; }
  await send(adminChatId, `📡 Enviando a <b>${users.length}</b> usuarios…`);
  let sent = 0, failed = 0;
  for (let i = 0; i < users.length; i += 25) {
    const batch = users.slice(i, i + 25);
    const results = await Promise.allSettled(
      batch.map(id => send(id, `📢 <b>ALERTA — Venezuela Se Levanta</b>\n\n${message}`))
    );
    sent   += results.filter(r => r.status === "fulfilled").length;
    failed += results.filter(r => r.status === "rejected").length;
    if (i + 25 < users.length) await new Promise(r => setTimeout(r, 1100));
  }
  await send(adminChatId, `✅ Broadcast completado: <b>${sent}</b> enviados, <b>${failed}</b> fallaron.`);
}

// ── Conversational handler ────────────────────────────────────────────────
async function handleChat(chatId: number, text: string, session: Session | null): Promise<void> {
  const history  = session?.history ?? [];
  const userName = session?.userName;
  const greet    = userName ? `Claro ${userName}, ` : "Entendido, ";

  const intent = await detectIntent(text);

  if (intent?.intent === "report") {
    const draft: Record<string, unknown> = {};
    if (intent.category && VALID_CATS.has(intent.category)) draft.category = intent.category;
    if (intent.urgency  && VALID_URGS.has(intent.urgency))  draft.urgency  = intent.urgency;
    if (intent.title)                                         draft.title    = String(intent.title).slice(0, 120);
    if (draft.category && draft.title) {
      setSession(chatId, "awaiting_description", draft);
      return send(chatId, `${greet}voy a registrar: <b>${draft.title}</b>\n\n3/6 · Agrega más detalles (o «-» para omitir):`);
    }
    if (draft.category) {
      setSession(chatId, "awaiting_title", draft);
      const catName = CATEGORIES.find(c => c.slug === draft.category)?.name ?? "";
      return send(chatId, `${greet}Categoría: <b>${catName}</b>\n\n2/6 · Escribe un <b>título breve</b>:`);
    }
    setSession(chatId, "awaiting_category", draft);
    return send(chatId, `${greet}voy a ayudarte a registrar el incidente.\n\n1/6 · Elige la <b>categoría</b>:`, categoryKb());
  }
  if (intent?.intent === "register_missing") {
    await send(chatId, `${greet}voy a registrar a la persona desaparecida.`);
    return startMissingPerson(chatId);
  }
  if (intent?.intent === "search_missing") {
    if (intent.query) return handleBuscar(chatId, intent.query);
    return send(chatId, `¿Cómo se llama la persona que buscas?`);
  }
  if (intent?.intent === "status") return handleEstado(chatId);

  const stats    = await getQuickStats();
  const response = await geminiConverse(history, text, stats, userName);
  if (response) {
    const newHistory: HistoryEntry[] = [...history, { role: "user" as const, text }, { role: "bot" as const, text: response }].slice(-16);
    setSession(chatId, "chat", session?.draft ?? {}, newHistory);
    await send(chatId, response);
    return;
  }
  const name = userName ? ` ${userName}` : "";
  await send(chatId, `Estoy aquí para ayudarte${name} 🇻🇪\n\nEmergencias: <b>171</b> · <b>911</b>\n\n/reportar · /registrar_desaparecido · /buscar · /estado`);
}

// ── Report flow ───────────────────────────────────────────────────────────
function buildSummary(draft: Record<string, unknown>): string {
  const catName = CATEGORIES.find(c => c.slug === draft.category)?.name ?? String(draft.category ?? "");
  const urgName = URGENCIES.find(u => u.v === draft.urgency)?.n ?? String(draft.urgency ?? "");
  const n   = (Array.isArray(draft.media_urls) ? draft.media_urls : []).length;
  const loc = draft.address ? String(draft.address) : (draft.lat != null ? `${Number(draft.lat).toFixed(4)}, ${Number(draft.lng).toFixed(4)}` : "(sin ubicación)");
  return `📋 <b>Resumen del reporte</b>\n\nCategoría: ${catName}\nTítulo: <b>${draft.title}</b>\nDescripción: ${draft.description ?? "(ninguna)"}\nUrgencia: ${urgName}\nUbicación: ${loc}\nAdjuntos: ${n > 0 ? `${n} archivo(s)` : "ninguno"}\n\n¿Confirmar y publicar en el mapa?`;
}

async function finalizeReport(chatId: number, draft: Record<string, unknown>, name: string) {
  const mediaUrls   = (draft.media_urls   as string[] | undefined) ?? [];
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
    media_urls: mediaUrls, media_thumbs: mediaThumbs,
  });
  clearSession(chatId);
  if (err) { await send(chatId, `⚠️ No se pudo guardar el reporte. Inténtalo de nuevo.`, removeKb()); console.error("[report-insert]", err); return; }
  const thanks = name !== "Anónimo" ? ` Gracias, ${name}` : "";
  await send(chatId, `✅ <b>¡Reporte publicado!</b>${mediaUrls.length ? `\n📎 ${mediaUrls.length} adjunto(s).` : ""}\nYa aparece en el mapa.${thanks} 🇻🇪\n\n/reportar para otro | /estado para ver cifras`, removeKb());
}

// ── Missing person flow ───────────────────────────────────────────────────
async function startMissingPerson(chatId: number) {
  setSession(chatId, "mp_name", {});
  await send(chatId, "📋 <b>Registrar persona desaparecida</b>\n\n1/6 · Escribe el <b>nombre completo</b> de la persona:", removeKb());
}

function buildMissingSummary(draft: Record<string, unknown>): string {
  const loc = draft.last_seen_location ? String(draft.last_seen_location) : (draft.last_seen_lat != null ? `${Number(draft.last_seen_lat).toFixed(4)}, ${Number(draft.last_seen_lng).toFixed(4)}` : "No indicado");
  return `📋 <b>Resumen — Persona Desaparecida</b>\n\nNombre: <b>${draft.name}</b>\nEdad: ${draft.age ?? "No indicada"}\nÚltimo lugar visto: ${loc}\nDescripción: ${draft.description ?? "Ninguna"}\nFoto: ${draft.photo_url ? "✅ Adjunta" : "No"}\nContacto: ${draft.contact_name ? `${draft.contact_name}${draft.contact_phone ? ` · ${draft.contact_phone}` : ""}` : "No indicado"}\n\n¿Confirmar y publicar?`;
}

async function finalizeMissingPerson(chatId: number, draft: Record<string, unknown>) {
  const err = await supabaseInsert("missing_persons", {
    name: String(draft.name ?? "").slice(0, 120),
    age: draft.age != null ? Number(draft.age) : null,
    last_seen_location: (draft.last_seen_location as string | null) ?? null,
    last_seen_lat: draft.last_seen_lat != null ? Number(draft.last_seen_lat) : null,
    last_seen_lng: draft.last_seen_lng != null ? Number(draft.last_seen_lng) : null,
    description: (draft.description as string | null) ?? null,
    photo_url: (draft.photo_url as string | null) ?? null,
    contact_name: (draft.contact_name as string | null) ?? null,
    contact_phone: (draft.contact_phone as string | null) ?? null,
    status: "missing", source_label: "Telegram", source_id: String(chatId),
  });
  clearSession(chatId);
  if (err) { await send(chatId, `⚠️ No se pudo guardar. Inténtalo de nuevo.`, removeKb()); console.error("[mp-insert]", err); return; }
  await send(chatId, `✅ <b>Persona registrada como desaparecida.</b>\n\nAparecerá en el mapa.\n\n🌐 <a href="https://venezuelaselevanta.info/desaparecidos">Ver lista completa</a>`, removeKb());
}

// ── Confirmation helpers ──────────────────────────────────────────────────
const isNaturalConfirm = (t: string) =>
  /^(sí|si|ok|dale|listo|confirmar?|publicar?|confirmo|publícalo|publicalo|va|claro|de acuerdo|sí confirmo|yes|adelante|procede|envíalo|envialo)/i.test(t.trim());
const isNaturalCancel = (t: string) =>
  /^(no|cancelar?|cancela|mejor no|déjalo|dejalo|olvídalo|olvidalo)/i.test(t.trim());

// ── Main update handler ───────────────────────────────────────────────────
async function processUpdate(update: Record<string, unknown>) {
  // ── Callback queries ──────────────────────────────────────────────────
  const cb = update.callback_query as {
    id: string; data: string; message: { chat: { id: number } };
  } | undefined;

  if (cb) {
    await tg("answerCallbackQuery", { callback_query_id: cb.id });
    const chatId = cb.message.chat.id;

    // ── Persona encontrada — paso 1: mostrar confirmación ──────────────
    if (cb.data.startsWith("found:")) {
      const personId = cb.data.slice(6);
      const rows = await supabaseSelect("missing_persons", `select=name,age,last_seen_location&id=eq.${encodeURIComponent(personId)}&limit=1`);
      if (!rows.length) { await send(chatId, "No se encontró ese registro."); return; }
      const p = rows[0];
      await send(chatId,
        `¿Confirmas que <b>${p.name}</b>${p.age ? ` (${p.age} años)` : ""}${p.last_seen_location ? `, visto/a en ${p.last_seen_location},` : ""} fue encontrado/a?`,
        ikb([[
          { text: "✅ Sí, fue encontrado/a", callback_data: `foundok:${personId}` },
          { text: "❌ Cancelar",             callback_data: "found_cancel" },
        ]])
      );
      return;
    }

    // ── Persona encontrada — paso 2: ejecutar actualización ────────────
    if (cb.data.startsWith("foundok:")) {
      const personId = cb.data.slice(8);
      const ok = await supabasePatch("missing_persons", `id=eq.${encodeURIComponent(personId)}`, { status: "found" });
      if (ok) {
        await send(chatId,
          `✅ <b>¡Gracias!</b> La persona fue marcada como encontrada.\n\n` +
          `Que buena noticia 🙏\n\n` +
          `🌐 <a href="https://venezuelaselevanta.info/desaparecidos">Ver lista de desaparecidos</a>`
        );
        statsCache = null; // invalidar cache de stats
      } else {
        await send(chatId, "⚠️ No se pudo actualizar el registro. Inténtalo de nuevo.");
      }
      return;
    }

    if (cb.data === "found_cancel") {
      await send(chatId, "Cancelado. Usa /encontrado si la encuentras.");
      return;
    }

    // ── Callbacks de flujo de reporte ──────────────────────────────────
    const session = await getOrLoadSession(chatId);
    if (!session) { await send(chatId, "La sesión expiró. Usa /reportar para empezar de nuevo."); return; }
    if (cb.data.startsWith("cat:") && session.state === "awaiting_category") {
      setSession(chatId, "awaiting_title", { ...session.draft, category: cb.data.slice(4) });
      await send(chatId, "2/6 · Escribe un <b>título breve</b> (ej: «Edificio colapsado en Av. Bolívar»).");
      return;
    }
    if (cb.data.startsWith("urg:") && session.state === "awaiting_urgency") {
      setSession(chatId, "awaiting_media", { ...session.draft, urgency: cb.data.slice(4), media_urls: [], media_thumbs: [] });
      await send(chatId, "5/6 · ¿Adjuntar <b>fotos o videos</b>?\n\nEnvía archivos y luego pulsa «✅ Listo, continuar».", mediaKb(false));
      return;
    }
    return;
  }

  // ── Regular messages ──────────────────────────────────────────────────
  const msg = (update.message ?? update.edited_message) as {
    chat: { id: number }; from?: { first_name?: string; username?: string }; text?: string;
    location?: { latitude: number; longitude: number };
    photo?: { file_id: string; width?: number; height?: number }[];
    video?: { file_id: string; thumb?: { file_id: string }; thumbnail?: { file_id: string } };
  } | undefined;
  if (!msg) return;

  const chatId   = msg.chat.id;
  const fromName = msg.from?.first_name ?? "Anónimo";
  const text     = (msg.text ?? "").trim();

  // Registrar usuario en background (fire and forget)
  registerUser(chatId, msg.from?.first_name ?? "", msg.from?.username);

  // ── Comandos globales ─────────────────────────────────────────────────
  if (text === "/start" || text.startsWith("/start "))  return handleStart(chatId);
  if (text === "/reportar")                             return startReport(chatId);
  if (text === "/registrar_desaparecido")               return startMissingPerson(chatId);
  if (text === "/cancelar" || text === "❌ Cancelar")   return cancelFlow(chatId);
  if (text === "/estado")                               return handleEstado(chatId);
  if (text.startsWith("/buscar"))
    return handleBuscar(chatId, text.replace(/^\/buscar\s*/i, "").trim());
  if (text.startsWith("/encontrado"))
    return handleEncontrado(chatId, text.replace(/^\/encontrado\s*/i, "").trim());
  if (text === "/myid")
    return send(chatId, `Tu chat ID es: <code>${chatId}</code>\n\nAgrega este número a TELEGRAM_ADMIN_IDS en el .env para acceder al broadcast.`);
  if (text === "/ayuda" || text === "/help") {
    return send(chatId,
      "<b>Comandos disponibles:</b>\n\n" +
      "/reportar — publicar incidente en el mapa\n" +
      "/registrar_desaparecido — registrar persona desaparecida\n" +
      "/encontrado [nombre] — marcar persona como encontrada\n" +
      "/buscar [nombre] — buscar desaparecidos\n" +
      "/estado — cifras actuales\n" +
      "/cancelar — cancelar operación\n\n" +
      "También puedes escribirme en lenguaje natural.\n\n" +
      "🌐 https://venezuelaselevanta.info"
    );
  }
  if (text.startsWith("/broadcast")) {
    if (!ADMIN_IDS.has(chatId)) return send(chatId, "Comando no disponible.");
    const msg2 = text.replace(/^\/broadcast\s*/i, "").trim();
    if (!msg2) return send(chatId, "Escribe el mensaje: /broadcast <mensaje de emergencia>");
    executeBroadcast(chatId, msg2); // sin await — continúa en background
    return;
  }

  const session = await getOrLoadSession(chatId);

  // ── Awaiting name ─────────────────────────────────────────────────────
  if (session?.state === "awaiting_user_name") {
    if (text && !text.startsWith("/")) {
      const userName = text.slice(0, 50).trim();
      setSession(chatId, "chat", {}, [], userName);
      await send(chatId,
        `Mucho gusto, <b>${userName}</b> 🤝\n\n` +
        `Cuéntame en qué te puedo ayudar. Puedo:\n\n` +
        `• Registrar un incidente en el mapa\n` +
        `• Registrar a una persona desaparecida\n` +
        `• Buscar a alguien por nombre\n` +
        `• Orientarte en la emergencia (números de auxilio, qué hacer, etc.)\n\n` +
        `Cuéntame con tus propias palabras, o usa los comandos:\n` +
        `/reportar · /registrar_desaparecido · /buscar · /estado`,
        removeKb(),
      );
      return;
    }
    return send(chatId, "¿Cómo te llamas? Escríbeme tu nombre.");
  }

  // ── Chat state ────────────────────────────────────────────────────────
  if (session?.state === "chat") {
    if (text && !text.startsWith("/")) return handleChat(chatId, text, session);
    return send(chatId, "Escríbeme algo o usa /reportar para registrar un incidente.");
  }

  // ── No session ────────────────────────────────────────────────────────
  if (!session) {
    if (text && !text.startsWith("/")) return handleChat(chatId, text, null);
    return send(chatId, "Hola 🇻🇪 Escríbeme lo que necesitas o usa /reportar.\n/ayuda — ver comandos");
  }

  // ── Flujo de reporte ──────────────────────────────────────────────────
  if (session.state === "awaiting_category" && text && !text.startsWith("/")) {
    const extracted = await extractReportFields(text);
    if (extracted?.category && VALID_CATS.has(extracted.category)) {
      const draft: Record<string, unknown> = { ...session.draft, category: extracted.category };
      if (extracted.title)                                         draft.title       = extracted.title.slice(0, 120);
      if (extracted.urgency && VALID_URGS.has(extracted.urgency)) draft.urgency     = extracted.urgency;
      if (extracted.description)                                   draft.description = extracted.description.slice(0, 1000);
      if (extracted.address)                                       draft._addr_hint  = extracted.address;
      if (draft.title && draft.urgency) {
        setSession(chatId, "awaiting_media", { ...draft, media_urls: [], media_thumbs: [] });
        return send(chatId, `✅ <b>${draft.title}</b>\n\n5/6 · ¿Adjuntar fotos o videos?`, mediaKb(false));
      }
      if (draft.title) {
        setSession(chatId, "awaiting_urgency", draft);
        return send(chatId, `✅ Categoría y título registrados.\n\n4/6 · Elige la <b>urgencia</b>:`, urgencyKb());
      }
      setSession(chatId, "awaiting_title", draft);
      const catName = CATEGORIES.find(c => c.slug === extracted.category)?.name ?? "";
      return send(chatId, `✅ Categoría: <b>${catName}</b>\n\n2/6 · Escribe un <b>título breve</b>:`);
    }
    return send(chatId, "Por favor elige una categoría con los botones 👆", categoryKb());
  }

  if (session.state === "awaiting_title" && text && !text.startsWith("/")) {
    if (text.length > 20) {
      const extracted = await extractReportFields(text);
      if (extracted?.title) {
        const draft: Record<string, unknown> = { ...session.draft, title: extracted.title.slice(0, 120) };
        if (!draft.category && extracted.category && VALID_CATS.has(extracted.category)) draft.category    = extracted.category;
        if (!draft.urgency  && extracted.urgency  && VALID_URGS.has(extracted.urgency))  draft.urgency     = extracted.urgency;
        if (extracted.description)                                                         draft.description = extracted.description.slice(0, 1000);
        if (extracted.address)                                                             draft._addr_hint  = extracted.address;
        if (draft.urgency && extracted.description) {
          setSession(chatId, "awaiting_media", { ...draft, media_urls: [], media_thumbs: [] });
          return send(chatId, `✅ Registrado: <b>${draft.title}</b>\n\n5/6 · ¿Adjuntar <b>fotos o videos</b>?`, mediaKb(false));
        }
        if (draft.urgency) {
          setSession(chatId, "awaiting_media", { ...draft, media_urls: [], media_thumbs: [] });
          return send(chatId, `✅ Título: <b>${draft.title}</b>\n\n5/6 · ¿Adjuntar fotos o videos?`, mediaKb(false));
        }
        if (extracted.description) {
          setSession(chatId, "awaiting_urgency", draft);
          return send(chatId, `✅ Título: <b>${draft.title}</b>\n\n4/6 · Elige la <b>urgencia</b>:`, urgencyKb());
        }
        setSession(chatId, "awaiting_description", draft);
        return send(chatId, `✅ Título: <b>${draft.title}</b>\n\n3/6 · Agrega más <b>detalles</b> (o «-» para omitir):`);
      }
    }
    setSession(chatId, "awaiting_description", { ...session.draft, title: text.slice(0, 120) });
    return send(chatId, "3/6 · Agrega una <b>descripción</b> con más detalles (o envía «-» para omitir).");
  }

  if (session.state === "awaiting_description" && text && !text.startsWith("/")) {
    setSession(chatId, "awaiting_urgency", { ...session.draft, description: text === "-" ? null : text.slice(0, 1000) });
    return send(chatId, "4/6 · Elige la <b>urgencia</b>:", urgencyKb());
  }

  if (session.state === "awaiting_media") {
    const cur  = (session.draft.media_urls   as string[]) ?? [];
    const curT = (session.draft.media_thumbs as string[]) ?? [];
    if (msg.photo?.length) {
      const up = await uploadPhoto(msg.photo);
      if (!up) { await send(chatId, "⚠️ No se pudo subir la foto.", mediaKb(cur.length > 0)); return; }
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
    if (text === "✅ Listo, continuar" || text === "⏭️ Omitir foto/video" || text === "/listo") {
      const draft = { ...session.draft };
      if (text === "⏭️ Omitir foto/video") { draft.media_urls = []; draft.media_thumbs = []; }
      if (draft._addr_hint && !draft.address) {
        await send(chatId, "⏳ Buscando coordenadas…");
        const hint = String(draft._addr_hint);
        const coords = await geocodeText(hint);
        delete draft._addr_hint;
        draft.address = hint.slice(0, 200);
        draft.lat = coords?.lat ?? 10.48;
        draft.lng = coords?.lng ?? -66.9;
        setSession(chatId, "awaiting_confirm", draft);
        const note = coords ? "" : "\n⚠️ <i>No se encontraron coordenadas exactas.</i>\n";
        return send(chatId, note + buildSummary(draft), confirmKb());
      }
      setSession(chatId, "awaiting_location", draft);
      return send(chatId, "6/6 · Comparte la <b>ubicación</b> del incidente.\n\nUsa el botón 📍 o escribe la dirección.", locationKb());
    }
    return send(chatId, "Envía fotos/videos, o usa los botones inferiores.", mediaKb(cur.length > 0));
  }

  if (session.state === "awaiting_location") {
    if (msg.location) {
      const { latitude: lat, longitude: lng } = msg.location;
      if (lat < VE_MIN_LAT || lat > VE_MAX_LAT || lng < VE_MIN_LNG || lng > VE_MAX_LNG)
        return send(chatId, "⚠️ La ubicación está fuera de Venezuela. Comparte la ubicación correcta o escribe la dirección.", locationKb());
      const draft = { ...session.draft, lat, lng };
      setSession(chatId, "awaiting_confirm", draft);
      return send(chatId, buildSummary(draft), confirmKb());
    }
    if (text === "✏️ Escribir dirección") {
      setSession(chatId, "awaiting_text_location", session.draft);
      return send(chatId, "Escribe la dirección o zona del incidente:", removeKb());
    }
    return send(chatId, "Usa el botón 📍 para compartir ubicación, o «✏️ Escribir dirección».", locationKb());
  }

  if (session.state === "awaiting_text_location" && text && !text.startsWith("/")) {
    await send(chatId, "⏳ Buscando coordenadas…");
    const coords = await geocodeText(text);
    const draft  = { ...session.draft, address: text.slice(0, 200), lat: coords?.lat ?? 10.48, lng: coords?.lng ?? -66.9 };
    setSession(chatId, "awaiting_confirm", draft);
    const note = coords ? "" : "\n⚠️ <i>No se encontraron coordenadas exactas. El marcador aparecerá aproximado.</i>\n";
    return send(chatId, note + buildSummary(draft), confirmKb());
  }

  if (session.state === "awaiting_confirm") {
    if (text === "✅ Confirmar y publicar" || isNaturalConfirm(text))
      return finalizeReport(chatId, session.draft, session.userName ?? fromName);
    if (text === "❌ Cancelar" || isNaturalCancel(text)) return cancelFlow(chatId);
    return send(chatId, "Pulsa «✅ Confirmar y publicar» o «❌ Cancelar».", confirmKb());
  }

  // ── Flujo de desaparecidos ────────────────────────────────────────────
  if (session.state === "mp_name" && text && !text.startsWith("/")) {
    setSession(chatId, "mp_age", { ...session.draft, name: text.slice(0, 120) });
    return send(chatId, "2/6 · ¿Cuál es la <b>edad aproximada</b>? (o escribe «desconocida»):");
  }

  if (session.state === "mp_age" && text && !text.startsWith("/")) {
    const m = text.match(/\d+/);
    setSession(chatId, "mp_location", { ...session.draft, age: m ? parseInt(m[0]) : null });
    return send(chatId, "3/6 · ¿Cuál fue el <b>último lugar</b> donde fue visto/a?\n\nUsa 📍 o escribe la dirección.", locationKb());
  }

  if (session.state === "mp_location") {
    if (msg.location) {
      const { latitude: lat, longitude: lng } = msg.location;
      setSession(chatId, "mp_description", { ...session.draft, last_seen_lat: lat, last_seen_lng: lng });
      return send(chatId, "4/6 · Describe a la persona: rasgos físicos, ropa, etc. (o «-» para omitir):", removeKb());
    }
    if (text === "✏️ Escribir dirección") {
      setSession(chatId, "mp_text_location", session.draft);
      return send(chatId, "Escribe la dirección o zona donde fue visto/a por última vez:", removeKb());
    }
    return send(chatId, "Usa 📍 para compartir la ubicación, o «✏️ Escribir dirección».", locationKb());
  }

  if (session.state === "mp_text_location" && text && !text.startsWith("/")) {
    await send(chatId, "⏳ Buscando coordenadas…");
    const coords = await geocodeText(text);
    setSession(chatId, "mp_description", {
      ...session.draft,
      last_seen_location: text.slice(0, 200),
      last_seen_lat: coords?.lat ?? null, last_seen_lng: coords?.lng ?? null,
    });
    return send(chatId, "4/6 · Describe a la persona: rasgos físicos, ropa, etc. (o «-» para omitir):", removeKb());
  }

  if (session.state === "mp_description" && text && !text.startsWith("/")) {
    setSession(chatId, "mp_photo", { ...session.draft, description: text === "-" ? null : text.slice(0, 1000) });
    return send(chatId, "5/6 · Envía una <b>foto</b> de la persona (muy útil),\no pulsa «⏭️ Omitir foto».", mpPhotoKb(false));
  }

  if (session.state === "mp_photo") {
    if (msg.photo?.length) {
      const up = await uploadPhoto(msg.photo);
      setSession(chatId, "mp_contact", { ...session.draft, photo_url: up?.url ?? null });
      return send(chatId, `${up?.url ? "📸 Foto recibida.\n\n" : ""}6/6 · Datos de <b>contacto</b>:\nNombre y teléfono (ej: <i>Ana López 0412-1234567</i>)\no «⏭️ Sin datos de contacto».`, mpContactKb());
    }
    if (text === "⏭️ Omitir foto" || text === "✅ Listo, continuar") {
      setSession(chatId, "mp_contact", { ...session.draft, photo_url: null });
      return send(chatId, "6/6 · Datos de <b>contacto</b>:\nNombre y teléfono, o «⏭️ Sin datos de contacto».", mpContactKb());
    }
    return send(chatId, "Envía una foto o pulsa «⏭️ Omitir foto».", mpPhotoKb(false));
  }

  if (session.state === "mp_contact") {
    if (text === "⏭️ Sin datos de contacto" || text === "-") {
      const draft = { ...session.draft };
      setSession(chatId, "mp_confirm", draft);
      return send(chatId, buildMissingSummary(draft), mpConfirmKb());
    }
    if (text && !text.startsWith("/")) {
      const phoneMatch = text.match(/(\d[\d\s\-()+]{5,})/);
      const phone = phoneMatch ? phoneMatch[0].trim() : null;
      const name  = phone ? text.replace(phone, "").replace(/[:\-,]/g, "").trim() || text : text;
      const draft = { ...session.draft, contact_name: name.slice(0, 80), contact_phone: phone?.slice(0, 30) ?? null };
      setSession(chatId, "mp_confirm", draft);
      return send(chatId, buildMissingSummary(draft), mpConfirmKb());
    }
    return send(chatId, "Escribe los datos de contacto o pulsa «⏭️ Sin datos de contacto».", mpContactKb());
  }

  if (session.state === "mp_confirm") {
    if (text === "✅ Confirmar y registrar" || isNaturalConfirm(text)) return finalizeMissingPerson(chatId, session.draft);
    if (text === "❌ Cancelar" || isNaturalCancel(text))               return cancelFlow(chatId);
    return send(chatId, "Pulsa «✅ Confirmar y registrar» o «❌ Cancelar».", mpConfirmKb());
  }
}

// ── Route ─────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!BOT) return new Response("Bot not configured", { status: 500 });
        const expected = createHash("sha256").update(BOT).digest("hex").slice(0, 64);
        const got      = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (got !== expected) return new Response("Unauthorized", { status: 401 });
        try { await processUpdate(await request.json()); } catch (err) { console.error("[telegram]", err); }
        return Response.json({ ok: true });
      },
      GET: async () => Response.json({ ok: true, bot: "@VenezuelaSeLevantabot" }),
    },
  },
});
