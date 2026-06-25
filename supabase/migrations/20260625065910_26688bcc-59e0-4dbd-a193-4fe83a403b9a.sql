CREATE TABLE public.telegram_sessions (
  chat_id BIGINT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'idle',
  draft JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.telegram_sessions TO service_role;
ALTER TABLE public.telegram_sessions ENABLE ROW LEVEL SECURITY;
-- No public/anon/authenticated policies: only service role (used by webhook) touches this.