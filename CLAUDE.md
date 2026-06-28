# Venezuela Se Levanta — Guía para Claude Code

## ⚠️ BASE DE DATOS DE PRODUCCIÓN — LEER PRIMERO

Producción usa el proyecto Supabase **NUEVO**:

- URL:        `https://advebubtfjgxwpjxprok.supabase.co`
- Project ID: `advebubtfjgxwpjxprok`

El proyecto **VIEJO** (`evcgvbycvgueoelvfbna`) sigue existiendo pero está congelado — su data NO refleja producción.

### Reglas obligatorias para el agente

1. Para consultar/modificar datos reales usar SIEMPRE `psql "$NEW_SUPABASE_DB_URL"` o REST con `$NEW_SUPABASE_SERVICE_KEY` contra `$NEW_SUPABASE_URL`.
2. Las herramientas integradas `supabase--read_query`, `supabase--insert`, `supabase--migration`, `supabase--slow_queries` y las variables `PG*` del sandbox apuntan al proyecto VIEJO — NO usarlas para análisis ni migraciones que afecten producción.
3. Para cambios de schema en producción: generar el SQL y ejecutarlo con `psql "$NEW_SUPABASE_DB_URL" -f migracion.sql`, no con el tool de migración.
4. El cliente del frontend (`src/integrations/supabase/client.ts`) ya está hardcodeado al proyecto nuevo; el VPS lee sus credenciales del `.env` propio del servidor.

---



Sistema ciudadano de crisis post-terremoto en Venezuela. Reportes geoespaciales,
registro de desaparecidos, matching con pacientes y centros médicos.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | TanStack Start (SSR) + Vite + TypeScript |
| Runtime | Bun |
| UI | React + shadcn/ui + Tailwind CSS |
| Base de datos | Supabase (PostgreSQL) |
| Storage | Supabase Storage — bucket `report-media` |
| Proceso | PM2 (nombre: `venezuela-levanta`, modo fork) |
| Bot | Telegram Bot API (webhook) |
| IA | Google Gemini 2.0 Flash (NLP híbrido) |
| Geocoding | Nominatim / OpenStreetMap |
| Frontend externo | Lovable (edita el frontend y hace push a GitHub) |

## Servidor VPS

- **Directorio:** `/var/www/venezuelaselevanta/`
- **Proceso:** `pm2 restart venezuela-levanta --update-env`
- **Build:** `bun run build` (desde `/var/www/venezuelaselevanta/`)
- **Logs:** `pm2 logs venezuela-levanta --lines 50`
- **Puerto:** 3000 (interno), expuesto vía nginx/proxy

### Ciclo de deploy habitual
```bash
bun run build
pm2 restart venezuela-levanta --update-env
```

> **Para escalar cambios dev → producción** (migraciones de schema, releases con flags,
> el gate de `VITE_*` en el bundle): seguir el runbook [`DEPLOY.md`](DEPLOY.md).

## Variables de entorno (`.env`)

El archivo `.env` vive en `/var/www/venezuelaselevanta/.env` y **no va a git**.

| Variable | Qué es |
|---|---|
| `SUPABASE_URL` | `https://evcgvbycvgueoelvfbna.supabase.co` |
| `SUPABASE_PROJECT_ID` | `evcgvbycvgueoelvfbna` |
| `SUPABASE_PUBLISHABLE_KEY` | JWT anon key (pública, segura en frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (solo backend, para uploads) |
| `TELEGRAM_BOT_TOKEN` | Token del bot `@VenezuelaSeLevantabot` |
| `TELEGRAM_ADMIN_IDS` | (opcional) chat IDs admin para `/broadcast`, separados por coma |
| `GEMINI_API_KEY` | Google AI Studio — Gemini 2.0 Flash |
| `BOT_NEEDS_FLOW` | (opcional) habilita el flujo `/necesidad` del bot (`1`/`true`/`on`/`yes`). Oculto por defecto |
| `BOT_HELP_FLOW` | (opcional) habilita el flujo `/ayudar` del bot (`1`/`true`/`on`/`yes`). Oculto por defecto |

Las claves `VITE_*` son duplicados con prefijo para el cliente Vite.

## Supabase — tablas principales

```
reports            — incidentes en el mapa (categoría, urgencia, lat/lng, fotos)
missing_persons    — personas desaparecidas
patients           — pacientes en centros médicos
health_centers     — centros médicos activos
sites              — puntos geográficos (hospital|acopio|rescate|salud|otro) + DIVIPOL
site_responsibles  — responsables de un punto (1 sitio → N responsables)
needs              — necesidades (agua, comida…) con DIVIPOL + site_id + lat/lng
offers             — ofertas de ayuda con DIVIPOL + site_id + lat/lng (matching)
categories         — categorías de reporte (slug, color, icon)
report_votes       — votos de verificación ciudadana
report_comments    — comentarios en reportes
push_subscriptions — suscriptores de notificaciones push
contact_messages   — mensajes de contacto del formulario web
user_roles         — roles de administrador (moderación)
channel_sessions   — sesiones del bot por canal, clave `${channel}:${externalUserId}`
bot_sessions       — (legacy Telegram; leída como fallback, reemplazada por channel_sessions)
telegram_sessions  — (tabla legacy, no usada)
```

**Columnas DIVIPOL** (convención compartida): `state` / `municipality` / `parish`
(en `reports`, `missing_persons`, `needs`, `offers`, `sites`). No hay CHECK constraints
sobre los vocabularios de `needs`/`offers` (se validan en la app, con fallbacks `catMeta`/`urgMeta`).

**RPCs de matching:** `suggest_patient_matches` (desaparecidos↔pacientes, por nombre/pg_trgm)
y `suggest_needs_for_offer` (needs↔offers por **cercanía**: tier DIVIPOL + distancia haversine, SQL puro).

### Patrón de acceso a Supabase (sin createClient)

El bot usa fetch directo con `apikey` header. No usar `@supabase/supabase-js` en el bot:

```typescript
const res = await fetch(`${SUPA_URL}/rest/v1/reports`, {
  method: "POST",
  headers: {
    apikey: SUPA_ANON,
    Authorization: `Bearer ${SUPA_ANON}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  },
  body: JSON.stringify(payload),
});
```

## Bot de Telegram

**Webhook URL:** `https://venezuelaselevanta.info/api/public/telegram/webhook`

**Autenticación del webhook:** SHA-256 del BOT_TOKEN, cabecera `x-telegram-bot-api-secret-token`

### Arquitectura agnóstica de canal

Separado en tres capas. **Añadir un canal (WhatsApp, chatbot web) = nuevo `ChannelAdapter` + ruta delgada, sin tocar el núcleo:**

- **Transporte** — `src/channels/`: contrato `ChannelAdapter` (`types.ts`) + adaptador Telegram
  (`telegram/adapter.ts`): `verify`, `parseIncoming` → `IncomingMessage`, `send` (traduce el markup
  abstracto a teclados nativos), `storeMedia`, `registerUser`, `/broadcast`.
- **Núcleo agnóstico** — `src/bot/core/`: `engine.ts` (dispatcher) + `flows/{report,missing,search,status,chat,need,help,common}.ts`
  + `nlp.ts` (Gemini) + `geocode.ts` + `data.ts` (fetch Supabase) + `keyboards.ts` + `session.ts`. **No conoce Telegram.**
- **Ruta** — `src/routes/api/public/telegram/webhook.ts`: wrapper delgado (verify → parse → engine → send) + health check `GET`.

### Sesiones

`SessionStore` (`src/bot/core/session.ts`): en memoria (TTL 2 h) con **clave compuesta `${channel}:${externalUserId}`**,
persistida en `channel_sessions`. Lee `bot_sessions` (legacy) como fallback de solo lectura.

### NLP híbrido (Gemini + máquina de estados)

- **Sin sesión activa:** Gemini detecta intención del mensaje libre → ruta al flujo correcto
- **En flujo `awaiting_category` o `awaiting_title`:** Gemini extrae múltiples campos del mensaje → salta pasos ya cubiertos
- **Si Gemini falla o tarda >5s:** el bot continúa con el flujo de pasos normales sin interrupción

### Flujos implementados

| Comando | Estados | Tabla destino |
|---|---|---|
| `/reportar` | `awaiting_category → awaiting_title → awaiting_description → awaiting_urgency → awaiting_media → awaiting_location → awaiting_text_location → awaiting_confirm` | `reports` |
| `/registrar_desaparecido` | `mp_name → mp_age → mp_location → mp_text_location → mp_description → mp_photo → mp_contact → mp_confirm` | `missing_persons` |
| `/buscar [nombre]` | — (búsqueda directa) | `missing_persons` |
| `/encontrado [nombre]` | callbacks `found:` → `foundok:` | `missing_persons` |
| `/estado` | — | `reports`, `missing_persons` |
| `/necesidad` *(gated `BOT_NEEDS_FLOW`)* | `need_site → need_category → need_description → need_quantity → need_location → need_responsible → need_confirm` | `needs` (+ `sites`, `site_responsibles`) |
| `/ayudar` *(gated `BOT_HELP_FLOW`)* | `help_category → help_location → help_pick` (vía RPC `suggest_needs_for_offer`) | `offers` (+ `needs` open→partial) |

Los flujos nuevos (`/necesidad`, `/ayudar`) quedan **ocultos** salvo que su flag de entorno esté activo.

### Categorías de reporte
`missing`, `medical`, `rescue`, `shelter`, `infrastructure`, `evacuation`, `blocked_road`, `hospital`

### Urgencias
`critical`, `high`, `medium`, `low`

## Geocoding

Nominatim (OpenStreetMap) para texto → lat/lng. Venezuela bounding box:
- Lat: -1 a 14 · Lng: -74 a -59

## Git y colaboración

- **Repo:** `https://github.com/otrakossa/venezuelaselevanta.git`
- **Rama principal:** `main`
- **Credenciales:** almacenadas con `git credential.helper store` (token HTTPS en la URL del remote)
- **Lovable** hace push del frontend desde su propia integración
- **Claude** hace push del backend/bot directamente desde el VPS

**No commitear:** `.env`, archivos con credenciales, `node_modules/`, `.output/`

## Rutas API relevantes

```
POST /api/public/telegram/webhook   — webhook de Telegram
GET  /api/public/telegram/webhook   — health check del bot
GET  /api/public/media/:key         — proxy de archivos en Supabase Storage
POST /api/public/reports            — crear reporte desde web
POST /api/public/push               — suscripción push
POST /api/public/hooks              — webhooks varios
```

## Comandos frecuentes

```bash
# Ver estado del servidor
pm2 status

# Rebuild + restart
bun run build && pm2 restart venezuela-levanta --update-env

# Ver logs en tiempo real
pm2 logs venezuela-levanta

# Commit + push (backend / bot)
git add src/bot src/channels src/routes/api/public/telegram/webhook.ts
git commit -m "feat(telegram): descripción"
git push origin main

# Aplicar migraciones de esquema a Supabase (antes de desplegar código que las use)
supabase db push
```
