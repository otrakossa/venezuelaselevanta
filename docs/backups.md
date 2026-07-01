# Plan de backups — Venezuela Se Levanta

## Capas de respaldo

| Capa | Fuente | Frecuencia | Retención | Restaurable |
|------|--------|-----------|-----------|-------------|
| **1. Supabase gestionado** | Snapshots automáticos de la plataforma | Diario | 7 días | Sí, desde el panel del proveedor |
| **2. `pg_dump` en el VPS** | `scripts/backup-supabase.sh` vía cron | Diario 03:00 | 14 días locales | Sí, con `pg_restore` |
| **3. Exports CSV** | `\copy` de tablas clave | Semanal (domingos) | 60 días | Legible por humanos / auditoría |

La capa 1 la gestiona el proveedor. Las capas 2 y 3 corren en el VPS.

## Instalación en el VPS

1. Crear el directorio de backups (una sola vez):
   ```bash
   sudo mkdir -p /var/backups/vsl
   sudo chown $USER:$USER /var/backups/vsl
   ```

2. Verificar que `NEW_SUPABASE_DB_URL` está en el `.env` del VPS y exportado en el entorno donde corre el cron. El formato es:
   ```
   postgresql://postgres:<password>@db.advebubtfjgxwpjxprok.supabase.co:5432/postgres
   ```

3. Probar el script manualmente:
   ```bash
   cd /var/www/venezuelaselevanta
   source .env && export NEW_SUPABASE_DB_URL
   bash scripts/backup-supabase.sh
   ls -lh /var/backups/vsl/
   ```

4. Agregar al crontab del usuario que tenga acceso a las variables:
   ```cron
   0 3 * * * cd /var/www/venezuelaselevanta && set -a && . ./.env && set +a && bash scripts/backup-supabase.sh >> /var/log/vsl-backup.log 2>&1
   ```

## Restauración

**BD completa** (a un proyecto Supabase nuevo o de staging):
```bash
pg_restore \
  --no-owner --no-privileges \
  --clean --if-exists \
  -d "$TARGET_DB_URL" \
  /var/backups/vsl/vsl-YYYY-MM-DD_HHMM.dump
```

**Una sola tabla** (útil ante borrado accidental):
```bash
pg_restore -a -t missing_persons \
  -d "$TARGET_DB_URL" \
  /var/backups/vsl/vsl-YYYY-MM-DD_HHMM.dump
```

## Verificación mensual

Primer lunes de cada mes:
1. Copiar el último dump a un entorno de staging (Supabase secundario o Postgres local).
2. Restaurar con el comando de arriba.
3. Verificar que `SELECT COUNT(*) FROM missing_persons;` y `SELECT COUNT(*) FROM patients;` coincidan con producción ±1 %.
4. Registrar la fecha del test en este archivo.

| Fecha del test | Resultado | Notas |
|----------------|-----------|-------|
| _pendiente_    | —         | —     |

## Monitoreo externo

El endpoint `GET /api/public/health?deep=1` responde 503 si:
- La base de datos no responde.
- El scraper de pacientes no actualiza registros hace >24 h.

Configurar UptimeRobot / BetterStack apuntando a esa URL cada 5 minutos.
