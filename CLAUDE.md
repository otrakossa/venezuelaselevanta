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

## Variables de entorno (`.env`)

El archivo `.env` vive en `/var/www/venezuelaselevanta/.env` y **no va a git**.

| Variable | Qué es |
|---|---|
| `SUPABASE_URL` | `https://evcgvbycvgueoelvfbna.supabase.co` |
| `SUPABASE_PROJECT_ID` | `evcgvbycvgueoelvfbna` |
| `SUPABASE_PUBLISHABLE_KEY` | JWT anon key (pública, segura en frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (solo backend, para uploads) |
| `TELEGRAM_BOT_TOKEN` | Token del bot `@VenezuelaSeLevantabot` |
| `GEMINI_API_KEY` | Google AI Studio — Gemini 2.0 Flash |

Las claves `VITE_*` son duplicados con prefijo para el cliente Vite.

## Supabase — tablas principales

```
reports            — incidentes en el mapa (categoría, urgencia, lat/lng, fotos)
missing_persons    — personas desaparecidas
patients           — pacientes en centros médicos
health_centers     — centros médicos activos
needs              — necesidades (agua, comida, medicamentos)
offers             — ofertas de ayuda
categories         — categorías de reporte (slug, color, icon)
report_votes       — votos de verificación ciudadana
report_comments    — comentarios en reportes
push_subscriptions — suscriptores de notificaciones push
contact_messages   — mensajes de contacto del formulario web
user_roles         — roles de administrador
telegram_sessions  — (tabla legacy, no usada; sesiones viven en memoria)
```

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

**Archivo:** `src/routes/api/public/telegram/webhook.ts`

**Webhook URL:** `https://venezuelaselevanta.info/api/public/telegram/webhook`

**Autenticación del webhook:** SHA-256 del BOT_TOKEN, cabecera `x-telegram-bot-api-secret-token`

### Sesiones

In-memory `Map<number, Session>` con TTL de 2 horas. No persisten entre reinicios de PM2.

### Arquitectura híbrida (Gemini + máquina de estados)

- **Sin sesión activa:** Gemini detecta intención del mensaje libre → ruta al flujo correcto
- **En flujo `awaiting_category` o `awaiting_title`:** Gemini extrae múltiples campos del mensaje → salta pasos ya cubiertos
- **Si Gemini falla o tarda >5s:** el bot continúa con el flujo de pasos normales sin interrupción

### Flujos implementados

| Comando | Estados | Tabla destino |
|---|---|---|
| `/reportar` | `awaiting_category → awaiting_title → awaiting_description → awaiting_urgency → awaiting_media → awaiting_location → awaiting_text_location → awaiting_confirm` | `reports` |
| `/registrar_desaparecido` | `mp_name → mp_age → mp_location → mp_text_location → mp_description → mp_photo → mp_contact → mp_confirm` | `missing_persons` |
| `/buscar [nombre]` | — (búsqueda directa) | `missing_persons` |
| `/estado` | — | `reports`, `missing_persons` |

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

# Commit + push (backend)
git add src/routes/api/public/telegram/webhook.ts
git commit -m "feat(telegram): descripción"
git push origin main
```
