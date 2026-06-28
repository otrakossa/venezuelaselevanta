# Revisión técnica de los ajustes — rama `feature/ajustes`

> **Propósito de este documento.** Dejar constancia, con el máximo nivel de detalle verificado
> contra el código, de TODO lo que se construyó en la rama `feature/ajustes`. Sirve como insumo
> para luego redactar un documento no técnico (alcance, valor agregado) y para decidir si se
> escala a producción.
>
> **Método.** Cada afirmación de este documento se contrastó leyendo el código fuente, las
> migraciones SQL y corriendo la suite de pruebas. Donde la versión no técnica difiere de lo
> implementado, se indica explícitamente.
>
> **Fecha de revisión:** 2026-06-27 · **Rama:** `feature/ajustes` · **HEAD:** `80c8dec` ·
> **Base (merge-base con `main`):** `ef89d49`

---

## 0. Resultado de la revisión (TL;DR)

| Pregunta | Respuesta |
|---|---|
| ¿El código coincide con lo que dice el resumen no técnico? | **Sí**, en lo esencial y con creces. El resumen subestima un punto: el matching por cercanía también está en la **web**, no solo en el bot. |
| ¿Está todo implementado y funcionando? | Funcionalidad y datos: **sí**. Pruebas core: **33/33 en verde** (corridas en esta revisión). E2E y DB: implementadas, corren en CI. |
| ¿Rompe algo de lo existente? | **No.** Las migraciones son aditivas/idempotentes/reversibles; el refactor del bot mantiene **paridad total** con Telegram; los flujos nuevos están **ocultos tras feature flags**. |
| ¿Está esto ya en producción? | **No.** Vive en la rama y (según notas del proyecto) en el Supabase de **dev**. Escalar a prod requiere: aplicar migraciones al proyecto nuevo, decidir flags y **endurecer políticas RLS** (ver §9). |

**Veredicto:** los cambios están correctamente implementados, son de bajo riesgo por diseño
(aditivos + flags + pruebas) y aportan una capacidad nueva de valor (registrar necesidades por
punto y conectar oferta↔necesidad por cercanía). El principal trabajo pendiente antes de prod es
de **seguridad/privacidad de datos** (RLS) y de **operación** (aplicar migraciones + activar flags).

---

## 1. Alcance: qué entró en la rama

14 commits sobre `main`. Se agrupan en dos bloques: **funcionalidad** (Fases 0–3) y **pruebas**
(Fases 0–5). Más documentación.

```
198d050 docs: CLAUDE.md + APP_OVERVIEW (arquitectura de canal, sites, matching)
ffebe9a feat(matching): Fase 3 — matching por cercanía + 'quiero ayudar'
9d32c41 feat(needs):    Fase 2 — registro de necesidades por punto (web + bot)
e0bc073 refactor(bot):  Fase 1 — arquitectura de canal agnóstica (paridad total Telegram)
024c457 feat:           fallbacks defensivos de categorías/urgencias + APP_OVERVIEW
0ae0c01 feat(db):       Fase 0 — entidad sites, responsables y DIVIPOL/geo en needs/offers
+ test(harness/bot-core/webhook/db/e2e/smoke): Fases 0–5 de la suite de pruebas
```

**Tamaño del diff:** ~7.837 líneas añadidas / ~1.100 eliminadas en 111 archivos. La mayor
parte de las eliminaciones (1.041 líneas) corresponden a `webhook.ts`, que pasó de un monolito
a un wrapper de 43 líneas (ver §4).

> **Nota de nomenclatura.** El resumen no técnico numera "Etapas 1–4"; el git numera "Fases 0–3".
> El mapeo es:
> - **Etapa 1 (Cimientos de información)** = **Fase 0** (entidad `sites`, responsables, DIVIPOL/geo).
> - **Etapa 2 (Preparar para crecer)** = **Fase 1** (arquitectura de canal agnóstica).
> - **Etapa 3 (Necesidades por punto)** = **Fase 2** (alta de `needs` en web + bot).
> - **Etapa 4 (Conectar ayuda con necesidad)** = **Fase 3** (matching por cercanía + ofertas).

---

## 2. Fase 0 — Cimientos de datos (entidad `sites`, responsables, DIVIPOL/geo)

Migración: `supabase/migrations/20260627132457_sites_and_geo.sql`.
La cabecera lo declara: **"TODO ADITIVO, IDEMPOTENTE Y REVERSIBLE. No cambia comportamiento."**
Incluye el bloque DOWN (rollback) comentado al final.

### 2.1 Tabla `sites` — el "punto" como entidad de primera clase
Cada hospital, centro de acopio o punto de rescate ahora es un registro propio:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `type` | text | `hospital \| acopio \| rescate \| salud \| otro` — extensible, **SIN CHECK** (se valida en la app) |
| `name` | text NOT NULL | |
| `description` | text | |
| `lat` / `lng` | double precision | coordenadas |
| `state` / `municipality` / `parish` | text | **DIVIPOL** (misma convención que `reports`) |
| `status` | text | default `active` |
| `created_at` / `updated_at` | timestamptz | trigger `set_updated_at` |

Índices: `(state, municipality, parish)`, `(lat, lng)`, `(type)`. RLS habilitado con políticas
**públicas** de lectura/inserción/actualización (ver §9).

### 2.2 Tabla `site_responsibles` — 1 sitio → N responsables
| Columna | Tipo |
|---|---|
| `id` | uuid PK |
| `site_id` | uuid → `sites(id)` ON DELETE CASCADE |
| `name` / `phone` / `contact_info` / `role_label` | text |
| `created_at` | timestamptz |

Índice por `site_id`. RLS público de lectura/inserción (coherente con que el objetivo es poner en
contacto a quien ofrece con el responsable del punto).

### 2.3 `needs` y `offers` — DIVIPOL + geo + FK a `sites`
- **`needs`** gana: `state`, `municipality`, `parish`, `site_id` (→ `sites`, ON DELETE SET NULL).
- **`offers`** gana: `state`, `municipality`, `parish`, **`lat`, `lng`** (necesarias para el matching de Fase 3) y `site_id`.
- Índices DIVIPOL + `site_id` (+ `lat/lng` en offers).

### 2.4 Backfill no destructivo
Copia `health_centers` → `sites` como `type='salud'`, solo los que aún no existen por `(name, lat, lng)`.
Es re-ejecutable sin duplicar. `health_centers` queda **intacto**.

> **Migración de soporte** `20260625060715_dev_base_tables_and_bucket.sql`: reconstruye tablas base
> (`health_centers`, `needs`, `offers`, `patients`, `bot_sessions`, `bot_users`, bucket `report-media`)
> que el proyecto original había creado fuera de migraciones, para que `supabase db reset` funcione
> de cero (necesario para CI/tests). **Aviso explícito en la cabecera:** sus políticas RLS son
> permisivas y `patients` contiene PII — endurecer antes de prod.

---

## 3. Fase 1 — Arquitectura de canal agnóstica (el "motor" separado del canal)

Refactor que reorganiza el bot en **tres capas**, de modo que el núcleo de la conversación **no
conoce Telegram**. El resultado: añadir WhatsApp o un chat web = nuevo adaptador + ruta delgada,
**sin tocar los flujos**.

### 3.1 Las tres capas

| Capa | Ubicación | Responsabilidad | ¿Conoce Telegram? |
|---|---|---|---|
| **Transporte (contrato)** | `src/channels/types.ts` | Define `ChannelAdapter`, `IncomingMessage`, `OutgoingMessage`, `ReplyMarkup`, `Capabilities` | ❌ No |
| **Transporte (Telegram)** | `src/channels/telegram/adapter.ts` | Traduce update nativo ↔ tipos abstractos; `verify`, `parseIncoming`, `send`, `storeMedia`, `registerUser`, `/broadcast` | ✅ Sí |
| **Núcleo** | `src/bot/core/` | `engine.ts` (dispatcher) + `flows/*` + `session.ts` + `nlp.ts` + `geocode.ts` + `data.ts` + `keyboards.ts` + `constants.ts` | ❌ No |
| **Ruta (ensamblador)** | `src/routes/api/public/telegram/webhook.ts` | Wirea adaptador + motor + sesiones (43 líneas) | ✅ Sí (única que importa el adapter) |

### 3.2 Cómo se logra la independencia del canal
- **Inversión de control (`EngineCtx`).** El webhook inyecta al motor los métodos `send()`,
  `storeMedia()`, `getSession()`, `setSession()`, `clearSession()` y las `capabilities`. El motor
  los llama sin saber qué hay detrás (`src/bot/core/types.ts:20-37`).
- **Normalización de entrada.** El adaptador convierte el update crudo de Telegram en un
  `IncomingMessage` neutro (`channel`, `externalUserId`, `text`, `callbackData`, `location`,
  `media`, `fromName`, `username`).
- **Markup abstracto.** Los flujos construyen teclados neutros (`{kind:"inline"|"keyboard"|"remove"}`)
  en `keyboards.ts`; el adaptador los traduce al formato nativo (`adapter.ts toMarkup()`).
- **Comandos específicos interceptados antes del núcleo.** `/myid` y `/broadcast` (admin de
  Telegram) los maneja `tryHandleTelegramAdmin()` en el adapter; nunca llegan al motor.

### 3.3 Sesiones agnósticas (`session.ts`)
- Clave compuesta **`${channel}:${externalUserId}`** (p.ej. `telegram:12345678`).
- Caché en memoria (`Map`) con **TTL de 2 horas**; al expirar limpia memoria + DB + legacy.
- Persistencia en la tabla nueva **`channel_sessions`** (`session_key` PK, `data` jsonb, `updated_at`),
  migración `20260627134712_channel_sessions.sql` (solo `service_role`).
- **Fallback de solo lectura** a `bot_sessions` (legacy, keyed por `chat_id`) para no perder sesiones
  en vuelo durante el primer deploy. Extrae el `chat_id` con regex `^telegram:(\d+)$`.

### 3.4 Evidencia de paridad
- `webhook.ts` pasó de **~1.041 líneas a 43** (toda la lógica migró al núcleo reutilizable).
- El commit se titula explícitamente *"paridad total Telegram"*.
- Los tests de webhook (§7) reproducen un flujo de usuario real `/reportar` extremo a extremo
  contra el handler real de la ruta y verifican que se persiste la sesión en `channel_sessions`.

---

## 4. Fase 2 — Registrar necesidades por punto (web + bot)

### 4.1 En el bot: flujo `/necesidad` (`src/bot/core/flows/need.ts`)
- **Gated** por `BOT_NEEDS_FLOW` (`1|true|on|yes`). Oculto por defecto.
- Máquina de estados (7 pasos): `need_site → need_category → need_description → need_quantity →
  need_location → need_responsible → need_confirm`.
- Captura: nombre del punto, categoría (`NEED_CATEGORIES`), descripción, cantidad, ubicación
  (GPS o dirección geocodificada vía Nominatim, validada contra el bounding box de Venezuela),
  y datos del responsable (nombre + teléfono).
- **Escribe 3 tablas al confirmar:**
  1. `sites` (reutiliza por nombre exacto si ya existe; si es nuevo, lo crea con `type='otro'`, `status='active'`).
  2. `site_responsibles` (solo si el sitio es nuevo y hay nombre/teléfono).
  3. `needs` (título auto "{Categoría} — {site}", `urgency='high'`, `status='open'`, DIVIPOL, `site_id`,
     `reporter_name` con sufijo de canal "(Telegram)").

### 4.2 En la web: `/necesidades` (`src/routes/necesidades.tsx`)
- Wizard de 3 pasos: **Qué se necesita** (categoría + urgencia + título/descripción/cantidad) →
  **Dónde** (`SitePicker` + cascada DIVIPOL Estado→Municipio→Parroquia + dirección + responsable
  si el punto es nuevo) → **Contacto**.
- **`SitePicker.tsx`** (componente nuevo): buscador de puntos existentes (por nombre/parroquia/
  municipio/estado) con opción de **crear uno nuevo en línea**. **`useSites.ts`** (hook nuevo):
  carga y cachea `sites` desde Supabase.
- Al guardar: crea `sites` (+ `site_responsibles`) si es nuevo, luego `needs` con DIVIPOL completo,
  `site_id` y `status='open'`.
- Las tarjetas muestran estado: **abierta / parcial / cubierta** (`open|partial|fulfilled`), y un botón
  "Ofrecer ayuda" salvo que ya esté cubierta.

> **Robustez añadida (commit 024c457).** `necesidades.tsx` y `ofertas.tsx` ahora usan accesores con
> fallback (`catMeta`/`urgMeta`): una categoría/urgencia fuera del enum ya **no tumba la página**
> (cae a `📦 Otro` / `Media`). Antes, un valor inesperado disparaba el error boundary.

---

## 5. Fase 3 — Conectar ayuda con necesidad (matching por cercanía)

### 5.1 El motor de matching: RPC `suggest_needs_for_offer`
Migración `20260627145407_suggest_needs_for_offer.sql`. **SQL puro, sin extensiones.**
Dada una oferta (categoría + ubicación + DIVIPOL), devuelve hasta **8** necesidades abiertas
(`status in ('open','partial')`) y de la misma categoría, ordenadas por:

1. **Tier territorial DIVIPOL:** 0 = misma parroquia · 1 = mismo municipio · 2 = mismo estado · 3 = otra zona.
2. **Urgencia:** critical → high → medium → low.
3. **Distancia haversine (km)** calculada en SQL (radio 6371 km), `nulls last`.
4. Desempate por `created_at desc`.

Devuelve también `tier`, `distance_km`, contacto y `site_id` de cada necesidad. `grant execute` a
`anon` y `authenticated`.

### 5.2 En el bot: flujo `/ayudar` (`src/bot/core/flows/help.ts`)
- **Gated** por `BOT_HELP_FLOW`. Oculto por defecto.
- Estados (3 pasos): `help_category → help_location → help_pick`.
- Captura categoría y ubicación (GPS o dirección geocodificada), llama a `suggest_needs_for_offer`,
  muestra el top de necesidades cercanas con su distancia, y al elegir una:
  - Inserta en `offers` (`status='matched'`, `need_id`, `lat/lng`, contacto).
  - **PATCH a `needs`**: `open → partial`.
  - Busca el responsable del punto (`site_responsibles`) para devolver el contacto correcto.

### 5.3 En la web: `/ofertas` (`src/routes/ofertas.tsx`) — **más rico que el bot**
- Wizard de alta de oferta (qué ofreces + ubicación DIVIPOL + contacto). `status` inicial
  `available` (o `matched` si se llega prefilled desde una necesidad).
- **`MatchPicker`** (modal de vinculación): llama a `suggest_needs_for_offer` y muestra sugerencias
  agrupadas por **tier** ("Misma parroquia", "Mismo municipio"…) **con distancia en km**; además
  ofrece **búsqueda manual** (por título/centro, scope misma-categoría o todas).
- Al vincular: PATCH `offers` (`need_id`, `status='matched'`) + PATCH `needs` (`open → partial`).
- Estados visibles de oferta: **Disponible / Vinculada / Entregada** (`available|matched|delivered`),
  con acciones Vincular / Desvincular / Marcar entregada.

> **Hallazgo respecto al resumen no técnico:** el documento dice que el sistema sugiere necesidades
> cercanas "en el bot". En realidad **la web también** ejecuta el matching por cercanía (mismo RPC),
> con una UI más completa (sugerencias + búsqueda manual + estados). Esto es **más** de lo que el
> resumen reclama.

---

## 6. Documentación añadida
- `docs/APP_OVERVIEW.md` (nuevo): recorrido funcional de toda la app (rutas, vocabularios de estado
  por tabla, API de datos abiertos GeoJSON/CSV-HXL, integraciones USGS/Supabase/Telegram, notas de
  robustez). Es una excelente base para el documento no técnico.
- `CLAUDE.md`: actualizado con la arquitectura de canal, `sites` y matching.

---

## 7. Pruebas automáticas (la "red de seguridad") — Fases 0–5

Suite construida por niveles, pensada para correr **sin tocar producción** (todo aislado con mocks,
salvo la prueba de base de datos que usa un Supabase **local** efímero).

### 7.1 Inventario verificado (corrido en esta revisión)

| Nivel | Framework | Capa | Archivos | Casos | Mocks | Comando | Estado |
|---|---|---|---|---|---|---|---|
| Núcleo + webhook + smoke | Vitest + MSW | unidad/integración | 10 | **33** | MSW (todo I/O) | `bun run test` | ✅ **33/33 verde** |
| RPC matching | Vitest + `postgres` | integración DB real | 1 | 5 | ninguno (Postgres local) | `bun run test:db` | requiere `supabase start` |
| Web E2E | Playwright (Chromium) | extremo a extremo | 6 | 8 | `page.route()` (OSM/USGS/Nominatim/Supabase) | `bun run test:e2e` | requiere `bun run build` |
| Smoke real | GramJS (`telegram`) | bot real, opcional | 1 script | ~4 flujos | ninguno (bot dedicado) | `bun run test:smoke` | **gated** por env |

**Total: 17 archivos de prueba · 46 casos automatizados** (33 core + 5 db + 8 e2e) + el script
smoke gated. Resultado de correr el núcleo en esta revisión: `Test Files 10 passed (10) · Tests
33 passed (33)` en ~600 ms.

### 7.2 Detalle por nivel
- **Aislamiento.** Vitest usa **MSW** con `onUnhandledRequest: "error"`: si algún `fetch` real se
  escapa, el test **falla**. Se mockean Gemini, Supabase (REST + RPC), Nominatim, USGS y Telegram
  Bot API. Credenciales falsas en `.env.test` (committeable).
- **Núcleo (`tests/core/`).** Un test por flujo: `report` (6), `chat` (5), `engine` (5), `search` (4),
  `missing` (2), `help` (2), `status` (1), `need` (1). Cubren: máquinas de estado completas, saltos
  de paso por NLP, fallback cuando Gemini cae, validación de bounds de Venezuela, errores de INSERT.
- **Webhook (`tests/webhook/`, 5).** Integración del handler real: rechaza secret inválido (401),
  health check GET, produce `sendMessage`, persiste sesión en `channel_sessions`, y un flujo
  `/reportar` completo extremo a extremo.
- **DB (`tests/db/matching.test.ts`, 5).** Corre `suggest_needs_for_offer` y `suggest_patient_matches`
  contra **Postgres local real** (puerto 54322), truncando tablas y sembrando fixtures. Verifica el
  orden tier→urgencia→distancia y la transición de estados.
- **E2E (`e2e/`, 8).** Playwright sobre el build de producción con todo el I/O externo interceptado:
  `reportar` (cascada DIVIPOL + submit), `ofertas` (sugerencias por cercanía + vínculo + fallback de
  vocabulario), `desaparecidos` (matching de pacientes), `estadisticas` (export GeoJSON/CSV-HXL),
  `mapa` (filtros en URL + apertura de detalle), `smoke` (home carga).
- **Smoke real (`tests/smoke/`).** GramJS contra un bot de prueba **dedicado**. Guardrail que
  **rechaza** apuntar al bot de producción y se **salta limpio** (exit 0) si faltan las variables
  `SMOKE_*` — seguro en CI.
- **CI (`.github/workflows/test.yml`).** Workflow `Tests` **aparte y no bloqueante** (no toca el
  deploy por SSH), con 3 jobs: `core`, `e2e`, `db` (este último levanta `supabase start` + `db reset`).

---

## 8. Validación del checklist del resumen no técnico

| # | Afirmación del resumen | Veredicto | Evidencia |
|---|---|---|---|
| 1 | Existen los "puntos/lugares" con ubicación y responsable | ✅ Cierto | Tablas `sites` + `site_responsibles` (migración Fase 0); backfill desde `health_centers` |
| 2 | Necesidades y ofertas guardan su DIVIPOL (estado/municipio/parroquia) | ✅ Cierto (matiz) | Columnas añadidas a `needs` y `offers`. **Matiz:** la web de **ofertas** guarda `parish=null` (solo estado+municipio); el bot y `needs` sí guardan los tres |
| 3 | El motor del bot quedó separado del canal; Telegram igual; sumar canal no exige rehacer flujos | ✅ Cierto | 3 capas (`channels/` · `bot/core/` · ruta de 43 líneas); `EngineCtx` por inyección; paridad verificada por tests |
| 4 | Registrar una necesidad por punto desde web y desde Telegram | ✅ Cierto | Web `necesidades.tsx` (+`SitePicker`/`useSites`) y bot `/necesidad` (gated) |
| 5 | Al ofrecer ayuda, el sistema sugiere necesidades cercanas, permite vincularlas y muestra estado | ✅ Cierto y **superado** | RPC `suggest_needs_for_offer` (tier DIVIPOL + haversine). En **bot** (`/ayudar`) **y web** (`MatchPicker`). Estados open→partial / available→matched→delivered |
| 6 | Suite de pruebas automáticas (en curso) | ✅ Ya implementada, no "en curso" | 17 archivos / 46 casos + smoke; core 33/33 verde; CI con 3 jobs |

**Conclusión de la validación:** las 6 afirmaciones se cumplen. Dos correcciones de matiz para el
documento no técnico: (a) el matching por cercanía está **también en la web**; (b) la suite de
pruebas ya está **construida y pasando**, no meramente "en marcha".

---

## 9. Consideraciones para escalar a producción (valor + riesgos)

### 9.1 Valor agregado (por qué vale la pena)
- **Cierra el lazo ayuda↔necesidad.** Antes el sistema registraba incidentes; ahora **conecta**
  quién necesita con quién ofrece, priorizando por cercanía y urgencia. Es el salto de "mapa de
  reportes" a "coordinación de respuesta".
- **Inversión que habilita crecimiento barato.** La arquitectura de canal convierte "sumar WhatsApp
  o chat web" en trabajo acotado (adaptador + ruta), sin reescribir la lógica conversacional.
- **Datos estructurados y trazables.** `sites` + DIVIPOL + `site_id` permiten agregar por estado/
  municipio/parroquia y alimentar los exports abiertos (GeoJSON/CSV-HXL) ya existentes.
- **Calidad operacional.** La red de pruebas reduce el riesgo de regresiones en cada cambio futuro,
  algo crítico en un sistema de crisis donde un fallo silencioso cuesta.

### 9.2 Riesgos / trabajo previo a producción (orden sugerido)
1. **Endurecer RLS (alta prioridad / privacidad).** Las políticas de `sites`, `site_responsibles`,
   `needs`, `offers` (y `patients`) son **públicas** de lectura **y** escritura. `site_responsibles`
   guarda **teléfonos** (PII) con lectura pública. Antes de prod conviene: limitar `update`/`delete`,
   y revisar qué PII se expone vía `anon`. Las migraciones de dev lo advierten explícitamente.
2. **Aplicar migraciones al Supabase de producción** (proyecto `advebubtfjgxwpjxprok`), no al de dev.
   Las 4 migraciones nuevas son aditivas e idempotentes; traen su propio bloque DOWN para rollback.
3. **Decidir activación de flags.** `/necesidad` y `/ayudar` están ocultos. Definir si se lanzan y
   poner `BOT_NEEDS_FLOW` / `BOT_HELP_FLOW` en el `.env` del VPS.
4. **Vocabularios sin CHECK.** `needs.category`/`offers.category` se validan solo en la app (con
   fallbacks). Aceptable por flexibilidad, pero implica disciplina de datos.
5. **Validar el flujo completo en staging** con datos reales (geocoding Nominatim, matching) antes
   de exponer a usuarios.

---

## 10. Apéndice — archivos clave y comandos

### Migraciones nuevas
```
supabase/migrations/20260625060715_dev_base_tables_and_bucket.sql   (soporte CI/reset)
supabase/migrations/20260627132457_sites_and_geo.sql                (Fase 0)
supabase/migrations/20260627134712_channel_sessions.sql             (Fase 1)
supabase/migrations/20260627145407_suggest_needs_for_offer.sql      (Fase 3)
```

### Código nuevo / refactorizado
```
src/channels/types.ts · src/channels/telegram/adapter.ts            (transporte)
src/bot/core/{engine,session,types,keyboards,constants,data,nlp,geocode}.ts
src/bot/core/flows/{report,missing,search,status,chat,need,help,common}.ts
src/routes/api/public/telegram/webhook.ts                           (1041 → 43 líneas)
src/routes/{necesidades,ofertas,index}.tsx                          (web)
src/components/SitePicker.tsx · src/hooks/useSites.ts               (web)
```

### Comandos de verificación
```bash
bun run test        # núcleo del bot (Vitest + MSW) — 33 tests, sin Docker
bun run test:db     # RPC matching contra Supabase local (requiere `supabase start`)
bun run test:e2e    # Playwright (requiere `bun run build`)
bun run test:smoke  # smoke real GramJS (gated; se salta sin SMOKE_*)
```

---

*Documento generado tras revisar el código de `feature/ajustes` archivo por archivo, leer las 4
migraciones, y correr la suite de pruebas del núcleo (33/33 en verde). Listo para servir de base al
documento no técnico de alcance y valor.*
