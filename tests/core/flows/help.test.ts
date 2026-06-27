// ── Fase 1: flujo /ayudar (matching por cercanía, gated BOT_HELP_FLOW) ─────
import { describe, it, expect } from "vitest";
import { handle } from "@/bot/core/engine";
import { makeHarness, txt, cb, loc } from "../../helpers/ctx";
import { server } from "../../setup/msw.server";
import {
  rpcHandler,
  selectHandler,
  recordInserts,
  recordPatches,
} from "../../mocks/handlers/supabase";

describe("flujo /ayudar", () => {
  it("sugiere necesidades cercanas, vincula la oferta y pasa la need a partial", async () => {
    const ins = recordInserts();
    const patches = recordPatches();
    server.use(
      ins.handler,
      patches.handler,
      rpcHandler("suggest_needs_for_offer", [
        {
          need_id: "n1",
          title: "Agua potable",
          center_name: "Hospital X",
          distance_km: 3,
          status: "open",
        },
      ]),
      selectHandler("needs", [
        {
          id: "n1",
          title: "Agua potable",
          center_name: "Hospital X",
          site_id: null,
          contact_name: "María",
          contact_phone: "0412-9999999",
          status: "open",
        },
      ]),
    );
    const h = makeHarness();

    await handle(txt("/ayudar"), h.ctx);
    expect(h.session()?.state).toBe("help_category");

    await handle(cb("ncat:water"), h.ctx);
    expect(h.session()?.state).toBe("help_location");
    expect(h.session()?.draft.category).toBe("water");

    // ubicación → corre la RPC de sugerencias
    await handle(loc(10.5, -66.9), h.ctx);
    expect(h.session()?.state).toBe("help_pick");
    expect(h.last().text).toContain("Agua potable");
    const markup = h.last().markup;
    expect(markup?.kind).toBe("inline");
    if (markup?.kind === "inline") expect(markup.rows[0][0].data).toBe("hneed:n1");

    // elegir la necesidad → crea offer + patch need
    await handle(cb("hneed:n1"), h.ctx);
    expect(h.session()).toBeNull();
    expect(h.last().text).toContain("Gracias por ayudar");
    expect(h.last().text).toContain("María"); // contacto del punto

    const offer = ins.calls.find((c) => c.table === "offers");
    expect(offer).toBeTruthy();
    expect(offer!.body).toMatchObject({ status: "matched", need_id: "n1", category: "water" });

    expect(patches.calls).toHaveLength(1);
    expect(patches.calls[0].table).toBe("needs");
    expect(patches.calls[0].body).toMatchObject({ status: "partial" });
  });

  it("si no hay sugerencias, lo informa y limpia la sesión", async () => {
    server.use(rpcHandler("suggest_needs_for_offer", []));
    const h = makeHarness({
      session: { state: "help_location", draft: { category: "blood" }, history: [], at: 0 },
    });

    await handle(loc(10.5, -66.9), h.ctx);
    expect(h.session()).toBeNull();
    expect(h.last().text).toContain("No encontré necesidades abiertas");
  });
});
