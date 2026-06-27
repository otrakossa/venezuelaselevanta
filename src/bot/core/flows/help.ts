// ── Flujo /ayudar ("quiero ayudar": matching por cercanía) ────────────────
// Detrás del flag de entorno BOT_HELP_FLOW.
// categoría → ubicación → sugerencias (RPC) → elegir → vincular + contacto.
import type { Button, IncomingMessage } from "@/channels/types";
import type { EngineCtx, Session } from "../types";
import { channelLabel, needCatLabel } from "../constants";
import { ikb, locationKb, needCategoryKb, removeKb } from "../keyboards";
import { supabaseInsert, supabasePatch, supabaseRpc, supabaseSelect } from "../data";
import { geocodeText } from "../geocode";

export const HELP_FLOW_ENABLED = ["1", "true", "on", "yes"].includes(
  (process.env.BOT_HELP_FLOW ?? "").trim().toLowerCase(),
);

export async function startHelp(ctx: EngineCtx): Promise<void> {
  ctx.setSession("help_category", {});
  await ctx.send("🤝 <b>Quiero ayudar</b>\n\n¿Qué tipo de ayuda puedes ofrecer?", needCategoryKb());
}

export async function onHelpCategoryCallback(
  ctx: EngineCtx,
  session: Session,
  slug: string,
): Promise<void> {
  ctx.setSession("help_location", { ...session.draft, category: slug });
  await ctx.send(
    `✅ ${needCatLabel(slug)}\n\n¿Desde dónde puedes ayudar? Comparte tu ubicación 📍 o escribe la zona.`,
    locationKb(),
  );
}

export async function handleHelpCategoryText(ctx: EngineCtx): Promise<void> {
  return ctx.send("Elige una categoría con los botones 👆", needCategoryKb());
}

export async function handleHelpLocation(
  ctx: EngineCtx,
  session: Session,
  incoming: IncomingMessage,
): Promise<void> {
  if (incoming.location) {
    const { lat, lng } = incoming.location;
    return runSuggestions(ctx, { ...session.draft, lat, lng });
  }
  if (incoming.text === "✏️ Escribir dirección") {
    ctx.setSession("help_text_location", session.draft);
    return ctx.send("Escribe tu zona o dirección:", removeKb());
  }
  return ctx.send("Usa 📍 para compartir tu ubicación, o «✏️ Escribir dirección».", locationKb());
}

export async function handleHelpTextLocation(
  ctx: EngineCtx,
  session: Session,
  text: string,
): Promise<void> {
  await ctx.send("⏳ Buscando necesidades cercanas…");
  const coords = await geocodeText(text);
  return runSuggestions(ctx, {
    ...session.draft,
    location_desc: text.slice(0, 200),
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  });
}

async function runSuggestions(ctx: EngineCtx, draft: Record<string, unknown>): Promise<void> {
  const rows = await supabaseRpc("suggest_needs_for_offer", {
    p_category: draft.category ?? null,
    p_lat: draft.lat ?? null,
    p_lng: draft.lng ?? null,
    p_state: null,
    p_municipality: null,
    p_parish: null,
  });
  const top = rows.slice(0, 5);
  if (!top.length) {
    ctx.clearSession();
    await ctx.send(
      "No encontré necesidades abiertas de esa categoría ahora mismo.\n\n🌐 <a href=\"https://venezuelaselevanta.info/necesidades\">Ver necesidades</a>",
      removeKb(),
    );
    return;
  }
  ctx.setSession("help_pick", { ...draft, options: top.map((r) => r.need_id) });
  const lines = top
    .map((r, i) => {
      const km = r.distance_km != null ? ` · ~${Math.round(Number(r.distance_km))} km` : "";
      return `${i + 1}. <b>${r.title}</b>\n   🏥 ${r.center_name}${km}`;
    })
    .join("\n\n");
  const buttons: Button[][] = top.map((r, i) => [
    { text: `${i + 1}. ${String(r.title).slice(0, 40)}`, data: `hneed:${r.need_id}` },
  ]);
  await ctx.send(`Necesidades cercanas que puedes apoyar:\n\n${lines}\n\n¿Cuál quieres apoyar?`, ikb(buttons));
}

export async function handleHelpPickText(ctx: EngineCtx): Promise<void> {
  return ctx.send("Elige una necesidad con los botones 👆");
}

export async function onHelpPickCallback(
  ctx: EngineCtx,
  session: Session,
  needId: string,
): Promise<void> {
  const rows = await supabaseSelect(
    "needs",
    `select=id,title,center_name,site_id,contact_name,contact_phone,status&id=eq.${encodeURIComponent(needId)}&limit=1`,
  );
  if (!rows.length) {
    ctx.clearSession();
    await ctx.send("Esa necesidad ya no está disponible. Usa /ayudar para intentar de nuevo.", removeKb());
    return;
  }
  const need = rows[0] as {
    id: string;
    title: string;
    center_name: string;
    site_id: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    status: string;
  };
  const draft = session.draft;
  const name = session.userName ?? ctx.fromName;

  // Crear la oferta del ayudante, vinculada a la necesidad.
  await supabaseInsert("offers", {
    category: String(draft.category ?? "other"),
    title: `Ofrezco ayuda: ${need.title}`.slice(0, 150),
    status: "matched",
    need_id: need.id,
    location_desc: (draft.location_desc as string | null) ?? null,
    lat: draft.lat != null ? Number(draft.lat) : null,
    lng: draft.lng != null ? Number(draft.lng) : null,
    contact_name: name,
    contact_info: `Vía ${channelLabel(ctx.channel)}`,
  });

  // Necesidad: open → partial
  if (need.status === "open") {
    await supabasePatch("needs", `id=eq.${encodeURIComponent(need.id)}`, { status: "partial" });
  }

  // Contacto del responsable del punto (site_responsibles) o de la necesidad.
  let contactName: string | null = need.contact_name;
  let contactPhone: string | null = need.contact_phone;
  if (need.site_id) {
    const resp = await supabaseSelect(
      "site_responsibles",
      `select=name,phone&site_id=eq.${encodeURIComponent(need.site_id)}&order=created_at.asc&limit=1`,
    );
    if (resp.length) {
      contactName = (resp[0].name as string | null) ?? contactName;
      contactPhone = (resp[0].phone as string | null) ?? contactPhone;
    }
  }
  const contact =
    contactName || contactPhone
      ? `\n\n📞 <b>Contacto del punto:</b> ${contactName ?? ""}${contactPhone ? ` · ${contactPhone}` : ""}`
      : "\n\nEl punto no registró un contacto directo; coordina vía la plataforma.";

  ctx.clearSession();
  await ctx.send(
    `✅ <b>¡Gracias por ayudar, ${name}!</b>\n\nTe vinculamos con:\n<b>${need.title}</b>\n🏥 ${need.center_name}${contact}\n\nCoordina la entrega directamente. 🇻🇪`,
    removeKb(),
  );
}
