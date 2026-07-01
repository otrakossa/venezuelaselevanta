## Estado de la base de datos de producción (`advebubtfjgxwpjxprok`)

Ya está aplicado (verificado): `missing_status_log`, `page_views`, `solidarity_stats`, columna `outcome`, `suggest_patient_matches_batch`, `dedupe_missing_persons_run`, `merge_missing_persons`, `set_missing_person_photo`, RLS y grants.

Quedan **3 pendientes** que no se pudieron aplicar automáticamente (las tools de migración apuntan al proyecto viejo). Ejecutar todo con:

```bash
psql "$NEW_SUPABASE_DB_URL" -f pendientes.sql
```

---

### 1. Bug crítico — `auto_link_missing_to_patient` está roto

La función escribe `status = 'encontrado'` (español), pero el `CHECK` de `missing_persons` solo acepta `'missing' | 'found' | 'deceased'`. Cualquier auto-vínculo desde el flujo de pacientes falla con violación de constraint.

```sql
CREATE OR REPLACE FUNCTION public.auto_link_missing_to_patient(
  p_missing_id uuid, p_patient_id uuid, p_score real DEFAULT 0
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE already_m boolean; already_p boolean;
BEGIN
  SELECT matched_patient_id IS NOT NULL INTO already_m
    FROM public.missing_persons WHERE id = p_missing_id;
  SELECT matched_missing_id  IS NOT NULL INTO already_p
    FROM public.patients        WHERE id = p_patient_id;
  IF already_m OR already_p THEN RETURN false; END IF;

  UPDATE public.missing_persons
     SET matched_patient_id = p_patient_id,
         matched_at         = now(),
         status             = 'found',                 -- FIX: era 'encontrado'
         outcome            = COALESCE(outcome, 'at_health_center'),
         found_date         = COALESCE(found_date, now())
   WHERE id = p_missing_id;

  UPDATE public.patients
     SET matched_missing_id = p_missing_id
   WHERE id = p_patient_id;

  INSERT INTO public.missing_status_log
    (missing_id, prev_status, new_status, new_outcome, note)
  VALUES
    (p_missing_id, 'missing', 'found', 'at_health_center',
     'auto-link patient=' || p_patient_id::text || ' score=' || p_score);

  RETURN true;
END; $$;
```

---

### 2. `set_missing_status` no soporta `outcome`

El admin panel ya envía outcomes (`at_health_center`, `with_family`, …), pero la función solo acepta 3 estados y no actualiza la columna `outcome` ni escribe en el log.

```sql
CREATE OR REPLACE FUNCTION public.set_missing_status(
  p_id uuid, p_status text, p_note text DEFAULT NULL, p_outcome text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); prev_s text; prev_o text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (public.has_role(uid,'admin') OR public.has_role(uid,'moderator')) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;
  IF p_status NOT IN ('missing','found','deceased') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  IF p_outcome IS NOT NULL AND p_outcome NOT IN
     ('at_health_center','with_family','relocated','deceased','other') THEN
    RAISE EXCEPTION 'invalid outcome';
  END IF;

  SELECT status, outcome INTO prev_s, prev_o FROM public.missing_persons WHERE id = p_id;

  UPDATE public.missing_persons
     SET status = p_status,
         outcome = CASE WHEN p_status = 'missing' THEN NULL ELSE p_outcome END,
         found_date = CASE WHEN p_status = 'missing' THEN NULL
                           WHEN found_date IS NULL THEN now() ELSE found_date END,
         description = CASE WHEN p_note IS NULL OR length(trim(p_note))=0 THEN description
                            ELSE COALESCE(description || E'\n','') ||
                                 '[' || now()::date || ' admin] ' || p_note END
   WHERE id = p_id;

  INSERT INTO public.missing_status_log
    (missing_id, prev_status, new_status, prev_outcome, new_outcome, changed_by, note)
  VALUES (p_id, prev_s, p_status, prev_o, p_outcome, uid, p_note);
END; $$;
```

---

### 3. Programar dedupe automático cada 8h (pg_cron)

El usuario aprobó frecuencia de 8h, umbral conservador y hard delete. La función `dedupe_missing_persons_run()` ya existe, pero `pg_cron` no está habilitado y no hay job programado.

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Corre 3 veces al día: 02:00, 10:00, 18:00 UTC (22h / 06h / 14h Caracas)
SELECT cron.schedule(
  'dedupe_missing_persons_8h',
  '0 2,10,18 * * *',
  $$ SELECT public.dedupe_missing_persons_run(); $$
);
```

Verificación después de correr:
```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'dedupe_missing_persons_8h';
```

---

### Notas

- Ningún cambio afecta el frontend — todo es DB. No hace falta redeploy del VPS.
- Los 3 bloques son idempotentes salvo `cron.schedule`: si ya existe el job, primero `SELECT cron.unschedule('dedupe_missing_persons_8h');`.
- Después de aplicar, el frontend puede empezar a pasar `p_outcome` al RPC `set_missing_status` (ya está listo del lado del admin; el 4º argumento simplemente empezará a persistir).
