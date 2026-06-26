-- ============================================================
-- Tablas base que las migraciones posteriores ASUMEN pero nunca crean
-- (se habían creado fuera de migraciones en el proyecto original).
-- Reconstruidas desde src/integrations/supabase/types.ts.
-- Va inmediatamente después de la 1ª migración (...060714) para que
-- `supabase db push` / reset funcione de cero.
--
-- ⚠️ AVISO: las políticas RLS aquí son PERMISIVAS (pensadas para DEV).
--    `patients` contiene PII — revisar/endurecer estas políticas antes
--    de aplicar a producción.
-- ============================================================

-- Extensión usada por búsquedas fuzzy / migraciones posteriores
create extension if not exists pg_trgm;

-- set_updated_at ya existe (creada en ...060714); CREATE OR REPLACE es idempotente
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ---------- health_centers ----------
create table if not exists public.health_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'hospital',
  address text,
  city text,
  state text,
  phone text,
  lat double precision not null,
  lng double precision not null,
  osm_id bigint,
  osm_type text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.health_centers to anon, authenticated;
grant all on public.health_centers to service_role;
alter table public.health_centers enable row level security;
create policy "health_centers public read"   on public.health_centers for select using (true);
create policy "health_centers public insert" on public.health_centers for insert with check (true);
create policy "health_centers public update" on public.health_centers for update using (true) with check (true);

-- ---------- needs ----------
create table if not exists public.needs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  description text,
  quantity text,
  urgency text not null default 'medium',
  status text not null default 'open',
  center_name text not null,
  center_address text,
  lat double precision,
  lng double precision,
  contact_name text,
  contact_phone text,
  contact_info text,
  reporter_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.needs to anon, authenticated;
grant all on public.needs to service_role;
alter table public.needs enable row level security;
create policy "needs public read"   on public.needs for select using (true);
create policy "needs public insert" on public.needs for insert with check (true);
create policy "needs public update" on public.needs for update using (true) with check (true);
create trigger needs_updated_at before update on public.needs
  for each row execute function public.set_updated_at();

-- ---------- offers ----------
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  description text,
  quantity text,
  status text not null default 'open',
  location_desc text,
  need_id uuid references public.needs(id) on delete set null,
  contact_name text not null,
  contact_phone text,
  contact_info text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.offers to anon, authenticated;
grant all on public.offers to service_role;
alter table public.offers enable row level security;
create policy "offers public read"   on public.offers for select using (true);
create policy "offers public insert" on public.offers for insert with check (true);
create policy "offers public update" on public.offers for update using (true) with check (true);

-- ---------- patients (⚠️ PII — políticas permisivas SOLO dev) ----------
-- id_number/phone/address los añade ...095623; matched_missing_id lo añade ...100818.
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age integer,
  sex text,
  center_name text not null,
  center_address text,
  center_lat double precision,
  center_lng double precision,
  status text not null default 'admitted',
  notes text,
  discharged_at timestamptz,
  registered_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.patients to anon, authenticated;
grant all on public.patients to service_role;
alter table public.patients enable row level security;
create policy "patients public read"   on public.patients for select using (true);
create policy "patients public insert" on public.patients for insert with check (true);
create policy "patients public update" on public.patients for update using (true) with check (true);

-- ---------- bot_sessions (solo service_role) ----------
create table if not exists public.bot_sessions (
  chat_id bigint primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
grant all on public.bot_sessions to service_role;
alter table public.bot_sessions enable row level security;

-- ---------- bot_users (solo service_role) ----------
create table if not exists public.bot_users (
  chat_id bigint primary key,
  username text,
  first_name text,
  last_seen timestamptz default now()
);
grant all on public.bot_users to service_role;
alter table public.bot_users enable row level security;

-- ---------- columna source_id en missing_persons (existe en prod, falta en migraciones) ----------
alter table public.missing_persons add column if not exists source_id text;

-- ---------- storage bucket report-media (privado) ----------
insert into storage.buckets (id, name, public)
values ('report-media', 'report-media', false)
on conflict (id) do nothing;
