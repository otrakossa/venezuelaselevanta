// ── Harness para ejercitar engine.handle() sin HTTP ni Telegram ────────────
// makeHarness() devuelve un EngineCtx falso que captura los send() y mantiene
// una sesión en memoria mutable, reproduciendo la semántica REAL de
// session.ts#set (history/userName se preservan si no se pasan). Así se puede
// reconducir la máquina de estados llamando handle() paso a paso.
import type { EngineCtx, Session } from "@/bot/core/types";
import type {
  Capabilities,
  IncomingMessage,
  OutgoingMessage,
  StoredMedia,
} from "@/channels/types";

export const CAPS: Capabilities = {
  inlineButtons: true,
  replyKeyboard: true,
  requestLocation: true,
  media: true,
};

const DEFAULT_MEDIA: StoredMedia = {
  url: "https://cdn.test/photo.jpg",
  thumb: "https://cdn.test/thumb.jpg",
};

export interface Harness {
  ctx: EngineCtx;
  /** Todos los mensajes enviados (acumulado). */
  sent: OutgoingMessage[];
  /** Sesión actual (lo que dejó el último setSession, o null tras clear). */
  session(): Session | null;
  /** Arranca el test en un estado dado. */
  seed(state: string, draft?: Record<string, unknown>, extra?: Partial<Session>): void;
  /** Vacía el buffer de mensajes (para asertar por paso). */
  clear(): void;
  /** Último mensaje enviado. */
  last(): OutgoingMessage;
  /** Concatenación de todos los textos enviados (para asserts laxos). */
  text(): string;
}

export function makeHarness(opts?: {
  session?: Session | null;
  channel?: string;
  externalUserId?: string;
  fromName?: string;
  /** Resultado de storeMedia. `null` simula fallo de subida. */
  storeMediaResult?: StoredMedia | null;
}): Harness {
  let session: Session | null = opts?.session ?? null;
  const sent: OutgoingMessage[] = [];

  const ctx: EngineCtx = {
    channel: opts?.channel ?? "test",
    externalUserId: opts?.externalUserId ?? "u1",
    fromName: opts?.fromName ?? "Tester",
    capabilities: CAPS,
    send: async (text, markup) => {
      sent.push({ text, markup });
    },
    storeMedia: async () =>
      opts && "storeMediaResult" in opts ? opts.storeMediaResult! : DEFAULT_MEDIA,
    getSession: async () => session,
    setSession: (state, draft, history, userName) => {
      session = {
        state,
        draft,
        history: history ?? session?.history ?? [],
        userName: userName ?? session?.userName,
        at: 0,
      };
    },
    clearSession: () => {
      session = null;
    },
  };

  return {
    ctx,
    sent,
    session: () => session,
    seed: (state, draft = {}, extra = {}) => {
      session = { state, draft, history: [], at: 0, ...extra };
    },
    clear: () => {
      sent.length = 0;
    },
    last: () => {
      if (!sent.length) throw new Error("no se envió ningún mensaje");
      return sent[sent.length - 1];
    },
    text: () => sent.map((m) => m.text).join("\n"),
  };
}

// ── Builders de IncomingMessage ────────────────────────────────────────────
const base = (): Pick<IncomingMessage, "channel" | "externalUserId" | "fromName"> => ({
  channel: "test",
  externalUserId: "u1",
  fromName: "Tester",
});

/** Mensaje de texto. */
export const txt = (text: string): IncomingMessage => ({ ...base(), text });

/** Pulsación de botón inline (callback). */
export const cb = (callbackData: string): IncomingMessage => ({
  ...base(),
  text: "",
  callbackData,
});

/** Mensaje con ubicación compartida. */
export const loc = (lat: number, lng: number): IncomingMessage => ({
  ...base(),
  text: "",
  location: { lat, lng },
});

/** Mensaje con foto adjunta. */
export const photo = (): IncomingMessage => ({
  ...base(),
  text: "",
  media: { kind: "photo", raw: {} },
});
