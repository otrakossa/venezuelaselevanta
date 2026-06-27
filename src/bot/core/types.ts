// ── Tipos del núcleo del bot (agnóstico de canal) ─────────────────────────
import type {
  Capabilities,
  Channel,
  IncomingMedia,
  ReplyMarkup,
  StoredMedia,
} from "@/channels/types";

export type HistoryEntry = { role: "user" | "bot"; text: string };

export type Session = {
  state: string;
  draft: Record<string, unknown>;
  history: HistoryEntry[];
  userName?: string;
  at: number;
};

// Contexto que el motor entrega a cada flujo. Aísla por completo la lógica de
// los flujos del transporte: los flujos NO conocen Telegram.
export interface EngineCtx {
  channel: Channel;
  externalUserId: string;
  fromName: string;
  capabilities: Capabilities;
  send(text: string, markup?: ReplyMarkup): Promise<void>;
  storeMedia(media: IncomingMedia): Promise<StoredMedia | null>;
  getSession(): Promise<Session | null>;
  setSession(
    state: string,
    draft: Record<string, unknown>,
    history?: HistoryEntry[],
    userName?: string,
  ): void;
  clearSession(): void;
}
