## Nueva página: "Créditos y Colaboradores"

Crear una sección dedicada para reconocer a quienes hacen posible la plataforma.

### Ruta nueva
- `src/routes/creditos.tsx` → URL `/creditos`
- Metadata propia (title, description, og:title, og:description)

### Secciones de la página
1. **Hero corto** — mensaje de agradecimiento + CTA "¿Quieres colaborar?" (email/Telegram).
2. **Creadores / Equipo core** — tarjetas con avatar (iniciales o foto), nombre, rol y enlaces (X, GitHub, LinkedIn).
3. **Colaboradores** — grid más compacto de contribuidores (voluntarios, traductores, moderadores, verificadores).
4. **Organizaciones que apoyan** — logos en grid con enlace al sitio de cada organización. Tono neutro, mismo tamaño visual, escala de grises en hover→color.
5. **Tecnología y datos abiertos** — créditos a OpenStreetMap, Leaflet, shadcn/ui, Supabase/Lovable Cloud, etc. (requisito de atribución de OSM).
6. **Cómo unirse** — bloque final con formas de colaborar (reportar, verificar, donar tiempo, organización aliada → contacto).

### Datos
Contenido estático en `src/lib/credits.ts` (arrays tipados: `team`, `collaborators`, `organizations`, `tech`). Sin tabla en BD — es contenido editorial, fácil de editar luego. Si más adelante se quiere autoservicio, se puede migrar a una tabla `partners`.

### Integración en la app
- Enlace en el **footer** del Header / shell (nuevo footer minimal si no existe en mobile, o link en menú).
- Entrada en `BottomNav`? No — la barra ya está saturada; mejor enlace desde la página de inicio (hero → "Conoce al equipo") y desde un menú "Más" si fuera necesario. Por ahora: link en header + footer.
- Atribución de OpenStreetMap ya debe estar en el mapa; agregar link "Ver todos los créditos" → `/creditos`.

### Diseño
Respetar paleta existente (Sunrise / Gold / Sky / Midnight / Cream), tipografías Archivo Black + Hind. Tarjetas con bordes suaves, hover sutil. Mobile-first: 1 columna en móvil, 2-3 en desktop. Logos de organizaciones en `src/assets/partners/` (placeholder si no hay aún).

### Preguntas para ti antes de implementar
1. ¿Tienes ya nombres/roles del equipo core y colaboradores, o lo dejo con **placeholders editables** (ej: "Tu nombre aquí")?
2. ¿Hay organizaciones aliadas confirmadas para listar, o también placeholders?
3. ¿Quieres un formulario de "Quiero colaborar" que escriba a una tabla, o basta con un enlace `mailto:` / Telegram?

Puedo proceder con placeholders sensatos y un `mailto:contacto@venezuelaselevanta.info` si prefieres no decidir aún.