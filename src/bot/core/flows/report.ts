// ── Flujo /reportar (incidentes en el mapa) ───────────────────────────────
import type { IncomingMessage } from "@/channels/types";
import type { EngineCtx, Session } from "../types";
import { CATEGORIES, URGENCIES, VALID_CATS, VALID_URGS, channelLabel, isNaturalCancel, isNaturalConfirm } from "../constants";
import { categoryKb, confirmKb, locationKb, mediaKb, removeKb, urgencyKb } from "../keyboards";
import { supabaseInsert } from "../data";
import { extractReportFields } from "../nlp";
import { geocodeText, VE_MAX_LAT, VE_MAX_LNG, VE_MIN_LAT, VE_MIN_LNG } from "../geocode";
import { cancelFlow } from "./common";

export async function startReport(ctx: EngineCtx): Promise<void> {
  ctx.setSession("awaiting_category", {});
  await ctx.send("1/6 · Elige la <b>categoría</b> del incidente:", categoryKb());
}

function buildSummary(draft: Record<string, unknown>): string {
  const catName = CATEGORIES.find((c) => c.slug === draft.category)?.name ?? String(draft.category ?? "");
  const urgName = URGENCIES.find((u) => u.v === draft.urgency)?.n ?? String(draft.urgency ?? "");
  const n = (Array.isArray(draft.media_urls) ? draft.media_urls : []).length;
  const loc = draft.address
    ? String(draft.address)
    : draft.lat != null
      ? `${Number(draft.lat).toFixed(4)}, ${Number(draft.lng).toFixed(4)}`
      : "(sin ubicación)";
  return `📋 <b>Resumen del reporte</b>\n\nCategoría: ${catName}\nTítulo: <b>${draft.title}</b>\nDescripción: ${draft.description ?? "(ninguna)"}\nUrgencia: ${urgName}\nUbicación: ${loc}\nAdjuntos: ${n > 0 ? `${n} archivo(s)` : "ninguno"}\n\n¿Confirmar y publicar en el mapa?`;
}

async function finalizeReport(
  ctx: EngineCtx,
  draft: Record<string, unknown>,
  name: string,
): Promise<void> {
  const label = channelLabel(ctx.channel);
  const mediaUrls = (draft.media_urls as string[] | undefined) ?? [];
  const mediaThumbs = (draft.media_thumbs as string[] | undefined) ?? [];
  const err = await supabaseInsert("reports", {
    title: String(draft.title ?? `Reporte vía ${label}`).slice(0, 120),
    description: (draft.description as string | null) ?? null,
    category: String(draft.category ?? "infrastructure"),
    urgency: String(draft.urgency ?? "medium"),
    status: "active",
    address: (draft.address as string | null) ?? null,
    lat: draft.lat != null ? Number(draft.lat) : 10.48,
    lng: draft.lng != null ? Number(draft.lng) : -66.9,
    reporter_name: `${name} (${label})`,
    photo_url: mediaUrls[0] ?? null,
    media_urls: mediaUrls,
    media_thumbs: mediaThumbs,
  });
  ctx.clearSession();
  if (err) {
    await ctx.send(`⚠️ No se pudo guardar el reporte. Inténtalo de nuevo.`, removeKb());
    console.error("[report-insert]", err);
    return;
  }
  const thanks = name !== "Anónimo" ? ` Gracias, ${name}` : "";
  await ctx.send(
    `✅ <b>¡Reporte publicado!</b>${mediaUrls.length ? `\n📎 ${mediaUrls.length} adjunto(s).` : ""}\nYa aparece en el mapa.${thanks} 🇻🇪\n\n/reportar para otro | /estado para ver cifras`,
    removeKb(),
  );
}

// ── Callbacks inline ──────────────────────────────────────────────────────
export async function onCategoryCallback(
  ctx: EngineCtx,
  session: Session,
  slug: string,
): Promise<void> {
  ctx.setSession("awaiting_title", { ...session.draft, category: slug });
  await ctx.send("2/6 · Escribe un <b>título breve</b> (ej: «Edificio colapsado en Av. Bolívar»).");
}

export async function onUrgencyCallback(
  ctx: EngineCtx,
  session: Session,
  urgency: string,
): Promise<void> {
  ctx.setSession("awaiting_media", { ...session.draft, urgency, media_urls: [], media_thumbs: [] });
  await ctx.send(
    "5/6 · ¿Adjuntar <b>fotos o videos</b>?\n\nEnvía archivos y luego pulsa «✅ Listo, continuar».",
    mediaKb(false),
  );
}

// ── Estados de texto ──────────────────────────────────────────────────────
export async function handleAwaitingCategory(
  ctx: EngineCtx,
  session: Session,
  text: string,
): Promise<void> {
  const extracted = await extractReportFields(text);
  if (extracted?.category && VALID_CATS.has(extracted.category)) {
    const draft: Record<string, unknown> = { ...session.draft, category: extracted.category };
    if (extracted.title) draft.title = extracted.title.slice(0, 120);
    if (extracted.urgency && VALID_URGS.has(extracted.urgency)) draft.urgency = extracted.urgency;
    if (extracted.description) draft.description = extracted.description.slice(0, 1000);
    if (extracted.address) draft._addr_hint = extracted.address;
    if (draft.title && draft.urgency) {
      ctx.setSession("awaiting_media", { ...draft, media_urls: [], media_thumbs: [] });
      return ctx.send(`✅ <b>${draft.title}</b>\n\n5/6 · ¿Adjuntar fotos o videos?`, mediaKb(false));
    }
    if (draft.title) {
      ctx.setSession("awaiting_urgency", draft);
      return ctx.send(`✅ Categoría y título registrados.\n\n4/6 · Elige la <b>urgencia</b>:`, urgencyKb());
    }
    ctx.setSession("awaiting_title", draft);
    const catName = CATEGORIES.find((c) => c.slug === extracted.category)?.name ?? "";
    return ctx.send(`✅ Categoría: <b>${catName}</b>\n\n2/6 · Escribe un <b>título breve</b>:`);
  }
  return ctx.send("Por favor elige una categoría con los botones 👆", categoryKb());
}

export async function handleAwaitingTitle(
  ctx: EngineCtx,
  session: Session,
  text: string,
): Promise<void> {
  if (text.length > 20) {
    const extracted = await extractReportFields(text);
    if (extracted?.title) {
      const draft: Record<string, unknown> = { ...session.draft, title: extracted.title.slice(0, 120) };
      if (!draft.category && extracted.category && VALID_CATS.has(extracted.category)) draft.category = extracted.category;
      if (!draft.urgency && extracted.urgency && VALID_URGS.has(extracted.urgency)) draft.urgency = extracted.urgency;
      if (extracted.description) draft.description = extracted.description.slice(0, 1000);
      if (extracted.address) draft._addr_hint = extracted.address;
      if (draft.urgency && extracted.description) {
        ctx.setSession("awaiting_media", { ...draft, media_urls: [], media_thumbs: [] });
        return ctx.send(`✅ Registrado: <b>${draft.title}</b>\n\n5/6 · ¿Adjuntar <b>fotos o videos</b>?`, mediaKb(false));
      }
      if (draft.urgency) {
        ctx.setSession("awaiting_media", { ...draft, media_urls: [], media_thumbs: [] });
        return ctx.send(`✅ Título: <b>${draft.title}</b>\n\n5/6 · ¿Adjuntar fotos o videos?`, mediaKb(false));
      }
      if (extracted.description) {
        ctx.setSession("awaiting_urgency", draft);
        return ctx.send(`✅ Título: <b>${draft.title}</b>\n\n4/6 · Elige la <b>urgencia</b>:`, urgencyKb());
      }
      ctx.setSession("awaiting_description", draft);
      return ctx.send(`✅ Título: <b>${draft.title}</b>\n\n3/6 · Agrega más <b>detalles</b> (o «-» para omitir):`);
    }
  }
  ctx.setSession("awaiting_description", { ...session.draft, title: text.slice(0, 120) });
  return ctx.send("3/6 · Agrega una <b>descripción</b> con más detalles (o envía «-» para omitir).");
}

export async function handleAwaitingDescription(
  ctx: EngineCtx,
  session: Session,
  text: string,
): Promise<void> {
  ctx.setSession("awaiting_urgency", {
    ...session.draft,
    description: text === "-" ? null : text.slice(0, 1000),
  });
  return ctx.send("4/6 · Elige la <b>urgencia</b>:", urgencyKb());
}

export async function handleAwaitingMedia(
  ctx: EngineCtx,
  session: Session,
  incoming: IncomingMessage,
): Promise<void> {
  const text = incoming.text;
  const cur = (session.draft.media_urls as string[]) ?? [];
  const curT = (session.draft.media_thumbs as string[]) ?? [];
  if (incoming.media?.kind === "photo") {
    const up = await ctx.storeMedia(incoming.media);
    if (!up) {
      await ctx.send("⚠️ No se pudo subir la foto.", mediaKb(cur.length > 0));
      return;
    }
    const next = [...cur, up.url],
      nextT = [...curT, up.thumb];
    ctx.setSession("awaiting_media", { ...session.draft, media_urls: next, media_thumbs: nextT });
    return ctx.send(`📎 ${next.length} adjunto(s). Envía más o pulsa «✅ Listo, continuar».`, mediaKb(true));
  }
  if (incoming.media?.kind === "video") {
    await ctx.send("⏳ Subiendo video…");
    const up = await ctx.storeMedia(incoming.media);
    if (!up) {
      await ctx.send("⚠️ No se pudo subir el video.", mediaKb(cur.length > 0));
      return;
    }
    const next = [...cur, up.url],
      nextT = [...curT, up.thumb];
    ctx.setSession("awaiting_media", { ...session.draft, media_urls: next, media_thumbs: nextT });
    return ctx.send(`📎 ${next.length} adjunto(s). Envía más o pulsa «✅ Listo, continuar».`, mediaKb(true));
  }
  if (text === "✅ Listo, continuar" || text === "⏭️ Omitir foto/video" || text === "/listo") {
    const draft = { ...session.draft };
    if (text === "⏭️ Omitir foto/video") {
      draft.media_urls = [];
      draft.media_thumbs = [];
    }
    if (draft._addr_hint && !draft.address) {
      await ctx.send("⏳ Buscando coordenadas…");
      const hint = String(draft._addr_hint);
      const coords = await geocodeText(hint);
      delete draft._addr_hint;
      draft.address = hint.slice(0, 200);
      draft.lat = coords?.lat ?? 10.48;
      draft.lng = coords?.lng ?? -66.9;
      ctx.setSession("awaiting_confirm", draft);
      const note = coords ? "" : "\n⚠️ <i>No se encontraron coordenadas exactas.</i>\n";
      return ctx.send(note + buildSummary(draft), confirmKb());
    }
    ctx.setSession("awaiting_location", draft);
    return ctx.send(
      "6/6 · Comparte la <b>ubicación</b> del incidente.\n\nUsa el botón 📍 o escribe la dirección.",
      locationKb(),
    );
  }
  return ctx.send("Envía fotos/videos, o usa los botones inferiores.", mediaKb(cur.length > 0));
}

export async function handleAwaitingLocation(
  ctx: EngineCtx,
  session: Session,
  incoming: IncomingMessage,
): Promise<void> {
  if (incoming.location) {
    const { lat, lng } = incoming.location;
    if (lat < VE_MIN_LAT || lat > VE_MAX_LAT || lng < VE_MIN_LNG || lng > VE_MAX_LNG)
      return ctx.send(
        "⚠️ La ubicación está fuera de Venezuela. Comparte la ubicación correcta o escribe la dirección.",
        locationKb(),
      );
    const draft = { ...session.draft, lat, lng };
    ctx.setSession("awaiting_confirm", draft);
    return ctx.send(buildSummary(draft), confirmKb());
  }
  if (incoming.text === "✏️ Escribir dirección") {
    ctx.setSession("awaiting_text_location", session.draft);
    return ctx.send("Escribe la dirección o zona del incidente:", removeKb());
  }
  return ctx.send("Usa el botón 📍 para compartir ubicación, o «✏️ Escribir dirección».", locationKb());
}

export async function handleAwaitingTextLocation(
  ctx: EngineCtx,
  session: Session,
  text: string,
): Promise<void> {
  await ctx.send("⏳ Buscando coordenadas…");
  const coords = await geocodeText(text);
  const draft = {
    ...session.draft,
    address: text.slice(0, 200),
    lat: coords?.lat ?? 10.48,
    lng: coords?.lng ?? -66.9,
  };
  ctx.setSession("awaiting_confirm", draft);
  const note = coords
    ? ""
    : "\n⚠️ <i>No se encontraron coordenadas exactas. El marcador aparecerá aproximado.</i>\n";
  return ctx.send(note + buildSummary(draft), confirmKb());
}

export async function handleAwaitingConfirm(
  ctx: EngineCtx,
  session: Session,
  text: string,
): Promise<void> {
  if (text === "✅ Confirmar y publicar" || isNaturalConfirm(text))
    return finalizeReport(ctx, session.draft, session.userName ?? ctx.fromName);
  if (text === "❌ Cancelar" || isNaturalCancel(text)) return cancelFlow(ctx);
  return ctx.send("Pulsa «✅ Confirmar y publicar» o «❌ Cancelar».", confirmKb());
}
