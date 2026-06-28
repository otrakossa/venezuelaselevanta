## Problema

Las miniaturas que se ven antes de cargar la página y el icono que aparece al instalar la PWA en el móvil muestran una versión antigua: un mapa de Venezuela en anaranjado. El logo nuevo es el corazoncito anaranjado del favicon, y debería ser el único icono que se vea en todas partes.

El favicon SVG (`public/favicon.svg`) ya es el corazón nuevo, pero los PNG que usan iOS/Android y los previewers de WhatsApp/Twitter siguen siendo los viejos. Se nota además porque no son cuadrados (192×168, 512×448, 180×158), señal de que se generaron del lockup viejo con mapa, no del corazón.

## Cambios

1. **Regenerar los tres PNG de icono** a partir del corazón nuevo, todos cuadrados y centrados sobre el fondo de marca (`#0D2B45` midnight, igual al `background_color` del manifest). Tamaños finales:
   - `public/apple-touch-icon.png` → 180×180
   - `public/icon-192.png` → 192×192 (con área segura ~80% para que funcione como `maskable`)
   - `public/icon-512.png` → 512×512 (idem)
   
   Se generan en el VPS con `rsvg-convert` + `PIL` desde `public/favicon.svg`, sin tocar el SVG fuente.

2. **Bump de cache-buster a `?v=6`** en `src/routes/__root.tsx` para `favicon.svg`, `icon-192.png` y `apple-touch-icon.png`, y también en `og:image` / `twitter:image` por si alguna caché de red social todavía sirve el mapa viejo.

3. **`public/manifest.webmanifest`**: añadir `?v=6` a las URLs de `icon-192.png` e `icon-512.png` (y a los `shortcuts`), para forzar a Chrome/Android a re-descargar el icono al actualizar la PWA instalada. Mantener `theme_color` y `background_color` actuales.

4. **No se toca** el lockup `public/logo-vsl.svg` ni `Logo.tsx` — el header/footer ya usan el logo nuevo. Tampoco se cambia `og-cover.jpg` (es la imagen banner ya aprobada, no el mapa viejo).

## Aviso al usuario

PWA ya instalada en el móvil: Android suele tardar uno o dos arranques en refrescar el icono; en algunos casos hace falta desinstalar y volver a instalar. iOS cachea `apple-touch-icon` muy agresivamente — la única forma garantizada es quitar la app de la pantalla de inicio y volver a añadirla.
