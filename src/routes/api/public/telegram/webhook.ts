import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

const BOT       = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TG_API    = `https://api.telegram.org/bot${BOT}`;
const SUPA_URL  = process.env.SUPABASE_URL!;
const SUPA_ANON = process.env.SUPABASE_PUBLISHABLE_KEY!;
const SUPA_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";

const VE_MIN_LAT = -1, VE_MAX_LAT = 14, VE_MIN_LNG = -74, VE_MAX_LNG = -59;

// ── Sessions (2h TTL) ─────────────────────────────────────────────────────
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

function getSession(id: number): Session | null {
  const s = sessions.get(id);
  if (!s) return null;
  if (Date.now() - s.at > SESSION_TTL) { sessions.delete(id); return null; }
  return s;
}
function setSession(
  id: number,
  state: string,
  draft: Record<string, unknown>,
  history?: HistoryEntry[],
  userName?: string,
) {
  const existing = sessions.get(id);
  sessions.set(id, {
    state,
    draft,
    history: history ?? existing?.history ?? [],
    userName: userName ?? existing?.userName,
    at: Date.now(),
  });
}
function clearSession(id: number) { sessions.delete(id); }

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
const urgencyKb = () => ikb([URGENCIES.map(u => ({ text: u.n, callback_data: `urg:${u.v}` }))]);
const mediaKb = (hasAny: boolean) => ({
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
const confirmKb = () => ({
  reply_markup: {
    keyboard: [[{ text: "✅ Confirmar y publicar" }, { text: "❌ Cancelar" }]],
    resize_keyboard: true, one_time_keyboard: true,
  },
});
const mpConfirmKb = () => ({
  reply_markup: {
    keyboard: [[{ text: "✅ Confirmar y registrar" }, { text: "❌ Cancelar" }]],
    resize_keyboard: true, one_time_keyboard: true,
  },
});
const mpPhotoKb = (hasPhoto: boolean) => ({
  reply_markup: {
    keyboard: [[{ text: hasPhoto ? "✅ Listo, continuar" : "⏭️ Omitir foto" }], [{ text: "❌ Cancelar" }]],
    resize_keyboard: true, one_time_keyboard: false,
  },
});
const mpContactKb = () => ({
  reply_markup: {
    keyboard: [[{ text: "⏭️ Sin datos de contacto" }], [{ text: "❌ Cancelar" }]],
    resize_keyboard: true, one_time_keyboard: false,
  },
});
const removeKb = () => ({ reply_markup: { remove_keyboard: true } });

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
    headers: { apikey: SUPA_SVC!, Authorization: `Bearer ${SUPA_SVC}`, "Content-Type": ct },
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

// ── Gemini API ────────────────────────────────────────────────────────────
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

// Conversational Gemini: generates natural language responses with crisis knowledge
async function geminiConverse(
  history: HistoryEntry[],
  userMsg: string,
  stats: { reports: number; missing: number; searching: number },
  userName?: string,
): Promise<string | null> {
  if (!GEMINI_KEY) return null;

  const systemText =
    `Eres el asistente del sistema "Venezuela Se Levanta", plataforma ciudadana de respuesta al terremoto en Venezuela.\n` +
    `Tu misión: orientar, informar y acompañar a las personas afectadas. Ayudarlas a registrar incidentes y encontrar desaparecidos.\n\n` +
    (userName ? `El usuario se llama ${userName}. Dirígete a él/ella por su nombre cuando sea natural y cálido.\n\n` : "") +
    `PERSONALIDAD: Cálido, sereno, venezolano. Habla con cercanía. Infunde calma. Nunca alarmista. Usa "chamo", "mi pana", "tranquilo/a" cuando sea natural.\n\n` +
    `Cuando el usuario quiera reportar un incidente o registrar un desaparecido, el sistema va a iniciar ese proceso automáticamente. Responde con algo breve y cálido tipo "Claro${userName ? ` ${userName}` : ""}, voy a ayudarte a registrar eso ahora." sin dar instrucciones adicionales.\n\n` +
    `NÚMEROS DE EMERGENCIA EN VENEZUELA:\n` +
    `• Protección Civil Nacional: 171\n` +
    `• Emergencias médicas / ambulancia: 911\n` +
    `• Cruz Roja Venezuela: 0212-557-2021\n` +
    `• Defensa Civil: 0800-344-6342\n` +
    `• Bomberos: 0800-266-2376\n\n` +
    `SI ALGUIEN ESTÁ ATRAPADO BAJO ESCOMBROS:\n` +
    `• Golpear tuberías o paredes con ritmo constante para hacer ruido\n` +
    `• No encender fuego ni usar encendedores (riesgo de fuga de gas)\n` +
    `• Cubrir boca y nariz con ropa contra el polvo\n` +
    `• Conservar energía, gritar solo cuando escuchen movimiento cerca\n` +
    `• Los rescatistas llegarán — mantener la calma es clave\n\n` +
    `QUÉ HACER DESPUÉS DE UN SISMO:\n` +
    `• Evaluar heridas propias y de los presentes antes de moverse\n` +
    `• No mover a heridos graves (lesiones espinales pueden empeorar)\n` +
    `• Alejarse de edificios dañados, postes y paredes agrietadas\n` +
    `• Si huele a gas: no encender nada, abrir ventanas, salir de inmediato\n` +
    `• No usar velas hasta confirmar que no hay escapes de gas\n` +
    `• Mantener el teléfono cargado y escuchar la radio AM\n` +
    `• Las réplicas son normales — alejarse de estructuras dañadas\n` +
    `• Verificar el agua antes de beberla (posibles tuberías rotas)\n\n` +
    `CÓMO AYUDAR A OTROS:\n` +
    `• Si ves a alguien herido que no puedes atender: llama al 911 y quédate con esa persona\n` +
    `• Para donar o recibir ayuda: usa /reportar con categoría Refugio\n` +
    `• Para reportar vías bloqueadas, edificios caídos, etc.: usa /reportar\n\n` +
    `ESTADÍSTICAS ACTUALES DEL MAPA (recientes):\n` +
    `• Reportes de crisis registrados: ${stats.reports}\n` +
    `• Personas registradas: ${stats.missing}\n` +
    `• Personas activamente buscadas: ${stats.searching}\n\n` +
    `FUNCIONES DEL BOT:\n` +
    `• /reportar → registrar un incidente en el mapa\n` +
    `• /registrar_desaparecido → registrar persona desaparecida\n` +
    `• /buscar [nombre] → buscar persona desaparecida\n` +
    `• /estado → ver estadísticas actuales\n\n` +
    `Responde de forma concisa (2-4 oraciones normalmente). Si la persona quiere reportar algo o buscar a alguien, guíala amablemente hacia esas funciones. ` +
    `Si hace preguntas de seguridad o crisis, responde directamente con la información que tienes.`;

  const recentHistory = history.slice(-10);
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const h of recentHistory) {
    contents.push({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] });
  }
  contents.push({ role: "user", parts: [{ text: userMsg }] });

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemText }] },
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

// ── Gemini intent / field extraction ─────────────────────────────────────
type IntentResult = {
  intent: "report" | "search_missing" | "register_missing" | "status" | "help" | "unknown";
  query?: string;
  category?: string;
  urgency?: string;
  title?: string;
};

const VALID_CATS = new Set(["missing","medical","rescue","shelter","infrastructure","evacuation","blocked_road","hospital"]);
const VALID_URGS = new Set(["critical","high","medium","low"]);

async function detectIntent(text: string): Promise<IntentResult | null> {
  const t = text.replace(/"/g, "'").slice(0, 300);
  return geminiJSON<IntentResult>(
    `Eres el asistente de "Venezuela Se Levanta", sistema de crisis post-terremoto.\n` +
    `El usuario escribió al bot de Telegram: "${t}"\n\n` +
    `Clasifica su intención. Responde SOLO con JSON válido:\n` +
    `{"intent":"report"|"search_missing"|"register_missing"|"status"|"help"|"unknown",` +
    `"query":"nombre buscado si intent=search_missing",` +
    `"category":"missing|medical|rescue|shelter|infrastructure|evacuation|blocked_road|hospital",` +
    `"urgency":"critical|high|medium|low",` +
    `"title":"título corto del incidente si es reporte"}\n\n` +
    `Categorías: missing=desaparecidos, medical=heridos, rescue=rescate/atrapados, ` +
    `shelter=refugio/albergue, infrastructure=daños estructurales, evacuation=evacuación, ` +
    `blocked_road=vías bloqueadas, hospital=centros médicos activos`
  );
}

type ReportExtract = {
  title?: string;
  description?: string;
  category?: string;
  urgency?: string;
  address?: string;
};

async function extractReportFields(text: string): Promise<ReportExtract | null> {
  const t = text.replace(/"/g, "'").slice(0, 500);
  return geminiJSON<ReportExtract>(
    `Extrae campos de un reporte de crisis en Venezuela. Mensaje: "${t}"\n\n` +
    `Responde SOLO con JSON (omite campos que no estén claramente en el mensaje):\n` +
    `{"title":"título conciso máx 100 chars",` +
    `"description":"detalles adicionales",` +
    `"category":"missing|medical|rescue|shelter|infrastructure|evacuation|blocked_road|hospital",` +
    `"urgency":"critical|high|medium|low",` +
    `"address":"dirección o zona mencionada"}`
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
  const lines = data.map(r =>
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
  const stats = await getQuickStats();
  await send(chatId,
    `📊 <b>Estado del mapa — Venezuela Se Levanta</b>\n\n` +
    `📋 Reportes de crisis: <b>${stats.reports.toLocaleString("es")}</b>\n` +
    `👥 Personas registradas: <b>${stats.missing.toLocaleString("es")}</b>\n` +
    `🔴 Sin encontrar: <b>${stats.searching.toLocaleString("es")}</b>\n\n` +
    `🌐 https://venezuelaselevanta.info`
  );
}

// ── Conversational chat handler ───────────────────────────────────────────
// Handles both the "chat" session state and no-session free-text messages.
// Detects structured intents first and starts the corresponding flow inline;
// falls back to Gemini conversational response for everything else.
async function handleChat(chatId: number, text: string, session: Session | null): Promise<void> {
  const history  = session?.history ?? [];
  const userName = session?.userName;
  const greet    = userName ? `Claro ${userName}, ` : "Entendido, ";

  // ── Detect structured intent first ────────────────────────────────────
  const intent = await detectIntent(text);

  if (intent?.intent === "report") {
    const draft: Record<string, unknown> = {};
    if (intent.category && VALID_CATS.has(intent.category)) draft.category = intent.category;
    if (intent.urgency  && VALID_URGS.has(intent.urgency))  draft.urgency  = intent.urgency;
    if (intent.title)                                         draft.title    = String(intent.title).slice(0, 120);

    if (draft.category && draft.title) {
      setSession(chatId, "awaiting_description", draft);
      const catName = CATEGORIES.find(c => c.slug === draft.category)?.name ?? "";
      await send(chatId, `${greet}voy a registrar: <b>${draft.title}</b> (${catName})\n\n3/6 · Agrega más detalles (o «-» para omitir):`);
      return;
    }
    if (draft.category) {
      setSession(chatId, "awaiting_title", draft);
      const catName = CATEGORIES.find(c => c.slug === draft.category)?.name ?? "";
      await send(chatId, `${greet}Categoría: <b>${catName}</b>\n\n2/6 · Escribe un <b>título breve</b>:`);
      return;
    }
    setSession(chatId, "awaiting_category", draft);
    await send(chatId, `${greet}voy a ayudarte a registrar el incidente.\n\n1/6 · Elige la <b>categoría</b>:`, categoryKb());
    return;
  }

  if (intent?.intent === "register_missing") {
    await send(chatId, `${greet}voy a registrar a la persona desaparecida.`);
    return startMissingPerson(chatId);
  }

  if (intent?.intent === "search_missing") {
    if (intent.query) return handleBuscar(chatId, intent.query);
    return send(chatId, `${userName ? `${userName}, ¿` : "¿"}cómo se llama la persona que buscas? Escribe el nombre completo.`);
  }

  if (intent?.intent === "status") return handleEstado(chatId);

  // ── Conversational response for help / unknown ─────────────────────────
  const stats    = await getQuickStats();
  const response = await geminiConverse(history, text, stats, userName);

  if (response) {
    const newHistory: HistoryEntry[] = [
      ...history,
      { role: "user" as const, text },
      { role: "bot" as const, text: response },
    ].slice(-16);
    setSession(chatId, "chat", session?.draft ?? {}, newHistory);
    await send(chatId, response);
    return;
  }

  // Fallback when Gemini is unavailable
  const name = userName ? ` ${userName}` : "";
  await send(chatId,
    `Estoy aquí para ayudarte${name} 🇻🇪\n\n` +
    `En emergencias: <b>171</b> (Protección Civil) · <b>911</b>\n\n` +
    `/reportar · /registrar_desaparecido · /buscar · /estado`
  );
}

// ── Report flow ───────────────────────────────────────────────────────────
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
  const mediaUrls   = (draft.media_urls   as string[] | undefined) ?? [];
  const mediaThumbs = (draft.media_thumbs as string[] | undefined) ?? [];
  const err = await supabaseInsert("reports", {
    title:         String(draft.title ?? "Reporte vía Telegram").slice(0, 120),
    description:   (draft.description as string | null) ?? null,
    category:      String(draft.category ?? "infrastructure"),
    urgency:       String(draft.urgency ?? "medium"),
    status:        "active",
    address:       (draft.address as string | null) ?? null,
    lat:           draft.lat != null ? Number(draft.lat) : 10.48,
    lng:           draft.lng != null ? Number(draft.lng) : -66.9,
    reporter_name: `${name} (Telegram)`,
    photo_url:     mediaUrls[0] ?? null,
    media_urls:    mediaUrls,
    media_thumbs:  mediaThumbs,
  });
  clearSession(chatId);
  if (err) { await send(chatId, `⚠️ No se pudo guardar el reporte: ${err}`, removeKb()); return; }
  const thanks = name !== "Anónimo" ? ` Gracias, ${name}` : "";
  await send(chatId,
    `✅ <b>¡Reporte publicado!</b>${mediaUrls.length ? `\n📎 ${mediaUrls.length} adjunto(s).` : ""}\n` +
    `Ya aparece en el mapa.${thanks} 🇻🇪\n\n` +
    `/reportar para otro | /estado para ver cifras`,
    removeKb(),
  );
}

// ── Missing person flow ───────────────────────────────────────────────────
async function startMissingPerson(chatId: number) {
  setSession(chatId, "mp_name", {});
  await send(chatId,
    "📋 <b>Registrar persona desaparecida</b>\n\n" +
    "1/6 · Escribe el <b>nombre completo</b> de la persona:",
    removeKb()
  );
}

function buildMissingSummary(draft: Record<string, unknown>): string {
  const loc = draft.last_seen_location
    ? String(draft.last_seen_location)
    : (draft.last_seen_lat != null
        ? `${Number(draft.last_seen_lat).toFixed(4)}, ${Number(draft.last_seen_lng).toFixed(4)}`
        : "No indicado");
  return `📋 <b>Resumen — Persona Desaparecida</b>\n\n` +
    `Nombre: <b>${draft.name}</b>\n` +
    `Edad: ${draft.age ?? "No indicada"}\n` +
    `Último lugar visto: ${loc}\n` +
    `Descripción: ${draft.description ?? "Ninguna"}\n` +
    `Foto: ${draft.photo_url ? "✅ Adjunta" : "No"}\n` +
    `Contacto: ${draft.contact_name
      ? `${draft.contact_name}${draft.contact_phone ? ` · ${draft.contact_phone}` : ""}`
      : "No indicado"}\n\n` +
    `¿Confirmar y publicar?`;
}

async function finalizeMissingPerson(chatId: number, draft: Record<string, unknown>) {
  const err = await supabaseInsert("missing_persons", {
    name:               String(draft.name ?? "").slice(0, 120),
    age:                draft.age != null ? Number(draft.age) : null,
    last_seen_location: (draft.last_seen_location as string | null) ?? null,
    last_seen_lat:      draft.last_seen_lat != null ? Number(draft.last_seen_lat) : null,
    last_seen_lng:      draft.last_seen_lng != null ? Number(draft.last_seen_lng) : null,
    description:        (draft.description as string | null) ?? null,
    photo_url:          (draft.photo_url as string | null) ?? null,
    contact_name:       (draft.contact_name as string | null) ?? null,
    contact_phone:      (draft.contact_phone as string | null) ?? null,
    status:             "missing",
    source_label:       "Telegram",
    source_id:          String(chatId),
  });
  clearSession(chatId);
  if (err) { await send(chatId, `⚠️ No se pudo guardar: ${err}`, removeKb()); return; }
  await send(chatId,
    `✅ <b>Persona registrada como desaparecida.</b>\n\n` +
    `Aparecerá en el mapa. Si la encuentran, notifícanos por aquí.\n\n` +
    `🌐 <a href="https://venezuelaselevanta.info/desaparecidos">Ver lista completa</a>`,
    removeKb()
  );
}

// ── Natural-language confirmation helpers ─────────────────────────────────
function isNaturalConfirm(text: string): boolean {
  return /^(sí|si|ok|dale|listo|confirmar?|publicar?|confirmo|publícalo|publicalo|va|claro|de acuerdo|sí confirmo|yes|adelante|procede|envíalo|envialo)/i.test(text.trim());
}
function isNaturalCancel(text: string): boolean {
  return /^(no|cancelar?|cancela|mejor no|déjalo|dejalo|olvídalo|olvidalo)/i.test(text.trim());
}

// ── Main update handler ───────────────────────────────────────────────────
async function processUpdate(update: Record<string, unknown>) {
  // Callback queries (inline keyboards)
  const cb = update.callback_query as {
    id: string; data: string;
    message: { chat: { id: number } };
  } | undefined;

  if (cb) {
    await tg("answerCallbackQuery", { callback_query_id: cb.id });
    const chatId  = cb.message.chat.id;
    const session = getSession(chatId);
    if (!session) { await send(chatId, "La sesión expiró. Usa /reportar para empezar de nuevo."); return; }
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

  const chatId   = msg.chat.id;
  const fromName = msg.from?.first_name ?? "Anónimo";
  const text     = (msg.text ?? "").trim();

  // Global commands (always handled, regardless of session state)
  if (text === "/start" || text.startsWith("/start "))    return handleStart(chatId);
  if (text === "/reportar")                               return startReport(chatId);
  if (text === "/registrar_desaparecido")                 return startMissingPerson(chatId);
  if (text === "/cancelar" || text === "❌ Cancelar")     return cancelFlow(chatId);
  if (text === "/estado")                                 return handleEstado(chatId);
  if (text.startsWith("/buscar"))
    return handleBuscar(chatId, text.replace(/^\/buscar\s*/i, "").trim());
  if (text === "/ayuda" || text === "/help") {
    return send(chatId,
      "<b>Comandos disponibles:</b>\n\n" +
      "/reportar — publicar incidente en el mapa\n" +
      "/registrar_desaparecido — registrar persona desaparecida\n" +
      "/buscar [nombre] — buscar desaparecidos\n" +
      "/estado — cifras actuales\n" +
      "/cancelar — cancelar operación\n\n" +
      "También puedes preguntarme en lenguaje natural:\n" +
      "«¿qué hago si hay una réplica?», «números de emergencia», «cómo ayudar», etc.\n\n" +
      "🌐 https://venezuelaselevanta.info"
    );
  }

  const session = getSession(chatId);

  // ── Awaiting user name (after /start greeting) ────────────────────────────
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
        `• Orientarte sobre qué hacer en la emergencia\n` +
        `• Darte números de emergencia y protocolos de seguridad\n\n` +
        `Cuéntame lo que necesitas con tus propias palabras, o usa los comandos:\n` +
        `/reportar · /registrar_desaparecido · /buscar · /estado`,
        removeKb(),
      );
      return;
    }
    return send(chatId, "¿Cómo te llamas? Escríbeme tu nombre para poder ayudarte mejor.");
  }

  // ── Chat state: free-form conversation ────────────────────────────────────
  if (session?.state === "chat") {
    if (text && !text.startsWith("/")) {
      return handleChat(chatId, text, session);
    }
    return send(chatId, "Escríbeme algo, o usa /reportar para registrar un incidente.");
  }

  // ── No session: route through handleChat (detects intent + converses) ───────
  if (!session) {
    if (text && !text.startsWith("/")) return handleChat(chatId, text, null);
    return send(chatId,
      "Hola 🇻🇪 Escríbeme lo que necesitas o usa /reportar para registrar un incidente.\n" +
      "También puedo responder preguntas sobre seguridad y emergencias.\n\n" +
      "/ayuda — ver todos los comandos"
    );
  }

  // ── Report flow ───────────────────────────────────────────────────────────

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
        const catName = CATEGORIES.find(c => c.slug === extracted.category)?.name ?? "";
        return send(chatId, `✅ <b>${draft.title}</b> · ${catName}\n\n5/6 · ¿Adjuntar fotos o videos?`, mediaKb(false));
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
        if (!draft.category && extracted.category && VALID_CATS.has(extracted.category)) draft.category     = extracted.category;
        if (!draft.urgency  && extracted.urgency  && VALID_URGS.has(extracted.urgency))  draft.urgency      = extracted.urgency;
        if (extracted.description)                                                         draft.description  = extracted.description.slice(0, 1000);
        if (extracted.address)                                                             draft._addr_hint   = extracted.address;

        const catName = CATEGORIES.find(c => c.slug === draft.category)?.name ?? "";
        const urgName = URGENCIES.find(u => u.v === draft.urgency)?.n ?? "";

        if (draft.urgency && extracted.description) {
          setSession(chatId, "awaiting_media", { ...draft, media_urls: [], media_thumbs: [] });
          return send(chatId,
            `✅ Registrado: <b>${draft.title}</b>\n` +
            `${catName ? `🏷️ ${catName}` : ""}${urgName ? ` · ${urgName}` : ""}\n\n` +
            `5/6 · ¿Adjuntar <b>fotos o videos</b>?`,
            mediaKb(false)
          );
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
        const hint   = String(draft._addr_hint);
        const coords = await geocodeText(hint);
        delete draft._addr_hint;
        draft.address = hint.slice(0, 200);
        draft.lat     = coords?.lat ?? 10.48;
        draft.lng     = coords?.lng ?? -66.9;
        setSession(chatId, "awaiting_confirm", draft);
        const note = coords ? "" : "\n⚠️ <i>No se encontraron coordenadas exactas.</i>\n";
        return send(chatId, note + buildSummary(draft), confirmKb());
      }
      setSession(chatId, "awaiting_location", draft);
      return send(chatId,
        "6/6 · Comparte la <b>ubicación</b> del incidente.\n\nUsa el botón 📍 o escribe la dirección si no tienes GPS.",
        locationKb()
      );
    }
    return send(chatId, "Envía fotos/videos, o usa los botones inferiores.", mediaKb(cur.length > 0));
  }

  if (session.state === "awaiting_location") {
    if (msg.location) {
      const { latitude: lat, longitude: lng } = msg.location;
      if (lat < VE_MIN_LAT || lat > VE_MAX_LAT || lng < VE_MIN_LNG || lng > VE_MAX_LNG) {
        return send(chatId, "⚠️ La ubicación está fuera de Venezuela. Comparte la ubicación correcta o escribe la dirección.", locationKb());
      }
      const draft = { ...session.draft, lat, lng };
      setSession(chatId, "awaiting_confirm", draft);
      return send(chatId, buildSummary(draft), confirmKb());
    }
    if (text === "✏️ Escribir dirección") {
      setSession(chatId, "awaiting_text_location", session.draft);
      return send(chatId, "Escribe la dirección o zona del incidente\n(ej: <i>Catia La Mar, cerca del mercado municipal</i>):", removeKb());
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
    if (text === "❌ Cancelar" || isNaturalCancel(text))
      return cancelFlow(chatId);
    return send(chatId, "Pulsa «✅ Confirmar y publicar» o «❌ Cancelar».", confirmKb());
  }

  // ── Missing person flow ───────────────────────────────────────────────────

  if (session.state === "mp_name" && text && !text.startsWith("/")) {
    setSession(chatId, "mp_age", { ...session.draft, name: text.slice(0, 120) });
    return send(chatId, "2/6 · ¿Cuál es la <b>edad aproximada</b>? (o escribe «desconocida»):");
  }

  if (session.state === "mp_age" && text && !text.startsWith("/")) {
    const m   = text.match(/\d+/);
    const age = m ? parseInt(m[0]) : null;
    setSession(chatId, "mp_location", { ...session.draft, age });
    return send(chatId,
      "3/6 · ¿Cuál fue el <b>último lugar</b> donde fue visto/a?\n\nUsa 📍 o escribe la dirección.",
      locationKb()
    );
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
      last_seen_lat:      coords?.lat ?? null,
      last_seen_lng:      coords?.lng ?? null,
    });
    return send(chatId, "4/6 · Describe a la persona: rasgos físicos, ropa, etc. (o «-» para omitir):", removeKb());
  }

  if (session.state === "mp_description" && text && !text.startsWith("/")) {
    setSession(chatId, "mp_photo", { ...session.draft, description: text === "-" ? null : text.slice(0, 1000) });
    return send(chatId,
      "5/6 · Envía una <b>foto</b> de la persona (muy útil para la búsqueda),\no pulsa «⏭️ Omitir foto».",
      mpPhotoKb(false)
    );
  }

  if (session.state === "mp_photo") {
    if (msg.photo?.length) {
      const up       = await uploadPhoto(msg.photo);
      const photoUrl = up?.url ?? null;
      setSession(chatId, "mp_contact", { ...session.draft, photo_url: photoUrl });
      return send(chatId,
        `${photoUrl ? "📸 Foto recibida.\n\n" : ""}` +
        "6/6 · Datos de <b>contacto</b>:\nEscribe nombre y teléfono (ej: <i>Ana López 0412-1234567</i>),\no pulsa «⏭️ Sin datos de contacto».",
        mpContactKb()
      );
    }
    if (text === "⏭️ Omitir foto" || text === "✅ Listo, continuar") {
      setSession(chatId, "mp_contact", { ...session.draft, photo_url: null });
      return send(chatId,
        "6/6 · Datos de <b>contacto</b>:\nEscribe nombre y teléfono (ej: <i>Ana López 0412-1234567</i>),\no pulsa «⏭️ Sin datos de contacto».",
        mpContactKb()
      );
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
      const phone      = phoneMatch ? phoneMatch[0].trim() : null;
      const name       = phone ? text.replace(phone, "").replace(/[:\-,]/g, "").trim() || text : text;
      const draft      = { ...session.draft, contact_name: name.slice(0, 80), contact_phone: phone?.slice(0, 30) ?? null };
      setSession(chatId, "mp_confirm", draft);
      return send(chatId, buildMissingSummary(draft), mpConfirmKb());
    }
    return send(chatId, "Escribe los datos de contacto o pulsa «⏭️ Sin datos de contacto».", mpContactKb());
  }

  if (session.state === "mp_confirm") {
    if (text === "✅ Confirmar y registrar" || isNaturalConfirm(text))
      return finalizeMissingPerson(chatId, session.draft);
    if (text === "❌ Cancelar" || isNaturalCancel(text))
      return cancelFlow(chatId);
    return send(chatId, "Pulsa «✅ Confirmar y registrar» o «❌ Cancelar».", mpConfirmKb());
  }
}

// ── Route ──────────────────────────────────────────────────────────────────
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
