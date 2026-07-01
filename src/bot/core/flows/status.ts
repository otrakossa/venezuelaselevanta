// ── Flujo /estado + caché de stats (TTL 5 min) ────────────────────────────
import type { EngineCtx } from "../types";
import { supabaseCount } from "../data";

interface QuickStats {
  reports: number;
  missing: number;
  searching: number;
  at: number;
}
let statsCache: QuickStats | null = null;
const STATS_TTL = 5 * 60 * 1000;

export function invalidateStats(): void {
  statsCache = null;
}

export async function getQuickStats(): Promise<{
  reports: number;
  missing: number;
  searching: number;
}> {
  if (statsCache && Date.now() - statsCache.at < STATS_TTL) return statsCache;
  try {
    const [reports, missing, searching] = await Promise.all([
      supabaseCount("reports"),
      supabaseCount("missing_persons"),
      supabaseCount("missing_persons", "status=eq.missing"),
    ]);
    statsCache = { reports, missing, searching, at: Date.now() };
    return statsCache;
  } catch {
    return statsCache ?? { reports: 0, missing: 0, searching: 0 };
  }
}

export async function handleEstado(ctx: EngineCtx): Promise<void> {
  const s = await getQuickStats();
  await ctx.send(
    `📊 <b>Estado del mapa — Venezuela Se Levanta</b>\n\n` +
      `📋 Reportes de crisis: <b>${s.reports.toLocaleString("es")}</b>\n` +
      `👥 Personas registradas: <b>${s.missing.toLocaleString("es")}</b>\n` +
      `🔴 Sin encontrar: <b>${s.searching.toLocaleString("es")}</b>\n\n` +
      `🌐 https://venezuelaselevanta.info`,
  );
}
