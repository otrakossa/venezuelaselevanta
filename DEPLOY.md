# Despliegue — Venezuela Se Levanta

Runbook para escalar cambios de **dev → producción** sin romper el entorno local.
Léelo completo antes del primer deploy de un release. Los pasos marcados 🔴 son **gates
que no se saltan**.

---

## 1. Modelo de entornos (por qué dev no se rompe)

La selección de entorno vive **enteramente** en `.env` (git-ignored), distinto por máquina.
El **mismo código** corre en todos lados; solo cambia el `.env`.

| Entorno | Supabase | Bot Telegram | `.env` |
|---|---|---|---|
| Local / dev | `leehurgkpgunksrqjnqm` (staging) | `@venezuelalevanta_bot` | en tu máquina |
| Producción | `advebubtfjgxwpjxprok` | `@VenezuelaSeLevantabot` | en el VPS (`/var/www/venezuelaselevanta/.env`) |

- `.env` y `.env.*` están git-ignored; solo `.env.example` se versiona (plantilla sin secretos).
- **Nunca se commitea nada específico de un entorno** → tu config local nunca se pierde ni se sube.
- Plantilla de variables: ver [`.env.example`](.env.example).

### Cómo lee cada capa su config
- **Navegador** — `src/integrations/supabase/client.ts` lee `import.meta.env.VITE_SUPABASE_URL` /
  `VITE_SUPABASE_PUBLISHABLE_KEY`, inyectadas en **BUILD time** por Vite. Fallback si faltan:
  `http://127.0.0.1:54321` + JWT demo.
- **Server / SSR / admin** — `client.server.ts`, `auth-middleware.ts` leen `process.env.SUPABASE_*` en runtime.
- **Bot** — `src/channels/telegram/adapter.ts` + `src/bot/core/data.ts` leen `process.env` (Supabase, `TELEGRAM_BOT_TOKEN`, flags).
- PM2 carga el `.env` del VPS vía `ecosystem.config.cjs` (lo parsea y lo mete en `process.env`).

### 🔴 El gate dominante: `VITE_*` en prod
Como `client.ts` es **env-driven** y las `VITE_*` se hornean en **build time** (no runtime,
`pm2 --update-env` no las afecta):

> Si el `.env` del VPS **no** tiene `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`
> apuntando a `advebubtfjgxwpjxprok`, el `bun run build` hornea **localhost** en el bundle.
> El build pasa, el SSR funciona, y **todas** las llamadas client-side fallan en silencio
> (mapa, reportes, sites). `deploy.sh` trae un guard que aborta antes del restart si esto pasa.

---

## 2. Modelo de branch + deploy

- `main` es la fuente de verdad y la línea de release.
- Trabajar en `feature/*` → PR a `main`. **El backend owner mergea** los cambios que cruzan la
  frontera Lovable/Claude (tocan frontend *y* bot/canales). Coordinar para que Lovable no
  empuje una regeneración competidora de `client.ts` durante la ventana de merge.
- El VPS despliega con [`deploy.sh`](deploy.sh): `git reset --hard origin/main` →
  `bun install --frozen-lockfile` → `bun run build` → **guard del bundle** → pm2.

```bash
# Ciclo de deploy en el VPS
cd /var/www/venezuelaselevanta && ./deploy.sh
```

---

## 3. Reglas de base de datos (producción)

- Para schema/data de prod usar **solo** `psql "$NEW_SUPABASE_DB_URL"` (o REST con
  `$NEW_SUPABASE_SERVICE_KEY` contra `$NEW_SUPABASE_URL`).
- **Nunca** `supabase db push` ni el tool de migración integrado: apuntan al proyecto **VIEJO
  congelado** (`evcgvbycvgueoelvfbna`), no a prod.
- Prod **no** se construyó desde el historial de `supabase/migrations/` → aplicar solo el
  **delta** que le falta, con `psql -f`, no el historial completo.
- Las migraciones nuevas son idempotentes (`if not exists`, `create or replace`, backfill `where not exists`).

---

## 4. Checklist de release (orden obligatorio: schema → código → flags)

### Paso 0 — Snapshot para rollback (VPS)
```bash
cd /var/www/venezuelaselevanta && git rev-parse HEAD       # SHA = target de rollback de código
pg_dump "$NEW_SUPABASE_DB_URL" --schema=public --no-owner -f /root/pre_release_$(date +%F).sql
```

### Paso 1 — Verificar qué le FALTA a prod (antes de aplicar nada)
Comprobar con `to_regclass` / `information_schema.columns` / `pg_proc` cada objeto que el
release introduce. `NULL`/fila ausente = hay que crearlo. (Ver la sección del release actual
para las consultas concretas.)

### Paso 2 — Aplicar schema con `psql -f`, en orden de dependencias
Aplicar solo los archivos del delta. **No** reaplicar migraciones de “base tables” marcadas
para entornos frescos (debilitarían el RLS de prod, incl. PII de `patients`).

### Paso 3 — Endurecer RLS si el release trae policies dev-permisivas
Dropear cualquier policy `... using (true)` de UPDATE/DELETE que no deba ser pública;
conservar SELECT/INSERT público donde web/bot lo necesiten para registrar.

### Paso 4 — Re-verificar schema + smoke de RPCs nuevos
Repetir el Paso 1: todo non-null. Probar los RPC nuevos con un `select` de ejemplo.

### Paso 5 — 🔴 Gate `VITE_*` en el `.env` del VPS (antes de buildear)
```bash
grep -E '^VITE_SUPABASE_(URL|PUBLISHABLE_KEY)=' /var/www/venezuelaselevanta/.env
```
Si falta, agregarlas apuntando a prod:
```
VITE_SUPABASE_URL=https://advebubtfjgxwpjxprok.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key de prod>
```

### Paso 6 — Merge + deploy con **flags OFF**
Confirmar que el `.env` del VPS **no** tiene `BOT_NEEDS_FLOW`/`BOT_HELP_FLOW` (o están off).
Mergear a `main` y correr `./deploy.sh`. El guard de `deploy.sh` aborta si el bundle quedó
apuntando a localhost o no referencia el host de `VITE_SUPABASE_URL`.

### Paso 7 — Health checks
```bash
pm2 logs venezuela-levanta --lines 50                                  # sin "Missing env" ni 401s
curl -s https://venezuelaselevanta.info/api/public/telegram/webhook    # → {"ok":true,...}
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo" # url + pending + last_error
```
Webhook: **no** requiere re-registro si el token y la URL no cambiaron (el secret se deriva
`sha256(TELEGRAM_BOT_TOKEN)`). Solo re-correr `setWebhook` si cambió alguno.

### Paso 8 — Rollout progresivo de flags (runtime, sin rebuild)
Los flags se leen de `process.env` en runtime. Activar = editar `.env` del VPS +
`pm2 restart venezuela-levanta --update-env`. Verificar en cada gate antes de avanzar.

---

## 5. Rollback

Orden: lo más barato primero. El schema es **aditivo** y compatible hacia atrás, así que un
rollback de código **no** requiere rollback de schema.

- **Flags (segundos):** quitar `BOT_*_FLOW` del `.env` → `pm2 restart --update-env`.
- **Código (minutos):** `git reset --hard <SHA del Paso 0>` → `bun run build` → guard → `pm2 restart`.
  Alternativa limpia: `git revert -m 1 <merge-commit>` en `main`, push, y el VPS hace pull.
- **Schema (solo si una migración fue el problema):** cada `.sql` trae su `DOWN` en comentarios.
  Preferir flags-off + revert de código y **conservar** el schema aditivo.
- Red de seguridad: el `pg_dump` del Paso 0.

---

## 6. Release actual: `feature/ajustes` (sites + bot agnóstico + matching)

12 commits: núcleo de bot agnóstico de canal, flujos `/necesidad` y `/ayudar`, matching por
cercanía, entidad `sites`, suite de tests. **Decidido:** client.ts env-driven (commiteado),
deploy oculto-primero, endurecer RLS de `sites`, frontend lo sirve el VPS.

### Paso 1 — Verificar qué le falta a prod
```bash
psql "$NEW_SUPABASE_DB_URL" -c "select to_regclass('public.sites'), to_regclass('public.site_responsibles'), to_regclass('public.channel_sessions');"
psql "$NEW_SUPABASE_DB_URL" -c "select column_name from information_schema.columns where table_name='needs' and column_name in ('state','municipality','parish','site_id');"
psql "$NEW_SUPABASE_DB_URL" -c "select column_name from information_schema.columns where table_name='offers' and column_name in ('state','municipality','parish','lat','lng','site_id');"
psql "$NEW_SUPABASE_DB_URL" -c "select proname from pg_proc where proname in ('suggest_needs_for_offer','has_role');"
# admin_interop (estado desconocido):
psql "$NEW_SUPABASE_DB_URL" -c "select to_regclass('public.match_dismissals'), to_regclass('public.dedupe_whitelist'), to_regclass('public.merge_log'), to_regclass('public.missing_status_log');"
```

### Paso 2 — Aplicar las 3 migraciones (en este orden)
```bash
psql "$NEW_SUPABASE_DB_URL" -f supabase/migrations/20260627132457_sites_and_geo.sql
psql "$NEW_SUPABASE_DB_URL" -f supabase/migrations/20260627134712_channel_sessions.sql
psql "$NEW_SUPABASE_DB_URL" -f supabase/migrations/20260627145407_suggest_needs_for_offer.sql
```
> **NO** aplicar `20260625060715_dev_base_tables_and_bucket.sql` (es para entornos frescos;
> prod ya tiene esas tablas y su RLS dev-permisivo debilitaría prod).

### Paso 3 — Endurecer RLS de `sites`
```bash
psql "$NEW_SUPABASE_DB_URL" -c "drop policy if exists \"sites public update\" on public.sites;"
# anon/authenticated conservan SELECT + INSERT; UPDATE/DELETE → solo service_role.
```

### Paso 4 — admin_interop (solo si el Paso 1 lo mostró ausente y `has_role` existe)
```bash
psql "$NEW_SUPABASE_DB_URL" -f sql/2026-06-27_admin_interop.sql
```

### Paso 5 — Re-verificar + smoke del RPC
```bash
psql "$NEW_SUPABASE_DB_URL" -c "select * from public.suggest_needs_for_offer('agua',10.5,-66.9,'Distrito Capital',null,null) limit 3;"
```

### Pasos 5–7 (env gate, deploy, health) — según el checklist general (sección 4).

### Paso 8 — Rollout progresivo de los flujos del bot
- **Gate A — paridad (flags ausentes):** `/reportar`, `/buscar`, `/encontrado`, `/estado`,
  `/registrar_desaparecido` igual que antes; logs limpios; `channel_sessions` recibe filas.
  Las features **web** de needs/offers (SitePicker en `/necesidades`, sugerencias en `/ofertas`)
  **no** están gated → verificar que rendericen y que el SitePicker liste `sites`.
- **Gate B — `BOT_NEEDS_FLOW=1`** → `pm2 restart --update-env` → probar `/necesidad`
  (crea `needs` con DIVIPOL + `site_id`; si crea punto nuevo, filas en `sites` + `site_responsibles`).
- **Gate C — `BOT_HELP_FLOW=1`** → restart → probar `/ayudar` (llama `suggest_needs_for_offer`,
  escribe `offers`, pasa el `need` matcheado de `open → partial`).

```bash
# Verificar que el bot persiste sesiones tras el deploy:
psql "$NEW_SUPABASE_DB_URL" -c "select session_key, updated_at from public.channel_sessions order by updated_at desc limit 5;"
```
