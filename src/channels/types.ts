// ── Contrato de canal (transporte ↔ núcleo) ───────────────────────────────
// Tipos compartidos entre los adaptadores de canal (Telegram, WhatsApp, …) y
// el núcleo agnóstico del bot. NINGÚN detalle específico de Telegram vive aquí.

export type Channel = string; // "telegram" | "whatsapp" | …

// ── Mensaje entrante normalizado ──────────────────────────────────────────
export type IncomingMedia =
  | { kind: "photo"; raw: unknown }
  | { kind: "video"; raw: unknown };

export interface IncomingMessage {
  channel: Channel;
  externalUserId: string; // id del usuario en el canal (Telegram: chat.id en string)
  text: string; // texto recortado ("" si no hay)
  callbackData?: string; // pulsación de botón inline
  location?: { lat: number; lng: number };
  media?: IncomingMedia;
  fromName: string; // nombre de pila ("Anónimo" por defecto)
  username?: string;
}

// ── Primitivas de respuesta (abstractas) ──────────────────────────────────
export type Button = { text: string; data: string }; // botón inline (callback)
export type KeyboardButton = { text: string; requestLocation?: boolean };

export type ReplyMarkup =
  | { kind: "inline"; rows: Button[][] }
  | { kind: "keyboard"; rows: KeyboardButton[][]; oneTime?: boolean }
  | { kind: "remove" };

export interface OutgoingMessage {
  text: string;
  markup?: ReplyMarkup;
}

export interface StoredMedia {
  url: string;
  thumb: string;
}

// ── Capacidades del canal (para degradar a texto donde no haya soporte) ────
export interface Capabilities {
  inlineButtons: boolean;
  replyKeyboard: boolean;
  requestLocation: boolean;
  media: boolean;
}

// ── Interfaz que cada canal implementa ────────────────────────────────────
// (los adaptadores se exportan como módulos de funciones; este tipo documenta
//  el contrato y permite tipar wrappers genéricos a futuro.)
export interface ChannelAdapter {
  channel: Channel;
  capabilities: Capabilities;
  isConfigured(): boolean;
  verify(request: Request): boolean;
  parseIncoming(update: unknown): Promise<IncomingMessage | null>;
  send(externalUserId: string, msg: OutgoingMessage): Promise<void>;
  storeMedia(media: IncomingMedia): Promise<StoredMedia | null>;
}
