# Fase 5 — Smoke real con GramJS (opcional, gated)

Prueba **end-to-end real**: un cliente de usuario (GramJS) le escribe a un **bot
de prueba dedicado** y verifica que responde. Sirve como confianza extra sobre
el camino completo (Telegram → webhook → núcleo → Supabase → respuesta).

Es **opcional**, **gated por entorno** y **NO forma parte del CI obligatorio**
(puede ser flaky por rate limits / sesión). Si faltan las variables `SMOKE_*`,
`bun run test:smoke` se salta limpio (exit 0).

## ⚠️ Reglas de oro (guardrails)

- **NUNCA** el bot, token o base de datos de **producción**. El script aborta si
  `SMOKE_BOT_USERNAME` parece el bot real (`*venezuelaselevantabot`).
- Usa siempre: **bot de prueba dedicado** + **DB de prueba** (Supabase local de
  la Fase 4 o un proyecto de test) + (opcional) el **test DC** de Telegram.
- `SMOKE_TG_SESSION` y los tokens son **secretos** — no commitearlos (van por
  entorno; `.env*.local` está gitignored).

## Requisitos previos

1. **API id/hash** de usuario: créalos en <https://my.telegram.org> → API
   development tools. (Para el test DC sirven igual.)
2. **Bot de prueba**: con @BotFather crea un bot nuevo (p. ej. `@vsl_test_bot`).
   Guarda su token.
3. **El bot debe estar CORRIENDO** apuntando al **token de prueba** y a la **DB
   de prueba**, con su webhook accesible por Telegram. Opciones:
   - Local + túnel: `bun run dev`, expón con un túnel (cloudflared) y registra el
     webhook del bot de prueba a `https://<tunnel>/api/public/telegram/webhook`.
   - O despliega el bot de prueba en un entorno alcanzable.
   El `.env` de ese proceso usa `TELEGRAM_BOT_TOKEN=<token de prueba>` y las
   credenciales de la **DB de prueba** (no producción).
4. **Sesión de usuario** (one-time):
   ```bash
   SMOKE_TG_API_ID=... SMOKE_TG_API_HASH=... bun tests/smoke/login.ts
   # (test DC: añade SMOKE_TG_TEST_DC=1 y usa una cuenta de prueba)
   ```
   Copia el `SMOKE_TG_SESSION` impreso.

## Variables de entorno

| Var | Qué es |
|---|---|
| `SMOKE_TG_API_ID` / `SMOKE_TG_API_HASH` | credenciales de API de usuario (my.telegram.org) |
| `SMOKE_TG_SESSION` | string de sesión generado por `login.ts` |
| `SMOKE_BOT_USERNAME` | username del **bot de prueba** (ej. `vsl_test_bot`) |
| `SMOKE_TG_TEST_DC` | (opcional) `1` para usar el test DC de Telegram |

## Correr

```bash
SMOKE_TG_API_ID=... SMOKE_TG_API_HASH=... \
SMOKE_TG_SESSION=... SMOKE_BOT_USERNAME=vsl_test_bot \
bun run test:smoke
```

Caminos felices verificados: `/estado`, `/reportar`, `/buscar`, `/cancelar`.

> El `telegram` (GramJS) e `input` están en devDependencies. Si los podaste:
> `bun add -d telegram input`.
