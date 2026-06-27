// ── Fase 1: conversación libre (Gemini) + ruteo de intención + fallback ────
import { describe, it, expect, beforeEach } from "vitest";
import { handle } from "@/bot/core/engine";
import { invalidateStats } from "@/bot/core/flows/status";
import { makeHarness, txt } from "../../helpers/ctx";
import { server } from "../../setup/msw.server";
import {
  geminiJsonHandler,
  geminiSplitHandler,
  geminiNetworkErrorHandler,
} from "../../mocks/handlers/gemini";
import { selectHandler } from "../../mocks/handlers/supabase";

describe("conversación libre / ruteo de intención", () => {
  beforeEach(() => invalidateStats());

  it("intención 'report' con categoría+título arranca el flujo de reporte", async () => {
    server.use(geminiJsonHandler({ intent: "report", category: "medical", title: "Edificio colapsado" }));
    const h = makeHarness(); // sin sesión

    await handle(txt("se cayó un edificio y hay heridos"), h.ctx);
    expect(h.session()?.state).toBe("awaiting_description");
    expect(h.session()?.draft).toMatchObject({ category: "medical", title: "Edificio colapsado" });
    expect(h.last().text).toContain("voy a registrar");
  });

  it("intención 'status' muestra las cifras", async () => {
    server.use(geminiJsonHandler({ intent: "status" }));
    const h = makeHarness();
    await handle(txt("cuántos reportes hay"), h.ctx);
    expect(h.last().text).toContain("Estado del mapa");
  });

  it("intención 'search_missing' con query busca a la persona", async () => {
    server.use(
      geminiJsonHandler({ intent: "search_missing", query: "Juan" }),
      selectHandler("missing_persons", [
        { name: "Juan García", age: 30, last_seen_location: "Chacao", status: "missing" },
      ]),
    );
    const h = makeHarness();
    await handle(txt("estoy buscando a Juan"), h.ctx);
    expect(h.last().text).toContain("Juan García");
  });

  it("intención desconocida responde por chat y guarda historial", async () => {
    server.use(geminiSplitHandler({ json: { intent: "unknown" }, text: "Mantén la calma 🇻🇪" }));
    const h = makeHarness();
    await handle(txt("hola, tengo miedo"), h.ctx);
    expect(h.last().text).toBe("Mantén la calma 🇻🇪");
    expect(h.session()?.state).toBe("chat");
    expect(h.session()?.history).toHaveLength(2); // user + bot
  });

  it("fallback: si Gemini está caído, responde con el mensaje de auxilio", async () => {
    server.use(geminiNetworkErrorHandler());
    const h = makeHarness();
    await handle(txt("qué hago ahora"), h.ctx);
    expect(h.last().text).toContain("Estoy aquí para ayudarte");
    expect(h.last().text).toContain("171"); // números de emergencia
  });
});
