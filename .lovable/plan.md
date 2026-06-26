## Estado actual

`patients` (337 importados de hospitales) y `missing_persons` (~11k registros) no tienen ningún vínculo en BD ni en UI. Campos que podrían coincidir:

- `patients.name` + `age` + `id_number` (cédula) + `phone`
- `missing_persons.name` + `age` + `contact_phone`

No hay cédula en `missing_persons`, así que el match fuerte es por **nombre normalizado + edad ±1**, con phone como confirmación secundaria.

## Objetivo

Permitir que una persona reportada como desaparecida aparezca como "localizada en hospital X" cuando coincide con un paciente registrado, y viceversa.

## Cambios propuestos

### 1. Base de datos (migración)

- Agregar `missing_persons.matched_patient_id uuid REFERENCES patients(id)` y `missing_persons.match_confidence text` ('auto' | 'confirmed' | 'rejected').
- Agregar `patients.matched_missing_id uuid REFERENCES missing_persons(id)` (espejo, opcional pero útil para queries directas).
- Índices trigram sobre `missing_persons.name` (ya existe en patients) para acelerar fuzzy match.
- Función `public.suggest_patient_matches(p_missing_id uuid)` que devuelve candidatos usando `similarity(name)` ≥ 0.6 y `abs(age - age) ≤ 2`.
- Función `public.link_missing_to_patient(p_missing_id, p_patient_id)` SECURITY DEFINER que escribe ambos lados y marca `status='found'` en `missing_persons` con `found_date = now()`.

### 2. Job de matching automático (opcional, fase 2)

Trigger `AFTER INSERT` sobre `patients` que busca desaparecidos con `similarity(name) ≥ 0.85` y edad ±1 → marca `match_confidence='auto'` para revisión humana, sin cambiar `status` aún.

### 3. UI

- **`/desaparecidos` (tarjeta)**: si `matched_patient_id` existe, badge verde "Localizado/a en {hospital}" con link al detalle del paciente.
- **`/pacientes` (tarjeta)**: si `matched_missing_id` existe, badge ámbar "Reportado/a como desaparecido/a" con link a la ficha.
- **Detalle de desaparecido (`ReportDetailSheet` o equivalente)**: sección "Posibles coincidencias en hospitales" que llama a `suggest_patient_matches` y muestra 0-5 candidatos con botón "Confirmar coincidencia" (llama `link_missing_to_patient`).
- **Detalle de paciente**: sección espejo "Posibles desaparecidos que coinciden".

### 4. Permisos

- `suggest_patient_matches`: `GRANT EXECUTE TO anon, authenticated` (solo devuelve nombre + hospital, datos ya públicos).
- `link_missing_to_patient`: `GRANT EXECUTE TO authenticated` y dentro chequear `has_role(auth.uid(), 'admin')` o `'moderator'`. Voluntarios sin rol no deben poder marcar "encontrado" — es un dato sensible para familias.

### 5. Stats

En `/estadisticas` agregar KPI "Desaparecidos localizados en hospitales" con conteo de `missing_persons WHERE matched_patient_id IS NOT NULL`.

## Decisiones que necesito de ti antes de implementar

1. **¿Match automático o solo sugerencias?** Recomiendo solo sugerencias + confirmación humana en fase 1 — un falso positivo en "encontrado" es muy doloroso para una familia.
2. **¿Quién puede confirmar el link?** ¿Solo admins/moderadores, o cualquier usuario autenticado?
3. **¿Mostrar datos de contacto del paciente (teléfono) a quien reportó al desaparecido?** Implica revisar políticas RLS de `patients`.
