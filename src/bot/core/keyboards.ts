// ── Constructores de teclados (markup ABSTRACTO, agnóstico de canal) ──────
// Devuelven ReplyMarkup; cada adaptador lo traduce a su formato nativo.
import type { Button, ReplyMarkup } from "@/channels/types";
import { CATEGORIES, URGENCIES } from "./constants";

export const ikb = (rows: Button[][]): ReplyMarkup => ({ kind: "inline", rows });

export function categoryKb(): ReplyMarkup {
  const rows: Button[][] = [];
  for (let i = 0; i < CATEGORIES.length; i += 2)
    rows.push(CATEGORIES.slice(i, i + 2).map((c) => ({ text: c.name, data: `cat:${c.slug}` })));
  return { kind: "inline", rows };
}

export const urgencyKb = (): ReplyMarkup => ({
  kind: "inline",
  rows: [URGENCIES.map((u) => ({ text: u.n, data: `urg:${u.v}` }))],
});

export const mediaKb = (hasAny: boolean): ReplyMarkup => ({
  kind: "keyboard",
  rows: [[{ text: hasAny ? "✅ Listo, continuar" : "⏭️ Omitir foto/video" }], [{ text: "❌ Cancelar" }]],
  oneTime: false,
});

export const locationKb = (): ReplyMarkup => ({
  kind: "keyboard",
  rows: [
    [{ text: "📍 Compartir mi ubicación", requestLocation: true }],
    [{ text: "✏️ Escribir dirección" }],
    [{ text: "❌ Cancelar" }],
  ],
  oneTime: false,
});

export const confirmKb = (): ReplyMarkup => ({
  kind: "keyboard",
  rows: [[{ text: "✅ Confirmar y publicar" }, { text: "❌ Cancelar" }]],
  oneTime: true,
});

export const mpConfirmKb = (): ReplyMarkup => ({
  kind: "keyboard",
  rows: [[{ text: "✅ Confirmar y registrar" }, { text: "❌ Cancelar" }]],
  oneTime: true,
});

export const mpPhotoKb = (has: boolean): ReplyMarkup => ({
  kind: "keyboard",
  rows: [[{ text: has ? "✅ Listo, continuar" : "⏭️ Omitir foto" }], [{ text: "❌ Cancelar" }]],
  oneTime: false,
});

export const mpContactKb = (): ReplyMarkup => ({
  kind: "keyboard",
  rows: [[{ text: "⏭️ Sin datos de contacto" }], [{ text: "❌ Cancelar" }]],
  oneTime: false,
});

export const removeKb = (): ReplyMarkup => ({ kind: "remove" });
