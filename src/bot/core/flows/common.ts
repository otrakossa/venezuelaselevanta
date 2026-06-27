// ── Handlers compartidos por varios flujos (sin dependencias entre flujos) ─
import type { EngineCtx } from "../types";
import { removeKb } from "../keyboards";

export async function handleStart(ctx: EngineCtx): Promise<void> {
  ctx.clearSession();
  ctx.setSession("awaiting_user_name", {});
  await ctx.send(
    `<b>Venezuela Se Levanta 🇻🇪</b>\n\n` +
      `Hola, soy el asistente del sistema ciudadano de respuesta al terremoto.\n\n` +
      `Puedo ayudarte a registrar incidentes, buscar personas desaparecidas y orientarte en esta emergencia.\n\n` +
      `¿Cómo te llamas?`,
    removeKb(),
  );
}

export async function cancelFlow(ctx: EngineCtx): Promise<void> {
  ctx.clearSession();
  await ctx.send(
    "❌ Cancelado.\n\n/reportar — reportar incidente\n/registrar_desaparecido — registrar persona\n/ayuda — más opciones",
    removeKb(),
  );
}
