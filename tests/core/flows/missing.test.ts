// ── Fase 1: flujo /registrar_desaparecido ──────────────────────────────────
import { describe, it, expect } from "vitest";
import { handle } from "@/bot/core/engine";
import { makeHarness, txt, cb, loc } from "../../helpers/ctx";
import { server } from "../../setup/msw.server";
import { recordInserts } from "../../mocks/handlers/supabase";

describe("flujo /registrar_desaparecido", () => {
  it("recorre los pasos y registra la persona (con contacto)", async () => {
    const ins = recordInserts();
    server.use(ins.handler);
    const h = makeHarness();

    await handle(txt("/registrar_desaparecido"), h.ctx);
    expect(h.session()?.state).toBe("mp_name");
    expect(h.last().text).toContain("1/6");

    await handle(txt("Juan García"), h.ctx);
    expect(h.session()?.state).toBe("mp_age");
    expect(h.session()?.draft.name).toBe("Juan García");

    await handle(txt("35 años"), h.ctx);
    expect(h.session()?.state).toBe("mp_location");
    expect(h.session()?.draft.age).toBe(35);

    await handle(loc(10.5, -66.9), h.ctx);
    expect(h.session()?.state).toBe("mp_description");
    expect(h.session()?.draft.last_seen_lat).toBe(10.5);

    await handle(txt("Camisa azul, 1.70m"), h.ctx);
    expect(h.session()?.state).toBe("mp_photo");

    await handle(txt("⏭️ Omitir foto"), h.ctx);
    expect(h.session()?.state).toBe("mp_contact");

    await handle(txt("Ana López 0412-1234567"), h.ctx);
    expect(h.session()?.state).toBe("mp_confirm");
    expect(h.session()?.draft).toMatchObject({
      contact_name: "Ana López",
      contact_phone: "0412-1234567",
    });
    expect(h.last().text).toContain("Resumen — Persona Desaparecida");

    await handle(txt("✅ Confirmar y registrar"), h.ctx);
    expect(h.session()).toBeNull();
    expect(h.last().text).toContain("Persona registrada");

    expect(ins.calls).toHaveLength(1);
    expect(ins.calls[0].table).toBe("missing_persons");
    expect(ins.calls[0].body).toMatchObject({
      name: "Juan García",
      age: 35,
      last_seen_lat: 10.5,
      last_seen_lng: -66.9,
      description: "Camisa azul, 1.70m",
      photo_url: null,
      contact_name: "Ana López",
      contact_phone: "0412-1234567",
      status: "missing",
      source_label: "Test",
      source_id: "u1",
    });
  });

  it("permite escribir la ubicación por texto (geocoding)", async () => {
    const h = makeHarness({
      session: { state: "mp_location", draft: { name: "Pedro", age: 40 }, history: [], at: 0 },
    });

    await handle(txt("✏️ Escribir dirección"), h.ctx);
    expect(h.session()?.state).toBe("mp_text_location");

    await handle(txt("Petare, Caracas"), h.ctx);
    expect(h.session()?.state).toBe("mp_description");
    expect(h.session()?.draft).toMatchObject({
      last_seen_location: "Petare, Caracas",
      last_seen_lat: 10.5, // default del mock de Nominatim
      last_seen_lng: -66.9,
    });
  });
});
