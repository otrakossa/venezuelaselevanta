## Problema

El botón flotante `+` (FAB para "Reportar") en la barra inferior móvil no responde al tap en algunos dispositivos.

## Causa

En `src/components/BottomNav.tsx`, dentro del `<Link to="/reportar">` hay un `<span>` decorativo con `animate-ping` posicionado `absolute inset-0` SIN `pointer-events-none`. En móvil (especialmente Safari iOS y algunos WebView de Android), ese span animado con transform/scale intercepta el touch y el `<Link>` nunca recibe el evento de navegación. En desktop el cursor "click" igual llega al ancla, por eso no se reproduce ahí.

Además, el icono `<Plus>` interno usa `relative` pero también podría beneficiarse de `pointer-events-none` para forzar que el tap siempre lo capture el `<Link>`.

## Cambios

Archivo único: `src/components/BottomNav.tsx`

1. Agregar `pointer-events-none` y `aria-hidden` al span del `animate-ping`.
2. Agregar `pointer-events-none` al `<Plus>` para que cualquier tap, incluso sobre el SVG, sea capturado por el `<Link>` padre.
3. Agregar `touch-manipulation` al `<Link>` para eliminar el retardo de 300ms y mejorar respuesta táctil.

No se tocan otros componentes ni el z-index/posicionamiento. El comportamiento visual (efecto ping pulsante) se mantiene idéntico.

## Verificación

- Probar en móvil real (o emulación táctil) que tocar el `+` navega a `/reportar`.
- Confirmar que el anillo de "ping" sigue animándose visualmente.
- Revisar que la navegación funcione tanto con el FAB cerrado como con el bottom sheet de la lista de reportes abierto.