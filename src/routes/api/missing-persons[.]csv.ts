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
  "id,name,age,description,last_seen_location,last_seen_lat,last_seen_lng,photo_url,contact_name,status,created_at,updated_at,report_date,found_date,source_url,source_label,state,municipality,parish";

export const Route = createFileRoute("/api/missing-persons.csv")({
  server: {
    handlers: {
      OPTIONS: async () => optionsHandler(),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const sp = url.searchParams;
          const limit = parseLimit(sp);
          const q =
            `missing_persons?select=${SAFE_COLS}` +
            `&order=created_at.desc&limit=${limit}` +
            commonFilters(sp, { allow: ["state", "municipality", "parish", "status", "since"] });
          const rows = await supaFetch(q);
          const headers = [
            "id","nombre","edad","descripcion","ultima_ubicacion","latitud","longitud",
            "foto","contacto","estado_registro","fecha_creacion","fecha_actualizacion",
            "fecha_reporte","fecha_encontrado","fuente_url","fuente_label",
            "estado","municipio","parroquia",
          ];
          const hxl = [
            "#id","#person+name","#person+age","#description","#loc+name","#geo+lat","#geo+lon",
            "#image","#contact+name","#status","#date+created","#date+updated",
            "#date+reported","#date+found","#meta+url","#meta+source",
            "#adm1+name","#adm2+name","#adm3+name",
          ];
          const data = rows.map((r) => [
            r.id, r.name, r.age, r.description, r.last_seen_location, r.last_seen_lat, r.last_seen_lng,
            r.photo_url, r.contact_name, r.status, r.created_at, r.updated_at,
            r.report_date, r.found_date, r.source_url, r.source_label,
            r.state, r.municipality, r.parish,
          ]);
          return csvResponse(buildCsv(headers, hxl, data), "venezuelaselevanta-desaparecidos.csv");
        } catch (e) {
          return errorResponse(e, "csv");
        }
      },
    },
  },
});
