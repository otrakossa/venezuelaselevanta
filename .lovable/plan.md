## Sistema de valoración y verificación de reportes

Permitir que cualquier visitante confirme o cuestione un reporte (1 voto por dispositivo) y que moderadores autenticados marquen reportes como "Verificado oficialmente". La credibilidad y el sello de verificación aparecen en el mapa, la lista y la página de detalle, con un filtro en el mapa.

### Modelo de datos (nuevas tablas / columnas)

Nueva tabla `report_votes`:
- `report_id` (FK a `reports`)
- `device_id` (texto — fingerprint local guardado en `localStorage`)
- `vote` (`confirm` | `dispute`)
- `created_at`
- UNIQUE(`report_id`, `device_id`) → 1 voto por dispositivo por reporte (re-votar lo reemplaza)

Columnas nuevas en `reports`:
- `confirm_count` (int, default 0)
- `dispute_count` (int, default 0)
- `verified_by` (uuid, nullable — moderador que verificó)
- `verified_at` (timestamptz, nullable)
- (`verified` ya existe; lo seguimos usando como flag de "Verificado oficialmente")

Triggers Postgres que mantienen `confirm_count` / `dispute_count` automáticamente al insertar/actualizar/eliminar en `report_votes`.

### RLS y permisos

- `report_votes`: `INSERT` y `UPDATE` públicos (con `device_id` provisto por el cliente); `SELECT` público para mostrar conteos detallados si hace falta.
- `reports.verified` / `verified_by` / `verified_at`: solo modificable por usuarios autenticados (mod/admin) — reglas vía `UPDATE` policy que exige `auth.uid() IS NOT NULL`. (Hoy `admin.tsx` ya requiere sesión.)
- `confirm_count` / `dispute_count`: solo escribibles por trigger (no por la API pública).

### Credibilidad

Fórmula simple en cliente: `score = confirm / (confirm + dispute)` con umbral mínimo de 3 votos para mostrar %. Debajo del umbral muestra "Sin valoraciones aún". Reglas:
- `verified === true` → badge dorado "Verificado oficialmente" (prioritario sobre el %).
- score ≥ 0.7 → verde "Confiable".
- score 0.4-0.69 → ámbar "En revisión".
- score < 0.4 → rojo "Cuestionado".

### UI

1. **Componente `ReportRating`** (`src/components/ReportRating.tsx`)
   - Botones 👍 Confirmo / 👎 Dudo con contador.
   - Estado deshabilitado/resaltado si el `device_id` ya votó (lectura desde `localStorage`).
   - Versión `compact` (popup y lista) y `full` (detalle).
   - Optimistic update + llamada a server fn.

2. **Popup del marcador (`MapView.tsx`)**: badge de credibilidad arriba del título + `ReportRating` compacto.

3. **Lista en home (`routes/index.tsx`)**: badge pequeño (verificado / % / "nuevo") junto al título.

4. **Detalle (`routes/reportes.$id.tsx`)**: sección dedicada con badge grande, conteos, `ReportRating` completo y, si hay sesión + rol mod, botón "Marcar como verificado oficialmente".

5. **Filtro en el mapa (`CategoryFilter.tsx` o nuevo chip)**: toggles "Solo verificados" y "Confiables (≥70%)". Filtra `reports` antes de pasarlos al mapa y a la lista.

6. **Panel admin (`routes/admin.tsx`)**: nueva columna con toggle "Verificado oficialmente" y conteos.

### Backend (server functions)

Archivo nuevo `src/lib/votes.functions.ts`:
- `castVote({ reportId, deviceId, vote })` — upsert en `report_votes`. Público (sin `requireSupabaseAuth`).
- `removeVote({ reportId, deviceId })` — borra el voto del dispositivo.
- `verifyReport({ reportId, verified })` — `.middleware([requireSupabaseAuth])`, marca/desmarca `verified` y setea `verified_by`/`verified_at`.

Lecturas: los conteos vienen ya en `reports` (mantenidos por trigger) y `useReports` no cambia su shape más allá de los nuevos campos.

### Identidad anónima del dispositivo

Helper `src/lib/device-id.ts`: genera un `crypto.randomUUID()` la primera vez y lo guarda en `localStorage`. No es infalible (incógnito, borrar storage), pero es lo esperado para "1 voto por dispositivo" sin login.

### Realtime

La suscripción existente a `reports` ya refresca conteos al cambiar la fila (trigger actualiza `confirm_count` / `dispute_count` → realtime emite). No hace falta suscribirse a `report_votes`.

### Roles de moderador

Reusar el patrón estándar: tabla `user_roles` + enum `app_role` + función `has_role`. Por ahora cualquier autenticado puede verificar (el admin panel ya está detrás de auth); si quieres rol estricto `moderator/admin`, lo añadimos como paso siguiente — lo dejo flagged en el plan, no incluido en esta iteración para no inflarla.

### Pasos de implementación

1. Migración: columnas en `reports`, tabla `report_votes`, triggers, GRANTs y RLS.
2. Server fns: `castVote`, `removeVote`, `verifyReport`.
3. `device-id.ts` + tipos actualizados en `src/lib/types.ts`.
4. `ReportRating` (compacto + full) y helper `getCredibility(report)`.
5. Integrar en `MapView` popup, lista home, detalle, admin.
6. Filtro "Solo verificados / Confiables" en home + mapa.
7. Probar: votar anónimo, re-votar, verificar como moderador, ver realtime, ver filtro.

### Preguntas opcionales antes de implementar

- ¿Quieres roles estrictos (`moderator` / `admin` vía `user_roles`) ya en esta iteración, o por ahora "cualquier usuario autenticado puede verificar"? — propongo lo segundo y migrar después.
- ¿OK que un mismo dispositivo pueda cambiar su voto (👍 → 👎) o prefieres que sea inmutable? — propongo permitir cambio.