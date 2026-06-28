import { createFileRoute } from "@tanstack/react-router";
import {
  buildCsv,
  commonFilters,
  csvResponse,
  errorResponse,
  optionsHandler,
  parseLimit,
  supaFetch,
} from "@/lib/api-public";

const SAFE_COLS =
  "id,center_name,center_address,lat,lng,category,categories,title,description,quantity,urgency,status,contact_name,created_at,updated_at";

export const Route = createFileRoute("/api/needs.csv")({
  server: {
    handlers: {
      OPTIONS: async () => optionsHandler(),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const sp = url.searchParams;
          const limit = parseLimit(sp);
          const q =
            `needs?select=${SAFE_COLS}&order=created_at.desc&limit=${limit}` +
            commonFilters(sp, { allow: ["category", "urgency", "status", "since"] });
          const rows = await supaFetch(q);
          const headers = [
            "id","lugar","direccion","latitud","longitud","categoria","categorias",
            "titulo","descripcion","cantidad","urgencia","estado","contacto",
            "fecha_creacion","fecha_actualizacion",
          ];
          const hxl = [
            "#id","#loc+name","#loc+address","#geo+lat","#geo+lon","#need+type","#need+types",
            "#need+title","#description","#need+quantity","#severity","#status","#contact+name",
            "#date+created","#date+updated",
          ];
          const data = rows.map((r) => [
            r.id, r.center_name, r.center_address, r.lat, r.lng, r.category, r.categories,
            r.title, r.description, r.quantity, r.urgency, r.status, r.contact_name,
            r.created_at, r.updated_at,
          ]);
          return csvResponse(buildCsv(headers, hxl, data), "venezuelaselevanta-necesidades.csv");
        } catch (e) {
          return errorResponse(e, "csv");
        }
      },
    },
  },
});
