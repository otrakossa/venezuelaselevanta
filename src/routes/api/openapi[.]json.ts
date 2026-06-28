import { createFileRoute } from "@tanstack/react-router";
import { buildOpenApiSpec } from "@/lib/openapi-spec";
import { CORS } from "@/lib/api-public";

export const Route = createFileRoute("/api/openapi.json")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        return new Response(JSON.stringify(buildOpenApiSpec()), {
          status: 200,
          headers: {
            ...CORS,
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=300, s-maxage=600",
          },
        });
      },
    },
  },
});
