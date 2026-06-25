import {
  UserX, HeartPulse, Siren, HandHelping, Building2, MapPin, Construction, Cross,
  type LucideIcon,
} from "lucide-react";

export type CategorySlug =
  | "missing" | "medical" | "rescue" | "shelter"
  | "infrastructure" | "evacuation" | "blocked_road" | "hospital";

export interface CategoryMeta {
  slug: CategorySlug;
  name: string;
  color: string;
  icon: LucideIcon;
  emoji: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { slug: "missing",        name: "Personas desaparecidas",          color: "#DC2626", icon: UserX,        emoji: "🔴" },
  { slug: "medical",        name: "Heridos / Necesidad médica",      color: "#EA580C", icon: HeartPulse,   emoji: "🟠" },
  { slug: "rescue",         name: "Personas atrapadas / Rescate",    color: "#CA8A04", icon: Siren,        emoji: "🟡" },
  { slug: "shelter",        name: "Distribución de ayuda / Refugio", color: "#2563EB", icon: HandHelping,  emoji: "🔵" },
  { slug: "infrastructure", name: "Infraestructura dañada",          color: "#7C3AED", icon: Building2,    emoji: "🟣" },
  { slug: "evacuation",     name: "Punto de encuentro / Evacuación", color: "#16A34A", icon: MapPin,       emoji: "🟢" },
  { slug: "blocked_road",   name: "Vías bloqueadas",                 color: "#374151", icon: Construction, emoji: "⚫" },
  { slug: "hospital",       name: "Centro médico / Hospital",        color: "#DB2777", icon: Cross,        emoji: "🩺" },
];

export const CATEGORY_MAP: Record<string, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c]),
);

export const URGENCY_LABELS: Record<string, { label: string; color: string }> = {
  critical: { label: "Crítico", color: "var(--color-urgency-critical)" },
  high:     { label: "Alto",    color: "var(--color-urgency-high)" },
  medium:   { label: "Medio",   color: "var(--color-urgency-medium)" },
  low:      { label: "Bajo",    color: "var(--color-urgency-low)" },
};

export const STATUS_LABELS: Record<string, string> = {
  active:    "Activo",
  attending: "En atención",
  resolved:  "Resuelto",
};

export const MISSING_STATUS_LABELS: Record<string, string> = {
  missing:  "Buscando",
  found:    "Encontrada",
  deceased: "Fallecida",
};
