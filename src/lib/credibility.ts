import type { Report } from "@/lib/types";

export type Credibility = {
  level: "verified" | "trusted" | "review" | "disputed" | "new";
  label: string;
  short: string;
  color: string; // tailwind bg class fragment (hex used inline)
  bg: string;
  fg: string;
  score: number | null; // 0..1 or null when not enough votes
  total: number;
};

const MIN_VOTES = 3;

export function getCredibility(r: Pick<Report, "verified" | "confirm_count" | "dispute_count">): Credibility {
  const confirm = r.confirm_count ?? 0;
  const dispute = r.dispute_count ?? 0;
  const total = confirm + dispute;

  if (r.verified) {
    return {
      level: "verified",
      label: "Verificado oficialmente",
      short: "Verificado",
      color: "#FFC93C",
      bg: "#FFC93C",
      fg: "#0D2B45",
      score: total > 0 ? confirm / total : null,
      total,
    };
  }

  if (total < MIN_VOTES) {
    return {
      level: "new",
      label: "Sin valoraciones aún",
      short: "Por confirmar",
      color: "#94a3b8",
      bg: "#e2e8f0",
      fg: "#334155",
      score: null,
      total,
    };
  }

  const score = confirm / total;
  if (score >= 0.7)
    return { level: "trusted", label: "Confiable por la comunidad", short: `Confiable ${Math.round(score * 100)}%`, color: "#16a34a", bg: "#16a34a", fg: "#ffffff", score, total };
  if (score >= 0.4)
    return { level: "review", label: "En revisión por la comunidad", short: `En revisión ${Math.round(score * 100)}%`, color: "#f59e0b", bg: "#f59e0b", fg: "#1f2937", score, total };
  return { level: "disputed", label: "Cuestionado por la comunidad", short: `Cuestionado ${Math.round(score * 100)}%`, color: "#dc2626", bg: "#dc2626", fg: "#ffffff", score, total };
}
