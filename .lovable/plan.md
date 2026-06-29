
# Plan — Agente Tsunami (interfaz oculta para pruebas)

Crear un asistente conversacional llamado **Tsunami** (perrito de rescate, tono amigable y empático) accesible en una ruta oculta sin enlaces visibles, para iterar sin exponerlo al público.

## Acceso y privacidad

- Ruta nueva `src/routes/tsunami.tsx` — no se enlaza desde `Header`, `BottomNav`, `Footer` ni sitemap.
- Añadir `Disallow: /tsunami` a `public/robots.txt` y `noindex, nofollow` en el `head()` de la ruta.
- Sin auth (cualquiera con el link entra), pero invisible para la navegación normal.

## Conversación

- **Una sola conversación, en `localStorage`** (clave `tsunami:messages:v1`), con botón "Nueva conversación" que la limpia.
- Mensajes tipados como `UIMessage[]` del AI SDK; render por `message.parts`.
- Textarea con foco automático al cargar, después de enviar y tras stream completo.

## Backend (TanStack server route + AI SDK)

- Nuevo archivo `src/routes/api/tsunami.ts` con `POST` handler que usa `streamText` + `toUIMessageStreamResponse`.
- Provider: Lovable AI Gateway helper (`src/lib/ai-gateway.server.ts` — crear si no existe).
- Modelo por defecto: `google/gemini-3-flash-preview`.
- System prompt: define la personalidad de Tsunami (perrito rescatista venezolano, cálido, claro, breve, usa emojis con moderación 🐾), explica que es un asistente en pruebas, nunca inventa datos de personas, siempre cita el `id` cuando muestra una ficha y enlaza a `/desaparecidos?person=<id>`, `/necesidades?need=<id>`, etc.
- `stopWhen: stepCountIs(50)` para permitir múltiples tool calls encadenados.

## Tools del agente (todas server-side, lectura/escritura vía REST de Supabase con `fetchFromSupabase` siguiendo la regla del proyecto — sin `createClient` en server handlers)

1. **`search_missing_persons`** — input `{ query?: string, id_number?: string, limit?: number }`. Consulta `missing_persons` filtrando por `id_number` exacto o por `or(full_name.ilike,*)` escapado; devuelve hasta 10 fichas con id, nombre, edad, estado/municipio, status, foto y URL canónica.
2. **`get_missing_person`** — input `{ id }`. Devuelve la ficha completa para que el modelo la resuma.
3. **`suggest_patient_matches`** — input `{ missing_person_id }`. Llama el RPC ya existente y devuelve coincidencias resumidas.
4. **`register_missing_person`** — input validado con Zod (`full_name` requerido, `id_number?`, `age?`, `state?`, `municipality?`, `parish?`, `last_seen_description?`, `reporter_name?`, `reporter_phone?`). Marca `needsApproval: true` para que la UI muestre confirmación antes de insertar en `missing_persons`. Tras insertar devuelve `{ id, url }`.
5. **`list_needs`** — input `{ category?, state?, urgency?, limit? }`. Lee `needs` activas, devuelve resumen + link `/necesidades?need=<id>`.
6. **`get_need`** — input `{ id }`. Detalle de una necesidad para guiar a quien quiere ayudar.
7. **`guide_offer_help`** — sin DB write; devuelve estructura sugerida de oferta (categoría, descripción, contacto) y el deep-link `/ofertas?need=<id>` para abrir el wizard pre-rellenado. La creación real de la oferta se hace en la UI existente — Tsunami solo orienta.

Cada tool tiene `description` clara, `inputSchema` Zod, y resultados compactos (sin PII innecesaria — nunca expone `reporter_phone`/`reporter_cedula` de terceros; sí los acepta como input al registrar).

## UI (`src/routes/tsunami.tsx`)

- Componentes AI Elements: instalar `conversation message prompt-input shimmer tool` con `bun x ai-elements@latest add ...`.
- Layout: header compacto con avatar de Tsunami (emoji 🐶 + nombre + badge "Beta privada"), `Conversation` ocupa el alto disponible (`dvh`), `PromptInput` sticky abajo con `safe-area-inset-bottom`.
- Mensajes assistant sin fondo (render markdown con `MessageResponse`); user con bubble `primary`/`primary-foreground`.
- Tool calls colapsados por defecto (`<Tool defaultOpen={false}>`) mostrando nombre + estado.
- Para `register_missing_person` con `needsApproval`: render una tarjeta de confirmación con los datos extraídos y botones "Registrar" / "Editar" / "Cancelar".
- Render de resultados de búsqueda como tarjetas pequeñas con foto + nombre + link a la ficha (usa `Link to="/desaparecidos" search={{ person: id }}`).
- Estado vacío inicial: avatar grande de Tsunami + 4 chips de sugerencias ("Buscar a un familiar", "Registrar un desaparecido", "Ver necesidades cerca", "Quiero ayudar").
- Manejo de errores 402/429 del gateway con toast.

## Persistencia local

- Hook `useTsunamiHistory()` lee/escribe `localStorage` guardado por `typeof window !== "undefined"`, con efecto que persiste `messages` cuando cambian (deps completos, sin loops).
- Botón "Nueva conversación" limpia el array y vuelve a enfocar el textarea.

## Archivos a crear/editar

```
src/routes/tsunami.tsx                 (nuevo — UI del chat)
src/routes/api/tsunami.ts              (nuevo — streaming endpoint + tools)
src/lib/ai-gateway.server.ts           (nuevo si no existe — provider helper)
src/lib/tsunami-tools.server.ts        (nuevo — definiciones de tools + acceso REST a Supabase)
src/components/ai-elements/*           (instalado por CLI)
public/robots.txt                      (añadir Disallow: /tsunami)
```

No se modifican `Header`, `BottomNav`, `Footer`, sitemap, ni rutas existentes.

## Detalles técnicos clave

- `process.env.LOVABLE_API_KEY` se lee dentro del handler `POST`, nunca a nivel de módulo.
- Acceso a Supabase desde el server route: `fetch` directo con `apikey` + `Authorization: Bearer` usando `process.env.SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` (lectura). Para `register_missing_person` se usa también la publishable key (las policies de `missing_persons` ya permiten INSERT público).
- `inputValidator`/schemas en Zod, tools con outputs serializables y pequeños.
- SSR off en la ruta (`ssr: false`) para evitar prerender sin sesión local.
- Sin tracking ni analítica en esta ruta mientras esté en beta.

## Fuera de alcance (siguientes iteraciones)

- Voz / audio, multi-thread, persistencia en BD, login, métricas.
- Creación directa de ofertas desde el chat (por ahora solo guía + deep-link al wizard).
- Integración con WhatsApp / Telegram.
