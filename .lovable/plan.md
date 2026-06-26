
## Qué contiene el archivo

Excel con **339 pacientes consolidados** del sismo, distribuidos en 5 hospitales de Caracas:

| Hospital | Pacientes |
|---|---|
| Hospital Pérez Carreño | 119 |
| Hospital Domingo Luciani | 91 |
| Hospital Universitario de Caracas | 60 |
| Periférico de Catia | 44 |
| Cruz Roja | 28 |

La hoja **"🔍 BUSCAR PACIENTES"** es el maestro consolidado (las otras 5 son por hospital y ya están incluidas ahí → no duplicar).

**Campos por paciente:** N°, Hospital, Apellidos y Nombres, Edad, Cédula/ID, Teléfono, Dirección, Observaciones. Muchas filas tienen edad/teléfono/dirección vacíos (depende del hospital).

---

## Problema con el esquema actual

La tabla `patients` actual tiene: `name, age, sex, center_name, center_address, center_lat, center_lng, status, notes, registered_by, discharged_at`.

**Faltan campos relevantes del Excel:** cédula, teléfono, dirección del paciente (distinta de la del centro). Meter todo eso en `notes` mezcla datos y dificulta búsqueda. Necesitamos columnas dedicadas.

---

## Plan

### 1. Migración de esquema (`patients`)
Agregar 3 columnas opcionales:
- `id_number text` (cédula)
- `phone text`
- `address text` (dirección del paciente)

Y crear índices para búsqueda rápida por nombre y por cédula:
```text
CREATE INDEX patients_name_trgm  ON patients USING gin (name gin_trgm_ops);
CREATE INDEX patients_id_number  ON patients (id_number);
CREATE INDEX patients_center     ON patients (center_name);
```
(Activar `pg_trgm` si no está.)

### 2. Catálogo de hospitales con coordenadas reales
Insertar/upsert en la tabla existente `health_centers` los 5 hospitales con sus coordenadas:

| Hospital | Lat | Lng |
|---|---|---|
| Hospital Dr. Domingo Luciani (El Llanito) | 10.4730 | −66.8080 |
| Hospital Universitario de Caracas | 10.4900 | −66.8910 |
| Hospital Dr. José Gregorio Hernández – Pérez Carreño | 10.5120 | −66.9290 |
| Cruz Roja Venezolana – Caracas (Cotiza) | 10.5030 | −66.9130 |
| Hospital Periférico de Catia | 10.5150 | −66.9290 |

### 3. Import de los 339 pacientes
Vía la herramienta `insert`, parseando solo la hoja maestra. Para cada fila:
- Normalizar nombre (trim, capitalize), edad numérica (ignorar si NaN/0/>120).
- Cédula: quitar puntos/guiones, dejar solo dígitos; si queda vacía → `null`.
- Teléfono: normalizar `0412-9970844` tal cual; vacío → `null`.
- Mapear nombre exacto de hospital → uno de los 5 canónicos + `center_lat/lng` desde la tabla de arriba.
- `status = 'stable'` (no hay info clínica salvo en Periférico de Catia, donde las observaciones traen "traumatismo…/caída…" → dejar tal cual en `notes`).
- `registered_by = 'import:caracas-hospitales-2026'` (para poder revertir si hace falta).

**Anti-duplicados:** `ON CONFLICT` no aplica (no hay clave natural fiable). En su lugar, antes del import correremos `DELETE FROM patients WHERE registered_by = 'import:caracas-hospitales-2026'`, así el import es idempotente.

### 4. Mejoras de UI en `/pacientes`
Aprovechar la data nueva sin rediseñar la página:

- **Filtro por hospital**: chips horizontales arriba de la lista (igual estilo que las categorías de `/necesidades`), con conteo por hospital. "Todos · 339", "Pérez Carreño · 119", etc.
- **Tarjeta de paciente**: mostrar cédula y teléfono cuando existan (con `tel:` clickable). Mantener la jerarquía actual.
- **Buscador**: extender a cédula además de nombre/centro.
- **KPIs del hero**: agregar un 4º KPI "Hospitales activos" (count distinct de `center_name` con pacientes activos).
- **Empty state**: ya cubre el caso, no hace falta cambiar.

### 5. Aprovechar la data en el mapa principal (`/`)
Los 5 hospitales con coordenadas ya quedan en `health_centers`. Agregar una **capa opcional "Hospitales"** en el mapa (toggle, como ya existe el de Sismos/Desaparecidos) que renderiza marcadores 🏥 con popup: nombre + nº de pacientes activos + link "Ver pacientes" a `/pacientes?center=<id>`.

`/pacientes` leerá `?center=` para preseleccionar el filtro de hospital.

### 6. Estadísticas
En `/estadisticas` agregar una sección "Pacientes en centros de salud" con:
- Total pacientes, pacientes activos, dados de alta.
- Top hospitales por carga (bar chart).
- Pirámide de edades simple (3 rangos: <18, 18-60, >60) cuando hay edad.

---

## Detalles técnicos (para el equipo)

- **No usar `createClient` de supabase-js en handlers `/api/*`** (restricción del proyecto). El import se hace con la herramienta `insert` desde el agente, no desde un endpoint.
- Página `/pacientes` ya usa `fetch` directo a Supabase REST con anon key → el filtro por `center_name` será otro query param `center_name=eq.<x>`. No requiere cambios en RLS (la política ya permite SELECT público).
- El campo `sex` no viene en el Excel → quedará `'no indicado'` por defecto.
- `validateSearch` en la ruta `/pacientes` para parsear `?center=`.
- Edad fuera de rango (>120 o ≤0) → `null` para evitar romper UI.

## Orden de ejecución

1. Migración: 3 columnas + índices + trigger updated_at si falta.
2. Seed `health_centers` con los 5 hospitales y coords.
3. Import idempotente de los 339 pacientes (con `registered_by` tag).
4. Actualizar `src/routes/pacientes.tsx` (filtro por hospital, búsqueda extendida, cédula/teléfono en tarjeta, search-param).
5. Toggle "Hospitales" en `src/components/MapView.tsx` + `src/routes/index.tsx`.
6. Bloque de pacientes en `src/routes/estadisticas.tsx`.

Tras el paso 3 deberías ver los 339 pacientes en `/pacientes` y poder buscarlos por nombre o cédula al instante.
