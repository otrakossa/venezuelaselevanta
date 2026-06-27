import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/push/manage")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return json({ error: "bad json" }, 400);
        }
        const { action, endpoint } = body ?? {};
        if (!endpoint || typeof endpoint !== "string" || endpoint.length < 20) {
          return json({ error: "invalid endpoint" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (action === "unsubscribe") {
          const { error } = await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", endpoint);
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true });
        }

        if (action === "upsert") {
          const { p256dh, auth, lat, lng, radius_km, user_agent } = body;
          if (typeof p256dh !== "string" || typeof auth !== "string") {
            return json({ error: "invalid keys" }, 400);
          }
          const radius = Number.isFinite(radius_km) ? Number(radius_km) : 10;
          const payload = {
            endpoint,
            p256dh,
            auth,
            lat: typeof lat === "number" ? lat : null,
            lng: typeof lng === "number" ? lng : null,
            radius_km: radius,
            user_agent: typeof user_agent === "string" ? user_agent.slice(0, 200) : null,
          };
          const { error } = await supabaseAdmin
            .from("push_subscriptions")
            .upsert(payload, { onConflict: "endpoint" });
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true });
        }

        return json({ error: "unknown action" }, 400);
      },
    },
  },
});
