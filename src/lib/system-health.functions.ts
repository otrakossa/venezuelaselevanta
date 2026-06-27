import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HealthMetric = {
  ok: boolean;
  value?: number;
  detail?: string;
  error?: string;
};

export type SystemHealth = {
  timestamp: string;
  node: {
    version: string;
    uptimeSec: number;
    pid: number;
  };
  memory: {
    process: { rssMB: number; heapUsedMB: number; heapTotalMB: number; externalMB: number };
    os: { totalMB: number; freeMB: number; usedMB: number; usedPct: number } | null;
  };
  cpu: {
    cores: number | null;
    loadavg: [number, number, number] | null;
    loadPctPerCore: number | null;
  };
  disk: {
    path: string;
    totalGB: number;
    freeGB: number;
    usedGB: number;
    usedPct: number;
  } | null;
  database: {
    sizeMB?: number;
    sizePretty?: string;
    tables?: { name: string; rows: number; sizeMB: number }[];
    error?: string;
  } | null;
  errors: string[];
};

async function getDbStats(): Promise<SystemHealth["database"]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { error: "Service role key no configurada" };
  try {
    const res = await fetch(`${url}/rest/v1/rpc/admin_db_stats`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!res.ok) {
      const txt = await res.text();
      return { error: `RPC admin_db_stats: ${res.status} ${txt.slice(0, 180)}` };
    }
    const json = (await res.json()) as {
      size_bytes?: number;
      size_pretty?: string;
      tables?: { name: string; rows: number; size_bytes: number }[];
    };
    return {
      sizeMB: json.size_bytes ? +(json.size_bytes / 1024 / 1024).toFixed(1) : undefined,
      sizePretty: json.size_pretty,
      tables: (json.tables ?? []).map((t) => ({
        name: t.name,
        rows: t.rows,
        sizeMB: +(t.size_bytes / 1024 / 1024).toFixed(2),
      })),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export const getSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SystemHealth> => {
    // Admin gate
    const { data: isAdmin } = await (context as { supabase: any }).supabase.rpc("has_role", {
      _user_id: (context as { userId: string }).userId,
      _role: "admin",
    });
    if (!isAdmin) {
      throw new Response("Forbidden", { status: 403 });
    }

    const errors: string[] = [];
    const MB = 1024 * 1024;
    const GB = MB * 1024;

    // Memory
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
        cores = os.cpus()?.length ?? null;
      } catch (e) {
        errors.push("os.cpus no disponible en este runtime");
      }
      try {
        const la = os.loadavg();
        if (Array.isArray(la) && la.length === 3) loadavg = la as [number, number, number];
      } catch {
        // ignore
      }
    } catch (e) {
      errors.push("node:os no disponible: " + (e instanceof Error ? e.message : String(e)));
    }

    // Disk
    let disk: SystemHealth["disk"] = null;
    try {
      const fs = await import("node:fs/promises");
      const path = process.cwd() || "/";
      // statfs is Node 18.15+
      const s = await (fs as unknown as { statfs: (p: string) => Promise<{ bsize: number; blocks: number; bfree: number; bavail: number }> }).statfs(path);
      const total = s.blocks * s.bsize;
      const free = s.bavail * s.bsize;
      disk = {
        path,
        totalGB: +(total / GB).toFixed(2),
        freeGB: +(free / GB).toFixed(2),
        usedGB: +((total - free) / GB).toFixed(2),
        usedPct: +(((total - free) / total) * 100).toFixed(1),
      };
    } catch (e) {
      errors.push("Disco no disponible: " + (e instanceof Error ? e.message : String(e)));
    }

    const database = await getDbStats();

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
      database,
      errors,
    };
  });
