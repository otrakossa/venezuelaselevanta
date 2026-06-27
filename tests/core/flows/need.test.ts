// ── Fase 1: flujo /necesidad (gated BOT_NEEDS_FLOW, activo en test.env) ─────
import { describe, it, expect } from "vitest";
import { handle } from "@/bot/core/engine";
import { makeHarness, txt, cb, loc } from "../../helpers/ctx";
import { server } from "../../setup/msw.server";
import { recordInserts } from "../../mocks/handlers/supabase";

describe("flujo /necesidad", () => {
  it("recorre los pasos, crea el sitio y publica la necesidad", async () => {
    const ins = recordInserts();
    server.use(ins.handler);
    const h = makeHarness();

    await handle(txt("/necesidad"), h.ctx);
    expect(h.session()?.state).toBe("need_site");
    expect(h.last().text).toContain("1/5");

    await handle(txt("Hospital Central"), h.ctx);
    expect(h.session()?.state).toBe("need_category");

    await handle(cb("ncat:water"), h.ctx);
    expect(h.session()?.state).toBe("need_description");
    expect(h.session()?.draft.category).toBe("water");

    await handle(txt("Falta agua potable"), h.ctx);
    expect(h.session()?.state).toBe("need_quantity");

    await handle(txt("50 bidones"), h.ctx);
    expect(h.session()?.state).toBe("need_location");

    await handle(loc(10.5, -66.9), h.ctx);
    expect(h.session()?.state).toBe("need_responsible");

    await handle(txt("⏭️ Sin responsable"), h.ctx);
    expect(h.session()?.state).toBe("need_confirm");
    expect(h.last().text).toContain("Resumen — Necesidad");

    await handle(txt("✅ Confirmar y publicar"), h.ctx);
    expect(h.session()).toBeNull();
    expect(h.last().text).toContain("Necesidad publicada");

    // Crea el site (insertReturning) y luego la need.
    const site = ins.calls.find((c) => c.table === "sites");
    const need = ins.calls.find((c) => c.table === "needs");
    expect(site).toBeTruthy();
    expect(need).toBeTruthy();
    expect(need!.body).toMatchObject({
      category: "water",
      status: "open",
      urgency: "high",
      center_name: "Hospital Central",
      quantity: "50 bidones",
      site_id: "gen-1", // id sintético devuelto por el mock de insertReturning
    });
  });
});
