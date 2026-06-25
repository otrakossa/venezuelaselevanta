## Objetivo
Mostrar a las personas desaparecidas como marcadores en el mapa principal, usando `last_seen_lat` / `last_seen_lng` (campos que ya existen en la tabla `missing_persons`).

## Cambios

### 1. Captura de coordenadas al reportar
- En `src/routes/desaparecidos.tsx` (formulario `MissingForm`):
  - Al ingresar "Última ubicación conocida", llamar a `geocodeAddress()` (de `src/lib/geocode.ts`) para resolver lat/lng vía Nominatim.
  - Botón "Usar mi ubicación actual" (geolocalización del navegador) como alternativa rápida.
  - Mostrar pin verde de confirmación cuando hay coords; guardar `last_seen_lat` / `last_seen_lng` junto al resto del insert.
  - Permitir publicar sin coords (queda solo en la lista, no en el mapa).

### 2. Capa de desaparecidos en el mapa
- En `src/components/MapView.tsx`:
  - Aceptar nueva prop `missing: MissingPerson[]` (opcional).
  - Renderizar marcadores con `L.divIcon` distinto (color rosa/rose + icono de persona) para diferenciarlos de los reportes.
  - Popup compacto con foto/iniciales, nombre, edad, "visto por última vez", botón **Difundir WhatsApp** y botón **Ver detalle** → navega a `/desaparecidos` (o abre sheet ligero — opción mínima: link a la página).
  - Filtrar solo los que tienen lat/lng no nulos y `status = 'missing'` por defecto.

### 3. Toggle en filtros del mapa
- En `src/routes/index.tsx`:
  - Usar `useMissing()` además de `useReports()`.
  - Añadir un chip/toggle "👤 Desaparecidos" en el panel de filtros (encendido por defecto) que controla si la capa se pasa a `<MapView>`.
  - Conteo en el chip (cantidad con coords).

### 4. Leyenda
- Pequeña leyenda en el mapa (esquina inf-izq) indicando: 🔴 Reporte · 🟣 Sismo USGS · 🌸 Desaparecido.

## Detalles técnicos
- `last_seen_lat` / `last_seen_lng` ya existen en `missing_persons`; no se requiere migración.
- Geocoding reutiliza `src/lib/geocode.ts` (Nominatim, sin key).
- Marcador divIcon con color `#f43f5e` (rose-500) y la inicial del nombre o ícono de usuario para distinguir a simple vista.
- No se toca lógica de reportes ni de votación.

## Fuera de alcance
- Edición de coordenadas de desaparecidos existentes (los antiguos sin coords seguirán solo en la lista).
- Backfill masivo de geocoding sobre registros ya creados (puede ofrecerse en un paso posterior).
