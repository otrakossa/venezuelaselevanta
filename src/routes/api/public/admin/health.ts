import { createFileRoute } from "@tanstack/react-router";
import type { SystemHealth, ScraperRun, TableStat } from "@/lib/system-health.types";

const PROD_PROJECT_REF = "advebubtfjgxwpjxprok";
const PROD_SUPABASE_URL_FALLBACK = `https://${PROD_PROJECT_REF}.supabase.co`;
const PROD_SUPABASE_ANON_KEY_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdmVidWJ0ZmpneHdwanhwcm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDcyMTMsImV4cCI6MjA5ODAyMzIxM30.e4w9nrHsaNRP-enNPS-beZ0Kns7KxvRtVXxRDLECS5U";

function getProdSupabaseConfig() {
  const url = process.env.NEW_SUPABASE_URL || PROD_SUPABASE_URL_FALLBACK;
  const anonKey = process.env.NEW_SUPABASE_PUBLISHABLE_KEY || PROD_SUPABASE_ANON_KEY_FALLBACK;
  return { url: url.replace(/\/$/, ""), anonKey };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function safeAuthDebug(token: string) {
  const payload = decodeJwtPayload(token);
  const issuer = typeof payload?.iss === "string" ? payload.iss : null;
  return {
    projectRef: PROD_PROJECT_REF,
    tokenIssuerMatchesProduction: issuer ? issuer.includes(PROD_PROJECT_REF) : false,
    tokenAudience: typeof payload?.aud === "string" ? payload.aud : null,
    tokenSubjectPresent: typeof payload?.sub === "string" && payload.sub.length > 0,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function requireAdmin(request: Request): Promise<{ token: string; userId: string } | Response> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized: missing bearer token", projectRef: PROD_PROJECT_REF }, 401);
  }

  const token = authHeader.slice(7);
  const cfg = getProdSupabaseConfig();
  const authDebug = safeAuthDebug(token);

  const userRes = await fetch(`${cfg.url}/auth/v1/user`, {
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) {
    return json(
      { error: "Unauthorized: token rejected by production auth", status: userRes.status, ...authDebug },
      401,
    );
  }

  const user = (await userRes.json()) as { id?: string };
  if (!user.id) {
    return json({ error: "Unauthorized: user payload missing id", ...authDebug }, 401);
  }

  const roleRes = await fetch(`${cfg.url}/rest/v1/rpc/has_role`, {
    method: "POST",
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ _user_id: user.id, _role: "admin" }),
  });
  if (!roleRes.ok) {
    return json({ error: "Forbidden: admin role check failed", status: roleRes.status, projectRef: PROD_PROJECT_REF }, 403);
  }

  const isAdmin = (await roleRes.json()) as boolean;
  if (!isAdmin) return json({ error: "Forbidden: admin role required", projectRef: PROD_PROJECT_REF }, 403);

  return { token, userId: user.id };
}

// ── Supabase: estadísticas extendidas (BD + app) ──────────────────────────────
async function getExtendedStats(token: string): Promise<{
  database: SystemHealth["database"];
  appStats: SystemHealth["appStats"];
}> {
  try {
    const cfg = getProdSupabaseConfig();
    const res = await fetch(`${cfg.url}/rest/v1/rpc/admin_extended_stats`, {
      method: "POST",
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!res.ok) {
      const txt = await res.text();
      const err = `RPC admin_extended_stats: ${res.status} ${txt.slice(0, 180)}`;
      return {
        database: { error: err },
        appStats: { authUsers: null, authUsers24h: null, visitors: null, scraperRuns: [], error: err },
      };
    }

    const d = (await res.json()) as {
      db_size_bytes?: number;
      db_size_pretty?: string;
      table_stats?: {
        name: string; rows: number; dead_rows: number; inserts: number; updates: number;
        deletes: number; size_bytes: number; seq_scans: number; idx_scans: number;
      }[];
      db_connections?: { total: number; active: number; idle: number; waiting: number };
      unused_indexes?: { table: string; index: string; size_bytes: number }[];
      auth_users?: number;
      auth_users_24h?: number;
      visitors?: { today: number; yesterday: number; week: number; total: number; unique_total: number };
      scraper_runs?: {
        source: string; status: string; started_at: string | null; finished_at: string | null;
        duration_ms: number | null; inserted: number | null; seen: number | null;
        matches: number | null; error: string | null;
      }[];
    };

    const tables: TableStat[] = (d.table_stats ?? []).map((t) => ({
      name: t.name,
      rows: t.rows,
      deadRows: t.dead_rows,
      sizeMB: +(t.size_bytes / 1024 / 1024).toFixed(2),
      inserts: t.inserts,
      updates: t.updates,
      deletes: t.deletes,
      seqScans: t.seq_scans,
      idxScans: t.idx_scans,
    }));

    const scraperRuns: ScraperRun[] = (d.scraper_runs ?? []).map((r) => ({
      source: r.source,
      status: r.status,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      durationMs: r.duration_ms,
      inserted: r.inserted,
      seen: r.seen,
      matches: r.matches,
      error: r.error,
    }));

    return {
      database: {
        sizeMB: d.db_size_bytes ? +(d.db_size_bytes / 1024 / 1024).toFixed(1) : undefined,
        sizePretty: d.db_size_pretty,
        tables,
        connections: d.db_connections,
        unusedIndexes: (d.unused_indexes ?? []).map((i) => ({
          table: i.table,
          index: i.index,
          sizeMB: +(i.size_bytes / 1024 / 1024).toFixed(2),
        })),
      },
      appStats: {
        authUsers: d.auth_users ?? null,
        authUsers24h: d.auth_users_24h ?? null,
        visitors: d.visitors
          ? {
              today: d.visitors.today,
              yesterday: d.visitors.yesterday,
              week: d.visitors.week,
              total: d.visitors.total,
              uniqueTotal: d.visitors.unique_total,
            }
          : null,
        scraperRuns,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      database: { error: msg },
      appStats: { authUsers: null, authUsers24h: null, visitors: null, scraperRuns: [], error: msg },
    };
  }
}

// ── Red: I/O acumulado por interfaz (Linux /proc/net/dev) ─────────────────────
async function getNetworkStats(): Promise<SystemHealth["network"]> {
  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile("/proc/net/dev", "utf8");
    const MB = 1024 * 1024;
    const interfaces = raw
      .split("\n")
      .slice(2)
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 10) return null;
        const name = parts[0].replace(":", "");
        if (name === "lo") return null;
        return { name, rxMB: +(+parts[1] / MB).toFixed(1), txMB: +(+parts[9] / MB).toFixed(1) };
      })
      .filter((x): x is { name: string; rxMB: number; txMB: number } => x !== null);
    return { interfaces };
  } catch {
    return null;
  }
}

// ── Backup: último dump en /var/backups/vsl ───────────────────────────────────
async function getBackupStatus(): Promise<SystemHealth["backup"]> {
  try {
    const fs = await import("node:fs/promises");
    const dir = "/var/backups/vsl";
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".dump")).sort().reverse();
    if (!files.length) return { lastFile: null, lastSizeMB: null, lastModified: null };
    const lastFile = files[0];
    const stat = await fs.stat(`${dir}/${lastFile}`);
    return {
      lastFile,
      lastSizeMB: +(stat.size / 1024 / 1024).toFixed(1),
      lastModified: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

// ── Servicios externos: latencia + status HTTP ────────────────────────────────
async function checkExternalServices(): Promise<SystemHealth["externalServices"]> {
  const targets = [
    { name: "venezuaselevanta.info", url: "https://venezuelaselevanta.info/api/public/health" },
    { name: "localizapacientes.com", url: "https://localizapacientes.com" },
    { name: "desaparecidosterremotovenezuela.com", url: "https://desaparecidosterremotovenezuela.com" },
    { name: "Supabase Auth", url: `${PROD_SUPABASE_URL_FALLBACK}/auth/v1/health` },
  ];

  return Promise.all(
    targets.map(async ({ name, url }) => {
      const t0 = Date.now();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        return { name, url, ok: res.ok, statusCode: res.status, latencyMs: Date.now() - t0 };
      } catch {
        return { name, url, ok: false, statusCode: null, latencyMs: Date.now() - t0 };
      }
    }),
  );
}

// ── Recolección principal ─────────────────────────────────────────────────────
async function readSystemHealth(token: string): Promise<SystemHealth> {
  const errors: string[] = [];
  const MB = 1024 * 1024;
  const GB = MB * 1024;
  const mem = process.memoryUsage();

  let osMem: SystemHealth["memory"]["os"] = null;
  let cores: number | null = null;
  let loadavg: [number, number, number] | null = null;

  try {
    const os = await import("node:os");
    const total = os.totalmem();
    const free = os.freemem();
    osMem = {
      totalMB: +(total / MB).toFixed(0),
      freeMB: +(free / MB).toFixed(0),
      usedMB: +((total - free) / MB).toFixed(0),
      usedPct: +(((total - free) / total) * 100).toFixed(1),
    };
    try { cores = typeof os.cpus === "function" ? os.cpus().length : null; } catch { errors.push("os.cpus no disponible"); }
    try {
      const la = os.loadavg();
      if (Array.isArray(la) && la.length === 3) loadavg = la as [number, number, number];
    } catch { /* opcional */ }
  } catch (error) {
    errors.push("node:os no disponible: " + (error instanceof Error ? error.message : String(error)));
  }

  let disk: SystemHealth["disk"] = null;
  try {
    const fs = await import("node:fs/promises");
    const path = process.cwd() || "/";
    const statfs = (fs as unknown as {
      statfs?: (p: string) => Promise<{ bsize: number; blocks: number; bfree: number; bavail: number }>;
    }).statfs;
    if (!statfs) throw new Error("statfs no disponible");
    const s = await statfs(path);
    const total = s.blocks * s.bsize;
    const free = s.bavail * s.bsize;
    disk = {
      path,
      totalGB: +(total / GB).toFixed(2),
      freeGB: +(free / GB).toFixed(2),
      usedGB: +((total - free) / GB).toFixed(2),
      usedPct: +(((total - free) / total) * 100).toFixed(1),
    };
  } catch (error) {
    errors.push("Disco no disponible: " + (error instanceof Error ? error.message : String(error)));
  }

  const [{ database, appStats }, network, backup, externalServices] = await Promise.all([
    getExtendedStats(token),
    getNetworkStats(),
    getBackupStatus(),
    checkExternalServices(),
  ]);

  return {
    timestamp: new Date().toISOString(),
    node: {
      version: process.version,
      uptimeSec: Math.round(process.uptime()),
      pid: process.pid,
    },
    memory: {
      process: {
        rssMB: +(mem.rss / MB).toFixed(1),
        heapUsedMB: +(mem.heapUsed / MB).toFixed(1),
        heapTotalMB: +(mem.heapTotal / MB).toFixed(1),
        externalMB: +(mem.external / MB).toFixed(1),
      },
      os: osMem,
    },
    cpu: {
      cores,
      loadavg,
      loadPctPerCore: loadavg && cores ? +((loadavg[0] / cores) * 100).toFixed(1) : null,
    },
    disk,
    network,
    backup,
    externalServices,
    database,
    appStats,
    errors,
  };
}

export const Route = createFileRoute("/api/public/admin/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const admin = await requireAdmin(request);
        if (admin instanceof Response) return admin;

        try {
          return json(await readSystemHealth(admin.token));
        } catch (error) {
          console.error(error);
          return json({ error: "No se pudieron leer las métricas" }, 500);
        }
      },
    },
  },
});
