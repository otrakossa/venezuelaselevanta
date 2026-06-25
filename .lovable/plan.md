# Plan: Web Push + quick wins

Vamos a implementar la notificación push como feature principal, y empacar varias mejoras pequeñas que llevan poco tiempo pero suman calidad.

---

## 1. Notificaciones push para reportes críticos cercanos (#4)

Cuando entra un reporte crítico, las personas suscritas dentro de un radio (default 10 km) reciben push aunque la app esté cerrada.

**Backend**
- Migración:
  - Tabla `push_subscriptions` (endpoint, p256dh, auth, lat, lng, radius_km, user_id opcional).
  - Función `notify_critical_report()` + trigger AFTER INSERT en `reports` WHERE `urgency='critical'` que llama vía `pg_net` al endpoint público con el id del reporte.
- Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_BROADCAST_SECRET` (generados automáticamente).
- Server route público `/api/public/push/broadcast` que:
  - Verifica header secreto.
  - Carga el reporte y suscripciones dentro del radio (haversine en SQL).
  - Envía push con VAPID JWT firmado con Web Crypto (compatible Workers, sin lib Node-only).
- Server fn pública `getVapidPublicKey()` para que el cliente la lea.

**Frontend**
- Extender `public/sw.js` (service worker que ya genera PWA) con handler `push` y `notificationclick`.
- Componente `PushSubscribeButton` en el panel de filtros del mapa: "Avísame de emergencias cerca de mí" → pide permiso, geolocaliza, slider de radio (5/10/25 km), guarda suscripción.
- Estado persistido en localStorage para mostrar el toggle como activo.

---

## 2. SEO técnico básico (#5 parcial)

- `public/robots.txt` con `Allow: /` y enlace al sitemap.
- Server route `/sitemap.xml` generada dinámicamente con la home + páginas estáticas + últimos 1000 reportes.
- Canonical tag en `__root.tsx` apuntando a `https://venezuelaselevanta.info`.

## 3. Performance hints (#15 parcial)

- `<link rel="preconnect">` a Supabase y tiles de OpenStreetMap en `__root.tsx`.
- `React.memo` en los markers individuales del `MapView` para evitar re-render al cambiar filtros que no afectan a esos puntos.

## 4. Accesibilidad rápida (#18 parcial)

- `aria-live="polite"` en el contenedor de la lista de reportes para que lectores anuncien nuevos reportes que entran por realtime.
- `focus-visible` consistente: anillo dorado en `:focus-visible` para todos los botones e inputs.

## 5. Página desaparecidos — quick wins (#8 parcial)

- Buscador por nombre con debounce 200ms.
- Botón "Marcar como encontrado" (solo admin/moderator) que cambia `status='found'` con confirmación.

---

## Detalles técnicos

- VAPID JWT se firma con `crypto.subtle.sign('ECDSA', ...)` para ser compatible con el runtime Worker (no usamos `web-push` que es Node-only).
- El trigger `pg_net` envía solo `{ report_id }`; el endpoint hace la lectura para evitar inyección desde el payload.
- Haversine en SQL: `2 * 6371 * asin(sqrt(...))`.
- `push_subscriptions` con índice GIST sobre `(lat, lng)` para queries por radio (o índice simple si GIST no aplica sin PostGIS).

## Fuera de scope

- Onboarding de educación push (qué es, cómo desactivar) → más adelante.
- Reintentos / cleanup de suscripciones inválidas (410 Gone) → loggeado pero no automatizado en esta iteración.
- Métricas de entrega.
