Respuesta corta: no hay una forma segura/soportada de “ver” o copiar el valor de `LOVABLE_API_KEY` desde Lovable para pegarlo en el VPS. Es una clave administrada por Lovable; se puede crear o rotar, pero el valor no se expone al agente ni al usuario después. El endpoint temporal `_reveal-key` fue un intento de puente, pero no es confiable ni recomendable: en preview puede quedar detrás de auth-bridge y además supone exponer un secreto que no debería salir del runtime de Lovable.

Plan recomendado para resolverlo sin exponer la clave:

1. Eliminar el endpoint temporal inseguro
   - Borrar `src/routes/api/public/_reveal-key.ts`.
   - No volver a intentar revelar `LOVABLE_API_KEY` por HTTP.

2. Mantener `LOVABLE_API_KEY` solo dentro de Lovable
   - La llamada real al Lovable AI Gateway debe ejecutarse en un handler alojado por Lovable, donde esa variable sí existe.
   - El VPS no necesita tener `LOVABLE_API_KEY` en su `.env`.

3. Hacer que producción use una de estas dos rutas

   Opción A, recomendada si quieres seguir usando Lovable AI Gateway:
   - Crear/ajustar un endpoint proxy de Tsunami en Lovable que llame al AI Gateway internamente.
   - Configurar el frontend/VPS para que `/api/tsunami` reenvíe la petición a ese endpoint Lovable.
   - Añadir protección mínima: token interno, validación de origen y manejo claro de 429/402/errores.
   - Resultado: Tsunami funciona en `venezuelaselevanta.info` sin copiar `LOVABLE_API_KEY` al VPS.

   Opción B, inmediata y más simple porque ya tienes `GEMINI_API_KEY` en el VPS:
   - Cambiar `/api/tsunami` para usar Lovable AI Gateway cuando `LOVABLE_API_KEY` exista.
   - Si no existe, usar Gemini directo con `GEMINI_API_KEY` como fallback.
   - Resultado: Tsunami funciona hoy en el VPS, pero las llamadas de producción no pasarían por Lovable Gateway.

4. Mi recomendación práctica
   - Para resolver rápido: implementar fallback con `GEMINI_API_KEY`.
   - Para mantener Lovable AI Gateway a largo plazo: usar proxy alojado en Lovable, no intentar extraer la clave.

5. Comandos que NO recomiendo usar
   - No recomiendo seguir con `curl https://.../_reveal-key?...`.
   - No recomiendo guardar tokens revelados por endpoints temporales.
   - No recomiendo rotar de nuevo `LOVABLE_API_KEY`, porque rotarla tampoco mostrará el valor.

Si quieres, implemento la Opción B ahora para que Tsunami deje de fallar inmediatamente en el VPS, y después dejamos la Opción A como mejora de arquitectura.