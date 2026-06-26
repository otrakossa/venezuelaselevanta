## Objetivo

Crear una página dedicada que explique qué es Venezuela Se Levanta, cómo nació, qué se puede hacer en la plataforma y cómo sumarse. Tono humano, solidario, que invite a la acción y subraye la tecnología y los datos abiertos al servicio de la gente.

## Nueva ruta

`src/routes/que-es.tsx` (TanStack Start, `createFileRoute`, SSR activo para SEO).

### Estructura de la página

1. **Hero** — reutiliza `hero-rescate.jpg` y el lenguaje visual de `/creditos` (overlay midnight + acento sunrise).
   - Eyebrow: "Nuestra historia"
   - H1: "Venezuela se levanta, y lo hacemos juntos"
   - Subtítulo corto y humano (1-2 líneas)
   - CTAs: "Reportar algo" → `/reportar`, "Quiero ayudar" → `/ofertas`

2. **Qué es** — párrafo reescrito en tono cercano: plataforma ciudadana que pone tecnología y datos al servicio de la respuesta colectiva al terremoto.

3. **Cómo nació** — bloque narrativo breve: surgió de voluntarios, desarrolladores y organizaciones aliadas que vieron la necesidad de coordinar la respuesta en tiempo real cuando la tierra se movió. Mencionar inspiración en Ushahidi y el trabajo de Codex + Fundación Casa del Bosque + comunidad de software libre.

4. **Qué puedes hacer aquí** — grid de tarjetas (icono + título + descripción + link), una por sección clave:
   - Reportar incidentes (`/reportar`)
   - Buscar o registrar desaparecidos (`/desaparecidos`)
   - Ver atendidos en centros de salud (`/pacientes`)
   - Publicar necesidades (`/necesidades`)
   - Ofrecer ayuda (`/ofertas`)
   - Estadísticas en vivo (`/estadisticas`)
   - Donar (`/donar`)
   - Bot de Telegram (link externo)

5. **Datos abiertos al servicio de todos** — bloque destacado con licencia CC BY 4.0, descargas GeoJSON/CSV y compatibilidad con QGIS, ArcGIS, UNOCHA HDX. Reutiliza estética del footer.

6. **Cómo sumarte** — 3-4 vías concretas (reportar, verificar, difundir, aliarse) con CTA final hacia `/creditos#contacto`.

7. **Cierre emocional** — frase breve con el slogan "La tierra se movió, pero Venezuela sigue firme".

### SEO / metadatos

`head()` con:
- title: "Qué es Venezuela Se Levanta — Nuestra historia"
- description: una línea humana sobre la plataforma ciudadana
- og:title / og:description / og:image (hero-rescate)
- canonical `https://venezuelaselevanta.info/que-es`

## Navegación

Agregar enlace "Qué es" en:
- `src/components/Header.tsx` — menú principal (antes de "Créditos")
- `src/components/Footer.tsx` — sección "Ecosistema" o nueva sección "Sobre el proyecto"
- `src/routes/sitemap[.]xml.ts` — añadir la URL

## Diseño

Reusa tokens existentes (`--sunrise`, `--midnight`, `--gold`, `--sky`, `--cream`), tipografía display ya configurada, y patrones visuales de `/creditos` (hero con overlay, secciones con icono + título + subtítulo, tarjetas redondeadas con hover). Sin librerías nuevas.

## Fuera de alcance

- No se cambia copy de otras páginas.
- No se mueve contenido existente.
- No se tocan rutas API, DB ni lógica de negocio.
