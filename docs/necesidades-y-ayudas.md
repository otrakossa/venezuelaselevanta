# Necesidades y Ofertas de Ayuda — Guía para desarrolladores

Documento de referencia sobre cómo funcionan hoy los módulos de **Necesidades**
(`/necesidades`) y **Ofertas de ayuda** (`/ofertas`) en Venezuela Se Levanta,
qué flujos los conectan y qué oportunidades de mejora hay pendientes.

---

## 1. Modelo conceptual

La plataforma separa **demanda** y **oferta**:

| Concepto | Quién lo publica | Qué expresa | Tabla |
|---|---|---|---|
| **Necesidad** | Centros de salud, refugios, comunidades, voluntarios en terreno | "Nos hace falta X" | `public.needs` |
| **Oferta** | Donantes, empresas, ciudadanos, ONGs | "Puedo aportar Y" | `public.offers` |
| **Match** | Manual hoy, vía `offers.need_id` | Una oferta atada a una necesidad concreta | FK `offers.need_id → needs.id` |

La idea es que ambos lados se publiquen libremente y la plataforma facilite que
una oferta se vincule a una necesidad puntual sin obligar a registro previo.

---

## 2. Esquema de base de datos

### `needs`
Campos clave:
- **Ubicación**: `center_name`, `center_address`, `lat`, `lng` (capturados con
  `LocationPickerInline` + reverse geocoding Nominatim).
- **Contenido**: `title`, `description`, `quantity`, `category` (legacy single)
  + `categories text[]` (multi-categoría, indexada con GIN).
- **Urgencia**: `urgency ∈ {low, medium, high, critical}`.
- **Estado**: `status ∈ {open, in_progress, fulfilled, closed}` (default `open`).
- **Contacto** (obligatorios desde último cambio): `reporter_name`,
  `reporter_cedula`, `contact_phone`. `contact_info` queda como campo libre.
- Timestamps: `created_at`, `updated_at`.

RLS: lectura pública (`SELECT USING (true)`), inserción pública
(`INSERT WITH CHECK (true)`), update solo admin/moderator.

### `offers`
Campos clave:
- **Vinculación**: `need_id uuid NULL` con `ON DELETE SET NULL`. Si viene de
  hacer clic en "Ofrecer ayuda" desde una tarjeta de necesidad, queda atado.
- **Contenido**: `title`, `description`, `category`, `quantity`.
- **Ubicación de la oferta** (obligatoria desde último cambio):
  `state`, `city`, `address`, más `location_desc` libre.
- **Contacto**: `contact_name` (NOT NULL), `contact_phone`, `contact_info`.
- **Estado**: `status ∈ {open, matched, delivered, closed}` (default `open`).

Mismas RLS que `needs`.

### Notas de esquema
- No hay tabla intermedia oferta↔necesidad: la relación es **1 oferta → 0/1
  necesidad**. Una necesidad puede recibir N ofertas (`offers.need_id`).
- No hay historial de cambios de estado ni auditoría de quién marcó algo como
  `fulfilled`.
- `category` (singular) coexiste con `categories text[]`; se mantiene por
  compatibilidad con datos viejos pero el frontend ya escribe ambos.

---

## 3. Flujos de usuario

### 3.1 Publicar una necesidad — `/necesidades`
1. Usuario abre el wizard (`Wizard` reutilizable en `src/components/Wizard.tsx`).
2. **Paso 1 — Ubicación**: `HealthCenterPicker` (combobox sobre
   `health_centers`) o entrada libre + `LocationPickerInline` que hace reverse
   geocoding (Nominatim) y guarda `lat/lng` + `center_address`.
3. **Paso 2 — Qué necesitan**: categorías múltiples, título, descripción,
   cantidad, urgencia.
4. **Paso 3 — Contacto**: nombre, cédula y teléfono **obligatorios**.
5. Inserta directamente vía cliente Supabase con la `anon key` (RLS permite
   insert público).

### 3.2 Publicar una oferta — `/ofertas`
Dos puntos de entrada:

**A) Flujo libre** (`/ofertas` directo)
- Wizard pide categoría → datos del aporte → ubicación del donante → contacto.
- Se inserta con `need_id = NULL`. Queda en el listado público de ofertas para
  que un coordinador la enlace después.

**B) Flujo "Ofrecer ayuda a esta necesidad"** (`/ofertas?need=<uuid>`)
- Desde el listado `/necesidades`, el botón "Ofrecer ayuda" navega con
  `?need=<id>` y prellena el wizard.
- El wizard **salta** el paso de categoría: hereda título, categoría y
  contexto de la necesidad.
- Al guardar, `offers.need_id` queda con el UUID de la necesidad.
- Hoy esto **no cambia el estado de la necesidad** automáticamente.

### 3.3 Listado y filtros
- `/necesidades`: tarjetas con badge de urgencia, fecha relativa
  ("hace 2h") + fecha absoluta `toLocaleString("es-VE")`, botón "Ofrecer
  ayuda" y, si hay `lat/lng`, "Ver en mapa".
- `/ofertas`: tarjetas con datos del donante, ubicación y, si tiene `need_id`,
  una pista de a qué necesidad responde.
- Filtros: por categoría, urgencia y estado (lado cliente; los datasets son
  pequeños hoy).

### 3.4 Notificación a coordinación
Al publicar oferta o necesidad **no se envía email automático** (la
infraestructura `email_send_log` / `email_send_state` existe pero hoy se usa
solo para emails transaccionales puntuales). Los coordinadores monitorean los
listados manualmente.

---

## 4. Estados y ciclo de vida

```
needs.status:   open ─► in_progress ─► fulfilled ─► closed
offers.status:  open ─► matched     ─► delivered  ─► closed
```

Hoy estos cambios solo los puede hacer un admin/moderador (RLS) y el frontend
no expone un panel para administrarlos. En la práctica casi todo permanece en
`open`.

---

## 5. Limitaciones actuales

1. **Sin matching asistido**: a diferencia de desaparecidos↔atendidos, no hay
   RPC que sugiera ofertas relevantes para una necesidad (o viceversa) por
   categoría + cercanía geográfica.
2. **Sin cierre de ciclo automático**: enlazar una oferta a una necesidad
   (`need_id`) no marca la necesidad como `in_progress`, ni envía notificación
   al solicitante, ni descuenta cantidad parcial.
3. **Cantidad como texto libre**: `quantity varchar(100)` impide agregaciones
   ("¿cuántos litros de agua faltan en Caracas?").
4. **Sin verificación de identidad ni anti-spam**: cualquier dispositivo puede
   insertar. No hay rate limit, captcha ni device fingerprint como en votos.
5. **Sin moderación visible**: no hay flag de "reportar como falso", ni
   workflow de aprobación antes de publicar.
6. **Sin deduplicación**: dos centros pueden registrar la misma necesidad sin
   advertencia (no hay `unique` lógico ni búsqueda de similares al escribir).
7. **PII expuesta**: `reporter_cedula` y `contact_phone` se leen con
   `SELECT USING (true)`. Hoy aparecen en el JSON del API público.
8. **Estados huérfanos**: nadie cierra necesidades antiguas; el listado crece
   indefinidamente.
9. **Sin métricas**: no hay vista / dashboard de "necesidades cubiertas",
   "tiempo promedio de respuesta", "categorías más demandadas por estado".
10. **Sin canal de coordinación inverso**: el donante no recibe confirmación
    cuando el centro recibe lo ofrecido.

---

## 6. Mejoras propuestas

### 6.1 Rápidas (1–2 días)
- **Auto-actualizar `needs.status`** a `in_progress` cuando llega la primera
  oferta vinculada (trigger `AFTER INSERT ON offers WHEN need_id IS NOT NULL`).
- **Botón "Marcar como cubierta"** en la tarjeta de necesidad para el
  publicador (validado con `device_id` igual al de creación, o con un token
  emitido al crear).
- **Ocultar PII en listados públicos**: crear vista `needs_public` /
  `offers_public` sin `reporter_cedula` ni teléfono completo (mostrar últimos
  4 dígitos) y apuntar la API pública a esas vistas.
- **Filtro por estado/categoría/urgencia desde URL** (`?cat=agua&urg=critical`)
  para compartir listados específicos por WhatsApp.
- **Contador de ofertas por necesidad** en la tarjeta (`SELECT count(*)
  FROM offers WHERE need_id = ?`).

### 6.2 Medianas (3–5 días)
- **RPC `suggest_offers_for_need(need_id)`**: ranking por categoría exacta +
  proximidad geográfica (haversine sobre `lat/lng` de la necesidad y
  `state/city` de la oferta) + urgencia.
- **Wizard inverso**: desde una oferta abierta, sugerir necesidades
  compatibles ("Hay 5 necesidades de agua en Caracas que podrías cubrir").
- **Normalizar cantidades**: agregar columnas `quantity_value numeric` y
  `quantity_unit text` (l, kg, unidades, raciones) manteniendo `quantity` libre
  como descripción.
- **Panel admin** en `/admin/ayudas` para cerrar/editar/fusionar duplicados.
- **Notificación opcional**: si el reportante deja email, enviar resumen
  diario de ofertas nuevas que coincidan con su necesidad.

### 6.3 Estratégicas
- **Tabla `matches`** (oferta ↔ necesidad, muchos a muchos) con cantidad
  comprometida y estado propio (`proposed | accepted | delivered | rejected`).
  Permite que una oferta grande cubra varias necesidades pequeñas y viceversa.
- **Workflow de confirmación bidireccional**: el donante propone, el centro
  acepta, ambos confirman entrega. Cada paso genera evento auditable en
  `match_events`.
- **Integración con logística**: capa de "puntos de acopio" como un tipo
  especial de `health_center` para que las ofertas converjan en hubs antes de
  distribuirse.
- **Verificación de centros**: marcar `health_centers.verified = true`
  cuando un coordinador lo valida; mostrar badge en las necesidades emitidas
  desde un centro verificado.
- **Telegram bot**: añadir `/ofrecer` y `/necesitar` análogos a `/reportar`
  para que la mayoría de la operación entre por WhatsApp/Telegram.
- **API pública de matching**: exponer `GET /api/needs/:id/suggested-offers`
  en la spec OpenAPI para que sistemas terceros consuman.

---

## 7. Riesgos a vigilar
- **Sobre-publicación**: si la plataforma crece sin moderación, ambos
  listados pueden contaminarse con duplicados o información obsoleta.
- **Datos sensibles**: cédulas y teléfonos públicos son un vector de scraping
  y abuso; priorizar el punto 6.1 sobre vistas anonimizadas.
- **Falsos positivos en matching automático**: aprender de la lección de
  desaparecidos↔pacientes (umbrales muy permisivos generaron ruido). Empezar
  con criterios estrictos (categoría exacta + mismo estado).

---

## 8. Archivos relevantes

| Ruta | Qué hace |
|---|---|
| `src/routes/necesidades.tsx` | Listado, wizard de creación, tarjetas |
| `src/routes/ofertas.tsx` | Listado, wizard, modo prefilled (`?need=`) |
| `src/components/Wizard.tsx` | Componente reutilizable de pasos |
| `src/components/LocationPickerInline.tsx` | Geolocalización + reverse geocoding |
| `src/components/HealthCenterPicker.tsx` | Selección de centros de salud |
| `src/lib/categories.ts` | Catálogo de categorías de ayuda |
| `src/lib/supabase-rest.ts` | Helpers REST si se evita el cliente JS |
