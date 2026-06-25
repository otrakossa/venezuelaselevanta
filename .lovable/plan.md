# Plan: Reportes multi-canal + experiencia mobile tipo app nativa

Objetivo: que reportar sea rápido, posible sin señal y desde múltiples canales; y que la app en móvil se sienta como una aplicación nativa (no como una web encogida).

---

## 1. Experiencia mobile tipo app nativa

Rediseño mobile-first manteniendo el desktop intacto.

**Chrome de la app**
- Header colapsable: en mobile se reduce a un top bar mínimo (logo + acción de auth) con `safe-area-inset-top` para notch.
- **Bottom navigation bar** fija con 4 destinos: Mapa · Reportes · Desaparecidos · Stats. Iconos grandes (44px touch target), activos con el color Sunrise.
- **FAB central (Floating Action Button) "+ Reportar"** sobre la bottom bar, color amanecer con glow, abre el form como bottom sheet.
- Gestos: pull-to-refresh en listas, swipe horizontal entre tabs opcional.
- `viewport-fit=cover`, `theme-color` dinámico, status bar translúcido, sin scroll horizontal jamás.
- Tipografía y spacing escalados: títulos un punto más chicos en mobile, padding generoso, líneas táctiles ≥44px.

**Pantallas clave reescritas**
- **Mapa (home):** ocupa 100% de viewport. El hero "amanecer" pasa a ser una *card* colapsable arriba (dismiss persistido en localStorage). Filtros de categoría en chips horizontales scrolleables sobre el mapa. Geolocalización del usuario con botón flotante "📍 Mi ubicación".
- **Reportar:** se vuelve un **bottom sheet de 3 pasos** (Categoría grande con emoji · Ubicación con mapa táctil + GPS + foto con EXIF · Detalles). Botones grandes, validación inline, "Enviar" sticky abajo.
- **Listas (reportes/desaparecidos):** cards full-width con foto a la izquierda, info clave grande, badge de urgencia con color. Skeleton loaders.
- **Stats:** grid 2x2 de números grandes tipo dashboard de app.

**Detalles de feel "nativo"**
- Transiciones de ruta suaves (fade/slide) con `view-transition-api` cuando esté disponible.
- Haptic feedback (`navigator.vibrate`) en acciones clave (envío de reporte, confirmar).
- Toasts tipo iOS desde arriba, no desde abajo (evita chocar con bottom nav).
- Sin selección de texto en chrome de la app (`user-select: none` en nav/header).
- Splash screens y theme-color combinando con la paleta amanecer.

---

## 2. PWA instalable + offline queue

- `vite-plugin-pwa` con `generateSW`, guards de preview de Lovable (no registra en `id-preview--*` ni dev).
- `manifest.webmanifest` con name "Venezuela Se Levanta", short_name "VSL", display `standalone`, theme_color sunrise, icons 192/512/maskable, screenshots para Android.
- Iconos PWA generados (logo corazón-Venezuela sobre fondo amanecer).
- **Cache strategy:**
  - HTML → NetworkFirst
  - Assets hashed → CacheFirst
  - Tiles de OpenStreetMap → StaleWhileRevalidate (cap 200 tiles, 7 días) para que el mapa funcione offline en la última zona vista.
- **Offline queue para reportes:** cuando el usuario envía sin conexión, el reporte se guarda en IndexedDB (`idb` lib) en una cola `pending_reports`. Un Background Sync (`sync` event) o un retry al detectar `online` los manda a Supabase y notifica al usuario ("3 reportes enviados al recuperar señal").
- Banner "Sin conexión — tu reporte se enviará automáticamente" cuando `navigator.onLine === false`.
- Botón "Instalar app" en el menú cuando el navegador dispara `beforeinstallprompt`.

---

## 3. Mejoras al formulario actual

- **Geolocalización 1-tap:** botón "📍 Usar mi ubicación actual" con `navigator.geolocation` de alta precisión; muestra precisión en metros.
- **Cámara nativa:** `<input type="file" accept="image/*" capture="environment">` para abrir la cámara directamente en móvil.
- **EXIF GPS:** al subir foto, extraer coords con `exifr` y pre-llenar lat/lng si el form aún no tiene ubicación.
- **Subida de fotos a Supabase Storage** (bucket público `report-photos` con RLS de insert público, max 5MB, conversión a webp en cliente con `browser-image-compression`).
- **Web Share Target:** registrar la PWA como destino de "Compartir" para que desde Google Maps o WhatsApp se pueda compartir una ubicación que abra el form pre-llenado.
- Validación mejorada con feedback inmediato; el botón "Enviar" muestra estado (idle/sending/queued/sent).

---

## 4. Telegram Bot como canal de reporte

Bot que recibe mensajes y los inserta en `reports`.

- Conectar **Telegram via connector** de Lovable (`standard_connectors--connect telegram`).
- Crear webhook público en `src/routes/api/public/telegram/webhook.ts` que:
  1. Verifica `X-Telegram-Bot-Api-Secret-Token` (derivado por SHA-256 del `TELEGRAM_API_KEY`).
  2. Parsea el `update`: acepta texto, ubicación (`message.location`) y foto.
  3. Si hay foto, hace `getFile` y la sube a Supabase Storage.
  4. Detecta categoría por palabras clave o pregunta con teclado inline (botones: 🔴 Desaparecido, 🟠 Médico, 🟡 Rescate, etc.).
  5. Inserta en `reports` con `reporter_name = "Telegram: @username"`, `verified=false`.
  6. Responde al usuario "✅ Reporte recibido, ID #abc123. Verás aparecer un pin en el mapa".
- Comandos: `/start` (instrucciones), `/reportar` (asistente paso a paso), `/desaparecido` (nombre + foto + lugar → `missing_persons`).
- Registro del webhook con el URL público estable `project--<id>-dev.lovable.app/api/public/telegram/webhook`.
- En la home, banner "📱 También puedes reportar por Telegram: @VenezuelaSeLevantaBot" (o el handle que el usuario elija).

---

## 5. Cambios en la base de datos

Migración pequeña:
- Bucket de Storage `report-photos` (público read, insert público).
- Bucket `missing-photos` (idem).
- Columna `source text default 'web'` en `reports` y `missing_persons` para distinguir origen (`web` / `telegram` / `pwa-offline`).
- (Opcional) Tabla `telegram_messages` con `update_id` PK para idempotencia, si el bot la necesita.

---

## Orden de implementación sugerido

1. **Rediseño mobile** (bottom nav + FAB + bottom sheet + chrome nativo) — impacto inmediato visible.
2. **Form mejorado** (geolocalización, cámara, fotos a Storage, EXIF).
3. **PWA instalable + offline queue de reportes + cache de tiles**.
4. **Telegram bot** (conectar connector, webhook, comandos).

¿Avanzo con los 4 pasos en orden, o prefieres priorizar alguno primero (por ejemplo sólo el rediseño mobile + PWA, y dejar Telegram para una segunda iteración)?
