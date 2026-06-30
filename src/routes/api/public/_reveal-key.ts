// TEMPORAL — endpoint de un solo uso para revelar LOVABLE_API_KEY al admin
// del VPS. ELIMINAR este archivo apenas la key esté en el .env de producción.
import { createFileRoute } from "@tanstack/react-router";

const REVEAL_TOKEN = "11cee7bee788ac898635a5de5d9436f705707dcf5aed3d6b";

export const Route = createFileRoute("/api/public/_reveal-key")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("t");
        if (token !== REVEAL_TOKEN) {
          return new Response("forbidden", { status: 403 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("LOVABLE_API_KEY missing in runtime env", { status: 500 });
        return new Response(key, {
          status: 200,
          headers: { "content-type": "text/plain", "cache-control": "no-store" },
        });
      },
    },
  },
});
