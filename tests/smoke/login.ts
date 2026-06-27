/**
 * Genera el SMOKE_TG_SESSION (string de sesión de usuario de GramJS) una sola vez.
 *
 *   SMOKE_TG_API_ID=... SMOKE_TG_API_HASH=... bun tests/smoke/login.ts
 *
 * Para el TEST DC añade SMOKE_TG_TEST_DC=1 y usa una cuenta de prueba:
 *   teléfono  99966XYYYY  (X = nº de DC, p.ej. 2)
 *   código    el nº de DC repetido 5 veces (p.ej. 22222)
 * Ver https://core.telegram.org/api/auth#test-accounts
 *
 * Copia el valor SMOKE_TG_SESSION impreso a tu entorno (NO lo commitees).
 */
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from "input";

const apiId = Number(process.env.SMOKE_TG_API_ID);
const apiHash = process.env.SMOKE_TG_API_HASH;
if (!apiId || !apiHash) {
  console.error("Define SMOKE_TG_API_ID y SMOKE_TG_API_HASH (de https://my.telegram.org).");
  process.exit(1);
}

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 3,
  testServers: process.env.SMOKE_TG_TEST_DC === "1",
});

await client.start({
  phoneNumber: async () => await input.text("Teléfono: "),
  password: async () => await input.text("Contraseña 2FA (vacío si no aplica): "),
  phoneCode: async () => await input.text("Código de verificación: "),
  onError: (e) => console.error(e),
});

console.log("\n── Copia esto a tu entorno (secreto, NO commitear) ──");
console.log("SMOKE_TG_SESSION=" + client.session.save());
await client.disconnect();
process.exit(0);
