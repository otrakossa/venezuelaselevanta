## Objetivo
Capturar la división político-territorial (Estado, Municipio, Parroquia) en cada reporte —y también en personas desaparecidas— para poder filtrar y graficar por esos niveles en estadísticas.

## 1. Base de datos (migración)
Agregar a las tablas `reports` y `missing_persons`:
- `state` (text) — Estado
- `municipality` (text) — Municipio
- `parish` (text) — Parroquia

Sin cambios en RLS (heredan políticas actuales). Índices simples sobre `state` para acelerar agregaciones.

## 2. Formulario de reporte (`ReportForm.tsx`)
Tres campos nuevos con selects en cascada:
- Estado → carga lista fija de los 24 estados de Venezuela (+ Distrito Capital).
- Municipio → se filtra por estado seleccionado.
- Parroquia → se filtra por municipio.

Datos cargados desde un nuevo archivo `src/lib/venezuela-divipol.ts` (dataset estático JSON con estados/municipios/parroquias oficiales).

Autocompletado: si el usuario usa "mi ubicación" y el geocoder devuelve `address`, intentar precargar Estado/Municipio matcheando contra el dataset (best-effort, editable).

Campos opcionales pero recomendados (no obligatorios para no romper flujo offline ni Telegram).

## 3. Formulario de personas desaparecidas
Mismos tres campos en la creación de `missing_persons`.

## 4. Vistas
- **Detalle de reporte** (`ReportDetailSheet`) y **popup del mapa**: mostrar línea "Estado · Municipio · Parroquia" arriba de la dirección.
- **Tarjeta de la lista lateral**: badge pequeño con el Estado.

## 5. Estadísticas (`/estadisticas`)
Añadir nuevos widgets:
- Top 10 Estados con más reportes (barras horizontales).
- Top 10 Municipios.
- Filtro global por Estado que recalcula los KPIs existentes.
- Mini desglose por urgencia dentro del estado seleccionado.

## 6. Open data
Incluir `state`, `municipality`, `parish` como columnas/propiedades en:
- `GET /api/reports.csv` (con etiquetas HXL `#adm1+name`, `#adm2+name`, `#adm3+name`).
- `GET /api/reports.geojson` (dentro de `properties`).

## 7. Datos existentes
Backfill best-effort opcional: ejecutar una pasada que, donde `address` contenga el nombre de un estado conocido, rellene `state`. Municipio/Parroquia se quedan vacíos hasta que el usuario los edite.

---

### Notas técnicas
- Dataset DIVIPOL completo (≈335 municipios, ≈1.150 parroquias) se sirve como JSON estático bundleado; ~80 KB gzip.
- Tipos TS regenerados tras la migración.
- Sin breaking changes: los campos son `null`-ables.
- Realtime sigue funcionando sin cambios.