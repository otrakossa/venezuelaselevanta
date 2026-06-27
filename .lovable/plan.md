# Selector de categorías con iconos en Necesidades y Ayuda

Replicar el patrón visual de tarjetas con icono Lucide que ya usa `ReportForm` (paso 1, "Categoría") en los formularios de **Necesidades** (`src/routes/necesidades.tsx`) y **Ofrecimiento de ayuda** (`src/routes/ofertas.tsx`), que hoy usan un `<select>` con emoji + etiqueta.

## Alcance

Solo cambia el control de selección de categoría dentro del wizard de cada formulario. No toca:
- Filtros superiores de la lista (chips emoji), tarjetas del feed, ni el matching.
- Esquema de BD ni los valores de `category`.
- El selector de categoría del formulario de Reportes (ya tiene este patrón).

## Cambios por archivo

### `src/routes/necesidades.tsx`
1. Extender `CATEGORY_META` para incluir `icon: LucideIcon` y `color: string` (hex de la paleta) por categoría:
   - medicine → `Pill` / #DC2626
   - food → `Apple` / #16A34A
   - water → `Droplet` / #2563EB
   - volunteers → `HandHelping` / #EA580C
   - equipment → `Wrench` / #7C3AED
   - blood → `Droplets` / #B91C1C
   - money → `Banknote` / #CA8A04
   - hygiene → `SprayCan` (o `Sparkles`) / #0EA5E9
   - diapers → `Baby` / #DB2777
   - other → `Package` / #6B7280
2. Importar esos iconos desde `lucide-react`.
3. En el wizard (alrededor de la línea 494-503), reemplazar el `<select>` por un `grid grid-cols-2 sm:grid-cols-3 gap-2.5` de `<button type="button">` idéntico al de `ReportForm` (mismo estilo `min-h-[96px]`, borde activo `--sunrise`, icono coloreado con `c.color` cuando está activo, texto `text-[11px] font-bold`).
4. Mantener los emojis donde ya se muestran en filtros/tarjetas del feed (no se tocan).

### `src/routes/ofertas.tsx`
Mismo cambio que en Necesidades:
1. Extender `CATEGORY_META` con `icon` y `color` para las mismas categorías (comparten el tipo `Category`).
2. Reemplazar el `<select>` del wizard (líneas 697-704) por el mismo grid de tarjetas.
3. Filtros y tarjetas del feed no se modifican.

## Notas técnicas

- Reutilizamos exactamente las clases del `ReportForm` para mantener consistencia visual (paleta Amanecer sobre el Ávila).
- Los iconos Lucide ya están en el bundle, no requieren nuevas dependencias.
- Validación del wizard sigue funcionando porque `f.category` sigue siendo el mismo string.

## Resultado esperado

Los tres formularios (Reportes, Necesidades, Ayuda) comparten el mismo selector visual de categorías con tarjetas e iconos, tal como muestra la imagen de referencia.
