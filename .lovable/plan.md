
# Sub-estados para personas "encontradas"

Hoy `missing_persons.status` solo distingue `missing | found | deceased`. Esto no captura la diferencia entre "apareció vivo en un hospital", "está con su familia" o "falleció". Propongo ampliar la taxonomía sin romper lo existente.

## 1. Nuevo modelo de estado

Mantener `status` como estado de alto nivel (lo que ve la gente y filtra la app) y agregar un `outcome` opcional con el detalle cuando `status = 'found'`.

- `status`: `missing | found | deceased` (igual que hoy)
- `outcome` (nuevo, nullable):
  - `at_health_center` — atendido en centro de salud
  - `with_family` — reunido con su familia / en casa
  - `relocated` — en albergue o ubicación segura distinta
  - `deceased` — fallecido (también sube `status` a `deceased`)
  - `other` — texto libre en `outcome_note`
- `outcome_note` (texto corto, opcional): detalle libre (ej. "Hospital Universitario de Caracas", "Albergue La Vega").
- `outcome_set_at`, `outcome_set_by`: trazabilidad.

Ventajas: no rompe los filtros actuales (`status='found'` sigue funcionando), agrega granularidad, y `deceased` se modela tanto como `status` como `outcome` para reportes consistentes.

## 2. Flujos que setean el outcome

Los tres caminos ya unificados en `missing_status_log` se extienden:

1. **Match con paciente** (`link_missing_to_patient`): setea `outcome = 'at_health_center'` y `outcome_note = patients.center_name` automáticamente.
2. **Voto público "Marcar como encontrado"**: sigue marcando `found`, pero abre un mini-selector opcional ("¿Sabes dónde está?") con las 4 opciones. Si el usuario no elige, queda `outcome = NULL` (genérico "encontrado").
3. **Acción de moderador/admin** (`mark_missing_found`): el panel admin recibe selector obligatorio de `outcome` + nota.
4. **Nuevo botón "Marcar como fallecido"** en la ficha (solo admin/mod): sube `status='deceased'`, `outcome='deceased'`.

Toda transición de `outcome` se registra en `missing_status_log` (columna nueva `new_outcome`).

## 3. Cambios en BD (migración nueva)

```sql
ALTER TABLE missing_persons
  ADD COLUMN outcome text CHECK (outcome IN
    ('at_health_center','with_family','relocated','deceased','other')),
  ADD COLUMN outcome_note text,
  ADD COLUMN outcome_set_at timestamptz,
  ADD COLUMN outcome_set_by uuid REFERENCES auth.users(id);

ALTER TABLE missing_status_log
  ADD COLUMN prev_outcome text,
  ADD COLUMN new_outcome text;
```

RPCs a actualizar:
- `mark_missing_person_found(_person_id, _device_id, _outcome text DEFAULT NULL, _note text DEFAULT NULL)`
- `link_missing_to_patient` — setea outcome automáticamente.
- `mark_missing_found` (admin) — recibe outcome + nota.
- Nuevo `mark_missing_deceased(p_id, p_note)`.

Backfill: registros con `matched_patient_id IS NOT NULL` → `outcome='at_health_center'`. Registros con `status='deceased'` → `outcome='deceased'`.

## 4. Cambios en UI

- **Badge en tarjetas y ficha** (`desaparecidos.tsx`, `MissingDetailSheet.tsx`, popup del mapa):
  - "✅ Encontrado" (sin outcome)
  - "🏥 Atendido en centro de salud" + nota
  - "🏠 Con su familia"
  - "🛟 En albergue"
  - "🕊️ Fallecido" (gris/oscuro)
- **Filtros** en `/desaparecidos`: agregar chips por outcome.
- **Acción "Marcar como encontrado"**: tras votar abre un Dialog opcional para elegir dónde está. "Saltar" lo deja genérico.
- **Admin (`/admin/interop`)**: en la fila del desaparecido, dropdown con las 5 opciones de outcome + textarea nota.
- **Estadísticas** (`/estadisticas`): nueva sección "Cómo se encontraron" con conteos por outcome.
- **API pública** (`/api/missing-persons.json`, CSV, GeoJSON): agregar `outcome` y `outcome_note` a `SAFE_COLS`.

## 5. Tsunami (agente IA)

Actualizar `tsunami-tools.server.ts` para que al sugerir matches y al describir fichas mencione el outcome ("Esta persona fue encontrada y está atendida en X").

## Detalles técnicos

- `src/lib/types.ts`: ampliar `MissingStatus` y agregar `MissingOutcome`.
- `MissingDetailSheet.tsx`: nuevo sub-componente `OutcomePicker`.
- Trigger `auto_link_missing_to_patient` ya escribe el match; agregar set de outcome ahí mismo.
- Migración SQL nueva en `sql/2026-06-29_missing_outcome.sql`, aplicada con `psql "$NEW_SUPABASE_DB_URL" -f ...` (producción = proyecto nuevo).

## Decisiones que necesito confirmar

1. ¿Estás de acuerdo con las 5 opciones de outcome (`at_health_center`, `with_family`, `relocated`, `deceased`, `other`) o quieres ajustar la lista?
2. Para el voto público, ¿el selector de outcome debe ser opcional (mi propuesta) u obligatorio para que el voto cuente?
3. ¿Quieres que un voto popular pueda marcar "fallecido", o ese estado lo reserva solo admin/mod (mi propuesta)?
