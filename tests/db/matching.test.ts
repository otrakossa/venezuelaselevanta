// ── Fase 4: correctitud de las RPC de matching contra Supabase LOCAL real ──
// Requiere `supabase start` + `supabase db reset` (migraciones aplicadas).
// Se conecta como superusuario al Postgres local (bypassa RLS/grants; la RPC
// suggest_patient_matches solo concede EXECUTE a `authenticated`). Cada test
// trunca y siembra sus propias fixtures → aislamiento total.
import { describe, it, expect, afterAll, beforeEach } from "vitest";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });

afterAll(async () => {
  await sql.end();
});

beforeEach(async () => {
  await sql`truncate table
    public.offers, public.needs, public.site_responsibles, public.sites,
    public.patients, public.missing_persons
    restart identity cascade`;
});

// Helpers de inserción (devuelven id).
const need = (over: Record<string, unknown>) => ({
  title: "X",
  category: "water",
  center_name: "Centro",
  status: "open",
  urgency: "medium",
  ...over,
});
async function addNeed(over: Record<string, unknown>): Promise<string> {
  const [row] = await sql`insert into public.needs ${sql(need(over))} returning id`;
  return row.id as string;
}
async function addPatient(p: Record<string, unknown>): Promise<void> {
  await sql`insert into public.patients ${sql(p)}`;
}

const ALL = (...args: unknown[]) =>
  sql`select * from public.suggest_needs_for_offer(${args[0]}, ${args[1]}, ${args[2]}, ${args[3]}, ${args[4]}, ${args[5]})`;

describe("RPC suggest_needs_for_offer (matching por cercanía)", () => {
  it("ordena por TIER DIVIPOL por encima de urgencia y distancia", async () => {
    // El de parroquia es lejano y de baja urgencia, pero el tier manda.
    await addNeed({ title: "PARISH", state: "Miranda", municipality: "Sucre", parish: "Petare", urgency: "low", lat: 11.5, lng: -66.0 });
    await addNeed({ title: "MUNI", state: "Miranda", municipality: "Sucre", parish: "Leoncio Martínez", urgency: "critical", lat: 10.5, lng: -66.9 });
    await addNeed({ title: "STATE", state: "Miranda", municipality: "Baruta", parish: "Z", urgency: "critical", lat: 10.5, lng: -66.9 });
    await addNeed({ title: "OTHER", state: "Zulia", municipality: "Maracaibo", parish: "Q", urgency: "critical", lat: 10.5, lng: -66.9 });

    const rows = await ALL("water", 10.5, -66.9, "Miranda", "Sucre", "Petare");
    expect(rows.map((r) => r.title)).toEqual(["PARISH", "MUNI", "STATE", "OTHER"]);
    expect(rows.map((r) => r.tier)).toEqual([0, 1, 2, 3]);
  });

  it("dentro del mismo tier ordena por urgencia y luego por distancia", async () => {
    await addNeed({ title: "HIGH_NEAR", category: "food", urgency: "high", lat: 10.5, lng: -66.9 }); // 0 km
    await addNeed({ title: "CRIT_FAR", category: "food", urgency: "critical", lat: 10.6, lng: -66.9 }); // ~11 km
    await addNeed({ title: "CRIT_NEAR", category: "food", urgency: "critical", lat: 10.5, lng: -66.91 }); // ~1 km

    const rows = await ALL("food", 10.5, -66.9, null, null, null);
    expect(rows.map((r) => r.title)).toEqual(["CRIT_NEAR", "CRIT_FAR", "HIGH_NEAR"]);
    // la distancia haversine se calcula
    expect(Number(rows[0].distance_km)).toBeGreaterThan(0);
    expect(Number(rows[0].distance_km)).toBeLessThan(Number(rows[1].distance_km));
  });

  it("filtra por estado (solo open/partial) y por categoría", async () => {
    await addNeed({ title: "OPEN", category: "medicine", status: "open" });
    await addNeed({ title: "PARTIAL", category: "medicine", status: "partial" });
    await addNeed({ title: "FULFILLED", category: "medicine", status: "fulfilled" });
    await addNeed({ title: "OTHERCAT", category: "water", status: "open" });

    const titles = (await ALL("medicine", null, null, null, null, null)).map((r) => r.title);
    expect(titles).toContain("OPEN");
    expect(titles).toContain("PARTIAL");
    expect(titles).not.toContain("FULFILLED"); // la RPC excluye fulfilled
    expect(titles).not.toContain("OTHERCAT"); // filtra por categoría
  });
});

describe("RPC suggest_patient_matches (desaparecidos ↔ pacientes)", () => {
  it("puntúa por similitud de nombre + sector, filtra por edad y excluye ya vinculados", async () => {
    const [m] = await sql`insert into public.missing_persons ${sql({
      name: "Juan Pérez",
      age: 30,
      last_seen_location: "Sector El Valle, Caracas",
    })} returning id`;
    const mid = m.id as string;

    await addPatient({ name: "Juan Pérez", age: 31, sector: "El Valle", center_name: "Hospital A" }); // nombre ⩰ + sector
    await addPatient({ name: "Juan Pérez", age: 29, sector: "Chacao", center_name: "Hospital B" }); // nombre ⩰, sin sector
    await addPatient({ name: "Carlos Ramírez", age: 30, center_name: "Hospital C" }); // similitud < 0.40
    await addPatient({ name: "Juan Pérez", age: 40, center_name: "Hospital D" }); // edad fuera de ±2
    await addPatient({ name: "Juan Pérez", age: 30, center_name: "Hospital E", matched_missing_id: mid }); // ya vinculado

    const rows = await sql`select * from public.suggest_patient_matches(${mid})`;
    expect(rows.map((r) => r.center_name)).toEqual(["Hospital A", "Hospital B"]);
    // el boost de sector deja a Hospital A por encima
    expect(Number(rows[0].score)).toBeGreaterThan(Number(rows[1].score));
  });
});

describe("Transición de estados al vincular (vocabulario real)", () => {
  it("need open→partial→fulfilled y offer available→matched, reflejado en la RPC", async () => {
    const nid = await addNeed({
      title: "NEED1",
      category: "water",
      status: "open",
      state: "Miranda",
      municipality: "Sucre",
      parish: "Petare",
      lat: 10.5,
      lng: -66.9,
    });

    // 'open' → aparece en sugerencias
    let rows = await ALL("water", 10.5, -66.9, "Miranda", "Sucre", "Petare");
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("open");

    // vincular (lo que hace la app/bot): offer matched + need partial
    const [offer] = await sql`insert into public.offers ${sql({
      title: "Ofrezco agua",
      category: "water",
      contact_name: "Ana",
      status: "available",
    })} returning id`;
    await sql`update public.offers set need_id = ${nid}, status = 'matched' where id = ${offer.id}`;
    await sql`update public.needs set status = 'partial' where id = ${nid}`;

    // 'partial' → sigue apareciendo
    rows = await ALL("water", 10.5, -66.9, "Miranda", "Sucre", "Petare");
    expect(rows[0].status).toBe("partial");
    const [o] = await sql`select status, need_id from public.offers where id = ${offer.id}`;
    expect(o.status).toBe("matched");
    expect(o.need_id).toBe(nid);

    // 'fulfilled' → desaparece de sugerencias
    await sql`update public.needs set status = 'fulfilled' where id = ${nid}`;
    rows = await ALL("water", 10.5, -66.9, "Miranda", "Sucre", "Petare");
    expect(rows).toHaveLength(0);
  });
});
