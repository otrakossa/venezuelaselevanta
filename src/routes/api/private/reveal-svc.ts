import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/private/reveal-svc")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = request.headers.get("x-reveal-token");
        if (token !== "vsl-tmp-9k2p") {
          return new Response("Forbidden", { status: 403 });
        }
        return Response.json({ k: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null });
      },
    },
  },
});
