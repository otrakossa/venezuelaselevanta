// ── Vocabularios y constantes del bot (agnóstico de canal) ────────────────
export const CATEGORIES = [
  { slug: "missing", name: "🔴 Desaparecidos" },
  { slug: "medical", name: "🟠 Heridos / Médica" },
  { slug: "rescue", name: "🟡 Rescate / Atrapados" },
  { slug: "shelter", name: "🔵 Refugio / Ayuda" },
  { slug: "infrastructure", name: "🟣 Infraestructura" },
  { slug: "evacuation", name: "🟢 Punto de encuentro" },
  { slug: "blocked_road", name: "⚫ Vías bloqueadas" },
  { slug: "hospital", name: "🩺 Centro médico" },
];

export const URGENCIES = [
  { v: "critical", n: "🔴 Crítico" },
  { v: "high", n: "🟠 Alto" },
  { v: "medium", n: "🟡 Medio" },
  { v: "low", n: "🟢 Bajo" },
];

// Categorías de NECESIDADES (distintas de las de reportes).
export const NEED_CATEGORIES = [
  { slug: "medicine", name: "💊 Medicinas" },
  { slug: "food", name: "🍎 Alimentos" },
  { slug: "water", name: "💧 Agua" },
  { slug: "volunteers", name: "🤝 Voluntarios" },
  { slug: "equipment", name: "🔧 Equipos" },
  { slug: "blood", name: "🩸 Sangre" },
  { slug: "money", name: "💰 Dinero" },
  { slug: "other", name: "📦 Otro" },
];
export const needCatLabel = (slug: string): string =>
  NEED_CATEGORIES.find((c) => c.slug === slug)?.name ?? "📦 Otro";

export const VALID_CATS = new Set([
  "missing",
  "medical",
  "rescue",
  "shelter",
  "infrastructure",
  "evacuation",
  "blocked_road",
  "hospital",
]);
export const VALID_URGS = new Set(["critical", "high", "medium", "low"]);

// Etiqueta legible del canal para reporter_name / source_label.
export const channelLabel = (c: string): string =>
  c === "telegram" ? "Telegram" : c.charAt(0).toUpperCase() + c.slice(1);

// ── Confirmación / cancelación en lenguaje natural ────────────────────────
export const isNaturalConfirm = (t: string) =>
  /^(sí|si|ok|dale|listo|confirmar?|publicar?|confirmo|publícalo|publicalo|va|claro|de acuerdo|sí confirmo|yes|adelante|procede|envíalo|envialo)/i.test(
    t.trim(),
  );
export const isNaturalCancel = (t: string) =>
  /^(no|cancelar?|cancela|mejor no|déjalo|dejalo|olvídalo|olvidalo)/i.test(t.trim());
