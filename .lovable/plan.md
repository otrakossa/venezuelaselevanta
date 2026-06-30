## Objetivo
Tener `LOVABLE_API_KEY` válida en `/var/www/venezuelaselevanta/.env` para que Tsunami funcione en producción vía el Lovable AI Gateway.

## Paso 1 — Provisionar la key en Lovable (lo hago yo)

Al aprobar el plan, ejecuto en build mode:

- `ai_gateway--create` → asegura que el proyecto tenga `LOVABLE_API_KEY`. Si ya existe, no la cambia.
- (Opcional, recomendado si sospechas que se filtró en logs previos) `ai_gateway--rotate_lovable_api_key` → genera una nueva y revoca la anterior.

Luego uso `secrets--fetch_secrets` para mostrarte el **valor** de `LOVABLE_API_KEY` una sola vez en el chat. Cópialo de inmediato — no lo vuelvo a imprimir.

> Nota: en Lovable Cloud esta key se auto-provisiona y se cobra contra los créditos del workspace. No hay un panel público "copiar API key"; la única vía es a través de estas herramientas del agente.

## Paso 2 — Pegarla en el `.env` del VPS (lo haces tú por SSH)

Sustituye `PEGA_AQUI_LA_KEY` por el valor que te muestro:

```bash
ssh tu-user@tu-vps
cd /var/www/venezuelaselevanta

# Si ya existe la línea, la reemplaza; si no, la agrega
grep -q '^LOVABLE_API_KEY=' .env \
  && sed -i 's|^LOVABLE_API_KEY=.*|LOVABLE_API_KEY=PEGA_AQUI_LA_KEY|' .env \
  || echo 'LOVABLE_API_KEY=PEGA_AQUI_LA_KEY' >> .env

# Recargar PM2 con el nuevo entorno
pm2 restart venezuela-levanta --update-env
pm2 save
```

`ecosystem.config.cjs` ya parsea `.env` y lo inyecta como `process.env.*`, así que con esto `src/routes/api/tsunami.ts` deja de devolver `LOVABLE_API_KEY missing`.

## Paso 3 — Verificar

```bash
# En el VPS
pm2 logs venezuela-levanta --lines 30 --nostream

# Desde tu navegador
# Abre https://venezuelaselevanta.info/tsunami y haz una búsqueda por nombre.
# Debe responder normal; si falla, los logs mostrarán el error real del gateway.
```

## Decisión que necesito de ti antes de ejecutar

1. **¿Solo crear (si falta) o rotar?**
   - **Crear** → más rápido, no invalida nada. Recomendado si nunca expusiste la key.
   - **Rotar** → recomendado si la key pudo haberse filtrado (p. ej. apareció en logs/capturas). Invalida la anterior en ≤1h.

Responde "crear" o "rotar" y ejecuto el Paso 1; tú haces el Paso 2 con el valor que te paso.
