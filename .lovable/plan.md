Entiendo la frustración. No creo que sea necesario mandarlo directo a Claude en la VPS todavía; el problema ya se puede aislar desde aquí. Si después de aplicar este cambio sigue fallando solo en producción, sí te dejaré un bloque exacto para que Claude lo ejecute en la VPS.

## Diagnóstico real

La pantalla sí está enviando un token válido del proyecto nuevo (`advebubtfjgxwpjxprok`) y del usuario `kenny@codextecnologia.com`.

El `401 Unauthorized` viene del endpoint `/api/public/admin/health`, específicamente de esta validación:

```ts
GET /auth/v1/user
headers: {
  apikey: PROD_SUPABASE_ANON_KEY,
  Authorization: Bearer <token usuario>
}
```

La causa más probable ya no es el token del usuario, sino una de estas dos:

1. En el runtime del preview/VPS, `process.env.SUPABASE_URL` o `process.env.SUPABASE_PUBLISHABLE_KEY` todavía apuntan al proyecto viejo de Lovable Cloud, porque el endpoint los prioriza antes del hardcode nuevo.
2. El fallback hardcodeado funciona, pero el endpoint no expone suficiente diagnóstico seguro para distinguir si falla `auth/v1/user`, si falta header, o si el token pertenece a otro emisor.

## Plan de corrección

1. Cambiar `src/routes/api/public/admin/health.ts` para que la ruta de observabilidad use explícitamente el proyecto de producción nuevo por defecto:
   - URL: `https://advebubtfjgxwpjxprok.supabase.co`
   - publishable key del proyecto nuevo
   - Solo permitir override con variables específicas tipo `NEW_SUPABASE_URL` / `NEW_SUPABASE_PUBLISHABLE_KEY`, no con `SUPABASE_URL`, porque esas pueden estar apuntando al proyecto viejo en Lovable/preview.

2. Mejorar el error del endpoint sin filtrar secretos:
   - `401 Unauthorized: missing bearer` si no llega token.
   - `401 Unauthorized: token rejected by production auth` si falla `/auth/v1/user`.
   - `403 Forbidden: admin role required` si el usuario existe pero no tiene rol admin.
   - Incluir `authStatus` y `projectRef` no sensibles solo en desarrollo/preview para confirmar que está validando contra `advebubtfjgxwpjxprok`.

3. Corregir la pantalla `admin.observabilidad.tsx` para esperar explícitamente a que la sesión esté lista antes de llamar al endpoint:
   - Evitar llamadas tempranas con sesión parcial o token viejo.
   - Si hay token, enviar solo ese token actual.
   - Mostrar un mensaje distinto entre “sin sesión”, “no admin” y “token rechazado por backend”.

4. Verificar desde el navegador/preview:
   - Confirmar que la request a `/api/public/admin/health` ya no devuelve 401.
   - Si devuelve 403, el problema sería que `kenny@codextecnologia.com` no tiene rol admin en la tabla `user_roles` del proyecto nuevo.
   - Si devuelve 200, la observabilidad queda resuelta.

5. Si al publicar sigue fallando solo en la VPS, preparar un bloque para Claude con comandos exactos:
   - Revisar `.env` del VPS sin imprimir secretos.
   - Confirmar que `NEW_SUPABASE_URL` y/o `SUPABASE_URL` apuntan al proyecto nuevo.
   - Reiniciar PM2 con `--update-env`.
   - Probar el endpoint local con curl usando un token real desde la sesión.

## Resultado esperado

La observabilidad dejará de depender de variables ambiguas del proyecto viejo y validará el token contra la base/auth real de producción. Si queda algún fallo, el mensaje indicará exactamente si es sesión, rol admin o configuración de entorno.