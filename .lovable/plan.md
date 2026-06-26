## Diagnóstico

Reviso `src/server.ts`, `src/router.tsx`, `src/routes/__root.tsx`, `vite.config.ts`, `src/lib/pwa-register.ts` y la operativa del VPS (PM2 fork, single process). Hay tres familias de causas probables que explican los dos síntomas:

### 1) "El sitio no se renderiza completo" → casi siempre es el Service Worker sirviendo HTML viejo
- `vite.config.ts` registra VitePWA con `registerType: "autoUpdate"` y `globPatterns: ["**/*.{js,css,html,…}"]`.
- En SSR (Nitro `node-server`) el HTML es dinámico, pero el SW precachea el shell y queda apuntando a chunks hasheados (`/_build/assets/xxxx.js`) de un build anterior.
- Después de cada `bun run build && pm2 restart`, los usuarios con SW activo cargan HTML viejo → los chunks ya no existen → pantalla en blanco, header pero sin contenido, o errores `ChunkLoadError` silenciosos.
- Además hay dos SW (`/sw.js` de VitePWA y `/push-sw.js` para notificaciones) y `pwa-register.ts` solo desregistra el primero — riesgo de scopes que se pisan.

### 2) "Servidor no encontrado" → PM2 fork mode con un único proceso
- Producción corre con `pm2 … fork` (un proceso Node en :3000). Cualquier excepción no atrapada, OOM, o request lenta que sature el event loop tumba el sitio entero hasta que PM2 reinicia (1–3 s de 502 desde nginx).
- No hay healthcheck ni `max_memory_restart`, ni `instances: "max"`.
- El wrapper `src/server.ts` captura errores SSR pero los `console.error` se pierden si PM2 no rota logs o el disco se llena.

### 3) Riesgos secundarios que amplifican lo anterior
- `defaultPreloadStaleTime: 0` + preload on hover/visible dispara muchas queries SSR al hover; combinado con `/pacientes` cargando hasta 2 000 registros sin paginar, un pico puede tumbar el fork.
- `runtimeCaching` cachea TODO `*.supabase.co/*` con NetworkFirst 5 s (incluye auth y realtime). Tras un deploy o cuando Supabase tarda, devuelve respuestas viejas y la UI queda en estado raro.
- El handler que normaliza errores de h3 lee `response.clone().text()` en cada 5xx — útil, pero si el body es grande puede bloquear; aceptable, sin cambios.

## Plan de cambios

### A. Eliminar el problema del SW desactualizado (impacto inmediato en "no renderiza")
1. En `vite.config.ts → VitePWA`:
   - Quitar `html` de `globPatterns` (precachear solo `js,css,ico,png,svg,jpg,webp`).
   - Añadir `cleanupOutdatedCaches: true` y `skipWaiting: true`, `clientsClaim: true`.
   - Agregar `navigateFallback: null` explícito para que el SW jamás sirva HTML.
   - Quitar el `runtimeCaching` genérico de `*.supabase.co/*` (deja solo tiles OSM). Las llamadas a Supabase deben ir siempre a red.
2. En `src/lib/pwa-register.ts`:
   - Tras `register`, llamar `registration.update()` y, si hay `waiting`, hacer `postMessage({type:'SKIP_WAITING'})` para forzar activación.
   - Escuchar `controllerchange` y hacer `location.reload()` una sola vez (flag en `sessionStorage`) para que los usuarios con SW viejo carguen el build nuevo automáticamente.
   - Desregistrar también `/push-sw.js` viejo si está en scope `/` para evitar colisiones; mantenerlo solo si lo registra otro módulo.
3. Publicar un endpoint `/__sw-reset` (estático) y un botón discreto en el footer "Recargar versión nueva" que desregistre SW + recargue, para apoyar a usuarios trabados.

### B. Endurecer el proceso en el VPS (impacto en "servidor no encontrado")
4. Actualizar `ecosystem.config.cjs` (documentado, sin tocar deploy.sh):
   - `instances: "max"`, `exec_mode: "cluster"` para tolerar caídas de un worker.
   - `max_memory_restart: "700M"`, `kill_timeout: 8000`, `listen_timeout: 8000`.
   - `out_file`/`error_file` con rotación (`pm2 install pm2-logrotate` documentado).
5. Añadir ruta `GET /api/public/health` que responde `{ ok: true, build: <hash>, ts }`. Sirve para:
   - Healthcheck de nginx/uptime.
   - Que el cliente compare `build` cada N minutos y, si cambió, fuerce update del SW.
6. Documentar (sin cambiar `deploy.sh`) ajuste recomendado de nginx: `proxy_next_upstream error timeout http_502` y `proxy_read_timeout 30s`, para que un reinicio no devuelva "servidor no encontrado".

### C. Visibilidad de fallos (para dejar de adivinar)
7. En `src/server.ts`: además de `console.error`, mandar los 5xx normalizados a un endpoint `/api/public/hooks` (ya existe) con `{ path, status, message, stack, build }`. Persistir en tabla `server_errors` (nueva, RLS solo service_role) para poder revisar incidentes reales.
8. En el cliente, dentro de `ErrorComponent` y un `window.addEventListener('error'/'unhandledrejection')`, reportar `ChunkLoadError` específicamente y forzar `unregister + reload` (es la firma clásica del SW viejo).

### D. Quitar amplificadores
9. `/pacientes`: cambiar el `limit=2000` por paginación por cursor (mismo patrón ya usado en `/desaparecidos`).
10. `router.tsx`: subir `defaultPreloadStaleTime` a `30_000` para no relanzar queries en cada hover.

## Orden de ejecución sugerido

1. A1–A2 (SW) + C8 (auto-reload en ChunkLoadError) — soluciona el síntoma visible hoy.
2. B4–B5 (cluster + health) — corta los 502 intermitentes.
3. C7 + D9–D10 — telemetría y carga.
4. A3 + B6 — pulido.

## Lo que NO toco

- `deploy.sh` y el pipeline de GitHub Actions.
- `vite.config.ts → nitro: { preset: "node-server" }`.
- Cliente Supabase del browser; las reglas del backend (`fetch` directo en rutas API) se mantienen.
- Esquema de base de datos existente (solo añado tabla `server_errors` en C7).

¿Avanzo con el plan completo, o prefieres que arranque solo por el bloque A (Service Worker) que es el que más usuarios desbloquea de inmediato?
