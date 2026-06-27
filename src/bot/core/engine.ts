// ── Motor del bot (agnóstico de canal) ────────────────────────────────────
// Recibe un IncomingMessage normalizado + un EngineCtx (provisto por la ruta
// del canal) y orquesta comandos, callbacks y la máquina de estados. NO
// conoce Telegram: todo el transporte vive tras ctx / el ChannelAdapter.
import type { IncomingMessage } from "@/channels/types";
import type { EngineCtx } from "./types";
import { removeKb } from "./keyboards";
import { cancelFlow, handleStart } from "./flows/common";
import { handleChat } from "./flows/chat";
import { handleEstado } from "./flows/status";
import { handleBuscar, handleEncontrado, handleFoundConfirm, handleFoundOk } from "./flows/search";
import {
  handleAwaitingCategory,
  handleAwaitingConfirm,
  handleAwaitingDescription,
  handleAwaitingLocation,
  handleAwaitingMedia,
  handleAwaitingTextLocation,
  handleAwaitingTitle,
  onCategoryCallback,
  onUrgencyCallback,
  startReport,
} from "./flows/report";
import {
  handleMpAge,
  handleMpConfirm,
  handleMpContact,
  handleMpDescription,
  handleMpLocation,
  handleMpName,
  handleMpPhoto,
  handleMpTextLocation,
  startMissingPerson,
} from "./flows/missing";
import {
  NEEDS_FLOW_ENABLED,
  handleNeedCategoryText,
  handleNeedConfirm,
  handleNeedDescription,
  handleNeedLocation,
  handleNeedQuantity,
  handleNeedResponsible,
  handleNeedSite,
  handleNeedTextLocation,
  onNeedCategoryCallback,
  startNeed,
} from "./flows/need";
import {
  HELP_FLOW_ENABLED,
  handleHelpCategoryText,
  handleHelpLocation,
  handleHelpPickText,
  handleHelpTextLocation,
  onHelpCategoryCallback,
  onHelpPickCallback,
  startHelp,
} from "./flows/help";

const HELP_TEXT =
  "<b>Comandos disponibles:</b>\n\n" +
  "/reportar — publicar incidente en el mapa\n" +
  "/registrar_desaparecido — registrar persona desaparecida\n" +
  "/encontrado [nombre] — marcar persona como encontrada\n" +
  "/buscar [nombre] — buscar desaparecidos\n" +
  "/estado — cifras actuales\n" +
  "/cancelar — cancelar operación\n\n" +
  "También puedes escribirme en lenguaje natural.\n\n" +
  "🌐 https://venezuelaselevanta.info";

export async function handle(incoming: IncomingMessage, ctx: EngineCtx): Promise<void> {
  // ── Callbacks (botones inline) ──────────────────────────────────────────
  if (incoming.callbackData != null) {
    const data = incoming.callbackData;

    if (data.startsWith("found:")) return handleFoundConfirm(ctx, data.slice(6));
    if (data.startsWith("foundok:")) return handleFoundOk(ctx, data.slice(8));
    if (data === "found_cancel") {
      await ctx.send("Cancelado. Usa /encontrado si la encuentras.");
      return;
    }

    const session = await ctx.getSession();
    if (!session) {
      await ctx.send("La sesión expiró. Usa /reportar para empezar de nuevo.");
      return;
    }
    if (data.startsWith("cat:") && session.state === "awaiting_category")
      return onCategoryCallback(ctx, session, data.slice(4));
    if (data.startsWith("urg:") && session.state === "awaiting_urgency")
      return onUrgencyCallback(ctx, session, data.slice(4));
    if (data.startsWith("ncat:") && session.state === "need_category")
      return onNeedCategoryCallback(ctx, session, data.slice(5));
    if (data.startsWith("ncat:") && session.state === "help_category")
      return onHelpCategoryCallback(ctx, session, data.slice(5));
    if (data.startsWith("hneed:") && session.state === "help_pick")
      return onHelpPickCallback(ctx, session, data.slice(6));
    return;
  }

  const text = incoming.text;

  // ── Comandos globales ─────────────────────────────────────────────────
  if (text === "/start" || text.startsWith("/start ")) return handleStart(ctx);
  if (text === "/reportar") return startReport(ctx);
  if (text === "/registrar_desaparecido") return startMissingPerson(ctx);
  if (text === "/cancelar" || text === "❌ Cancelar") return cancelFlow(ctx);
  if (text === "/estado") return handleEstado(ctx);
  if (text.startsWith("/buscar")) return handleBuscar(ctx, text.replace(/^\/buscar\s*/i, "").trim());
  if (text.startsWith("/encontrado"))
    return handleEncontrado(ctx, text.replace(/^\/encontrado\s*/i, "").trim());
  if (text === "/necesidad" && NEEDS_FLOW_ENABLED) return startNeed(ctx);
  if (text === "/ayudar" && HELP_FLOW_ENABLED) return startHelp(ctx);
  if (text === "/ayuda" || text === "/help") {
    await ctx.send(HELP_TEXT);
    return;
  }

  const session = await ctx.getSession();

  // ── Esperando nombre ───────────────────────────────────────────────────
  if (session?.state === "awaiting_user_name") {
    if (text && !text.startsWith("/")) {
      const userName = text.slice(0, 50).trim();
      ctx.setSession("chat", {}, [], userName);
      await ctx.send(
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
    await ctx.send("¿Cómo te llamas? Escríbeme tu nombre.");
    return;
  }

  // ── Estado conversacional ──────────────────────────────────────────────
  if (session?.state === "chat") {
    if (text && !text.startsWith("/")) return handleChat(ctx, text, session);
    await ctx.send("Escríbeme algo o usa /reportar para registrar un incidente.");
    return;
  }

  // ── Sin sesión ─────────────────────────────────────────────────────────
  if (!session) {
    if (text && !text.startsWith("/")) return handleChat(ctx, text, null);
    await ctx.send("Hola 🇻🇪 Escríbeme lo que necesitas o usa /reportar.\n/ayuda — ver comandos");
    return;
  }

  // ── Flujo de reporte ──────────────────────────────────────────────────
  if (session.state === "awaiting_category" && text && !text.startsWith("/"))
    return handleAwaitingCategory(ctx, session, text);
  if (session.state === "awaiting_title" && text && !text.startsWith("/"))
    return handleAwaitingTitle(ctx, session, text);
  if (session.state === "awaiting_description" && text && !text.startsWith("/"))
    return handleAwaitingDescription(ctx, session, text);
  if (session.state === "awaiting_media") return handleAwaitingMedia(ctx, session, incoming);
  if (session.state === "awaiting_location") return handleAwaitingLocation(ctx, session, incoming);
  if (session.state === "awaiting_text_location" && text && !text.startsWith("/"))
    return handleAwaitingTextLocation(ctx, session, text);
  if (session.state === "awaiting_confirm") return handleAwaitingConfirm(ctx, session, text);

  // ── Flujo de desaparecidos ─────────────────────────────────────────────
  if (session.state === "mp_name" && text && !text.startsWith("/"))
    return handleMpName(ctx, session, text);
  if (session.state === "mp_age" && text && !text.startsWith("/"))
    return handleMpAge(ctx, session, text);
  if (session.state === "mp_location") return handleMpLocation(ctx, session, incoming);
  if (session.state === "mp_text_location" && text && !text.startsWith("/"))
    return handleMpTextLocation(ctx, session, text);
  if (session.state === "mp_description" && text && !text.startsWith("/"))
    return handleMpDescription(ctx, session, text);
  if (session.state === "mp_photo") return handleMpPhoto(ctx, session, incoming);
  if (session.state === "mp_contact") return handleMpContact(ctx, session, text);
  if (session.state === "mp_confirm") return handleMpConfirm(ctx, session, text);

  // ── Flujo de necesidad (Fase 2, gated por BOT_NEEDS_FLOW) ──────────────
  if (session.state === "need_site" && text && !text.startsWith("/"))
    return handleNeedSite(ctx, session, text);
  if (session.state === "need_category" && text && !text.startsWith("/"))
    return handleNeedCategoryText(ctx);
  if (session.state === "need_description" && text && !text.startsWith("/"))
    return handleNeedDescription(ctx, session, text);
  if (session.state === "need_quantity" && text && !text.startsWith("/"))
    return handleNeedQuantity(ctx, session, text);
  if (session.state === "need_location") return handleNeedLocation(ctx, session, incoming);
  if (session.state === "need_text_location" && text && !text.startsWith("/"))
    return handleNeedTextLocation(ctx, session, text);
  if (session.state === "need_responsible") return handleNeedResponsible(ctx, session, text);
  if (session.state === "need_confirm") return handleNeedConfirm(ctx, session, text);

  // ── Flujo "quiero ayudar" (Fase 3, gated por BOT_HELP_FLOW) ────────────
  if (session.state === "help_category" && text && !text.startsWith("/"))
    return handleHelpCategoryText(ctx);
  if (session.state === "help_location") return handleHelpLocation(ctx, session, incoming);
  if (session.state === "help_text_location" && text && !text.startsWith("/"))
    return handleHelpTextLocation(ctx, session, text);
  if (session.state === "help_pick") return handleHelpPickText(ctx);
}
