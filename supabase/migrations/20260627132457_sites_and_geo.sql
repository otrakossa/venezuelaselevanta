-- ============================================================
-- Fase 0 — Cimientos de datos
-- Entidad geográfica `sites` (punto de primera clase),
-- responsables de punto (`site_responsibles`), y DIVIPOL + geo
-- en `needs` / `offers`.
--
-- TODO ADITIVO, IDEMPOTENTE Y REVERSIBLE. No cambia comportamiento:
-- ningún código lee aún estas columnas/tablas. SIN CHECK constraints
-- (vocabularios validados en la app, con fallbacks catMeta/urgMeta).
-- Convención DIVIPOL = state / municipality / parish (igual que reports).
--
-- DOWN (rollback) documentado al final, en comentario.
-- ============================================================

-- set_updated_at ya existe (creada en ...060714/060715); referencia segura.

-- ---------- sites: punto geográfico de primera clase ----------
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'otro',          -- hospital | acopio | rescate | salud | otro (extensible, SIN CHECK)
  name text not null,
  description text,
  lat double precision,
  lng double precision,
  state text,
  municipality text,
  parish text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.sites to anon, authenticated;
grant all on public.sites to service_role;
alter table public.sites enable row level security;
drop policy if exists "sites public read"   on public.sites;
create policy "sites public read"   on public.sites for select using (true);
drop policy if exists "sites public insert" on public.sites;
create policy "sites public insert" on public.sites for insert with check (true);
drop policy if exists "sites public update" on public.sites;
create policy "sites public update" on public.sites for update using (true) with check (true);
drop trigger if exists sites_updated_at on public.sites;
create trigger sites_updated_at before update on public.sites
  for each row execute function public.set_updated_at();
create index if not exists sites_divipol_idx on public.sites(state, municipality, parish);
create index if not exists sites_lat_lng_idx on public.sites(lat, lng);
create index if not exists sites_type_idx   on public.sites(type);

-- ---------- site_responsibles: 1 sitio -> N responsables ----------
-- RLS permisiva (read/insert) coherente con needs.contact_phone ya público:
-- el objetivo es poner en contacto a quien ofrece con el responsable del punto.
create table if not exists public.site_responsibles (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  name text,
  phone text,
  contact_info text,
  role_label text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.site_responsibles to anon, authenticated;
grant all on public.site_responsibles to service_role;
alter table public.site_responsibles enable row level security;
drop policy if exists "site_responsibles public read"   on public.site_responsibles;
create policy "site_responsibles public read"   on public.site_responsibles for select using (true);
drop policy if exists "site_responsibles public insert" on public.site_responsibles;
create policy "site_responsibles public insert" on public.site_responsibles for insert with check (true);
create index if not exists site_responsibles_site_id_idx on public.site_responsibles(site_id);

-- ---------- needs: DIVIPOL + FK opcional a sites ----------
alter table public.needs
  add column if not exists state        text,
  add column if not exists municipality text,
  add column if not exists parish       text,
  add column if not exists site_id      uuid references public.sites(id) on delete set null;
create index if not exists needs_divipol_idx on public.needs(state, municipality, parish);
create index if not exists needs_site_id_idx on public.needs(site_id);

-- ---------- offers: DIVIPOL + geo (para matching Fase 3) + FK opcional a sites ----------
alter table public.offers
  add column if not exists state        text,
  add column if not exists municipality text,
  add column if not exists parish       text,
  add column if not exists lat          double precision,
  add column if not exists lng          double precision,
  add column if not exists site_id      uuid references public.sites(id) on delete set null;
create index if not exists offers_divipol_idx on public.offers(state, municipality, parish);
create index if not exists offers_site_id_idx on public.offers(site_id);
create index if not exists offers_lat_lng_idx on public.offers(lat, lng);

-- ---------- Backfill OPCIONAL, idempotente, no destructivo ----------
-- Copia health_centers -> sites como type='salud'. health_centers queda INTACTO.
-- Solo inserta los que aún no existen por (name, lat, lng) -> re-ejecutable sin duplicar.
insert into public.sites (type, name, lat, lng, state, status)
select 'salud', hc.name, hc.lat, hc.lng, hc.state, 'active'
from public.health_centers hc
where not exists (
  select 1 from public.sites s
  where s.name = hc.name
    and s.lat is not distinct from hc.lat
    and s.lng is not distinct from hc.lng
);

-- ============================================================
-- DOWN (rollback manual, ORDEN INVERSO). Solo elimina estructuras
-- aditivas. Los datos de needs/offers no se pierden: solo se
-- eliminan columnas nuevas (vacías al revertir Fase 0). El backfill
-- vive dentro de `sites`, así que se elimina con su DROP TABLE.
-- ============================================================
-- drop index if exists public.offers_lat_lng_idx;
-- drop index if exists public.offers_site_id_idx;
-- drop index if exists public.offers_divipol_idx;
-- alter table public.offers
--   drop column if exists site_id,
--   drop column if exists lng,
--   drop column if exists lat,
--   drop column if exists parish,
--   drop column if exists municipality,
--   drop column if exists state;
-- drop index if exists public.needs_site_id_idx;
-- drop index if exists public.needs_divipol_idx;
-- alter table public.needs
--   drop column if exists site_id,
--   drop column if exists parish,
--   drop column if exists municipality,
--   drop column if exists state;
-- drop table if exists public.site_responsibles;
-- drop table if exists public.sites;   -- el backfill se va con la tabla
