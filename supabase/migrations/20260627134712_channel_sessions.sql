-- ============================================================
-- Fase 1 — Sesiones agnósticas de canal.
-- Tabla aditiva `channel_sessions` con clave compuesta
-- `${channel}:${externalUserId}` (p.ej. "telegram:12345").
-- Convive con `bot_sessions` (legacy, keyed por chat_id), que el
-- SessionStore lee como fallback de solo-lectura durante el primer
-- deploy para no perder sesiones en vuelo. Solo service_role.
-- ============================================================
create table if not exists public.channel_sessions (
  session_key text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
grant all on public.channel_sessions to service_role;
alter table public.channel_sessions enable row level security;

-- DOWN: drop table if exists public.channel_sessions;
