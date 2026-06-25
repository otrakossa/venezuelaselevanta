# Mejora visual del dashboard de estadísticas

Rediseño completo de `/estadisticas` con identidad de marca (sunrise/gold/sky/midnight), KPIs ampliados, sparklines y gráficos adicionales aprovechando los datos ya disponibles (`reports`, `missing`, votos de credibilidad, sismos USGS).

## Nuevos indicadores (KPI cards)

Pasar de 4 a 8 tarjetas, agrupadas en 2 filas con jerarquía visual (card hero + grid):

1. **Total reportes** (con delta vs 24h)
2. **Reportes activos** (rojo crítico)
3. **Críticos / Alta urgencia** (nuevo — `urgency in ['critical','high']`)
4. **Atendiéndose** (amarillo)
5. **Resueltos** (verde, con % de resolución)
6. **Desaparecidos activos**
7. **Reportes verificados** (nuevo — `confirm_count >= 3`)
8. **Sismos USGS últimas 24h** (nuevo — desde `useUSGSQuakes`)

Cada card con: icono en círculo tintado, valor grande, label, micro-sparkline (últimos 7 días) o delta cuando aplique.

## Nuevos gráficos

- **Línea temporal "Reportes por día (últimos 14 días)"** — `AreaChart` con gradiente sunrise→transparent, eje X con día/mes.
- **Barras horizontales "Top 5 zonas afectadas"** — agrupado por primera parte de `address` (estado/ciudad), con conteo.
- **Barras apiladas "Urgencia por categoría"** — stacked bar (crítico/alto/medio/bajo) por categoría top 6.
- Mantener pero rediseñar: **Reportes por categoría** (bar con esquinas redondeadas, labels en barras) y **Estado** (donut en vez de pie completo, con valor central = total).
- **Mini-mapa de calor textual** "Magnitud sísmica reciente" — lista compacta de los 5 sismos más recientes con badge de magnitud coloreado (reusa escala USGS existente).

## Mejora visual

- Header con gradiente sutil `--sunrise → --gold` en la franja superior y badge "🟢 En vivo" pulsante.
- Cards con `border` fino, `shadow-sm`, hover lift, esquina con barra de color de acento por categoría.
- Tipografía: títulos en `font-display` (Archivo Black ya cargado), números grandes en tabular-nums.
- Tooltips de recharts personalizados (fondo midnight, texto cream) consistentes con la marca.
- Sección "Últimos reportes" → tarjetas con thumbnail de media (si existe), badge de urgencia y tiempo relativo ("hace 3 min").
- Botones de descarga (GeoJSON/CSV) movidos a un dropdown "Exportar datos" más limpio, con contador de filas.
- Layout responsivo: 2 cols en móvil para KPIs, 4 en desktop; gráficos full-width en móvil, 2 cols en lg.

## Archivos a modificar

- `src/routes/estadisticas.tsx` — rediseño completo del componente, nuevos `useMemo` para series temporales, top zonas, urgencia×categoría, verified count, deltas.
- Reutilizar hooks existentes: `useReports`, `useMissing`, `useUSGSQuakes`.
- Sin cambios de schema ni nuevas dependencias (recharts ya está instalado).

## Detalles técnicos

- Serie temporal: agrupar `reports` por `toISOString().slice(0,10)` de `created_at`, rellenar días faltantes con 0 para los últimos 14 días.
- Top zonas: split `address` por `,` y tomar el último segmento no vacío como "estado"; agrupar y ordenar desc, top 5.
- Verified: contar `confirm_count >= 3` (umbral ya usado en credibility).
- Sparklines: `<Sparkline>` mini-componente con `ResponsiveContainer` + `AreaChart` height 32, sin ejes.
- Tooltip personalizado: componente `<ChartTooltip>` reutilizable con `bg-[var(--midnight)] text-[var(--cream)]`.
- Tiempo relativo: helper local `timeAgo(date)` simple en español (sin nueva dep).
