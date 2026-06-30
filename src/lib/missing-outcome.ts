import type { MissingPerson } from "@/lib/types";

export type MissingOutcome =
  | "at_health_center"
  | "with_family"
  | "relocated"
  | "deceased"
  | "other";

export const OUTCOME_LABELS: Record<MissingOutcome, string> = {
  at_health_center: "Atendido en centro de salud",
  with_family: "Con su familia",
  relocated: "En albergue o lugar seguro",
  deceased: "Fallecido",
  other: "Otro",
};

export const OUTCOME_EMOJI: Record<MissingOutcome, string> = {
  at_health_center: "🏥",
  with_family: "🏠",
  relocated: "🛟",
  deceased: "🕊️",
  other: "ℹ️",
};

export const OUTCOME_PILL: Record<MissingOutcome, string> = {
  at_health_center: "bg-sky-600 text-white",
  with_family: "bg-emerald-600 text-white",
  relocated: "bg-amber-600 text-white",
  deceased: "bg-neutral-800 text-white",
  other: "bg-slate-600 text-white",
};

// Outcomes que un voto público puede setear (no incluye deceased: reservado a moderador)
export const PUBLIC_OUTCOMES: MissingOutcome[] = [
  "at_health_center",
  "with_family",
  "relocated",
  "other",
];

export function getOutcome(person: Pick<MissingPerson, "status"> & { outcome?: string | null }): MissingOutcome | null {
  const o = (person as { outcome?: string | null }).outcome;
  if (o && (o in OUTCOME_LABELS)) return o as MissingOutcome;
  return null;
}
