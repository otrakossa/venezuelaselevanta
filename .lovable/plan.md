## Objetivo
Llevar el chat de Tsunami de un MVP funcional a una experiencia conversacional pulida, cálida y accionable — manteniendo todo dentro del chat (sin enlaces externos) y respetando AI Elements + el contrato de chat-agent.

## Cambios propuestos (`src/routes/tsunami.tsx` salvo donde se indique)

### 1. Empty state más útil y humano
- Reemplazar el grid de 4 sugerencias planas por **2 secciones temáticas con icono y descripción corta**:
  - "Buscar a alguien" → buscar por nombre / por cédula / ver coincidencias en hospitales.
  - "Ayudar" → ver necesidades activas cerca / ofrecer ayuda / registrar desaparecido.
- Cada chip envía un prompt concreto y precargado al hacer click.
- Frase de bienvenida más cálida, con la hora del día ("Buenos días" / "Buenas tardes") y nombre del perrito en grande.
- Agregar línea de privacidad: "Solo tú ves esta conversación en este navegador."

### 2. Composer (PromptInput)
- **Chips de acción rápida** sobre el textarea, siempre visibles (no solo en empty state): "🔎 Buscar", "📝 Registrar desaparecido", "🆘 Necesidades", "🤝 Ofrecer ayuda". Se ocultan automáticamente cuando hay más de 6 mensajes para no estorbar.
- **Botón "Detener"** durante streaming (`status === "streaming"`) que llama `stop()` de `useChat`; reemplaza el submit deshabilitado.
- **Contador sutil** de caracteres solo cuando supere 500.
- **Atajo de teclado** Enter = enviar, Shift+Enter = nueva línea (verificar comportamiento actual de PromptInputTextarea; documentar en placeholder).
- Placeholder rotativo cada cierto tiempo con ejemplos reales ("Busca a Juan Pérez", "Tengo medicinas para donar en Caracas"...).

### 3. Mensajes
- **Avatar de Tsunami** (huellita 🐾 / emoji 🐶 en círculo) junto a cada mensaje del asistente, no solo en el header. Usuario sin avatar, alineado a la derecha.
- **Timestamp relativo** ("hace 2 min") al hacer hover/tap en el mensaje, en `text-[10px] text-muted-foreground`.
- **Acciones por mensaje del asistente** (al hover en desktop, siempre visibles en mobile):
  - Copiar texto (toast de confirmación).
  - Regenerar última respuesta (`regenerate()` de useChat) — solo en el último mensaje del asistente.
- **Mensaje del usuario**: contraste asegurado (bg-primary / text-primary-foreground) en lugar del actual `bg-secondary`, validado en ambos temas.
- **Markdown del asistente** ya va por `MessageResponse`; añadir estilos prose acotados (links subrayados, listas con espacio, code inline legible).

### 4. Tool calls — más legibles
- El accordion de Tool por defecto cerrado se mantiene, pero el **header del tool muestra un resumen humano** en español ("🔍 Buscando 'Juan Pérez'…", "🏥 Buscando coincidencias en hospitales…", "✅ Encontré 3 personas") en vez del nombre técnico del tool.
- La ficha rica (MissingFicha, NeedFicha, MatchList) se renderiza **fuera del accordion**, directamente en el flujo del mensaje, para que el usuario no tenga que abrir nada. El accordion queda solo para "ver detalles técnicos" (input/output crudo) opcionales.
- Loading state del tool: shimmer "Tsunami está buscando…" con icono específico por tool.

### 5. Persistencia y conversación
- **Botón "Nueva conversación"** con confirmación (AlertDialog) antes de borrar, para evitar pérdidas accidentales.
- Mostrar **conteo de mensajes** sutil en el header ("12 mensajes").
- Restaurar scroll al final al volver a abrir la pestaña.

### 6. Errores y estados
- Banner inline de error con botón "Reintentar" (en lugar de solo toast) cuando falla la respuesta.
- Detectar offline (`navigator.onLine`) y mostrar banner discreto "Sin conexión — Tsunami responderá cuando vuelvas".
- Mensaje específico cuando el stream se corta a la mitad: "Se cortó la respuesta — toca regenerar".

### 7. Mobile-first polish
- Header sticky con safe-area-inset-top.
- Composer con `pb-[max(env(safe-area-inset-bottom),12px)]`.
- Chips horizontales con scroll-x en mobile, grid en desktop.
- Tap targets ≥ 44px en todas las acciones.
- Tras enviar, el textarea se limpia y mantiene foco (ya funciona, validar en iOS).

### 8. Branding sutil
- Fondo del área de mensajes con gradiente muy suave de los tokens `--sunrise` y `--sky` al 3% de opacidad, sin afectar legibilidad.
- Bordes/acentos de fichas usan `--sunrise` en lugar de amber genérico.

## Fuera de alcance
- No se cambian las tools del servidor ni el system prompt.
- No se cambia la persistencia (sigue siendo una conversación en localStorage; ya validado por el usuario).
- No se agrega historial multi-thread.
- No se cambia el modelo ni el gateway.

## Archivos afectados
- `src/routes/tsunami.tsx` — refactor principal del UI.
- Posible nuevo componente `src/components/tsunami/QuickChips.tsx` para mantener el archivo legible.
- Posible nuevo componente `src/components/tsunami/MessageActions.tsx`.

## Validación
- Typecheck (`tsgo`).
- Probar en `/tsunami` flujos: empty state → buscar persona → coincidencias → confirmar/descartar → registrar nuevo → ofrecer ayuda.
- Verificar en viewport mobile (375px) y desktop.
- Verificar contraste de bubbles user/assistant.
