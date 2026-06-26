## Objetivo

Separar claramente **"Publicar necesidad"** (lo que falta en un centro / comunidad) de **"Ofrecer ayuda"** (insumos, voluntarios, recursos disponibles), y permitir que cualquier persona enlace una oferta con una necesidad existente.

Hoy todo vive mezclado en `/necesidades`: el botón "Ofrecer ayuda" solo existe dentro de una tarjeta de necesidad, así que una persona que quiere donar 50 mascarillas o sumarse como voluntario no tiene dónde publicarse sin atarse a un caso puntual.

---

## 1. Base de datos

La tabla `offers` ya existe, pero `need_id` es obligatorio. La cambiamos a opcional para soportar ofertas "libres":

- `ALTER TABLE offers ALTER COLUMN need_id DROP NOT NULL`
- Añadir columnas: `urgency` (no aplica), `location_lat`, `location_lng`, `available_from`, `available_until` (opcionales), `reporter_name`
- Añadir índice por `category` y `status` para listado rápido
- RLS: lectura pública (igual que `needs`), inserción pública (igual que hoy), actualización solo de su propio registro vía `device_id` o autenticado
- Estados de oferta: `available` (libre), `matched` (vinculada a una necesidad), `delivered` (entregada), `cancelled`
- Estados de necesidad: se mantienen (`open`, `partial`, `fulfilled`)
- Cuando una oferta se vincula a una necesidad: `offers.need_id` se setea y `offers.status='matched'`. La necesidad pasa a `partial` (o `fulfilled` si quien hace match así lo marca)

Migración mediante el tool de Supabase. La aprobación llegará por separado antes del paso 2.

---

## 2. Rutas y navegación

Dos rutas independientes, cada una con su propio `head()` y KPIs:

- `/necesidades` — lo que se necesita (queda como está, simplificada)
- `/ofertas` — lo que se ofrece (nueva)

Cambios en navegación:

- **Header desktop**: añadir enlace `Ofertas` con icono `PackageOpen` junto a `¡Quiero ayudar!`. La etiqueta "¡Quiero ayudar!" sigue apuntando a `/necesidades` (porque ahí se ven los casos que necesitan apoyo). Alternativamente, "¡Quiero ayudar!" → `/ofertas` para invitar a publicar. **Decisión propuesta**: "¡Quiero ayudar!" apunta a `/ofertas` (publicar ayuda) y añadimos `Necesidades` como ítem normal.
- **BottomNav mobile**: reemplazar la entrada actual de Necesidades por dos: `Necesidades` (HandHeart) y `Ofertas` (PackageOpen). Como el BottomNav tiene 4 slots + FAB, movemos `Atendidos` al Header solamente y dejamos en mobile: Mapa · Personas · [FAB] · Necesidades · Ofertas.

---

## 3. Página `/ofertas` (nueva)

Espejo estructural de `/necesidades`:

- KPIs arriba: total disponibles, matched, delivered
- Buscador + filtro por categoría (mismas categorías que needs: medicinas, alimentos, agua, voluntarios, equipos, sangre, dinero, otro)
- Tabs: `Disponibles` / `Vinculadas` / `Entregadas`
- Botón principal: **"Ofrecer ayuda"** → formulario con título, categoría, cantidad/descripción, ubicación libre, disponibilidad, contacto
- Cada tarjeta de oferta muestra: categoría, título, cantidad, contacto, fecha, estado
- Si la oferta está `available`: botón **"Vincular con una necesidad"** → abre selector
- Si está `matched`: badge + link a la necesidad vinculada + botón "Marcar entregada"

---

## 4. Página `/necesidades` (refactor ligero)

- Quitar `OfferDialog` actual (registrar oferta atada a la necesidad)
- Sustituir el botón "Ofrecer ayuda" de cada tarjeta por dos botones:
  - **"Publicar oferta para esto"** → navega a `/ofertas?need=<id>` con el formulario pre-rellenado y `need_id` preseleccionado
  - **"Ver ofertas vinculadas"** (si hay) → expande las ofertas con `need_id = id` y su estado
- KPIs actualizados: añadir `con oferta vinculada`
- El CTA principal "Publicar necesidad" se mantiene

---

## 5. Match manual desde la oferta

Componente `MatchNeedPicker` (nuevo):

- Lista de necesidades con `status in (open, partial)` filtradas por la misma categoría que la oferta
- Búsqueda por título / centro
- Click en una necesidad → confirma vinculación
- Cualquier persona puede vincular (sin login), igual que hoy se publica
- Acción: `UPDATE offers SET need_id=?, status='matched' WHERE id=?` + `UPDATE needs SET status='partial' WHERE id=? AND status='open'`
- Cualquier persona puede marcar como entregada / desvincular desde la misma tarjeta

No usamos sugerencias automáticas en esta fase (decisión del usuario). Si la oferta ya trae `need_id` (vino de `/necesidades?need=...`), se crea ya en estado `matched`.

---

## 6. KPIs y estadísticas

En `/estadisticas`, añadir bloque "Ayuda comunitaria":
- Total ofertas, vinculadas, entregadas
- Top categorías ofertadas vs demandadas
- Match rate (ofertas matched / total ofertas)

(Si quieres, lo dejo para una iteración posterior — confírmame y lo incluyo o lo aplazo).

---

## 7. Archivos a tocar

- `src/routes/necesidades.tsx` — simplificar, quitar `OfferDialog`, añadir botones de match
- `src/routes/ofertas.tsx` — **nuevo**, espejo de necesidades
- `src/components/MatchNeedPicker.tsx` — **nuevo**, selector de necesidad para una oferta
- `src/components/Header.tsx` — añadir entrada `Ofertas` y reorientar `¡Quiero ayudar!`
- `src/components/BottomNav.tsx` — sustituir slot por `Necesidades` + `Ofertas`
- Migración SQL para `offers` (need_id nullable, índices, política update)

---

## Detalles técnicos

- Acceso a datos: `fetch` directo al REST de Supabase con `VITE_SUPABASE_PUBLISHABLE_KEY`, mismo patrón que `necesidades.tsx` actual
- Sin server functions nuevas: vinculación y updates desde el cliente con políticas RLS abiertas (igual nivel que hoy)
- Realtime opcional: por ahora botón "Actualizar" como en `/necesidades`
- Toasts con `sonner`, iconos `lucide-react` (`PackageOpen`, `Link2`, `Check`)

---

## Fuera de alcance

- Sugerencias automáticas oferta↔necesidad (descartado por el usuario)
- Moderación por rol — cualquiera puede confirmar
- Notificaciones push al solicitante cuando alguien vincula una oferta (futura iteración)