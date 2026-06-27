// ── Fase 1: flujo /estado (con caché de stats) ─────────────────────────────
import { describe, it, expect, beforeEach } from "vitest";
import { handle } from "@/bot/core/engine";
import { invalidateStats } from "@/bot/core/flows/status";
import { makeHarness, txt } from "../../helpers/ctx";
import { server } from "../../setup/msw.server";
import { countHandler } from "../../mocks/handlers/supabase";

describe("flujo /estado", () => {
  beforeEach(() => invalidateStats()); // la caché de stats es módulo-global

  it("muestra las cifras del mapa", async () => {
    server.use(
      countHandler("reports", () => 42),
      countHandler("missing_persons", (sp) => (sp.has("status") ? 7 : 19)),
    );
    const h = makeHarness();

    await handle(txt("/estado"), h.ctx);
    const t = h.last().text;
    expect(t).toContain("Estado del mapa");
    expect(t).toContain("42"); // reportes
    expect(t).toContain("19"); // personas registradas
    expect(t).toContain("7"); // sin encontrar (status=eq.missing)
  });
});
