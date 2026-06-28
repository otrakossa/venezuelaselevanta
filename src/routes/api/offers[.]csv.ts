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
  "id,need_id,category,title,description,quantity,contact_name,location_desc,status,state,city,address,created_at";

export const Route = createFileRoute("/api/offers.csv")({
  server: {
    handlers: {
      OPTIONS: async () => optionsHandler(),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const sp = url.searchParams;
          const limit = parseLimit(sp);
          const q =
            `offers?select=${SAFE_COLS}&order=created_at.desc&limit=${limit}` +
            commonFilters(sp, { allow: ["category", "status", "state", "city", "since"] });
          const rows = await supaFetch(q);
          const headers = [
            "id","necesidad_id","categoria","titulo","descripcion","cantidad",
            "contacto","ubicacion_desc","estado","estado_geo","ciudad","direccion","fecha_creacion",
          ];
          const hxl = [
            "#id","#need+id","#offer+type","#offer+title","#description","#offer+quantity",
            "#contact+name","#loc+name","#status","#adm1+name","#adm2+name","#loc+address","#date+created",
          ];
          const data = rows.map((r) => [
            r.id, r.need_id, r.category, r.title, r.description, r.quantity,
            r.contact_name, r.location_desc, r.status, r.state, r.city, r.address, r.created_at,
          ]);
          return csvResponse(buildCsv(headers, hxl, data), "venezuelaselevanta-ofertas.csv");
        } catch (e) {
          return errorResponse(e, "csv");
        }
      },
    },
  },
});
