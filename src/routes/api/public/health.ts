import { createFileRoute } from "@tanstack/react-router";

// Health endpoint. Two modes:
//   GET /api/public/health          → cheap liveness (no DB) — for nginx upstream + client build-id
//   GET /api/public/health?deep=1   → deep check (DB latency, last scraper, last dedupe, subs)
//                                     Returns 200 when healthy, 503 when degraded.
//
// Wire the deep variant into UptimeRobot / BetterStack for real degradation alerts.

type CheckResult = { ok: boolean; ms?: number; detail?: unknown; error?: string };

async function restGet(path: string): Promise<Response> {
  const url = process.env.SUPABASE_URL ?? process.env.NEW_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEW_SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase server env");
  return fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });
}

async function timed<T>(fn: () => Promise<T>): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    const detail = await fn();
    return { ok: true, ms: Date.now() - t0, detail };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkDb(): Promise<CheckResult> {
  return timed(async () => {
    const res = await restGet("missing_persons?select=id&limit=1");
    if (!res.ok) throw new Error(`db ${res.status}`);
    return { rows: (await res.json()).length };
  });
}

async function checkLastPatientUpdate(): Promise<CheckResult> {
  return timed(async () => {
    const res = await restGet(
      "patients?select=updated_at&order=updated_at.desc&limit=1",
    );
    if (!res.ok) throw new Error(`patients ${res.status}`);
    const rows = (await res.json()) as Array<{ updated_at: string }>;
    const last = rows[0]?.updated_at ?? null;
    const ageHours = last
      ? (Date.now() - new Date(last).getTime()) / 36e5
      : null;
    return { last, ageHours };
  });
}

async function checkPushSubs(): Promise<CheckResult> {
  return timed(async () => {
    const res = await restGet("push_subscriptions?select=id&limit=1");
    if (!res.ok) throw new Error(`push_subs ${res.status}`);
    return { reachable: true };
  });
}

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const build =
          process.env.SOURCE_VERSION ??
          process.env.GIT_COMMIT ??
          process.env.COMMIT_SHA ??
          "unknown";

        const url = new URL(request.url);
        const deep = url.searchParams.get("deep") === "1";

        if (!deep) {
          return new Response(
            JSON.stringify({ ok: true, build, ts: Date.now() }),
            {
              status: 200,
              headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "no-store",
              },
            },
          );
        }

        const [db, patients, subs] = await Promise.all([
          checkDb(),
          checkLastPatientUpdate(),
          checkPushSubs(),
        ]);

        // Degraded if DB is down, or scraper hasn't touched patients in >24h.
        const patientAge =
          patients.ok &&
          typeof (patients.detail as { ageHours: number | null })?.ageHours === "number"
            ? (patients.detail as { ageHours: number }).ageHours
            : null;
        const scraperStale = patientAge !== null && patientAge > 24;

        const ok = db.ok && subs.ok && !scraperStale;
        return new Response(
          JSON.stringify({
            ok,
            build,
            ts: Date.now(),
            checks: {
              db,
              last_patient_update: patients,
              push_subs: subs,
              scraper_stale: scraperStale,
            },
          }),
          {
            status: ok ? 200 : 503,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
            },
          },
        );
      },
    },
  },
});
