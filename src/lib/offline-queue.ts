import { get, set, del, keys } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";

const PREFIX = "queued-report:";

export type QueuedReport = {
  id: string;
  payload: Record<string, unknown>;
  queued_at: number;
};

export async function enqueueReport(payload: Record<string, unknown>) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item: QueuedReport = { id, payload, queued_at: Date.now() };
  await set(PREFIX + id, item);
  return id;
}

export async function listQueued(): Promise<QueuedReport[]> {
  const all = await keys();
  const ids = all.filter((k): k is string => typeof k === "string" && k.startsWith(PREFIX));
  const items = await Promise.all(ids.map((k) => get<QueuedReport>(k)));
  return items.filter((x): x is QueuedReport => !!x).sort((a, b) => a.queued_at - b.queued_at);
}

export async function countQueued(): Promise<number> {
  const all = await keys();
  return all.filter((k) => typeof k === "string" && k.startsWith(PREFIX)).length;
}

export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  const items = await listQueued();
  let ok = 0, failed = 0;
  for (const item of items) {
    const { error } = await supabase.from("reports").insert(item.payload as never);
    if (!error) {
      await del(PREFIX + item.id);
      ok++;
    } else {
      failed++;
    }
  }
  return { ok, failed };
}
