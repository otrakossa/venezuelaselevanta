import { createFileRoute } from "@tanstack/react-router";
import type { SystemHealth } from "@/lib/system-health.types";

const PROD_PROJECT_REF = "advebubtfjgxwpjxprok";
const PROD_SUPABASE_URL_FALLBACK = `https://${PROD_PROJECT_REF}.supabase.co`;
const PROD_SUPABASE_ANON_KEY_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdmVidWJ0ZmpneHdwanhwcm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDcyMTMsImV4cCI6MjA5ODAyMzIxM30.e4w9nrHsaNRP-enNPS-beZ0Kns7KxvRtVXxRDLECS5U";

function getProdSupabaseConfig() {
  // Do not read the generic SUPABASE_* variables here: in this project they can
  // still point at the legacy backend in preview/VPS environments.
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
      {
        error: "Unauthorized: token rejected by production auth",
        status: userRes.status,
        ...authDebug,
      },
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

async function getDbStats(token: string): Promise<SystemHealth["database"]> {
  try {
    const cfg = getProdSupabaseConfig();
    const res = await fetch(`${cfg.url}/rest/v1/rpc/admin_db_stats`, {
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
      return { error: `RPC admin_db_stats: ${res.status} ${txt.slice(0, 180)}` };
    }
    const data = (await res.json()) as {
      size_bytes?: number;
      size_pretty?: string;
      tables?: { name: string; rows: number; size_bytes: number }[];
    };
    return {
      sizeMB: data.size_bytes ? +(data.size_bytes / 1024 / 1024).toFixed(1) : undefined,
      sizePretty: data.size_pretty,
      tables: (data.tables ?? []).map((table) => ({
        name: table.name,
        rows: table.rows,
        sizeMB: +(table.size_bytes / 1024 / 1024).toFixed(2),
      })),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

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

    try {
      cores = typeof os.cpus === "function" ? os.cpus().length : null;
    } catch {
      errors.push("os.cpus no disponible en este runtime");
    }

    try {
      const la = os.loadavg();
      if (Array.isArray(la) && la.length === 3) loadavg = la as [number, number, number];
    } catch {
      // Métrica opcional.
    }
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
    database: await getDbStats(token),
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