// ── Flujo /registrar_desaparecido (personas desaparecidas) ────────────────
import type { IncomingMessage } from "@/channels/types";
import type { EngineCtx, Session } from "../types";
import { channelLabel, isNaturalCancel, isNaturalConfirm } from "../constants";
import { locationKb, mpConfirmKb, mpContactKb, mpPhotoKb, removeKb } from "../keyboards";
import { supabaseInsert } from "../data";
import { geocodeText } from "../geocode";
import { cancelFlow } from "./common";

export async function startMissingPerson(ctx: EngineCtx): Promise<void> {
  ctx.setSession("mp_name", {});
  await ctx.send(
    "📋 <b>Registrar persona desaparecida</b>\n\n1/6 · Escribe el <b>nombre completo</b> de la persona:",
    removeKb(),
  );
}

function buildMissingSummary(draft: Record<string, unknown>): string {
  const loc = draft.last_seen_location
    ? String(draft.last_seen_location)
    : draft.last_seen_lat != null
      ? `${Number(draft.last_seen_lat).toFixed(4)}, ${Number(draft.last_seen_lng).toFixed(4)}`
      : "No indicado";
  return `📋 <b>Resumen — Persona Desaparecida</b>\n\nNombre: <b>${draft.name}</b>\nEdad: ${draft.age ?? "No indicada"}\nÚltimo lugar visto: ${loc}\nDescripción: ${draft.description ?? "Ninguna"}\nFoto: ${draft.photo_url ? "✅ Adjunta" : "No"}\nContacto: ${draft.contact_name ? `${draft.contact_name}${draft.contact_phone ? ` · ${draft.contact_phone}` : ""}` : "No indicado"}\n\n¿Confirmar y publicar?`;
}

async function finalizeMissingPerson(
  ctx: EngineCtx,
  draft: Record<string, unknown>,
): Promise<void> {
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
    status: "missing",
    source_label: channelLabel(ctx.channel),
    source_id: ctx.externalUserId,
  });
  ctx.clearSession();
  if (err) {
    await ctx.send(`⚠️ No se pudo guardar. Inténtalo de nuevo.`, removeKb());
    console.error("[mp-insert]", err);
    return;
  }
  await ctx.send(
    `✅ <b>Persona registrada como desaparecida.</b>\n\nAparecerá en el mapa.\n\n🌐 <a href="https://venezuelaselevanta.info/desaparecidos">Ver lista completa</a>`,
    removeKb(),
  );
}

export async function handleMpName(ctx: EngineCtx, session: Session, text: string): Promise<void> {
  ctx.setSession("mp_age", { ...session.draft, name: text.slice(0, 120) });
  return ctx.send("2/6 · ¿Cuál es la <b>edad aproximada</b>? (o escribe «desconocida»):");
}

export async function handleMpAge(ctx: EngineCtx, session: Session, text: string): Promise<void> {
  const m = text.match(/\d+/);
  ctx.setSession("mp_location", { ...session.draft, age: m ? parseInt(m[0]) : null });
  return ctx.send(
    "3/6 · ¿Cuál fue el <b>último lugar</b> donde fue visto/a?\n\nUsa 📍 o escribe la dirección.",
    locationKb(),
  );
}

export async function handleMpLocation(
  ctx: EngineCtx,
  session: Session,
  incoming: IncomingMessage,
): Promise<void> {
  if (incoming.location) {
    const { lat, lng } = incoming.location;
    ctx.setSession("mp_description", { ...session.draft, last_seen_lat: lat, last_seen_lng: lng });
    return ctx.send(
      "4/6 · Describe a la persona: rasgos físicos, ropa, etc. (o «-» para omitir):",
      removeKb(),
    );
  }
  if (incoming.text === "✏️ Escribir dirección") {
    ctx.setSession("mp_text_location", session.draft);
    return ctx.send("Escribe la dirección o zona donde fue visto/a por última vez:", removeKb());
  }
  return ctx.send("Usa 📍 para compartir la ubicación, o «✏️ Escribir dirección».", locationKb());
}

export async function handleMpTextLocation(
  ctx: EngineCtx,
  session: Session,
  text: string,
): Promise<void> {
  await ctx.send("⏳ Buscando coordenadas…");
  const coords = await geocodeText(text);
  ctx.setSession("mp_description", {
    ...session.draft,
    last_seen_location: text.slice(0, 200),
    last_seen_lat: coords?.lat ?? null,
    last_seen_lng: coords?.lng ?? null,
  });
  return ctx.send(
    "4/6 · Describe a la persona: rasgos físicos, ropa, etc. (o «-» para omitir):",
    removeKb(),
  );
}

export async function handleMpDescription(
  ctx: EngineCtx,
  session: Session,
  text: string,
): Promise<void> {
  ctx.setSession("mp_photo", { ...session.draft, description: text === "-" ? null : text.slice(0, 1000) });
  return ctx.send(
    "5/6 · Envía una <b>foto</b> de la persona (muy útil),\no pulsa «⏭️ Omitir foto».",
    mpPhotoKb(false),
  );
}

export async function handleMpPhoto(
  ctx: EngineCtx,
  session: Session,
  incoming: IncomingMessage,
): Promise<void> {
  const text = incoming.text;
  if (incoming.media?.kind === "photo") {
    const up = await ctx.storeMedia(incoming.media);
    ctx.setSession("mp_contact", { ...session.draft, photo_url: up?.url ?? null });
    return ctx.send(
      `${up?.url ? "📸 Foto recibida.\n\n" : ""}6/6 · Datos de <b>contacto</b>:\nNombre y teléfono (ej: <i>Ana López 0412-1234567</i>)\no «⏭️ Sin datos de contacto».`,
      mpContactKb(),
    );
  }
  if (text === "⏭️ Omitir foto" || text === "✅ Listo, continuar") {
    ctx.setSession("mp_contact", { ...session.draft, photo_url: null });
    return ctx.send(
      "6/6 · Datos de <b>contacto</b>:\nNombre y teléfono, o «⏭️ Sin datos de contacto».",
      mpContactKb(),
    );
  }
  return ctx.send("Envía una foto o pulsa «⏭️ Omitir foto».", mpPhotoKb(false));
}

export async function handleMpContact(
  ctx: EngineCtx,
  session: Session,
  text: string,
): Promise<void> {
  if (text === "⏭️ Sin datos de contacto" || text === "-") {
    const draft = { ...session.draft };
    ctx.setSession("mp_confirm", draft);
    return ctx.send(buildMissingSummary(draft), mpConfirmKb());
  }
  if (text && !text.startsWith("/")) {
    const phoneMatch = text.match(/(\d[\d\s\-()+]{5,})/);
    const phone = phoneMatch ? phoneMatch[0].trim() : null;
    const name = phone ? text.replace(phone, "").replace(/[:\-,]/g, "").trim() || text : text;
    const draft = {
      ...session.draft,
      contact_name: name.slice(0, 80),
      contact_phone: phone?.slice(0, 30) ?? null,
    };
    ctx.setSession("mp_confirm", draft);
    return ctx.send(buildMissingSummary(draft), mpConfirmKb());
  }
  return ctx.send(
    "Escribe los datos de contacto o pulsa «⏭️ Sin datos de contacto».",
    mpContactKb(),
  );
}

export async function handleMpConfirm(
  ctx: EngineCtx,
  session: Session,
  text: string,
): Promise<void> {
  if (text === "✅ Confirmar y registrar" || isNaturalConfirm(text))
    return finalizeMissingPerson(ctx, session.draft);
  if (text === "❌ Cancelar" || isNaturalCancel(text)) return cancelFlow(ctx);
  return ctx.send("Pulsa «✅ Confirmar y registrar» o «❌ Cancelar».", mpConfirmKb());
}
