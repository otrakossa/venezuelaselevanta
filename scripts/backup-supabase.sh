#!/usr/bin/env bash
# Venezuela Se Levanta — backup diario de la base de datos de producción.
#
# Requisitos en el VPS:
#   - postgresql-client (pg_dump 15+ compatible con Supabase)
#   - variable de entorno NEW_SUPABASE_DB_URL apuntando a la BD de producción
#
# Uso:
#   bash scripts/backup-supabase.sh
#   (o desde cron: 0 3 * * * /var/www/venezuelaselevanta/scripts/backup-supabase.sh)
#
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/vsl}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DB_URL="${NEW_SUPABASE_DB_URL:-}"

if [[ -z "$DB_URL" ]]; then
  echo "[backup] ERROR: NEW_SUPABASE_DB_URL no está definido en el entorno." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F_%H%M)"
OUT="$BACKUP_DIR/vsl-$STAMP.dump"
LOG="$BACKUP_DIR/vsl-$STAMP.log"

echo "[backup] iniciando $STAMP"
# -Fc = custom format (comprimido, restaurable con pg_restore)
# --no-owner --no-privileges = portable entre proyectos Supabase
pg_dump "$DB_URL" \
  -Fc \
  --no-owner \
  --no-privileges \
  -f "$OUT" 2> "$LOG"

SIZE=$(du -h "$OUT" | cut -f1)
echo "[backup] OK → $OUT ($SIZE)"

# Rotación: conservar últimos N días
find "$BACKUP_DIR" -name 'vsl-*.dump' -type f -mtime "+$RETENTION_DAYS" -print -delete
find "$BACKUP_DIR" -name 'vsl-*.log'  -type f -mtime "+$RETENTION_DAYS" -print -delete

# Export humano legible (CSV) — semanal (domingos)
if [[ "$(date +%u)" == "7" ]]; then
  EXPORT_DIR="$BACKUP_DIR/exports"
  mkdir -p "$EXPORT_DIR"
  for T in missing_persons patients needs offers; do
    OUT_CSV="$EXPORT_DIR/${T}-$STAMP.csv"
    psql "$DB_URL" -c "\copy (SELECT * FROM public.${T}) TO STDOUT WITH CSV HEADER" \
      > "$OUT_CSV" 2>> "$LOG" || echo "[backup] WARN: export $T falló"
  done
  find "$EXPORT_DIR" -name '*.csv' -type f -mtime +60 -delete
fi

echo "[backup] listo"
