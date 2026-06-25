import { get, set, del, keys } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";

const PREFIX = "queued-report:";
const DEAD_PREFIX = "dead-report:";
const MAX_ATTEMPTS = 8;
const MAX_QUEUE_SIZE = 50;

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

export async function listDead(): Promise<(QueuedReport & { dead_at: number })[]> {
  const all = await keys();
  const ids = all.filter((k): k is string => typeof k === "string" && k.startsWith(DEAD_PREFIX));
  const items = await Promise.all(ids.map((k) => get<QueuedReport & { dead_at: number }>(k)));
  return items.filter((x): x is QueuedReport & { dead_at: number } => !!x);
}

export async function clearDead() {
  const all = await keys();
  const ids = all.filter((k): k is string => typeof k === "string" && k.startsWith(DEAD_PREFIX));
  await Promise.all(ids.map((k) => del(k)));
}

function emitDropped(id: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("queue:dropped", { detail: { id } }));
  }
}

export type FlushResult = { ok: number; failed: number; dropped: number };

let flushing = false;

export async function flushQueue(): Promise<FlushResult> {
  if (flushing) return { ok: 0, failed: 0, dropped: 0 };
  flushing = true;
  try {
    let items = await listQueued();
    let ok = 0, failed = 0, dropped = 0;

    // Cap de tamaño: si hay más de MAX_QUEUE_SIZE, mover el exceso al dead-letter
    if (items.length > MAX_QUEUE_SIZE) {
      const excess = items.slice(0, items.length - MAX_QUEUE_SIZE);
      for (const item of excess) {
        await set(DEAD_PREFIX + item.id, { ...item, dead_at: Date.now(), last_error: "queue_overflow" });
        await del(PREFIX + item.id);
        emitDropped(item.id);
        dropped++;
      }
      items = items.slice(excess.length);
    }

    for (const item of items) {
      const attempts = (item.attempts ?? 0) + 1;
      const { error } = await supabase.from("reports").insert(item.payload as never);
      if (!error) {
        await del(PREFIX + item.id);
        ok++;
      } else if (attempts >= MAX_ATTEMPTS) {
        await set(DEAD_PREFIX + item.id, {
          ...item,
          attempts,
          last_error: error.message ?? "unknown",
          dead_at: Date.now(),
        });
        await del(PREFIX + item.id);
        emitDropped(item.id);
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
