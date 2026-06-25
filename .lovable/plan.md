## Fase 1 — Bugs funcionales (6–8) + UX mobile (9–16)

### 🔴 Bugs funcionales

**6. Hidratación SSR**
- Auditar `PWAInstallBanner.tsx` y `PushSubscribeButton.tsx`: cualquier uso de `window`, `navigator`, `localStorage` debe ir tras un flag `mounted` (mismo patrón ya aplicado en `OfflineBanner`).
- Envolver con `<ClientOnly>` cuando aplique.

**7. Realtime subscriptions duplicadas**
- Revisar `useReports.ts`, `useReportDetail.ts`, `useReportComments.ts`: garantizar `supabase.removeChannel()` en cleanup del `useEffect` y canales con nombre único por id para evitar colisiones al cambiar de ruta.
- Añadir guard contra doble suscripción en StrictMode.

**8. Geocoding Nominatim**
- En `src/lib/geocode.ts`: cache LRU en memoria + `localStorage` (clave normalizada).
- Throttle de 1 req/s (cola interna).
- Retry con backoff ante 429/503 y mensaje de error claro.
- User-Agent header conforme a la política de Nominatim.

### 🟡 UX mobile

**9. Skeleton loaders**
- Componente `ReportCardSkeleton` y `MissingCardSkeleton` (shadcn `Skeleton`).
- Aplicar en lista lateral de `index.tsx`, en `/desaparecidos`, y placeholder del mapa mientras `loading`.

**10. Empty states ilustrados**
- Componente `EmptyState` reutilizable (icono Lucide + título + subtítulo + CTA opcional).
- Usar en lista filtrada vacía (index), `/desaparecidos`, y filtros sin resultados.

**11. Pull-to-refresh (mobile)**
- Hook `usePullToRefresh` minimal (touchstart/touchmove en el contenedor scrollable).
- Indicador visual arriba de la lista.
- Trigger: refetch de reportes/desaparecidos.

**12. Filtros persistentes en URL**
- Sincronizar estado de filtros (categoría, urgencia, verificados, búsqueda) con `useSearch`/`useNavigate` en `index.tsx`.
- Validar con `zod` en `validateSearch` de la ruta.
- Compartible/bookmarkable.

**13. Modo oscuro — auditoría de contraste**
- Revisar popups del mapa (`MapView.tsx`), badges de urgencia, `ReportRating`, ribbons de status.
- Reemplazar cualquier color hardcodeado por tokens semánticos en `styles.css`.

**14. Cluster de marcadores**
- Instalar `leaflet.markercluster` + tipos.
- Activar cluster cuando `reports.length > 50` o por defecto.
- Estilizar clusters con paleta de la marca.

**15. Mini-mapa en el Sheet de detalle**
- En `ReportDetailSheet.tsx`: añadir `MapContainer` pequeño (200px) centrado en el reporte, marker no interactivo, tiles OSM.
- Solo si `lat/lng` presentes.

**16. Enlaces directos en WhatsApp**
- `WhatsAppShareButton`: aceptar prop `url` (default home).
- En popups y listas pasar `https://venezuelaselevanta.info/?report=<id>` o `?missing=<id>`.
- Mismo cambio en `MissingCard.shareWA` y popups del mapa.

---

### Orden de ejecución sugerido

1. Bugs primero (6 → 7 → 8) — base estable.
2. Luego UX en orden: 12 (filtros URL, base para todo) → 9 (skeletons) → 10 (empty states) → 13 (contraste) → 16 (links WA) → 15 (mini-mapa) → 14 (clusters) → 11 (pull-to-refresh).

### Detalles técnicos

- Sin nuevas tablas ni migraciones.
- Nuevas dependencias: `leaflet.markercluster` + `@types/leaflet.markercluster`.
- Sin cambios en API pública (GeoJSON/CSV).
- Mantener compatibilidad SSR (clusters y mini-mapa cargan client-only).
