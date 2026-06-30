// ── Fase 1: flujo /reportar sobre engine.handle ───────────────────────────
import { describe, it, expect } from "vitest";
import { handle } from "@/bot/core/engine";
import { makeHarness, txt, cb, loc } from "../../helpers/ctx";
import { server } from "../../setup/msw.server";
import { recordInserts, insertErrorHandler } from "../../mocks/handlers/supabase";
import {
  geminiJsonHandler,
  geminiErrorHandler,
  geminiNetworkErrorHandler,
} from "../../mocks/handlers/gemini";

describe("flujo /reportar", () => {
  it("recorre la máquina de estados paso a paso y publica el reporte", async () => {
    const ins = recordInserts();
    server.use(ins.handler);
    const h = makeHarness();

    // 1/6 — categoría
    await handle(txt("/reportar"), h.ctx);
    expect(h.session()?.state).toBe("awaiting_category");
    expect(h.last().text).toContain("1/6");
    expect(h.last().markup?.kind).toBe("inline");

    // categoría (callback) → título
    await handle(cb("cat:medical"), h.ctx);
    expect(h.session()?.state).toBe("awaiting_title");
    expect(h.session()?.draft.category).toBe("medical");
    expect(h.last().text).toContain("2/6");

    // título corto (≤20 chars: NO consulta Gemini) → descripción
    await handle(txt("Herido grave"), h.ctx);
    expect(h.session()?.state).toBe("awaiting_description");
    expect(h.session()?.draft.title).toBe("Herido grave");

    // descripción → urgencia
    await handle(txt("Edificio en Av. Bolívar"), h.ctx);
    expect(h.session()?.state).toBe("awaiting_urgency");

    // urgencia (callback) → media
    await handle(cb("urg:critical"), h.ctx);
    expect(h.session()?.state).toBe("awaiting_media");
    expect(h.session()?.draft.urgency).toBe("critical");

    // "Listo" sin adjuntos → ubicación
    await handle(txt("✅ Listo, continuar"), h.ctx);
    expect(h.session()?.state).toBe("awaiting_location");

    // ubicación dentro de Venezuela → confirmación
    await handle(loc(10.5, -66.9), h.ctx);
    expect(h.session()?.state).toBe("awaiting_confirm");
    expect(h.last().text).toContain("Resumen del reporte");

    // confirmar → INSERT + sesión limpia
    await handle(txt("✅ Confirmar y publicar"), h.ctx);
    expect(h.session()).toBeNull();
    expect(h.last().text).toContain("Reporte publicado");

    expect(ins.calls).toHaveLength(1);
    expect(ins.calls[0].table).toBe("reports");
    expect(ins.calls[0].body).toMatchObject({
      category: "medical",
      urgency: "critical",
      title: "Herido grave",
      status: "active",
      lat: 10.5,
      lng: -66.9,
      reporter_name: "Tester (Test)",
    });
  });

  it("salta pasos cuando Gemini extrae varios campos (categoría+título+urgencia)", async () => {
    server.use(
      geminiJsonHandler({
        category: "rescue",
        title: "Familia atrapada en escombros",
        urgency: "critical",
        description: "Tres personas bajo una losa",
      }),
    );
    const h = makeHarness({ session: { state: "awaiting_category", draft: {}, history: [], at: 0 } });

    await handle(txt("Hay una familia atrapada en los escombros, es urgentísimo"), h.ctx);

    // Con título + urgencia presentes salta directo a media.
    expect(h.session()?.state).toBe("awaiting_media");
    expect(h.session()?.draft).toMatchObject({
      category: "rescue",
      title: "Familia atrapada en escombros",
      urgency: "critical",
      description: "Tres personas bajo una losa",
    });
    expect(h.last().text).toContain("5/6");
  });

  it("ignora una extracción con categoría fuera de vocabulario y re-pregunta", async () => {
    server.use(geminiJsonHandler({ category: "banana", title: "X" }));
    const h = makeHarness({ session: { state: "awaiting_category", draft: {}, history: [], at: 0 } });

    await handle(txt("algo raro"), h.ctx);

    expect(h.session()?.state).toBe("awaiting_category"); // sin avanzar
    expect(h.last().text).toContain("elige una categoría");
    expect(h.last().markup?.kind).toBe("inline");
  });

  it("fallback: si Gemini falla (red) en awaiting_title, continúa con el texto crudo", async () => {
    // Equivale al timeout >5s: ambos caen en el catch de geminiJSON → null.
    server.use(geminiNetworkErrorHandler());
    const h = makeHarness({
      session: { state: "awaiting_title", draft: { category: "medical" }, history: [], at: 0 },
    });

    const longTitle = "Se derrumbó el edificio de la esquina norte del barrio";
    await handle(txt(longTitle), h.ctx);

    expect(h.session()?.state).toBe("awaiting_description");
    expect(h.session()?.draft.title).toBe(longTitle.slice(0, 120));
    expect(h.last().text).toContain("3/6");
  });

  it("rechaza ubicación fuera de Venezuela y se mantiene en awaiting_location", async () => {
    const h = makeHarness({
      session: { state: "awaiting_location", draft: { category: "medical" }, history: [], at: 0 },
    });

    await handle(loc(40.7, -74.0), h.ctx); // Nueva York
    expect(h.session()?.state).toBe("awaiting_location");
    expect(h.last().text).toContain("fuera de Venezuela");
  });

  it("informa error y limpia sesión si el INSERT falla al confirmar", async () => {
    server.use(geminiErrorHandler(), insertErrorHandler("reports"));
    const h = makeHarness({
      session: {
        state: "awaiting_confirm",
        draft: { category: "medical", title: "X", urgency: "high", lat: 10.5, lng: -66.9 },
        history: [],
        at: 0,
      },
    });

    await handle(txt("✅ Confirmar y publicar"), h.ctx);
    expect(h.session()).toBeNull();
    expect(h.last().text).toContain("No se pudo guardar");
  });
});
