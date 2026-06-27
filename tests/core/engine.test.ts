// ── Fase 1: comandos globales y ruteo del dispatcher ───────────────────────
import { describe, it, expect } from "vitest";
import { handle } from "@/bot/core/engine";
import { makeHarness, txt, cb } from "../helpers/ctx";

describe("engine.handle — comandos globales", () => {
  it("/ayuda lista los comandos", async () => {
    const h = makeHarness();
    await handle(txt("/ayuda"), h.ctx);
    expect(h.last().text).toContain("Comandos disponibles");
  });

  it("/cancelar limpia la sesión activa", async () => {
    const h = makeHarness({
      session: { state: "awaiting_title", draft: { category: "medical" }, history: [], at: 0 },
    });
    await handle(txt("/cancelar"), h.ctx);
    expect(h.session()).toBeNull();
    expect(h.last().text).toContain("Cancelado");
  });

  it("/start pide el nombre y luego entra en modo chat", async () => {
    const h = makeHarness();
    await handle(txt("/start"), h.ctx);
    expect(h.session()?.state).toBe("awaiting_user_name");

    await handle(txt("Carlos"), h.ctx);
    expect(h.session()?.state).toBe("chat");
    expect(h.session()?.userName).toBe("Carlos");
    expect(h.last().text).toContain("Carlos");
  });

  it("un callback sin sesión avisa que expiró", async () => {
    const h = makeHarness(); // sin sesión
    await handle(cb("cat:medical"), h.ctx);
    expect(h.last().text).toContain("sesión expiró");
  });

  it("found_cancel cancela sin tocar la base de datos", async () => {
    const h = makeHarness();
    await handle(cb("found_cancel"), h.ctx);
    expect(h.last().text).toContain("Cancelado");
  });
});
