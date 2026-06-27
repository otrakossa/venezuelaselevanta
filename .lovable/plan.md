
# Admin de Interoperabilidad

Nueva sección bajo `/admin/interop`, gateada por `useAdminRole` (admin o moderator), montada como sub-ruta del admin existente. Conecta a la BD de producción via los hooks/clientes browser actuales (`@/integrations/supabase/client`), respetando que el cliente del frontend ya apunta al proyecto NUEVO.

## Estructura

```text
/admin                  (sigue siendo moderación de reports)
/admin/interop
  ├── tab "Panorama"    KPIs por fuente + ingesta
  ├── tab "Registros"   Explorador missing_persons + patients
  ├── tab "Matches"     Cola de sugerencias missing ↔ patient
  └── tab "Duplicados"  Detector + fusión
```

Archivos nuevos:
- `src/routes/admin.interop.tsx` — layout con tabs + gate
- `src/components/admin/interop/SourcesPanel.tsx`
- `src/components/admin/interop/RecordsExplorer.tsx`
- `src/components/admin/interop/MatchQueue.tsx`
- `src/components/admin/interop/DuplicatesPanel.tsx`
- `src/lib/admin/interop.functions.ts` — server fns con `requireSupabaseAuth` + chequeo `has_role`

Enlace al panel desde la cabecera de `/admin` (no en navegación pública).

## 1. Panorama de fuentes + ingesta

KPIs (cards) agrupados por `source_label`, calculados server-side vía server fn que ejecuta SQL agregado:

- Total registros (missing_persons / patients)
- % con foto, % con coords válidas (lat/lng en bbox Venezuela)
- % vinculados a patient (matched_patient_id NOT NULL)
- % con status `found`
- Último `created_at` por fuente (proxy de "última ingesta")
- Intentos bloqueados por el unique index `missing_persons_source_uniq` — leídos del último día de logs de Postgres si están accesibles; si no, mostramos solo "índice activo: sí".

Sub-bloque "Ingesta automática":
- USGS: última ejecución de `pg_cron` + nº de sismos last 24h (lectura de `reports` donde `category='earthquake'` o etiqueta equivalente).
- Telegram bot: count de `reports` creados con `reporter_name` que matchee patrón bot en últimas 24h.
- Scrapers externos: agrupado por `source_label`, último timestamp y delta vs día anterior.

## 2. Explorador de registros por fuente

Tabla unificada con tabs internos missing / patients, filtros:
- `source_label` (multi-select)
- `status`
- "tiene match" sí/no
- "tiene coords" / "tiene foto"
- búsqueda por nombre (server-side, ya usamos pg_trgm)

Cada fila muestra: foto thumb, nombre, edad, ubicación, estado, source_label, link al `source_url` original, y botones contextuales (Ver detalle, Confirmar encontrada, Marcar duplicado).

Paginación cursor-based (igual patrón que `/desaparecidos`), 50 por página.

## 3. Cola de matches sugeridos

- Para cada `missing_person` sin `matched_patient_id`, llamar a la RPC ya existente `suggest_patient_matches(missing_id)` y mostrar top-N con score.
- También al revés: `patients` sin `matched_missing_id` con `suggest_missing_matches`.
- Acciones por fila:
  - **Confirmar match** → RPC `link_missing_to_patient` (ya existe; marca status=`found`).
  - **Descartar** → guardar en nueva tabla `match_dismissals(missing_id, patient_id, dismissed_by, reason)` para no volver a sugerir.
- Orden por score desc, filtros por fuente y umbral mínimo de score.

## 4. Detector y fusión de duplicados

- Server fn `findDuplicateCandidates()` ejecuta la misma lógica de la consolidación previa: agrupa por (nombre normalizado, edad ±2, similitud `last_seen_location` ≥ 0.4) sobre registros creados desde la última fusión. Devuelve clusters de 2+.
- UI muestra cada cluster lado a lado (foto, datos, source, score de calidad).
- Acción **Fusionar**: nueva RPC `merge_missing_persons(winner_id, loser_id)` que:
  1. valida admin/mod;
  2. rellena nulls del winner con datos del loser;
  3. re-apunta `patients.matched_missing_id` del loser al winner;
  4. transfiere `report_comments` / `report_votes` si aplican (no aplican hoy en missing_persons; se omite);
  5. registra auditoría en nueva tabla `merge_log(winner_id, loser_id, merged_by, payload_loser jsonb, created_at)`;
  6. elimina loser.
- Acción **Marcar como no duplicado** → inserta en `dedupe_whitelist(a_id, b_id, decided_by)` para excluir el par en futuras corridas.

## Acción global "Marcar encontrada"

Botón disponible en explorador y match queue: server fn `markMissingAsFound(missing_id, note)`. Update directo + log en `missing_status_log(missing_id, prev_status, new_status, changed_by, note, created_at)`.

## Migraciones SQL nuevas (a aplicar sobre BD NUEVA con `psql "$NEW_SUPABASE_DB_URL"`)

```text
match_dismissals       (missing_id, patient_id, dismissed_by uuid, reason text, created_at)
dedupe_whitelist       (a_id, b_id, decided_by uuid, created_at)  -- (least,greatest) UNIQUE
merge_log              (winner_id, loser_id, merged_by uuid, payload_loser jsonb, created_at)
missing_status_log     (missing_id, prev_status, new_status, changed_by uuid, note text, created_at)

RPC merge_missing_persons(p_winner_id uuid, p_loser_id uuid)
RPC mark_missing_found(p_id uuid, p_note text)
```

Todas con `SECURITY DEFINER`, gate por `has_role(auth.uid(),'admin'|'moderator')`, RLS habilitada y solo accesibles vía RPC (políticas SELECT cerradas). GRANTs a `authenticated` y `service_role`.

## Server fns

`src/lib/admin/interop.functions.ts` expone:
- `getInteropOverview()` → KPIs por fuente
- `listInteropRecords({ kind, filters, cursor })`
- `listMatchSuggestions({ kind, minScore, cursor })`
- `dismissMatch({ missingId, patientId, reason })`
- `findDuplicateCandidates({ since, cursor })`
- `mergeMissingPersons({ winnerId, loserId })`
- `markFound({ id, note })`

Todas con `.middleware([requireSupabaseAuth])` + chequeo `has_role` antes de tocar datos (las RPC también revalidan).

## Notas técnicas

- Realtime no se usa en este panel — datos pesados, refresh manual + invalidación tras cada acción (TanStack Query `invalidateQueries`).
- Reutiliza `MISSING_PUBLIC_COLUMNS` extendido a contact_* dentro del panel (admin tiene permiso vía RLS existente).
- El cliente browser ya apunta al proyecto NUEVO, por lo que el panel reflejará producción directamente sin tocar las herramientas internas que apuntan al viejo.
- No se agrega entrada a la navegación pública; el acceso es solo desde `/admin` → botón "Interoperabilidad".

## Fuera de alcance (siguiente fase)

- Exportación CSV/GeoJSON filtrada por fuente (ya existen endpoints globales).
- Webhook de re-importación o pausa de scrapers externos.
- Métricas históricas (requiere job que snapshotee diariamente).
