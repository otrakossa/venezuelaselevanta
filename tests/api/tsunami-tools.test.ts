// ── Smoke tests para tsunami-tools.server.ts ───────────────────────────────
// Verifica shape de tools (input schemas), y ejecuta un par contra MSW.
import { describe, it, expect } from "vitest";
import { server } from "../setup/msw.server";
import { http, HttpResponse } from "msw";
import { tsunamiTools } from "@/lib/tsunami-tools.server";
import { SUPA_URL } from "@/lib/supabase-rest";

// AI SDK v5 tool()s have inputSchema (Zod). Call the executor directly.
type ToolExec = { execute?: (i: unknown, opts?: unknown) => Promise<unknown> };
const exec = async (name: keyof typeof tsunamiTools, input: unknown) => {
  const t = tsunamiTools[name] as unknown as ToolExec;
  if (!t.execute) throw new Error(`tool ${String(name)} has no execute()`);
  return t.execute(input, {} as never);
};

describe("tsunamiTools shape", () => {
  it("expone las herramientas esperadas", () => {
    expect(Object.keys(tsunamiTools).sort()).toEqual(
      [
        "get_missing_person",
        "get_need",
        "guide_offer_help",
        "list_needs",
        "register_missing_person",
        "search_missing_persons",
        "suggest_patient_matches",
      ].sort(),
    );
  });

  it("search_missing_persons exige query o id_number", async () => {
    const out = (await exec("search_missing_persons", { limit: 5 })) as { error?: string };
    expect(out.error).toMatch(/query o id_number/);
  });
});

describe("tsunamiTools contra MSW", () => {
  it("search_missing_persons por cédula devuelve resultados normalizados con URL", async () => {
    server.use(
      http.get(`${SUPA_URL}/rest/v1/missing_persons`, ({ request }) => {
        const sp = new URL(request.url).searchParams;
        expect(sp.get("id_number")).toBe("eq.V12345678");
        return HttpResponse.json([
          {
            id: "11111111-1111-1111-1111-111111111111",
            name: "Ana Pérez",
            age: 30,
            id_number: "V12345678",
            state: "Miranda",
            municipality: "Baruta",
            status: "missing",
            photo_url: null,
          },
        ]);
      }),
    );
    const out = (await exec("search_missing_persons", {
      id_number: "V12345678",
      limit: 3,
    })) as { count: number; results: Array<{ url: string; id: string }> };
    expect(out.count).toBe(1);
    expect(out.results[0].id).toBe("11111111-1111-1111-1111-111111111111");
    expect(out.results[0].url).toContain("venezuelaselevanta.info/desaparecidos?person=");
  });

  it("register_missing_person requiere confirmación explícita antes de escribir", async () => {
    let posts = 0;
    server.use(
      http.post(`${SUPA_URL}/rest/v1/missing_persons`, () => {
        posts++;
        return HttpResponse.json([{ id: "gen-1" }]);
      }),
    );
    const preview = (await exec("register_missing_person", {
      confirm: false,
      full_name: "Juan Pérez",
    })) as { status: string };
    expect(preview.status).toBe("pending_confirmation");
    expect(posts).toBe(0);

    const created = (await exec("register_missing_person", {
      confirm: true,
      full_name: "Juan Pérez",
      age: 40,
    })) as { status: string; id: string };
    expect(created.status).toBe("ok");
    expect(posts).toBe(1);
  });

  it("suggest_patient_matches degrada a lista vacía cuando el RPC falla", async () => {
    server.use(
      http.post(`${SUPA_URL}/rest/v1/rpc/suggest_patient_matches`, () =>
        new HttpResponse("boom", { status: 500 }),
      ),
    );
    const out = (await exec("suggest_patient_matches", {
      missing_person_id: "22222222-2222-2222-2222-222222222222",
    })) as { count: number; matches: unknown[]; error?: string };
    expect(out.count).toBe(0);
    expect(out.matches).toEqual([]);
    expect(out.error).toBeTruthy();
  });
});
