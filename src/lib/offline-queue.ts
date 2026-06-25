import { get, set, del, keys } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";

const PREFIX = "queued-report:";
const MAX_ATTEMPTS = 8;

export type QueuedReport = {
  id: string;
  payload: Record<string, unknown>;
  queued_at: number;
  attempts?: number;
  last_error?: string | null;
  last_attempt_at?: number | null;
};

export async function enqueueReport(payload: Record<string, unknown>) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item: QueuedReport = { id, payload, queued_at: Date.now(), attempts: 0, last_error: null, last_attempt_at: null };
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

export async function removeQueued(id: string) {
  await del(PREFIX + id);
}

export type FlushResult = { ok: number; failed: number; dropped: number };

let flushing = false;

export async function flushQueue(): Promise<FlushResult> {
  if (flushing) return { ok: 0, failed: 0, dropped: 0 };
  flushing = true;
  try {
    const items = await listQueued();
    let ok = 0, failed = 0, dropped = 0;
    for (const item of items) {
      const attempts = (item.attempts ?? 0) + 1;
      const { error } = await supabase.from("reports").insert(item.payload as never);
      if (!error) {
        await del(PREFIX + item.id);
        ok++;
      } else if (attempts >= MAX_ATTEMPTS) {
        // Give up to avoid an infinite loop of a permanently bad payload.
        await del(PREFIX + item.id);
        dropped++;
      } else {
        await set(PREFIX + item.id, {
          ...item,
          attempts,
          last_error: error.message ?? "unknown",
          last_attempt_at: Date.now(),
        });
        failed++;
      }
    }
    return { ok, failed, dropped };
  } finally {
    flushing = false;
  }
}
