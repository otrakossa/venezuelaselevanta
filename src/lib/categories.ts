import { UserX, HeartPulse, Siren, HandHelping, Building2, MapPin, Construction, Cross, type LucideIcon } from "lucide-react";

export type CategorySlug =
  | "desaparecidos" | "heridos" | "atrapados" | "ayuda"
  | "infraestructura" | "encuentro" | "vias" | "medico";

export interface CategoryMeta {
  slug: CategorySlug;
  name: string;
  color: string;
  icon: LucideIcon;
  emoji: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { slug: "desaparecidos", name: "Personas desaparecidas", color: "#DC2626", icon: UserX, emoji: "🔴" },
  { slug: "heridos", name: "Heridos / Médico urgente", color: "#EA580C", icon: HeartPulse, emoji: "🟠" },
  { slug: "atrapados", name: "Atrapados / Rescate", color: "#EAB308", icon: Siren, emoji: "🟡" },
  { slug: "ayuda", name: "Ayuda / Refugio", color: "#2563EB", icon: HandHelping, emoji: "🔵" },
  { slug: "infraestructura", name: "Infraestructura dañada", color: "#9333EA", icon: Building2, emoji: "🟣" },
  { slug: "encuentro", name: "Punto de encuentro", color: "#16A34A", icon: MapPin, emoji: "🟢" },
  { slug: "vias", name: "Vías bloqueadas", color: "#374151", icon: Construction, emoji: "⚫" },
  { slug: "medico", name: "Centro médico", color: "#EC4899", icon: Cross, emoji: "🩺" },
];

export const CATEGORY_MAP: Record<string, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c]),
);

export const URGENCY_LABELS: Record<string, { label: string; color: string }> = {
  critico: { label: "Crítico", color: "var(--color-urgency-critico)" },
  alto: { label: "Alto", color: "var(--color-urgency-alto)" },
  medio: { label: "Medio", color: "var(--color-urgency-medio)" },
  bajo: { label: "Bajo", color: "var(--color-urgency-bajo)" },
};

export const STATUS_LABELS: Record<string, string> = {
  activo: "Activo",
  en_atencion: "En atención",
  resuelto: "Resuelto",
};
