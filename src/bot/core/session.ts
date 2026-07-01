// ── SessionStore agnóstico de canal ───────────────────────────────────────
// En memoria (TTL 2 h) tras una interfaz, persistiendo a `channel_sessions`
// con clave compuesta `${channel}:${externalUserId}`. Lee `bot_sessions`
// (legacy, keyed por chat_id) como fallback de SOLO LECTURA para recuperar
// sesiones de Telegram en vuelo durante el primer deploy.
import type { HistoryEntry, Session } from "./types";

const SUPA_URL = process.env.SUPABASE_URL!;
const SUPA_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SESSION_TTL = 2 * 60 * 60 * 1000;

const mem = new Map<string, Session>();

const svcHeaders = () => ({ apikey: SUPA_SVC, Authorization: `Bearer ${SUPA_SVC}` });

async function saveToDB(key: string, s: Session): Promise<void> {
  if (!SUPA_SVC) return;
  await fetch(`${SUPA_URL}/rest/v1/channel_sessions`, {
    method: "POST",
    headers: {
      ...svcHeaders(),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ session_key: key, data: s, updated_at: new Date().toISOString() }),
  }).catch((e) => console.error("[session-save]", e));
}

async function loadFromDB(key: string): Promise<Session | null> {
  if (!SUPA_SVC) return null;
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/channel_sessions?session_key=eq.${encodeURIComponent(key)}&select=data&limit=1`,
      { headers: svcHeaders() },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { data: Session }[];
    return rows[0]?.data ?? null;
  } catch {
    return null;
  }
}

async function deleteFromDB(key: string): Promise<void> {
  if (!SUPA_SVC) return;
  await fetch(`${SUPA_URL}/rest/v1/channel_sessions?session_key=eq.${encodeURIComponent(key)}`, {
    method: "DELETE",
    headers: svcHeaders(),
  }).catch((e) => console.error("[session-delete]", e));
}

// ── Legacy `bot_sessions` (solo Telegram) ─────────────────────────────────
const legacyChatId = (key: string): string | null => {
  const m = /^telegram:(\d+)$/.exec(key);
  return m ? m[1] : null;
};

async function loadLegacy(key: string): Promise<Session | null> {
  if (!SUPA_SVC) return null;
  const chatId = legacyChatId(key);
  if (!chatId) return null;
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/bot_sessions?chat_id=eq.${chatId}&select=data&limit=1`,
      { headers: svcHeaders() },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { data: Session }[];
    return rows[0]?.data ?? null;
  } catch {
    return null;
  }
}

async function deleteLegacy(key: string): Promise<void> {
  if (!SUPA_SVC) return;
  const chatId = legacyChatId(key);
  if (!chatId) return;
  await fetch(`${SUPA_URL}/rest/v1/bot_sessions?chat_id=eq.${chatId}`, {
    method: "DELETE",
    headers: svcHeaders(),
  }).catch(() => {});
}

export async function getOrLoad(key: string): Promise<Session | null> {
  const cached = mem.get(key);
  if (cached) {
    if (Date.now() - cached.at > SESSION_TTL) {
      mem.delete(key);
      deleteFromDB(key).catch(() => {});
      deleteLegacy(key).catch(() => {});
      return null;
    }
    return cached;
  }
  // No está en memoria — intentar DB (recupera sesiones tras reinicio de PM2),
  // y como último recurso la tabla legacy bot_sessions (Telegram).
  const db = (await loadFromDB(key)) ?? (await loadLegacy(key));
  if (!db) return null;
  if (Date.now() - db.at > SESSION_TTL) {
    deleteFromDB(key).catch(() => {});
    deleteLegacy(key).catch(() => {});
    return null;
  }
  mem.set(key, db);
  return db;
}

export function set(
  key: string,
  state: string,
  draft: Record<string, unknown>,
  history?: HistoryEntry[],
  userName?: string,
): void {
  const existing = mem.get(key);
  const s: Session = {
    state,
    draft,
    history: history ?? existing?.history ?? [],
    userName: userName ?? existing?.userName,
    at: Date.now(),
  };
  mem.set(key, s);
  saveToDB(key, s).catch((e) => console.error("[session-save]", e));
}

export function clear(key: string): void {
  mem.delete(key);
  deleteFromDB(key).catch((e) => console.error("[session-delete]", e));
  deleteLegacy(key).catch(() => {});
}
