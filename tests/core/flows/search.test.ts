// ── Fase 1: flujos /buscar, /encontrado y callbacks found ──────────────────
import { describe, it, expect } from "vitest";
import { handle } from "@/bot/core/engine";
import { makeHarness, txt, cb } from "../../helpers/ctx";
import { server } from "../../setup/msw.server";
import { selectHandler, recordPatches } from "../../mocks/handlers/supabase";

describe("flujo /buscar", () => {
  it("pide un nombre si la consulta es muy corta", async () => {
    const h = makeHarness();
    await handle(txt("/buscar a"), h.ctx);
    expect(h.last().text).toContain("/buscar");
  });

  it("lista coincidencias", async () => {
    server.use(
      selectHandler("missing_persons", [
        { name: "Juan García", age: 30, last_seen_location: "Chacao", status: "missing" },
      ]),
    );
    const h = makeHarness();
    await handle(txt("/buscar Juan"), h.ctx);
    expect(h.last().text).toContain("Juan García");
    expect(h.last().text).toContain("Buscado/a");
  });

  it("informa cuando no hay resultados", async () => {
    server.use(selectHandler("missing_persons", []));
    const h = makeHarness();
    await handle(txt("/buscar Zoraida"), h.ctx);
    expect(h.last().text).toContain("Sin resultados");
  });
});

describe("flujo /encontrado", () => {
  it("ofrece botones de confirmación y marca como encontrada", async () => {
    server.use(
      selectHandler("missing_persons", [
        { id: "m1", name: "Ana López", age: 25, last_seen_location: "Petare" },
      ]),
    );
    const h = makeHarness();

    await handle(txt("/encontrado Ana"), h.ctx);
    const markup = h.last().markup;
    expect(markup?.kind).toBe("inline");
    if (markup?.kind === "inline") {
      expect(markup.rows[0][0].data).toBe("found:m1");
    }

    // paso 1: confirmación
    await handle(cb("found:m1"), h.ctx);
    expect(h.last().text).toContain("fue encontrado/a");

    // paso 2: ejecutar update
    const patches = recordPatches();
    server.use(patches.handler);
    await handle(cb("foundok:m1"), h.ctx);
    expect(h.last().text).toContain("marcada como encontrada");
    expect(patches.calls).toHaveLength(1);
    expect(patches.calls[0].table).toBe("missing_persons");
    expect(patches.calls[0].body).toMatchObject({ status: "found" });
    expect(patches.calls[0].search).toContain("m1");
  });
});
