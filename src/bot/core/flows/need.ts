// ── Flujo /necesidad (registrar necesidad por punto) ──────────────────────
// Detrás del flag de entorno BOT_NEEDS_FLOW (oculto hasta validar en prod).
// site → categoría → descripción → cantidad → ubicación → responsable → confirmar.
import type { IncomingMessage, ReplyMarkup } from "@/channels/types";
import type { EngineCtx, Session } from "../types";
import { channelLabel, isNaturalCancel, isNaturalConfirm, needCatLabel } from "../constants";
import { confirmKb, locationKb, needCategoryKb, removeKb } from "../keyboards";
import { supabaseInsert, supabaseInsertReturning, supabaseSelect } from "../data";
import { geocodeText, VE_MAX_LAT, VE_MAX_LNG, VE_MIN_LAT, VE_MIN_LNG } from "../geocode";
import { cancelFlow } from "./common";

export const NEEDS_FLOW_ENABLED = ["1", "true", "on", "yes"].includes(
  (process.env.BOT_NEEDS_FLOW ?? "").trim().toLowerCase(),
);

const responsibleKb: ReplyMarkup = {
  kind: "keyboard",
  rows: [[{ text: "⏭️ Sin responsable" }], [{ text: "❌ Cancelar" }]],
  oneTime: false,
};

export async function startNeed(ctx: EngineCtx): Promise<void> {
  ctx.setSession("need_site", {});
  await ctx.send(
    "📋 <b>Registrar necesidad</b>\n\n1/5 · ¿En qué <b>punto o centro</b> se necesita la ayuda? Escribe el nombre.",
    removeKb(),
  );
}

export async function handleNeedSite(ctx: EngineCtx, session: Session, text: string): Promise<void> {
  ctx.setSession("need_category", { ...session.draft, site_name: text.slice(0, 160) });
  return ctx.send("2/5 · ¿Qué <b>categoría</b> de ayuda se necesita?", needCategoryKb());
}

export async function onNeedCategoryCallback(
  ctx: EngineCtx,
  session: Session,
  slug: string,
): Promise<void> {
  ctx.setSession("need_description", { ...session.draft, category: slug });
  await ctx.send(`✅ ${needCatLabel(slug)}\n\n3/5 · Describe la necesidad (o «-» para omitir):`);
}

export async function handleNeedCategoryText(ctx: EngineCtx): Promise<void> {
  return ctx.send("Elige una categoría con los botones 👆", needCategoryKb());
}

export async function handleNeedDescription(
  ctx: EngineCtx,
  session: Session,
  text: string,
): Promise<void> {
  ctx.setSession("need_quantity", {
    ...session.draft,
    description: text === "-" ? null : text.slice(0, 1000),
  });
  return ctx.send(
    "4/5 · ¿Qué <b>cantidad o detalle</b>? (ej: 50 bolsas de suero) — o «-» para omitir:",
  );
}

export async function handleNeedQuantity(
  ctx: EngineCtx,
  session: Session,
  text: string,
): Promise<void> {
  ctx.setSession("need_location", {
    ...session.draft,
    quantity: text === "-" ? null : text.slice(0, 100),
  });
  return ctx.send(
    "5/5 · Comparte la <b>ubicación</b> del punto.\n\nUsa 📍 o escribe la dirección.",
    locationKb(),
  );
}

export async function handleNeedLocation(
  ctx: EngineCtx,
  session: Session,
  incoming: IncomingMessage,
): Promise<void> {
  if (incoming.location) {
    const { lat, lng } = incoming.location;
    if (lat < VE_MIN_LAT || lat > VE_MAX_LAT || lng < VE_MIN_LNG || lng > VE_MAX_LNG)
      return ctx.send(
        "⚠️ La ubicación está fuera de Venezuela. Comparte la correcta o escribe la dirección.",
        locationKb(),
      );
    ctx.setSession("need_responsible", { ...session.draft, lat, lng });
    return ctx.send(
      "¿Datos del <b>responsable</b> del punto? Nombre y teléfono, o «⏭️ Sin responsable».",
      responsibleKb,
    );
  }
  if (incoming.text === "✏️ Escribir dirección") {
    ctx.setSession("need_text_location", session.draft);
    return ctx.send("Escribe la dirección o zona del punto:", removeKb());
  }
  return ctx.send("Usa 📍 para compartir la ubicación, o «✏️ Escribir dirección».", locationKb());
}

export async function handleNeedTextLocation(
  ctx: EngineCtx,
  session: Session,
  text: string,
): Promise<void> {
  await ctx.send("⏳ Buscando coordenadas…");
  const coords = await geocodeText(text);
  ctx.setSession("need_responsible", {
    ...session.draft,
    address: text.slice(0, 200),
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  });
  return ctx.send(
    "¿Datos del <b>responsable</b> del punto? Nombre y teléfono, o «⏭️ Sin responsable».",
    responsibleKb,
  );
}

export async function handleNeedResponsible(
  ctx: EngineCtx,
  session: Session,
  text: string,
): Promise<void> {
  if (text === "⏭️ Sin responsable" || text === "-") {
    const draft = { ...session.draft };
    ctx.setSession("need_confirm", draft);
    return ctx.send(buildNeedSummary(draft), confirmKb());
  }
  if (text && !text.startsWith("/")) {
    const phoneMatch = text.match(/(\d[\d\s\-()+]{5,})/);
    const phone = phoneMatch ? phoneMatch[0].trim() : null;
    const name = phone ? text.replace(phone, "").replace(/[:\-,]/g, "").trim() || text : text;
    const draft = {
      ...session.draft,
      resp_name: name.slice(0, 80),
      resp_phone: phone?.slice(0, 30) ?? null,
    };
    ctx.setSession("need_confirm", draft);
    return ctx.send(buildNeedSummary(draft), confirmKb());
  }
  return ctx.send("Escribe los datos del responsable o pulsa «⏭️ Sin responsable».", responsibleKb);
}

export async function handleNeedConfirm(
  ctx: EngineCtx,
  session: Session,
  text: string,
): Promise<void> {
  if (text === "✅ Confirmar y publicar" || isNaturalConfirm(text))
    return finalizeNeed(ctx, session.draft, session.userName ?? ctx.fromName);
  if (text === "❌ Cancelar" || isNaturalCancel(text)) return cancelFlow(ctx);
  return ctx.send("Pulsa «✅ Confirmar y publicar» o «❌ Cancelar».", confirmKb());
}

function buildNeedSummary(draft: Record<string, unknown>): string {
  const loc = draft.address
    ? String(draft.address)
    : draft.lat != null
      ? `${Number(draft.lat).toFixed(4)}, ${Number(draft.lng).toFixed(4)}`
      : "(sin ubicación)";
  const resp = draft.resp_name
    ? `${draft.resp_name}${draft.resp_phone ? ` · ${draft.resp_phone}` : ""}`
    : "(no indicado)";
  return `📋 <b>Resumen — Necesidad</b>\n\nPunto: <b>${draft.site_name}</b>\nCategoría: ${needCatLabel(String(draft.category ?? "other"))}\nDescripción: ${draft.description ?? "(ninguna)"}\nCantidad: ${draft.quantity ?? "(no indicada)"}\nUbicación: ${loc}\nResponsable: ${resp}\n\n¿Confirmar y publicar?`;
}

async function finalizeNeed(
  ctx: EngineCtx,
  draft: Record<string, unknown>,
  name: string,
): Promise<void> {
  const label = channelLabel(ctx.channel);
  const siteName = String(draft.site_name ?? "").trim().slice(0, 160);
  const category = String(draft.category ?? "other");
  let lat = draft.lat != null ? Number(draft.lat) : null;
  let lng = draft.lng != null ? Number(draft.lng) : null;
  const address = (draft.address as string | null) ?? null;
  const respName = (draft.resp_name as string | null) ?? null;
  const respPhone = (draft.resp_phone as string | null) ?? null;

  // Reusar un punto existente por nombre exacto, o crear uno nuevo.
  let siteId: string | null = null;
  const existing = await supabaseSelect(
    "sites",
    `select=id,lat,lng&name=eq.${encodeURIComponent(siteName)}&limit=1`,
  );
  if (existing.length) {
    siteId = existing[0].id as string;
    if (lat == null && existing[0].lat != null) {
      lat = Number(existing[0].lat);
      lng = existing[0].lng != null ? Number(existing[0].lng) : null;
    }
  } else {
    const created = await supabaseInsertReturning("sites", {
      type: "otro",
      name: siteName,
      lat,
      lng,
      status: "active",
    });
    siteId = (created?.id as string) ?? null;
    if (siteId && (respName || respPhone)) {
      await supabaseInsert("site_responsibles", { site_id: siteId, name: respName, phone: respPhone });
    }
  }

  const title = `${needCatLabel(category).replace(/^\S+\s/, "")} — ${siteName}`.slice(0, 150);

  const err = await supabaseInsert("needs", {
    category,
    title,
    description: (draft.description as string | null) ?? null,
    quantity: (draft.quantity as string | null) ?? null,
    urgency: "high",
    status: "open",
    center_name: siteName,
    center_address: address,
    lat,
    lng,
    site_id: siteId,
    contact_name: respName,
    contact_phone: respPhone,
    reporter_name: `${name} (${label})`,
  });
  ctx.clearSession();
  if (err) {
    await ctx.send("⚠️ No se pudo guardar la necesidad. Inténtalo de nuevo.", removeKb());
    console.error("[need-insert]", err);
    return;
  }
  await ctx.send(
    `✅ <b>Necesidad publicada.</b>\n\nYa aparece en la plataforma.\n\n🌐 <a href="https://venezuelaselevanta.info/necesidades">Ver necesidades</a>`,
    removeKb(),
  );
}
