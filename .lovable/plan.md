## API pública v1 — Venezuela Se Levanta

Expongo todos los datasets principales como endpoints públicos, sin auth, con CORS abierto, caché, licencia CC BY 4.0 y sin PII sensible.

### Endpoints nuevos

Bajo `src/routes/api/` (servidos en `venezuelaselevanta.info/api/...`):

| Recurso | JSON | GeoJSON | CSV (HXL) |
|---|---|---|---|
| reports | ya existe (añadir filtros + paginación) | ✅ ya existe | ✅ ya existe |
| missing-persons | ✅ nuevo | ✅ nuevo | ✅ nuevo |
| patients | ✅ nuevo | — (la mayoría sin coords) | ✅ nuevo |
| needs | ✅ nuevo | ✅ nuevo | ✅ nuevo |
| offers | ✅ nuevo | ✅ nuevo | ✅ nuevo |
| health-centers | ✅ nuevo | ✅ nuevo | ✅ nuevo |
| categories | ✅ nuevo | — | — |

Patrón de ruta: `src/routes/api/<recurso>[.]{json,geojson,csv}.ts`.

### Reglas comunes a todos los endpoints

1. **Server-side fetch** vía `fetch(${SUPABASE_URL}/rest/v1/...)` con `SUPABASE_PUBLISHABLE_KEY` — nunca `createClient` (rompe en Node 20 sin WebSocket, regla del proyecto).
2. **CORS abierto** (`Access-Control-Allow-Origin: *`) + handler `OPTIONS`.
3. **Caché**: `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600`.
4. **Paginación por cursor** vía querystring:
   - `?limit=` (default 500, máx 5000)
   - `?cursor=` (opaque, basado en `created_at` + `id`)
   - Respuesta JSON/GeoJSON incluye `metadata.next_cursor` y `Link: <...>; rel="next"` header.
   - CSV streamea sin cursor (un solo dump por petición, con `limit` aplicado).
5. **Filtros por querystring** (cuando aplique):
   - `state`, `municipality`, `parish`
   - `category` / `urgency` / `status`
   - `since` (ISO date, filtra `created_at >=`)
   - `bbox=minLng,minLat,maxLng,maxLat` (sólo en GeoJSON)
6. **Sin PII sensible**: se omiten `reporter_phone`, `reporter_email`, `reporter_cedula`, `contact_phone`, etc. La RLS ya los oculta a `anon`, pero además filtramos por columna en el `select=` para defensa en profundidad.
7. **HXL tags** en la segunda fila del CSV según el estándar humanitario (`#geo+lat`, `#geo+lon`, `#adm1+name`, `#contact+name`, `#date+created`, `#status`, `#severity`, etc.).
8. **Metadata block** en cada GeoJSON/JSON: `generated`, `title`, `description`, `license`, `source`, `count`, `next_cursor`.

### Helper compartido

Creo `src/lib/api-public.ts` con:
- `CORS` headers + `withCors(response)`
- `fetchSupabase(path, { signal })` — wrapper de `fetch` REST
- `parseCursor` / `encodeCursor` (`base64(created_at|id)`)
- `csvCell` / `buildCsv(headers, hxl, rows)`
- `buildGeoJSON(features, metadata)`
- `applyCommonFilters(searchParams, supabaseQuery)` — concatena `state=eq.…`, `created_at=gte.…`, etc.
- `parseBbox(param)` → cláusulas `lat=gte`, `lat=lte`, `lng=gte`, `lng=lte`

Esto evita duplicar la misma lógica en 15 archivos.

### Página `/api` de documentación

Nueva ruta `src/routes/api.tsx` (UI, no endpoint) con:
- Tabla de endpoints con descripción y ejemplo `curl`
- Lista de filtros soportados por recurso
- Sección "Paginación por cursor" con ejemplo
- Sección "Etiquetas HXL" con enlace al estándar
- Nota de licencia CC BY 4.0 + atribución requerida
- Bloque de "Sin auth, sin rate limit duro — usar responsablemente; contacto para volúmenes altos"

Se enlaza desde el footer (`src/components/Footer.tsx`) reemplazando los enlaces sueltos de geojson/csv por un único "API pública" → `/api`.

### Reports existentes — mejoras

A los tres endpoints actuales (`reports[.]json`/geojson/csv) les añado:
- Paginación por cursor (hoy traen todo sin límite — peligroso si crece).
- Filtros comunes (`state`, `category`, `urgency`, `since`, `bbox`).
- Migración al helper compartido para que el código quede uniforme.

### Sitemap

Agrego `/api` a `STATIC_PATHS` en `src/routes/sitemap[.]xml.ts`.

### Lo que NO hago en este plan

- No expongo `report_comments`, `report_votes`, `contact_messages`, `user_roles`, `bot_*`, `email_*`, `push_*`, `telegram_*` (operativos/sensibles).
- No agrego rate limiting persistente (sólo el ya existente en `POST /api/public/reports`). Si más adelante hace falta, se mete en una capa nginx o un middleware compartido.
- No agrego API keys ni OAuth — sigue siendo lectura pública pura.
- No toco la lógica de escritura existente (`POST /api/public/reports`).

### Resumen de archivos

Crear:
- `src/lib/api-public.ts`
- `src/routes/api/missing-persons[.]json.ts`
- `src/routes/api/missing-persons[.]geojson.ts`
- `src/routes/api/missing-persons[.]csv.ts`
- `src/routes/api/patients[.]json.ts`
- `src/routes/api/patients[.]csv.ts`
- `src/routes/api/needs[.]json.ts`
- `src/routes/api/needs[.]geojson.ts`
- `src/routes/api/needs[.]csv.ts`
- `src/routes/api/offers[.]json.ts`
- `src/routes/api/offers[.]geojson.ts`
- `src/routes/api/offers[.]csv.ts`
- `src/routes/api/health-centers[.]json.ts`
- `src/routes/api/health-centers[.]geojson.ts`
- `src/routes/api/health-centers[.]csv.ts`
- `src/routes/api/categories[.]json.ts`
- `src/routes/api.tsx` (documentación)

Modificar:
- `src/routes/api/reports[.]geojson.ts` (helper + filtros + cursor)
- `src/routes/api/reports[.]csv.ts` (helper + filtros)
- `src/components/Footer.tsx` (enlace a `/api`)
- `src/routes/sitemap[.]xml.ts` (añadir `/api`)
