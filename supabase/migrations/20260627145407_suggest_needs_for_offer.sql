-- ============================================================
-- Fase 3 — Matching por cercanía needs↔offers.
-- RPC estilo suggest_patient_matches: dada una oferta (categoría +
-- ubicación), devuelve el top de necesidades abiertas cercanas.
-- Orden: tier DIVIPOL (parroquia > municipio > estado > otra) → urgencia
-- → distancia haversine (km). SIN extensiones (SQL puro). Idempotente.
-- ============================================================
create or replace function public.suggest_needs_for_offer(
  p_category     text,
  p_lat          double precision,
  p_lng          double precision,
  p_state        text,
  p_municipality text,
  p_parish       text
)
returns table (
  need_id       uuid,
  title         text,
  category      text,
  urgency       text,
  status        text,
  center_name   text,
  state         text,
  municipality  text,
  parish        text,
  lat           double precision,
  lng           double precision,
  site_id       uuid,
  contact_name  text,
  contact_phone text,
  tier          int,
  distance_km   double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    n.id, n.title, n.category, n.urgency, n.status, n.center_name,
    n.state, n.municipality, n.parish, n.lat, n.lng, n.site_id,
    n.contact_name, n.contact_phone,
    -- Tier territorial: 0=misma parroquia … 3=otra zona
    case
      when p_parish is not null and n.parish is not null
           and lower(n.parish) = lower(p_parish) then 0
      when p_municipality is not null and n.municipality is not null
           and lower(n.municipality) = lower(p_municipality) then 1
      when p_state is not null and n.state is not null
           and lower(n.state) = lower(p_state) then 2
      else 3
    end as tier,
    -- Distancia haversine (km) si ambas coordenadas existen
    case
      when p_lat is not null and p_lng is not null and n.lat is not null and n.lng is not null then
        6371 * 2 * asin(least(1, sqrt(
          power(sin(radians(n.lat - p_lat) / 2), 2) +
          cos(radians(p_lat)) * cos(radians(n.lat)) *
          power(sin(radians(n.lng - p_lng) / 2), 2)
        )))
      else null
    end as distance_km
  from public.needs n
  where n.status in ('open', 'partial')
    and (p_category is null or n.category = p_category)
  order by
    tier asc,
    case n.urgency
      when 'critical' then 0 when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4
    end asc,
    distance_km asc nulls last,
    n.created_at desc
  limit 8;
$$;

grant execute on function public.suggest_needs_for_offer(
  text, double precision, double precision, text, text, text
) to anon, authenticated;

-- DOWN: drop function if exists public.suggest_needs_for_offer(text, double precision, double precision, text, text, text);
