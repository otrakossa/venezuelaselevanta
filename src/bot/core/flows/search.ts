// ── Flujos /buscar, /encontrado y callbacks de "persona encontrada" ───────
import type { EngineCtx } from "../types";
import { supabaseSelect, supabasePatch } from "../data";
import { ikb } from "../keyboards";
import { invalidateStats } from "./status";

export async function handleBuscar(ctx: EngineCtx, query: string): Promise<void> {
  if (!query || query.length < 2) {
    await ctx.send("Escribe /buscar seguido del nombre. Ejemplo:\n<code>/buscar Juan García</code>");
    return;
  }
  const enc = encodeURIComponent(`%${query}%`);
  const data = await supabaseSelect(
    "missing_persons",
    `select=name,age,last_seen_location,status&name=ilike.${enc}&limit=5&order=report_date.desc`,
  );
  if (!data.length) {
    await ctx.send(
      `🔍 Sin resultados para «${query}».\n\nVer todos: https://venezuelaselevanta.info/desaparecidos`,
    );
    return;
  }
  const ST: Record<string, string> = {
    missing: "🔴 Buscado/a",
    found: "✅ Encontrado/a",
    deceased: "⚫ Fallecido/a",
  };
  const lines = data
    .map(
      (r) =>
        `• <b>${r.name}</b>${r.age ? `, ${r.age} años` : ""}` +
        `${r.last_seen_location ? `\n  📍 ${r.last_seen_location}` : ""}` +
        `\n  ${ST[r.status as string] ?? String(r.status)}`,
    )
    .join("\n\n");
  await ctx.send(
    `🔍 Resultados para «${query}»:\n\n${lines}\n\n🌐 <a href="https://venezuelaselevanta.info/desaparecidos">Ver todos</a>`,
  );
}

export async function handleEncontrado(ctx: EngineCtx, query: string): Promise<void> {
  if (!query || query.length < 2) {
    await ctx.send(
      "¿Cómo se llama la persona que fue encontrada?\n\n" + "Ejemplo: <code>/encontrado Ana López</code>",
    );
    return;
  }
  const enc = encodeURIComponent(`%${query}%`);
  const data = await supabaseSelect(
    "missing_persons",
    `select=id,name,age,last_seen_location&name=ilike.${enc}&status=eq.missing&limit=5&order=report_date.desc`,
  );
  if (!data.length) {
    await ctx.send(
      `🔍 No encontré a «${query}» en la lista de personas buscadas.\n\n` +
        `Puede que ya esté marcada como encontrada o el nombre sea diferente.\n` +
        `Prueba con otro nombre o visita: https://venezuelaselevanta.info/desaparecidos`,
    );
    return;
  }
  const lines = data
    .map(
      (r) =>
        `• <b>${r.name}</b>${r.age ? `, ${r.age} años` : ""}${r.last_seen_location ? ` · 📍 ${r.last_seen_location}` : ""}`,
    )
    .join("\n");
  await ctx.send(
    `🔍 Personas buscadas con ese nombre:\n\n${lines}\n\n¿Cuál fue encontrada?`,
    ikb(
      data.map((r) => [
        { text: `✅ ${r.name}${r.age ? `, ${r.age} años` : ""}`, data: `found:${r.id}` },
      ]),
    ),
  );
}

// Callback paso 1: mostrar confirmación
export async function handleFoundConfirm(ctx: EngineCtx, personId: string): Promise<void> {
  const rows = await supabaseSelect(
    "missing_persons",
    `select=name,age,last_seen_location&id=eq.${encodeURIComponent(personId)}&limit=1`,
  );
  if (!rows.length) {
    await ctx.send("No se encontró ese registro.");
    return;
  }
  const p = rows[0];
  await ctx.send(
    `¿Confirmas que <b>${p.name}</b>${p.age ? ` (${p.age} años)` : ""}${p.last_seen_location ? `, visto/a en ${p.last_seen_location},` : ""} fue encontrado/a?`,
    ikb([
      [
        { text: "✅ Sí, fue encontrado/a", data: `foundok:${personId}` },
        { text: "❌ Cancelar", data: "found_cancel" },
      ],
    ]),
  );
}

// Callback paso 2: ejecutar actualización
export async function handleFoundOk(ctx: EngineCtx, personId: string): Promise<void> {
  const ok = await supabasePatch(
    "missing_persons",
    `id=eq.${encodeURIComponent(personId)}`,
    { status: "found" },
  );
  if (ok) {
    await ctx.send(
      `✅ <b>¡Gracias!</b> La persona fue marcada como encontrada.\n\n` +
        `Que buena noticia 🙏\n\n` +
        `🌐 <a href="https://venezuelaselevanta.info/desaparecidos">Ver lista de desaparecidos</a>`,
    );
    invalidateStats();
  } else {
    await ctx.send("⚠️ No se pudo actualizar el registro. Inténtalo de nuevo.");
  }
}
