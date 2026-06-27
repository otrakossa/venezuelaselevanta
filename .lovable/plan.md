## Problema

`/admin/observabilidad` siempre muestra **"Error al leer métricas: Unauthorized"**.

## Causa raíz

En `src/routes/api/public/admin/health.ts`, la constante hardcodeada `PROD_SUPABASE_ANON_KEY` está **mal formada**. Su payload JWT decodificado es:

```
{"iss":"supabebubtfjgxwpjxprok","role":"anon", ...}   ← INCORRECTO
```

La anon key real del proyecto `advebubtfjgxwpjxprok` (la que usa `src/integrations/supabase/client.ts` y funciona en todo el resto de la app) es:

```
{"iss":"supabase","ref":"advebubtfjgxwpjxprok","role":"anon", ...}   ← CORRECTO
```

Supabase Auth valida el header `apikey` contra las llaves reales del proyecto. Como la key hardcodeada en `health.ts` no coincide con ninguna, **todas** las llamadas a `GET /auth/v1/user` y al RPC `has_role` devuelven 401 antes de evaluar el bearer token del admin. Por eso el endpoint siempre responde `Unauthorized`, independientemente del usuario.

## Arreglo

Un único cambio en `src/routes/api/public/admin/health.ts`:

1. Reemplazar el valor de `PROD_SUPABASE_ANON_KEY` por la anon key correcta — la misma cadena que ya está en `src/integrations/supabase/client.ts` (`...eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdmVidWJ0ZmpneHdwanhwcm9rIi...`).
2. Para evitar que vuelva a pasar, leer primero `process.env.SUPABASE_PUBLISHABLE_KEY` y caer al literal solo si está vacío (en el VPS la env ya existe; en el preview de Lovable la env apunta al proyecto viejo, así que el literal correcto es el fallback necesario).

No se tocan UI, frontend, ni la lógica del handler — solo se corrige la constante.

## Verificación

1. Recargar `/admin/observabilidad` autenticado como `kenny@codextecnologia.com`.
2. Las tarjetas (memoria, CPU, disco, RSS) deben renderizar.
3. La tarjeta de Base de datos seguirá mostrando "RPC no disponible" hasta que se cree `admin_db_stats()` en producción (SQL ya provisto en la página) — es esperado y no es el bug actual.
