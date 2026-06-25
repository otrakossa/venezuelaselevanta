## Objetivo

Que la lista lateral de la home (`/`) muestre, intercalados con los reportes, las personas desaparecidas geolocalizadas — sin importar si están `missing`, `reunited` o `found` — ordenadas por fecha junto a los reportes. Al hacer clic en una tarjeta de desaparecido se enfoca su marcador rosa en el mapa (igual que ya hace el chip "Desaparecidos" + `?missing=<id>`).

## Cambios

Todo el trabajo es en `src/routes/index.tsx`. No se tocan hooks, tipos ni el mapa.

### 1. Lista combinada ordenada por fecha

- Construir un array `feed` que mezcle:
  - `visible` (reportes ya filtrados por categoría/urgencia/trust/tiempo/búsqueda).
  - `missing` con `last_seen_lat != null && last_seen_lng != null`, filtrado por la misma ventana de tiempo (`timeWindow`) y por el texto `q` (sobre `full_name`, `last_seen_address`, `description`).
- Etiquetar cada item con un discriminador (`kind: "report" | "missing"`) y una `sortDate` (reports: `created_at`; missing: `last_seen_at ?? created_at`).
- Ordenar desc por `sortDate` y cortar a 30 como hoy.
- Los filtros de categoría / urgencia / verificados / confiables NO aplican a desaparecidos (no tienen esas dimensiones); se mantienen siempre que pasen tiempo + búsqueda. Si el chip "Desaparecidos" del mapa (`showMissing`) está apagado, también se ocultan de la lista para que mapa y lista queden coherentes.

### 2. Tarjeta de desaparecido en la lista

Renderizada en el mismo `<ul>`, con el mismo padding/altura que las de reporte, pero diferenciada:

- Avatar circular rosa (`bg-rose-500`) con ícono `Users` en blanco, o miniatura cuadrada (`rounded-full object-cover`) si `photo_url` existe.
- Título: `full_name`.
- Sub-línea: `📍 {last_seen_address}` cuando exista.
- Chips: badge rosa `Desaparecido` + badge de estado (`missing` / `reunited` / `found`) con color (rosa / verde / azul) y fecha en formato `dd MMM HH:mm` desde `last_seen_at ?? created_at`. Si hay edad, mostrarla discreta (`· {age} años`).
- Botón de compartir WhatsApp a la derecha reutilizando el componente existente si soporta `missing`; si no, una variante mínima inline que abre `wa.me` con `nombre + última ubicación + link a /?missing=<id>`. (Pendiente verificar API de `WhatsAppShareButton` durante implementación; si no acepta `missing`, dejar solo el avatar sin botón en esta iteración para no inflar el cambio.)

Click en la tarjeta:
- `setShowMissing(true)` (por si el chip estaba apagado, el marcador debe estar en el mapa para enfocarlo).
- `setFocusMissing({ id, lat, lng, nonce: Date.now() })`.
- `setSheetOpen(false)` (cierra el bottom sheet en móvil).

### 3. Contador y estado vacío

- El contador del header de la lista (`{visible.length} incidentes`) y el chip flotante del mapa (`{visible.length}` y `${visible.length} reportes` del handle móvil) pasan a usar el largo del `feed` combinado, con etiqueta neutra: "registros" en lugar de "reportes" / "incidentes".
- `EmptyState` se mantiene; el mensaje "Sin reportes que coincidan" se cambia a "Sin registros que coincidan".

### 4. Lo que NO cambia

- `MapView`, hooks (`useReports`, `useMissing`), tipos, filtros existentes, URL search params, `ReportDetailSheet` ni la página `/desaparecidos`.
- Los desaparecidos sin coordenadas siguen viéndose solo en `/desaparecidos`.
- El comportamiento actual de clic en marcador del mapa (popup → detalle) no se toca.

## Detalle técnico

- Tipo local: `type FeedItem = { kind: "report"; data: Report; sortDate: number } | { kind: "missing"; data: MissingPerson; sortDate: number }`.
- `feed` se calcula con `useMemo` dependiendo de `[visible, missing, showMissing, timeWindow, search2]`.
- Render: `feed.slice(0, 30).map(item => item.kind === "report" ? <ReportRow .../> : <MissingRow .../>)` para mantener el JSX legible; se pueden inline ambos como hoy si se prefiere no extraer componentes.
- Importar `Users` de `lucide-react` ya está; no hacen falta nuevos imports salvo quizá el tipo `MissingPerson` desde `@/lib/types`.

## Validación

- Con varios desaparecidos geolocalizados recientes, deben aparecer mezclados por fecha en la lista.
- Clic en uno → mapa se centra y abre el popup rosa correspondiente.
- Apagar el chip "Desaparecidos" → desaparecen del mapa y de la lista.
- Filtros de categoría/urgencia no los esconden; búsqueda y rango de tiempo sí.
