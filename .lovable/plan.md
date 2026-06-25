# Roadmap de mejoras — Venezuela Se Levanta

Lista priorizada de mejoras detectadas en la plataforma. Cada bloque es independiente: podemos atacar uno, varios o todos en el orden que elijas.

---

## 🔴 Prioridad alta (impacto inmediato en campo)

### 1. Subida real de fotos/videos a Storage
Hoy el `ReportForm` acepta media pero no la persiste como archivos en un bucket público; los reportes vía web pueden quedarse sin pruebas visuales (solo los del bot de Telegram tienen media).
- Crear bucket `report-media` (público, con políticas).
- Subir desde el formulario con compresión cliente (canvas a ~1600px, jpeg 0.75) para que funcione en conexiones lentas.
- Guardar URLs en `reports.media[]`.

### 2. Geolocalización del navegador en el formulario
Hoy el usuario debe escribir una dirección. Agregar botón **"Usar mi ubicación"** con `navigator.geolocation` + reverse-geocoding (Nominatim) y un mini-mapa para arrastrar el pin. Esto reduce reportes mal ubicados.

### 3. Moderación de reportes en el panel admin
Auditar el panel actual y agregar:
- Marcar reporte como spam/falso (soft-delete con campo `hidden_at`).
- Cambiar urgencia y estado en lote.
- Fusionar duplicados cercanos (mismo punto + misma categoría en <1h).
- Filtro por reportes con bajo score de credibilidad.

### 4. Notificaciones push (Web Push)
La PWA ya está instalada. Falta:
- Suscripción al `pushManager` con clave VAPID.
- Server function que envía push cuando un reporte **crítico** entra en un radio configurado por el usuario.
- Toggle en perfil "Avísame de emergencias cerca de mí".

---

## 🟠 Prioridad media (calidad y confianza)

### 5. SEO técnico y compartibilidad
- `sitemap.xml` dinámico con todos los reportes.
- `robots.txt` y canonical tags.
- Open Graph image dinámica por reporte (server function que renderiza una tarjeta con título + mapa).
- JSON-LD `Event` / `NewsArticle` por reporte para Google News.

### 6. Búsqueda y filtros avanzados en el mapa
- Buscador por texto (título + dirección) con debounce.
- Filtro por rango de fechas.
- Filtro por estado (activo / atendiendo / resuelto).
- Cluster de marcadores con `leaflet.markercluster` cuando haya >100 reportes visibles.

### 7. Sistema de verificación más robusto
Hoy se vota con device-id (frágil). Mejorar:
- Bonus de credibilidad si el voto viene de usuario autenticado.
- Bonus si el votante es de la zona geográfica del reporte (heurística por IP/geoloc).
- Insignia "Verificado por organización aliada" cuando un admin lo certifica.

### 8. Página de desaparecidos — mejoras
- Buscador por nombre y filtros (zona, edad, fecha).
- Botón "Compartir caso" con OG image específica.
- Marcar como "encontrado" con flujo y fecha.
- Vista de lista + tarjeta grande con foto en lugar de solo lista compacta.

### 9. Internacionalización mínima
EN/ES toggle para que medios internacionales y diáspora puedan consumir y compartir. No requiere i18n completo: detectar idioma del navegador y traducir UI fija (las descripciones de reportes quedan en ES).

---

## 🟡 Prioridad media-baja (operación y datos)

### 10. Open data — completar el ecosistema
- Endpoint `/api/missing-persons.geojson` y `.csv` (mismo patrón que reports).
- Endpoint `/api/stats.json` con KPIs agregados para que medios los embeban.
- Página pública `/datos` documentando los endpoints, licencia, ejemplos `curl` y rate limits.

### 11. Integración con servicios oficiales
- Layer opcional con refugios oficiales (Protección Civil) cargado desde un JSON estático mantenible.
- Layer de hospitales operativos (estado: abierto / colapsado / sin insumos).
- Layer de puntos de acopio.

### 12. Dashboard mejorado
El "Centro de Control" ya tiene 8 KPIs. Faltan:
- Comparativa día vs ayer (% cambio).
- Mapa de calor (heatmap) por densidad de reportes.
- Exportar dashboard a PDF para reportes diarios a prensa.
- Vista pública embebible (`/estadisticas/embed`) sin nav, para iframes.

### 13. Bot de Telegram — features adicionales
- Comando `/cerca` que devuelve reportes en un radio del usuario.
- Comando `/buscar <nombre>` para desaparecidos.
- Suscripción a alertas críticas por zona.

---

## 🟢 Optimizaciones técnicas

### 14. Performance del mapa
- Virtualizar la lista lateral de reportes (react-window) — hoy renderiza todo.
- `React.memo` y `useMemo` en marcadores para evitar re-render al cambiar filtros.
- Lazy-load del componente `MapView` con `Suspense` (Leaflet pesa ~150KB).
- Cache de tiles en service worker para uso offline.

### 15. Bundle y carga inicial
- Auditar bundle con `vite-bundle-visualizer`.
- Code-split rutas pesadas (`admin`, `estadisticas`) — ya son `ssr:false` pero entran al bundle inicial.
- Convertir `hero-rescate.jpg` y `og-cover.jpg` a WebP/AVIF con fallback.
- Preconnect a Supabase y dominio de tiles.

### 16. Base de datos
- Índice geoespacial (`GIST` sobre `point(lng, lat)`) para queries por bounding box del mapa.
- Índice compuesto en `reports(created_at desc, urgency)` para feeds.
- Vista materializada `reports_summary` para el dashboard (refresh cada 5 min vía pg_cron).
- Revisar warnings del linter de Supabase pendientes.

### 17. Resiliencia offline
- Cachear las últimas 200 fichas de reporte con sus media para consulta offline.
- Indicador visual claro de "viendo datos en caché de hace X min".
- Background sync API para reintento garantizado de la cola, incluso con app cerrada.

### 18. Accesibilidad (a11y)
- Auditar con axe — marcadores del mapa no son navegables por teclado.
- `aria-live` para nuevos reportes que entran por realtime.
- Contraste del badge dorado sobre cream (puede estar por debajo de AA).
- Foco visible consistente en todos los botones.

---

## 🔵 Producto y crecimiento

### 19. Onboarding y educación
- Tour guiado primera visita (3 pasos: ver, reportar, compartir).
- Página `/como-funciona` con video corto y ejemplos.
- Plantillas de reporte por categoría (qué incluir, qué no).

### 20. Métricas de uso (privacidad-first)
- Plausible o Umami self-hosted (sin cookies, GDPR-friendly).
- Eventos clave: reporte creado, voto, share, install PWA.
- Panel admin con funnel de reporte (formulario abierto → enviado).

### 21. Donaciones — completar
- Activar Stripe (ya está el placeholder).
- Activar PayPal.
- Pagina pública de transparencia: cuánto entró, cuánto se gastó en qué.

### 22. Programa "Verificadores aliados"
- Roles `verifier` y `org_admin` en `user_roles`.
- Flujo de invitación por email.
- Página pública listando organizaciones verificadoras activas.

---

## 🛠️ Deuda técnica detectada

- `report_votes` con device-id en localStorage → migrar a fingerprint + IP hash para reducir manipulación.
- Componentes grandes (`MapView`, `ReportDetailSheet`, `index.tsx`) — extraer subcomponentes.
- Tests: no hay suite. Agregar al menos smoke tests con Playwright para flujos críticos (crear reporte, votar, ver detalle).
- Tipos de Supabase regenerados manualmente — verificar que estén al día.
- Migraciones de seed mezcladas con migraciones de esquema — separar.

---

## ¿Por dónde empezamos?

Recomendación: arrancar por **#1 (Storage media)** y **#2 (geolocalización)** porque desbloquean la calidad de TODO lo que entra por la web, luego **#3 (moderación)** para mantener limpia la base, y después **#6 (cluster + filtros)** para que el mapa siga siendo usable cuando crezca el volumen.

Dime cuáles quieres priorizar y armo el plan de implementación detallado de ese subset.