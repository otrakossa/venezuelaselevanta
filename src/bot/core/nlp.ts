// ── Gemini 2.0 Flash: intención, extracción de campos y conversación ──────
import type { HistoryEntry } from "./types";

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function geminiJSON<T>(prompt: string): Promise<T | null> {
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
    if (!res.ok) {
      console.error("[gemini]", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error("[gemini]", e);
    return null;
  }
}

export async function geminiConverse(
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
    if (!res.ok) {
      console.error("[gemini-chat]", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch (e) {
    console.error("[gemini-chat]", e);
    return null;
  }
}

export type IntentResult = {
  intent: "report" | "search_missing" | "register_missing" | "status" | "help" | "unknown";
  query?: string;
  category?: string;
  urgency?: string;
  title?: string;
};

export async function detectIntent(text: string): Promise<IntentResult | null> {
  const t = text.replace(/"/g, "'").slice(0, 300);
  return geminiJSON<IntentResult>(
    `Eres el asistente de "Venezuela Se Levanta", sistema de crisis post-terremoto.\n` +
      `El usuario escribió: "${t}"\n\n` +
      `Clasifica la intención. Responde SOLO JSON:\n` +
      `{"intent":"report"|"search_missing"|"register_missing"|"status"|"help"|"unknown",` +
      `"query":"nombre si search_missing","category":"missing|medical|rescue|shelter|infrastructure|evacuation|blocked_road|hospital",` +
      `"urgency":"critical|high|medium|low","title":"título si reporte"}`,
  );
}

export type ReportExtract = {
  title?: string;
  description?: string;
  category?: string;
  urgency?: string;
  address?: string;
};

export async function extractReportFields(text: string): Promise<ReportExtract | null> {
  const t = text.replace(/"/g, "'").slice(0, 500);
  return geminiJSON<ReportExtract>(
    `Extrae campos de un reporte de crisis en Venezuela. Mensaje: "${t}"\n\n` +
      `SOLO JSON (omite campos ausentes):\n` +
      `{"title":"máx 100 chars","description":"detalles","category":"missing|medical|rescue|shelter|infrastructure|evacuation|blocked_road|hospital","urgency":"critical|high|medium|low","address":"dirección"}`,
  );
}
