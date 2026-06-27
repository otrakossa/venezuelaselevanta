
# Ideas para mejorar el Centro de Control

Hoy el dashboard cubre bien los **reportes** (KPIs, serie 14 días, categorías, DIVIPOL, urgencia, sismos, atendidos por zona). Lo que falta es visibilidad sobre **operación, ayuda, salud y calidad de datos**. Propongo agruparlo en bloques; podés elegir cuáles construir primero.

---

## 1. Operación y tiempos de respuesta (lo más útil para coordinar)

- **Embudo de respuesta**: Activos → En atención → Resueltos, con porcentaje de conversión y tiempo mediano en cada paso.
- **Tiempo mediano de atención** y **de resolución** (KPI con sparkline 7 días).
- **Reportes "estancados"**: activos hace >24 h sin movimiento. Lista clicable para atender ya.
- **Mapa de calor por hora del día × día de la semana** (heatmap 7×24) para detectar picos.
- **SLA por urgencia**: % de críticos resueltos < 6 h, altos < 24 h, etc.

## 2. Cruce ayuda ↔ necesidad (hoy no existe en el dashboard)

- **Balance Necesidades vs Ofrecimientos** por categoría (agua, comida, medicinas, pañales, kit higiene…): barras espejadas que muestran gap.
- **Top zonas con más necesidad y sin oferta** (sectores rojos en el mapa).
- **Tasa de match**: ofrecimientos vinculados a una necesidad / total.
- **KPIs**: necesidades abiertas, ofrecimientos disponibles, matches realizados.

## 3. Salud y desaparecidos

- **Embudo desaparecidos**: registrados → con foto → con ubicación → encontrados, con tasa de localización.
- **Matches missing↔patient** confirmados por admin (cuenta + últimos 7 días).
- **Ocupación por centro de salud**: top hospitales con más atendidos, % de altas, fallecidos.
- **Pirámide etaria** de atendidos y desaparecidos (rangos 0-12 / 13-25 / 26-60 / 60+).

## 4. Mapa y geografía

- **Mini-heatmap de Venezuela** en el panel (Leaflet ya cargado), pintando intensidad por estado.
- **Cobertura DIVIPOL**: % de reportes con state/municipality/parish completos (calidad de dato).
- **Reportes sin coordenadas válidas** (alerta si supera 10 %).

## 5. Comunidad y verificación

- **Calidad / credibilidad**: reportes verificados (≥3 confirm) vs disputados (≥2 dispute), evolución 14 días.
- **Participación ciudadana**: comentarios nuevos, votos emitidos, suscriptores push activos.
- **Canal de origen**: Web vs Telegram vs Offline-queue (donut). Útil para mostrar impacto del bot.

## 6. Sismos (ampliar lo que ya está)

- **Correlación sismos ↔ reportes**: en la serie 14 días, overlay de sismos M≥4 como puntos sobre el área chart.
- **Magnitud máxima 7 días** y **promedio de profundidad**.

## 7. Filtros globales y exportación

- **Filtros del dashboard**: rango de fechas (24 h / 7 d / 30 d / todo), estado DIVIPOL, categoría. Se aplican a todos los paneles.
- **Comparativa de periodo**: "vs. semana pasada" en KPIs principales (ya está para 24 h, extender).
- **Botón "Imprimir / PDF"** para reportes situacionales.
- **Auto-refresh visible** (timestamp "actualizado hace Xs") y botón manual.

## 8. UX del propio dashboard

- **Acceso rápido**: chips arriba con "Críticos activos · Estancados · Necesidades sin cubrir" que llevan a vistas filtradas.
- **Modo TV / pantalla grande** (ruta `/estadisticas/tv` con tipografía gigante para sala de coordinación).
- **Alertas inline**: banda roja si críticos sin atender > umbral, o si entran >N reportes en una hora.

---

## Mi recomendación: arrancar por estos 4 (alto impacto, bajo esfuerzo)

1. **Embudo de respuesta + reportes estancados** — directo de `reports`, sin schema nuevo.
2. **Necesidades vs Ofrecimientos por categoría** — datos ya existen, solo agregar fetch.
3. **Heatmap hora × día** — visualización compacta, muy útil para entender patrones.
4. **Filtros globales (rango temporal + estado DIVIPOL)** — multiplica el valor de todos los paneles existentes.

## Detalles técnicos

- Patrón: añadir `useEffect` con `fetch` a `${SUPA_URL}/rest/v1/<tabla>?select=...` (igual que `patientZones`) para `needs`, `offers`, `report_comments` agregados.
- Para campos `attended_at` / `resolved_at`: revisar si existen en `reports`; si no, usar el primer/último `report_comments` como proxy o agregar columnas en una migración aparte.
- Heatmap: tabla CSS 7×24 con `bg-[color:var(--sunrise)]/{opacity}`, sin librería extra.
- Filtros globales: `useState` en `StatsPage` + un `useMemo` por panel que respete el filtro.
- Mini-mapa coroplético: requeriría GeoJSON de estados Venezuela; lo dejo fuera del primer batch.

¿Avanzo con los 4 recomendados, o preferís un subconjunto / agregar otros?
