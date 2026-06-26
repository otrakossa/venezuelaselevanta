## Análisis del reporte de Luisana (Maxsl)

Revisé cada observación contra el código actual. Esto es lo que **ya está hecho**, lo que **está parcial** y lo que **falta**.

### Ya implementado (no requiere trabajo)
- Hero dismissible con CTA "Reportar" + slogan en `/` (`HERO_DISMISS_KEY`).
- Nav con indicador de sección activa (Header + BottomNav, `pathname === item.to` → fondo sunrise).
- Clustering en el mapa (`react-leaflet-cluster`).
- Filtros por categoría, urgencia, ventana temporal y modo confianza.
- Pull-to-refresh en lista y estadísticas (`usePullToRefresh`).
- Marcar como "encontrada" en `/desaparecidos` (un clic, actualiza `status` + `found_date`).
- Service Worker / PWA con cola offline (IndexedDB).
- Geolocalización + EXIF + reverse geocoding en el formulario.
- Toasts de éxito/error (`sonner`) en envíos.
- Mobile-first: BottomNav, safe-area-insets, mapa a viewport completo.

### Lo que falta o está débil — propuesta de trabajo

**Fase 1 — Onboarding y claridad (alta prioridad, impacto inmediato)**

1. **Rediseñar el hero del home como "3 acciones principales"** (responde a las 3 preguntas universales del reporte):
   - Bloque 1: **Reportar / Buscar desaparecido** → `/desaparecidos`
   - Bloque 2: **Reportar incidente** → `/reportar`
   - Bloque 3: **Quiero ayudar** → `/ofertas`
   - Cada tarjeta con icono grande, color distinto, microcopy de 1 línea ("¿No sabes nada de un familiar?", "¿Viste algo que la gente debe saber?", "¿Tienes recursos, tiempo o transporte?"). Mantener el slogan, eliminar el CTA único actual.
   - El hero deja de ser "decorativo+dismiss" y pasa a ser **funcional** — sigue siendo dismissible, pero por defecto se ve y guía.

2. **Banner de estado en vivo** (sticky bajo el header, dismissible):
   - "X reportes activos · Y desaparecidos · Z encontrados · Última actualización: hh:mm"
   - Enlace a línea de emergencia oficial (171 / Protección Civil).
   - Solo en `/` y rutas principales; se calcula de los hooks ya existentes.

3. **Búsqueda por nombre desde el mapa**: añadir un input de búsqueda en la barra flotante del mapa que filtre marcadores de desaparecidos por nombre (ya existe el server-side search en `/desaparecidos`, lo reutilizamos en el cliente para los marcadores cargados).

**Fase 2 — Formulario en pasos (wizard)**

4. Convertir `ReportForm` (374 líneas, single-page) en un wizard de 3 pasos visibles:
   - Paso 1: Qué pasó (categoría + título + descripción + urgencia)
   - Paso 2: Dónde (mapa + dirección + estado/municipio/parroquia)
   - Paso 3: Quién reporta (nombre + medios + enviar)
   - Barra de progreso arriba, botones "Atrás / Siguiente / Enviar".
   - Validación en tiempo real por paso (no dejar avanzar sin campos obligatorios) con mensajes inline bajo cada campo.
   - Mantener toda la lógica actual de EXIF, geocoding, offline queue.

**Fase 3 — UX visual y accesibilidad**

5. **Leyenda del mapa**: panel colapsable abajo-derecha con los colores/iconos de cada categoría y el marcador de desaparecidos. Se muestra plegado por defecto en mobile.

6. **Indicadores de carga en navegación entre rutas**: barra de progreso superior (tipo nprogress) conectada al estado del router de TanStack. Hoy hay skeletons por ruta pero no señal visible durante la transición.

7. **"Última actualización"** visible en cada ficha de desaparecido y de reporte (`updated_at` relativo: "hace 12 min"). Ya tenemos los datos, falta exponerlos en `ReportDetailSheet` y en las tarjetas de `/desaparecidos`.

8. **Accesibilidad WCAG 2.1 AA**:
   - Auditar contraste del sunrise `#FF6B35` sobre fondos cream/blanco; bajar a `#E85A28` (ya usado en hover) donde no alcance 4.5:1.
   - Asegurar `aria-current="page"` en nav activa, `aria-label` en todos los botones-icono, focus visible en todos los interactivos.
   - Tamaño mínimo táctil 44×44 px en chips de filtro y botones de acción mobile (varios hoy son 32–36 px).

**Fase 4 — Anti-duplicados (más profunda, opcional según prioridad)**

9. Al crear un desaparecido, antes de guardar buscar coincidencias por nombre + edad aproximada y mostrar "¿Esta persona ya fue reportada? Súmate al caso existente en vez de duplicar". Si elige sumarse → añade un comentario/confirmación al caso original. Esto requiere ajuste de UX y un endpoint de búsqueda fuzzy; lo dejo separado porque toca tabla y flujo.

### Detalles técnicos

- Archivos principales a tocar: `src/routes/index.tsx` (hero), `src/components/Header.tsx` (aria-current), `src/components/ReportForm.tsx` (wizard), `src/components/MapView.tsx` (leyenda + buscador), `src/components/ReportDetailSheet.tsx` (updated_at), `src/routes/desaparecidos.tsx` (updated_at + búsqueda preventiva), `src/styles.css` (tokens de contraste y focus).
- Nuevo componente `LiveStatusBanner.tsx` consumiendo `useReports` + `useMissing`.
- Nuevo componente `RouteProgress.tsx` con el router state.
- Sin cambios de esquema en la base salvo que aprobemos la Fase 4.

### Orden sugerido de implementación

Fase 1 → Fase 3 (puntos 5–8) → Fase 2 → Fase 4.
La Fase 1 ataca la queja central (parálisis por análisis) con cambios localizados y bajo riesgo. La Fase 2 es la más invasiva y la dejo después de tener el banner/leyenda/contraste listos para no mezclar regresiones.

¿Avanzo con las cuatro fases en ese orden, o prefieres recortar (por ejemplo, dejar el wizard fuera o saltarte la Fase 4)?