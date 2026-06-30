// Credenciales Supabase REST centralizadas para los callers de fetch() crudo.
// Resuelven el proyecto por ambiente vía `@/lib/supabase-config` (variable propia
// `VITE_APP_SUPABASE_*`; dev→local, build prod→prod). Mantiene los nombres
// `SUPA_URL`/`SUPA_ANON` para no tocar a los consumidores.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase-config";

export const SUPA_URL = SUPABASE_URL;
export const SUPA_ANON = SUPABASE_ANON_KEY;
