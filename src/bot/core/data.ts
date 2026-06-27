// ── Acceso a Supabase: fetch directo con header apikey (NO supabase-js) ────
const SUPA_URL = process.env.SUPABASE_URL!;
const SUPA_ANON = process.env.SUPABASE_PUBLISHABLE_KEY!;
const SUPA_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function supabaseCount(table: string, filter = ""): Promise<number> {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/${table}?select=id&limit=1${filter ? "&" + filter : ""}`,
    {
      headers: {
        apikey: SUPA_ANON,
        Authorization: `Bearer ${SUPA_ANON}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    },
  );
  const m = (res.headers.get("content-range") ?? "").match(/\/(\d+)$/);
  return m ? parseInt(m[1]) : 0;
}

export async function supabaseSelect(
  table: string,
  query: string,
): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` },
  });
  return res.ok ? res.json() : [];
}

export async function supabaseInsert(
  table: string,
  body: Record<string, unknown>,
): Promise<string | null> {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPA_ANON,
      Authorization: `Bearer ${SUPA_ANON}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  return res.ok ? null : await res.text();
}

export async function supabasePatch(
  table: string,
  filter: string,
  body: Record<string, unknown>,
): Promise<boolean> {
  const key = SUPA_SVC || SUPA_ANON;
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}
