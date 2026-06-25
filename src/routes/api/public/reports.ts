import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// In-memory rate limiter: max 10 reports per IP per hour
const LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000;
const ipMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (entry.count >= LIMIT) return true;
  entry.count++;
  return false;
}

export const Route = createFileRoute("/api/public/reports")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const ip = getClientIp(request);
        if (isRateLimited(ip)) {
          return new Response(
            JSON.stringify({ error: "Demasiados reportes. Intenta en una hora." }),
            { status: 429, headers: { "Content-Type": "application/json", ...CORS } },
          );
        }

        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "JSON inválido" }),
            { status: 400, headers: { "Content-Type": "application/json", ...CORS } },
          );
        }

        const { title, category, urgency, lat, lng } = body;
        if (!title || !category || !urgency || typeof lat !== "number" || typeof lng !== "number") {
          return new Response(
            JSON.stringify({ error: "Faltan campos requeridos" }),
            { status: 400, headers: { "Content-Type": "application/json", ...CORS } },
          );
        }

        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const res = await fetch(`${url}/rest/v1/reports`, {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        return new Response(JSON.stringify(data), {
          status: res.ok ? 201 : res.status,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      },
    },
  },
});
