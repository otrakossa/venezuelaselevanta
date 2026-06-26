## Problema

1. **Datos sucios en `health_centers`**: hay 35 registros con nombres genéricos sin ubicación —25 son literalmente `"Ambulatorio"` sin `city` ni `address`, más duplicados de `"Barrio adentro"`, `"CDI"`, `"Alfa"`, etc. Son inútiles: el usuario no puede distinguir uno de otro.
2. **Picker limita a 50 resultados**: al buscar (p. ej. "hospital") solo aparecen los primeros 50 de potencialmente cientos, sin indicador de que hay más.

## Cambios

### 1. Migración de limpieza de datos
Eliminar registros genéricos sin información útil:
```sql
DELETE FROM public.health_centers
WHERE address IS NULL
  AND city IS NULL
  AND lower(trim(name)) IN ('ambulatorio','hospital','cdi','barrio adentro','alfa','clinica','clínica');
```
Esto borra los ~30 registros chatarra; los que sí tienen `city` (p. ej. "Ambulatorio – Tabay") se conservan.

### 2. `src/components/HealthCenterPicker.tsx`
- **Quitar el tope hardcodeado de 50**. Sin búsqueda: mostrar los primeros 100 con un aviso "Escribe para buscar entre 1.4k centros". Con búsqueda: mostrar **todos** los matches (no cortar).
- **Mostrar el conteo real** en el encabezado del grupo: "234 resultados" en lugar de "50".
- **Virtualización ligera**: si los resultados pasan de 200, renderizar solo los primeros 200 y agregar un item final tipo "…afina la búsqueda para ver más" para evitar lag del DOM. Es más simple que añadir `react-window` y suficiente para 1.4k filas.
- **Mejor etiqueta cuando falta ubicación**: si un centro no tiene `city` ni `state`, mostrar el `address` truncado o `(ubicación no registrada)` en la línea secundaria, así el usuario sabe que es ambiguo.
- **Ordenar resultados**: priorizar los que empiezan por el término buscado, luego los que lo contienen; dentro de cada grupo, primero los que tienen `city`.

### 3. Sin cambios en `/pacientes` ni `/necesidades`
Solo consumen el picker; el comportamiento mejora automáticamente.

## Lo que NO cambia
- Esquema de `health_centers` (no se añaden columnas).
- Almacenamiento del campo `center_name` como string libre en `patients`/`needs`.
- Opción de "Usar X como nuevo centro" cuando no hay match exacto.
