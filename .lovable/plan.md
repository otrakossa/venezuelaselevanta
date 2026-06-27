
## Problema

Las herramientas integradas (`supabase--read_query`, `supabase--migration`, `supabase--insert`, variables `PG*` del sandbox) están cableadas al proyecto **viejo** (`evcgvbycvgueoelvfbna.supabase.co`). Por eso el análisis anterior devolvió 25.865 desaparecidos: esa cifra es de la BD vieja, no de producción.

La BD **nueva y real** es `advebubtfjgxwpjxprok.supabase.co` y solo es accesible vía `psql $NEW_SUPABASE_DB_URL` o REST con `NEW_SUPABASE_SERVICE_KEY`. Esto ya pasó factura en migraciones anteriores y va a seguir pasando si no lo dejamos documentado.

## Plan

### 1. Fijar la fuente de verdad en el repo

Crear/actualizar `CLAUDE.md` (y replicar la nota corta en `AGENTS.md`) con una sección **al principio**, imposible de pasar por alto:

```markdown
## ⚠️ BASE DE DATOS DE PRODUCCIÓN — LEER PRIMERO

Producción usa el proyecto Supabase NUEVO:
- URL:        https://advebubtfjgxwpjxprok.supabase.co
- Project ID: advebubtfjgxwpjxprok

El proyecto VIEJO (`evcgvbycvgueoelvfbna`) sigue existiendo pero está
congelado — su data NO refleja producción.

### Reglas obligatorias para el agente

1. Para consultar datos reales usar SIEMPRE `psql $NEW_SUPABASE_DB_URL`
   o REST con `NEW_SUPABASE_SERVICE_KEY` contra `NEW_SUPABASE_URL`.
2. Las herramientas integradas `supabase--read_query`, `supabase--insert`,
   `supabase--migration`, `supabase--slow_queries` y las variables `PG*`
   del sandbox apuntan al proyecto viejo — NO usarlas para análisis
   ni migraciones que afecten producción.
3. Para cambios de schema en producción: generar el SQL y ejecutarlo con
   `psql $NEW_SUPABASE_DB_URL -f migracion.sql` (no con el tool de
   migración).
4. El cliente del frontend (`src/integrations/supabase/client.ts`) ya
   está hardcodeado al proyecto nuevo; el VPS lee sus credenciales del
   `.env` propio del servidor.
```

### 2. Añadir el mismo aviso a la sección "Stack de producción" de la project-knowledge

Para que aparezca también en el contexto inyectado en cada sesión nueva.

### 3. Re-correr el análisis de duplicados contra la BD nueva

Una vez documentado, ejecutar con `psql $NEW_SUPABASE_DB_URL`:

- Conteos por tabla (`missing_persons`, `patients`, `reports`).
- Grupos duplicados por `lower(unaccent(name))` en `missing_persons`.
- Muestra de 2-3 grupos para que veas la pinta real.

Con esos números reales recién armo la estrategia de deduplicación
(scoring de completitud, fusión, borrado) — porque la magnitud del
problema en la BD nueva puede ser muy distinta.

## Qué necesito de vos

- ✅ Confirmar que escriba la nota en `CLAUDE.md` + `AGENTS.md` con ese contenido (o decirme si querés otro tono/ubicación).
- Después del re-análisis te muestro los números reales y recién ahí decidimos la estrategia de dedupe.
