## Objetivo

Reemplazar los inputs de texto libre para "Centro de salud" en `/pacientes` y `/necesidades` por un selector con búsqueda inteligente que use la tabla `health_centers` (1.439 centros ya cargados), permitiendo además crear un centro nuevo cuando no exista en la lista.

## Alcance

Tres formularios consumen `center_name`:
- `src/routes/pacientes.tsx` (registrar paciente atendido)
- `src/routes/necesidades.tsx` (publicar necesidad)
- (Indirecto) `src/routes/ofertas.tsx` solo **muestra** `center_name` de necesidades vinculadas — no requiere cambio.

El bot de Telegram queda fuera de este cambio (sigue como texto libre por ahora).

## Diseño UX

Componente nuevo: `src/components/HealthCenterPicker.tsx`

- Trigger tipo input con placeholder "Buscar centro de salud…"
- Al hacer foco / clic abre un popover con:
  - Campo de búsqueda (filtra por `name`, `city`, `state` — case-insensitive, sin acentos)
  - Lista virtualizada o capada a ~50 resultados, mostrando: **Nombre** · municipio/estado en gris
  - Opción al final: "➕ Usar '<texto escrito>' como nuevo centro" cuando no haya match exacto y el usuario tenga texto
- Al seleccionar un centro existente: guarda `center_name` (string) y, si el formulario lo necesita más adelante, expone también `health_center_id`
- Permite limpiar la selección

Construido con `Command` (cmdk) + `Popover` de shadcn (ya instalados).

## Datos

- Hook `useHealthCenters()` en `src/hooks/useHealthCenters.ts`:
  - `fetch` directo (REST) a `health_centers?select=id,name,city,state&order=name.asc` una sola vez por sesión
  - Cachea en memoria (módulo-level) — 1.439 filas ≈ pocos KB, sin paginación
  - Devuelve `{ centers, loading, error }`
- Filtro en cliente usando `normalize()` (lowercase + `String.prototype.normalize('NFD').replace(/\p{Diacritic}/gu,'')`)

## Integración

1. **`src/routes/necesidades.tsx`** (línea 545): reemplazar el `<input>` por `<HealthCenterPicker value={f.center_name} onChange={(name) => setF({ ...f, center_name: name })} required />`. Conservar la validación existente.

2. **`src/routes/pacientes.tsx`** (línea 631): mismo reemplazo.

3. **Filtro de la lista de pacientes** (`/pacientes` ya tiene un select de centros derivado de los pacientes existentes — se mantiene tal cual, no cambia).

## Base de datos

No se requieren migraciones. Se sigue guardando `center_name` como texto en `patients` y `needs` (compatibilidad con datos actuales y con el bot de Telegram). Opcionalmente, si más adelante se quiere referencia dura, se puede agregar `health_center_id uuid` — fuera de alcance ahora.

## Archivos a crear / editar

- **Crear**: `src/components/HealthCenterPicker.tsx`, `src/hooks/useHealthCenters.ts`
- **Editar**: `src/routes/necesidades.tsx`, `src/routes/pacientes.tsx`

## Fuera de alcance

- Bot de Telegram
- Migración de datos históricos (`patients.center_name` ya escritos a mano)
- Crear nuevos `health_centers` en la BD desde el formulario (por ahora "nuevo centro" solo guarda el string libre)
