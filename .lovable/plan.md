## Qué hay disponible en `health_centers`

De los 1.419 centros activos:

| Campo | Cobertura | Útil para autocompletar |
|---|---|---|
| `name` | 100% | nombre del centro |
| `lat` / `lng` | 100% | coordenadas (mapa) |
| `type` | 100% | tipo (Hospital, Ambulatorio, CDI…) |
| `address` | 39% | dirección |
| `city` | 40% | municipio |
| `state` | 4% | estado |
| `phone` | 7% | teléfono |

Hoy el `HealthCenterPicker` solo devuelve el **nombre**, así que toda esa información se pierde aunque el usuario elija un centro conocido.

## Cambios propuestos (solo UI, sin tocar el schema)

### 1. `src/hooks/useHealthCenters.ts`
- Traer también `lat`, `lng`, `state`, `phone`, `type` (ya trae `id`, `name`, `city`, `address`).

### 2. `src/components/HealthCenterPicker.tsx`
- Cambiar la firma del callback a `onChange(name, center?)` para entregar el centro completo cuando se elige uno del listado (y `undefined` cuando es texto libre / "usar como nuevo").
- Mantener compatibilidad: si el consumidor solo usa el primer argumento, sigue funcionando.

### 3. `src/routes/pacientes.tsx`
- Cuando se selecciona un centro, autocompletar:
  - `center_address` ← `address` (o `city, state` si no hay dirección)
  - `center_lat` ← `lat`
  - `center_lng` ← `lng`
- Mostrar bajo el picker un mini-resumen "📍 dirección · 📞 teléfono" cuando el centro lo tenga, en modo solo lectura.
- Los campos siguen siendo editables por si el usuario quiere ajustar.

### 4. `src/routes/necesidades.tsx`
- Mismo comportamiento: autocompletar `center_address`, `lat`, `lng` al elegir un centro.
- Mostrar el mismo resumen informativo.

## Lo que NO cambia

- Esquema de base de datos.
- Lógica del backend / RPCs / matching.
- Posibilidad de escribir un centro nuevo a mano (sigue funcionando, sin autocompletar).
- Otros formularios (reportes, desaparecidos) que no usan el picker.

## Detalles técnicos

- El picker pasa el objeto completo del centro, así evitamos un segundo lookup en los consumidores.
- La selección de un centro nuevo (`"Usar X como nuevo centro"`) invoca `onChange(name, undefined)` para que los consumidores limpien `lat/lng/address` y permitan que el usuario los rellene a mano.
- Si el centro elegido no tiene `lat/lng` válidos (no debería pasar, pero por defensa), no se sobreescriben los valores actuales del formulario.
