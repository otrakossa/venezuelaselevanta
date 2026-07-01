import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, jsonResponse, metadata, optionsHandler, supaFetch } from "@/lib/api-public";
import { guardPublicApi } from "@/lib/api-rate-limit";

export const Route = createFileRoute("/api/categories.json")({
  server: {
    handlers: {
      OPTIONS: async () => optionsHandler(),
      GET: async () => {
        try {
          const rows = await supaFetch("categories?select=id,slug,name,color,icon,description,created_at&order=slug.asc");
          return jsonResponse({
            metadata: metadata({
              title: "Venezuela Se Levanta — Categorías de reporte",
              description: "Catálogo de categorías usadas en reportes.",
              count: rows.length,
            }),
            data: rows,
          });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
