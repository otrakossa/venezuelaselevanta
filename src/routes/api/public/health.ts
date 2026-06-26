import { createFileRoute } from "@tanstack/react-router";

// Lightweight health endpoint for nginx upstream checks, uptime monitors, and
// for the client to detect "a new build is live" by comparing the returned
// build id. Cheap — no DB calls.
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const build =
          process.env.SOURCE_VERSION ??
          process.env.GIT_COMMIT ??
          process.env.COMMIT_SHA ??
          "unknown";
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
      },
    },
  },
});
