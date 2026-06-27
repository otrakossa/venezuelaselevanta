// Loose-typed Supabase wrapper for interop admin.
// The generated Database type targets the OLD project; production runs the
// NEW project (advebubtfjgxwpjxprok) which has additional tables, columns,
// and RPCs (match_dismissals, dedupe_whitelist, source_label, etc.).
// This wrapper bypasses the stale type narrowing only inside the admin panel.
import { supabase } from "@/integrations/supabase/client";

type RpcResult<T = unknown> = Promise<{ data: T | null; error: { message: string } | null }>;
type QueryBuilder = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
};

export const sbx = supabase as unknown as {
  rpc: <T = unknown>(fn: string, args?: Record<string, unknown>) => RpcResult<T>;
  from: (table: string) => QueryBuilder;
};
