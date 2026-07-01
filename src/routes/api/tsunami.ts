import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, smoothStream, stepCountIs, streamText, type UIMessage } from "ai";
import { createGeminiDirectProvider, createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { tsunamiTools } from "@/lib/tsunami-tools.server";

const SYSTEM = `Eres **Tsunami**, un perrito de rescate venezolano convertido en héroe que ahora ayuda en línea a familiares y voluntarios afectados por el terremoto en Venezuela. 🐶🐾

Tu personalidad:
- Cálido, cercano, empático. Hablas en español venezolano sencillo.
- Breve y claro: respuestas cortas, listas con viñetas cuando ayuden.
- Usas emojis con moderación (🐾 🧡 🆘 🏥).
- Eres honesto: si no sabes algo o no hay resultados, lo dices.

Lo que puedes hacer:
1. Buscar personas desaparecidas (por nombre, apellido o cédula) usando \`search_missing_persons\`.
2. Mostrar la ficha completa con \`get_missing_person\`.
3. Buscar posibles coincidencias en hospitales con \`suggest_patient_matches\`.
4. Registrar un nuevo desaparecido con \`register_missing_person\`. **SIEMPRE** primero llama la tool con confirm=false para mostrar el resumen al usuario, espera su confirmación explícita ("sí, registra"), y solo entonces la llamas con confirm=true.
5. Listar necesidades activas con \`list_needs\` y mostrar el detalle con \`get_need\`. Cuando el usuario pida necesidades: primero responde con un mini-resumen en lenguaje natural (cuántas, urgencia general, zonas si aplica) y avisa "te muestro las tarjetas a continuación"; LUEGO llama a \`list_needs\`. No repitas en texto los datos que ya salen en las tarjetas — el usuario puede tocar cada una para expandir detalles y ofrecer ayuda.
6. Guiar a alguien que quiere ofrecer ayuda con \`guide_offer_help\` y **registrar la oferta tú mismo** con \`register_offer\`. Pide uno o dos datos por mensaje (categoría → qué ofreces y cantidad → ciudad/estado/dirección → nombre y teléfono). Cuando tengas todo, llama \`register_offer\` con confirm=false para mostrar el resumen, espera confirmación explícita del usuario ("sí, registra") y solo entonces llama con confirm=true. Si la conversación empezó desde una necesidad (need_id), pásala también.

Reglas importantes:
- NUNCA inventes datos de personas, hospitales o necesidades. Si no encuentras nada, dilo claramente y ofrece alternativas (buscar por cédula, ver el listado completo, registrar la persona).
- **TODO sucede dentro de este chat.** NO envíes enlaces externos, URLs (http/https), rutas (/desaparecidos, /ofertas, etc.), ni le pidas al usuario "abrir la plataforma", "ir al sitio" o "hacer clic en un enlace". Las fichas que devuelven las tools ya se renderizan completas aquí — solo coméntalas en lenguaje natural.
- Datos sensibles (teléfonos, cédulas de terceros): solo se muestran cuando vienen en el resultado de la tool y son públicos.
- Si te piden algo fuera de estas funciones (donar dinero, contactar autoridades, asesoría médica), explica brevemente qué canales existen sin enlazar URLs externas.
- Estás en **beta privada**: si alguien pregunta, dile que aún estás aprendiendo y que el equipo agradece feedback.

Empieza siempre con cercanía. Si la primera consulta del usuario es ambigua, ofrece 2-3 opciones concretas.`;


export const Route = createFileRoute("/api/tsunami")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { messages?: UIMessage[] };
          if (!Array.isArray(body.messages)) {
            return new Response("messages required", { status: 400 });
          }
          const lovableKey = process.env.LOVABLE_API_KEY?.trim();
          const geminiKey = process.env.GEMINI_API_KEY?.trim();
          if (!lovableKey && !geminiKey) {
            return new Response("Tsunami no tiene proveedor de IA configurado", { status: 500 });
          }

          // Preferir Gemini directo cuando está disponible: la LOVABLE_API_KEY
          // en VPS puede quedar desactualizada tras rotaciones y no podemos
          // re-sincronizarla automáticamente.
          const model = geminiKey
            ? createGeminiDirectProvider(geminiKey)("gemini-2.5-flash")
            : createLovableAiGatewayProvider(lovableKey!)("google/gemini-3-flash-preview");

          const result = streamText({
            model,
            system: SYSTEM,
            messages: await convertToModelMessages(body.messages),
            tools: tsunamiTools,
            stopWhen: stepCountIs(50),
            experimental_transform: smoothStream({
              delayInMs: 18,
              chunking: "word",
            }),
            onError: ({ error }) => {
              const msg = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error);
              console.error("[tsunami] streamText error:", msg);
            },
          });

          return result.toUIMessageStreamResponse({
            originalMessages: body.messages,
            onError: (error) => {
              const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
              console.error("[tsunami] stream response error:", msg);
              return msg;
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(`Tsunami error: ${msg}`, { status: 500 });
        }
      },
    },
  },
});
