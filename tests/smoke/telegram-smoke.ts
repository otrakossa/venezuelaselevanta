/**
 * Fase 5 — Smoke real (OPCIONAL, gated, FUERA del CI obligatorio).
 *
 * GramJS actúa como USUARIO y conversa con un BOT DE PRUEBA DEDICADO contra una
 * DB de prueba (y, opcionalmente, el test DC de Telegram). 2–3 caminos felices.
 *
 *   bun run test:smoke
 *
 * ⚠️ NUNCA usar el bot/token/DB de producción. Ver tests/smoke/README.md para
 *    el setup completo (bot de prueba, API id/hash, sesión de usuario, env).
 *
 * Si faltan las variables SMOKE_*, el script se SALTA (exit 0) — así nunca
 * rompe nada ni corre por accidente.
 */

const REQUIRED = ["SMOKE_TG_API_ID", "SMOKE_TG_API_HASH", "SMOKE_TG_SESSION", "SMOKE_BOT_USERNAME"];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.log(
    `[smoke] omitido — faltan variables de entorno: ${missing.join(", ")}.\n` +
      `        Es esperado en CI/local sin credenciales. Ver tests/smoke/README.md.`,
  );
  process.exit(0);
}

const bot = process.env.SMOKE_BOT_USERNAME!.replace(/^@/, "");

// Guardrail: jamás contra el bot de producción.
if (/venezuelaselevantabot/i.test(bot)) {
  console.error("[smoke] ABORTADO: el username parece el bot de PRODUCCIÓN. Usa un bot de prueba dedicado.");
  process.exit(1);
}

// Importación dinámica: el camino "saltado" no carga GramJS.
let tg: typeof import("telegram");
let sessions: typeof import("telegram/sessions");
try {
  tg = await import("telegram");
  sessions = await import("telegram/sessions");
} catch {
  console.error("[smoke] Falta GramJS. Instala con: bun add -d telegram input");
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const client = new tg.TelegramClient(
  new sessions.StringSession(process.env.SMOKE_TG_SESSION),
  Number(process.env.SMOKE_TG_API_ID),
  process.env.SMOKE_TG_API_HASH!,
  { connectionRetries: 3, testServers: process.env.SMOKE_TG_TEST_DC === "1" },
);

async function latestIncomingId(): Promise<number> {
  const msgs = await client.getMessages(bot, { limit: 1 });
  return msgs[0]?.id ?? 0;
}

/** Envía `text` al bot y espera una respuesta que contenga TODOS los `expected`. */
async function sendAndExpect(text: string, expected: string[], timeoutMs = 25_000): Promise<void> {
  const since = await latestIncomingId();
  await client.sendMessage(bot, { message: text });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(1500);
    const msgs = await client.getMessages(bot, { limit: 5 });
    const reply = msgs.find((m) => !m.out && m.id > since && (m.message ?? "").length > 0);
    if (reply) {
      const body = reply.message ?? "";
      const ok = expected.every((e) => body.includes(e));
      if (!ok) throw new Error(`Respuesta inesperada a "${text}": ${body.slice(0, 140)}`);
      console.log(`[smoke] OK  "${text}"  →  "${body.slice(0, 60).replace(/\n/g, " ")}…"`);
      return;
    }
  }
  throw new Error(`Timeout (${timeoutMs}ms) esperando respuesta a "${text}"`);
}

let failed = false;
try {
  await client.connect();
  console.log(`[smoke] Conectado. Hablando con @${bot}${process.env.SMOKE_TG_TEST_DC === "1" ? " (test DC)" : ""}.`);

  // 3 caminos felices (comandos → respuestas del núcleo real).
  await sendAndExpect("/estado", ["Estado del mapa"]);
  await sendAndExpect("/reportar", ["Elige", "categoría"]);
  await sendAndExpect("/buscar", ["/buscar"]); // pide el nombre
  await sendAndExpect("/cancelar", ["Cancelado"]);

  console.log("[smoke] ✅ Todos los caminos felices pasaron.");
} catch (err) {
  failed = true;
  console.error("[smoke] ❌", err instanceof Error ? err.message : err);
} finally {
  await client.disconnect();
  await client.destroy().catch(() => {});
}

process.exit(failed ? 1 : 0);
