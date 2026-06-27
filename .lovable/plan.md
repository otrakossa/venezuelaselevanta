## Objetivo

Aprovechar los nuevos campos `state`, `sector` y `health_center_id` recién añadidos a `patients` para mejorar la vista de Atendidos, las estadísticas y el cruce automático con desaparecidos.

## 1. UI de Atendidos (`/pacientes`)

Mostrar y permitir filtrar por la nueva información geográfica.

- Añadir columnas/badges visibles: **Estado** y **Sector** en cada tarjeta/fila.
- Nuevo bloque de filtros sobre el listado:
  - Selector de Estado (poblado dinámicamente con `DISTINCT state` desde la tabla).
  - Selector de Sector (dependiente del Estado seleccionado).
  - Mantener el filtro existente por Centro de Salud y la búsqueda por nombre.
- Contador "X atendidos en {Estado}/{Sector}" arriba del listado.
- El filtro se aplica server-side (queries con `eq('state', ...)` / `eq('sector', ...)`) para no traer 510+ filas al cliente.

## 2. Agregaciones por sector en `/estadisticas`

Añadir una nueva sección "Atendidos por zona" debajo de los KPIs existentes.

- Gráfico de barras horizontal: top 15 sectores por cantidad de atendidos.
- Tabla colapsable con desglose Estado → Sector → Conteo.
- KPI agregado: "Sectores afectados con personas atendidas: N".
- Reutilizar el componente `Card` + `recharts` ya presentes en la página.
- Datos vía un único query agregado (`SELECT state, sector, count(*) ... GROUP BY`).

## 3. Cruce sector ↔ desaparecidos

Mejorar la función `suggest_patient_matches` (y su simétrica `suggest_missing_matches`) para que el sector del atendido pese como señal adicional contra `last_seen_location` del desaparecido.

- Migración SQL que reemplaza ambas funciones para añadir un bonus al score cuando:
  - `patients.sector` aparece (case-insensitive, con `ILIKE '%sector%'`) dentro de `missing_persons.last_seen_location`, **o**
  - hay alta similitud trigram entre `patients.sector` y `last_seen_location`.
- Fórmula de score: `name_similarity * 0.7 + sector_match * 0.3` (manteniendo el umbral de edad ±2 años existente).
- El umbral mínimo se ajusta a 0.40 para no perder coincidencias actuales.
- Sin cambios en la UI de `MatchSuggestions`: ya muestra `score` y se beneficia automáticamente.

## Detalles técnicos

- **Archivos a tocar**:
  - `src/routes/pacientes.tsx` — filtros + columnas.
  - `src/routes/estadisticas.tsx` (o equivalente del "Centro de Control") — nueva sección.
  - Una migración SQL para `suggest_patient_matches` y `suggest_missing_matches`.
- **Sin cambios** en: esquema de tablas, formularios de entrada, RLS, o el resto de rutas.
- **Riesgos**: bajo. Las funciones de match son `SECURITY DEFINER` y solo las usa el panel admin; los filtros nuevos son aditivos.

## Entregables

1. `/pacientes` con filtros funcionales por Estado y Sector + visibilidad de esos campos.
2. Sección "Atendidos por zona" en `/estadisticas`.
3. Funciones de match actualizadas que ponderan coincidencia de sector.
