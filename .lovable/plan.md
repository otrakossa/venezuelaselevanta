## Identidad gráfica "Venezuela Se Levanta"

### Concepto
**"Amanecer sobre el Ávila"** — Un nuevo día que se levanta sobre el país. Calidez del amanecer caribe + solidez del azul profundo de la noche que termina. Símbolo: el mapa de Venezuela contenido dentro de un corazón con un pulso/latido que lo recorre.

### Paleta (paleta "Amanecer Caribe")
| Token | Hex | Uso |
|---|---|---|
| `--sunrise` | `#FF6B35` | Color principal / urgencia / acciones |
| `--gold` | `#FFC93C` | Acento / destacados / alertas medias |
| `--sky` | `#1A8FE3` | Secundario / enlaces / información |
| `--midnight` | `#0D2B45` | Fondo del header, textos, modo oscuro |
| `--cream` | `#FFF8F0` | Fondo cálido del modo claro |

Reemplazará los tokens actuales `--vzla-red/yellow/blue` y los colores semánticos de shadcn (`--primary`, `--background`, `--header`, etc.) manteniendo la estructura existente del design system.

### Tipografía
- **Titulares:** Archivo Black (peso bold, presencia de cartel ciudadano).
- **Cuerpo:** Hind (legible, humana, multi-peso).
- Carga vía `<link>` en `__root.tsx` (ya hay preconnect a Google Fonts). Reemplaza la Inter actual.

### Logo "Corazón-Venezuela"
SVG vectorial creado a mano, dos versiones:
- **Full color:** silueta del mapa de Venezuela formando un corazón, con una línea de pulso/latido horizontal en gradiente `sunrise → gold`. Sobre el corazón, un pequeño sol que asoma.
- **Monocromo:** versión en blanco para fondo oscuro y en `midnight` para fondo claro.
- **Favicon:** versión simplificada (solo corazón + pulso) en `public/favicon.svg`.

Archivos:
- `src/components/brand/Logo.tsx` — componente React parametrizable (tamaño, variante color/mono/blanco, con o sin wordmark).
- `public/favicon.svg` — favicon vectorial.
- Se actualiza el `<link rel="icon">` en `__root.tsx`.

### Hero / portada ilustrada
Imagen generada (premium) para la home: ilustración estilo editorial cálido con siluetas de montañas/tepuyes al fondo, un sol naranja-dorado naciendo, siluetas de personas con manos alzadas en primer plano, paleta amanecer caribe estricta. Guardada en `src/assets/hero-amanecer.jpg`.

Se añade un bloque hero ligero **encima del mapa en `/`** (overlay traslúcido, no rompe el flujo del mapa) con:
- Logo grande + wordmark "Venezuela Se Levanta"
- Tagline: "Juntos mapeamos. Juntos nos levantamos."
- CTA primario "Reportar" / secundario "Ver mapa"
- Se cierra/colapsa al hacer scroll o tras unos segundos, para no estorbar al mapa.

### Póster / Open Graph (1200×630)
Imagen generada para compartir en redes: logo + wordmark sobre composición del hero, dominio `venezuelaselevanta.info` visible. Guardada como `src/assets/og-cover.jpg` y referenciada en `__root.tsx` y rutas principales como `og:image` / `twitter:image`.

### Aplicación al sitio existente
- `src/styles.css`: nuevos tokens de color, mapeo a `--primary`, `--background`, `--header`, `--vzla-*` (mantengo los nombres `vzla-*` apuntando a los nuevos colores para no romper componentes), nueva familia tipográfica.
- `src/routes/__root.tsx`: links a Archivo Black + Hind, favicon SVG, og:image global.
- `src/components/Header.tsx`: sustituir el `<AlertTriangle>` + texto por `<Logo />`. Mantener layout, navegación, contador "activos", modo oscuro tal cual.
- `src/components/MapView.tsx`: tonos de marcadores y pulse en `sunrise/gold/sky` (mantiene la lógica de urgencia, solo cambia hex).
- `src/routes/index.tsx`: insertar el hero overlay descrito arriba.
- Rutas internas (`reportar`, `desaparecidos`, `estadisticas`, `admin`, `auth`): heredan automáticamente la nueva paleta y tipografía; sin cambios estructurales.

### Lo que NO cambia
- Esquema de base de datos, hooks, lógica de reportes, real-time, rutas, funcionalidades, copy general (solo branding visual).
- Layout y componentes de las páginas internas.

### Detalles técnicos
- Fuentes vía `<link>` en `__root.tsx` (no `@import` en CSS — Lightning CSS no resuelve URLs remotas).
- Imágenes hero y OG generadas con `imagegen` calidad `premium` (texto legible en OG) y guardadas bajo `src/assets/`.
- Logo como componente SVG inline para que herede `currentColor` y se anime sin peticiones extra.

¿Procedo con esta dirección?