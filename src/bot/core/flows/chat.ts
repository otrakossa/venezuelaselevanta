// ── Conversación libre (Gemini) + ruteo de intención ─────────────────────
import type { EngineCtx, Session } from "../types";
import { CATEGORIES, VALID_CATS, VALID_URGS } from "../constants";
import { categoryKb } from "../keyboards";
import { detectIntent, geminiConverse } from "../nlp";
import { getQuickStats, handleEstado } from "./status";
import { handleBuscar } from "./search";
import { startMissingPerson } from "./missing";

export async function handleChat(
  ctx: EngineCtx,
  text: string,
  session: Session | null,
): Promise<void> {
  const history = session?.history ?? [];
  const userName = session?.userName;
  const greet = userName ? `Claro ${userName}, ` : "Entendido, ";

  const intent = await detectIntent(text);

  if (intent?.intent === "report") {
    const draft: Record<string, unknown> = {};
    if (intent.category && VALID_CATS.has(intent.category)) draft.category = intent.category;
    if (intent.urgency && VALID_URGS.has(intent.urgency)) draft.urgency = intent.urgency;
    if (intent.title) draft.title = String(intent.title).slice(0, 120);
    if (draft.category && draft.title) {
      ctx.setSession("awaiting_description", draft);
      await ctx.send(
        `${greet}voy a registrar: <b>${draft.title}</b>\n\n3/6 · Agrega más detalles (o «-» para omitir):`,
      );
      return;
    }
    if (draft.category) {
      ctx.setSession("awaiting_title", draft);
      const catName = CATEGORIES.find((c) => c.slug === draft.category)?.name ?? "";
      await ctx.send(`${greet}Categoría: <b>${catName}</b>\n\n2/6 · Escribe un <b>título breve</b>:`);
      return;
    }
    ctx.setSession("awaiting_category", draft);
    await ctx.send(
      `${greet}voy a ayudarte a registrar el incidente.\n\n1/6 · Elige la <b>categoría</b>:`,
      categoryKb(),
    );
    return;
  }
  if (intent?.intent === "register_missing") {
    await ctx.send(`${greet}voy a registrar a la persona desaparecida.`);
    return startMissingPerson(ctx);
  }
  if (intent?.intent === "search_missing") {
    if (intent.query) {
      await handleBuscar(ctx, intent.query);
      return;
    }
    await ctx.send(`¿Cómo se llama la persona que buscas?`);
    return;
  }
  if (intent?.intent === "status") return handleEstado(ctx);

  const stats = await getQuickStats();
  const response = await geminiConverse(history, text, stats, userName);
  if (response) {
    const newHistory = [
      ...history,
      { role: "user" as const, text },
      { role: "bot" as const, text: response },
    ].slice(-16);
    ctx.setSession("chat", session?.draft ?? {}, newHistory);
    await ctx.send(response);
    return;
  }
  const name = userName ? ` ${userName}` : "";
  await ctx.send(
    `Estoy aquí para ayudarte${name} 🇻🇪\n\nEmergencias: <b>171</b> · <b>911</b>\n\n/reportar · /registrar_desaparecido · /buscar · /estado`,
  );
}
