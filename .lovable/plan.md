## Objetivo

Llevar la experiencia "wizard" del reporte de incidentes a los otros 4 formularios de alta del sistema: `MissingForm` (desaparecidos), `PatientForm` (atendidos), `NeedForm` (necesidades) y `OfferForm` (ofertas). Cada formulario usará la cantidad de pasos que mejor le calce, reutilizando un único componente `<Wizard>` con la misma estética del wizard de reportes (barra de progreso naranja, "Paso N de M", botones Atrás/Siguiente/Enviar, validación por paso).

## 1. Componente reutilizable

Crear `src/components/wizard/Wizard.tsx` con:

- Props:
  - `title: string`
  - `steps: { key: string; label: string; isValid: () => boolean; content: ReactNode }[]`
  - `submitLabel?: string` (por defecto "Enviar")
  - `onSubmit: () => Promise<void> | void`
  - `submitting?: boolean`
  - `onCancel?: () => void`
- Estado interno: `currentStep` (0..N-1).
- UI: header con título + chip "Paso N de M", barra de progreso segmentada (mismo estilo `--sunrise` que `ReportForm`), etiqueta del paso, contenedor del contenido del paso activo, y footer con botones:
  - Paso 1 → solo "Siguiente" (+ opcional "Cancelar").
  - Pasos intermedios → "Atrás" + "Siguiente".
  - Último paso → "Atrás" + botón principal "Enviar" (con loader).
- Validación: `goNext` llama `steps[current].isValid()`; si falla, muestra `toast.error` con mensaje del paso (prop opcional `invalidMessage` por paso).
- Accesibilidad: `role="progressbar"` con `aria-valuenow/min/max`, `aria-current` en step activo, botones con `min-h-[48px]`.
- Sin lógica de datos; cada formulario sigue dueño de su estado y submit.

Opcional pequeño: `src/components/wizard/useWizardSteps.ts` si simplifica memoización, pero no es obligatorio.

## 2. Migración por formulario

Mantener exactamente la misma lógica de submit, validaciones y campos actuales; solo se reorganiza la presentación en pasos.

### a. `MissingForm` (en `src/routes/desaparecidos.tsx`) — **3 pasos**

1. **Persona**: nombre, edad, foto, descripción/señas particulares.
2. **Última ubicación**: dirección + `LocationSelect` (Estado/Municipio/Parroquia) + mapa / geolocate + coords (reutilizar `MiniMap`/`MapView` como ya hace el form).
3. **Contacto**: nombre, teléfono, email del reportante + confirmación.

### b. `PatientForm` (en `src/routes/pacientes.tsx`) — **2 pasos**

1. **Datos del atendido**: nombre, edad, sexo, estado del atendido (status), notas.
2. **Centro y ubicación**: `HealthCenterPicker` (autocompleta estado/sector) + override manual de Estado/Sector si aplica + contacto opcional.

### c. `NeedForm` (en `src/routes/necesidades.tsx`) — **3 pasos**

1. **Qué se necesita**: categoría/tipo, título, descripción, cantidad, urgencia.
2. **Dónde**: `HealthCenterPicker` o ubicación libre + Estado/Municipio/Parroquia.
3. **Contacto**: nombre + teléfono/email + confirmación.

### d. `OfferForm` (en `src/routes/ofertas.tsx`) — **3 pasos**

1. **Qué ofreces**: categoría/tipo, título, descripción, cantidad/capacidad.
2. **Disponibilidad y zona**: ubicación (estado/municipio o radio), fecha/horario si existe.
3. **Contacto**: nombre + teléfono/email + confirmación.

En cada caso:
- Reemplazar el `<form onSubmit={submit}>` actual por `<Wizard ... onSubmit={submit} />`.
- Mover los campos al `content` del paso correspondiente sin cambiar nombres ni tipos de estado.
- Mantener el toggle `showForm` y el `onDone` igual.

## 3. Estética y consistencia

- Mismas clases de input que `ReportForm` (`field` helper) para que los 5 formularios se vean idénticos.
- Mismos colores: progreso `--sunrise`, foco `--sky`, texto `--midnight`.
- Mobile-first: pasos verticales con secciones espaciadas (`space-y-6/7`), botones a ancho completo en footer en móvil y alineados a la derecha en desktop.

## 4. Fuera de alcance

- No tocar esquemas de DB, hooks (`useMissing`, `usePatients`, etc.), ni RLS.
- No cambiar el wizard de reportes existente (solo se referencia su look).
- Sin nuevos campos: solo redistribución visual.

## Archivos a tocar

- **Nuevos**: `src/components/wizard/Wizard.tsx` (y posiblemente `useWizardSteps.ts`).
- **Editados**: `src/routes/desaparecidos.tsx`, `src/routes/pacientes.tsx`, `src/routes/necesidades.tsx`, `src/routes/ofertas.tsx`.

## Entregables

1. Componente `<Wizard>` reutilizable y documentado por props.
2. Los 4 formularios (`MissingForm`, `PatientForm`, `NeedForm`, `OfferForm`) migrados a wizard con la cantidad de pasos indicada.
3. Misma funcionalidad y validaciones que hoy, con UX consistente con el wizard de `ReportForm`.
