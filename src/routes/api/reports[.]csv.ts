import { createFileRoute } from "@tanstack/react-router";
import {
  bboxClause,
  buildCsv,
  commonFilters,
  csvResponse,
  errorResponse,
  optionsHandler,
  parseLimit,
  supaFetch,
} from "@/lib/api-public";

const SAFE_COLS =
  "id,title,description,category,urgency,status,address,lat,lng,reporter_name,photo_url,affected_count,verified,created_at,updated_at,media_urls,confirm_count,dispute_count,state,municipality,parish,external_id,source";

export const Route = createFileRoute("/api/reports.csv")({
  server: {
    handlers: {
      OPTIONS: async () => optionsHandler(),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const sp = url.searchParams;
          const limit = parseLimit(sp);
          const q =
            `reports?select=${SAFE_COLS}&hidden=is.false&order=created_at.desc&limit=${limit}` +
            commonFilters(sp, { allow: ["state", "municipality", "parish", "category", "urgency", "status", "since"] }) +
            bboxClause(sp, "lat", "lng");
          const rows = await supaFetch(q);
          const headers = [
            "id","titulo","descripcion","categoria","urgencia","estado_reporte",
            "latitud","longitud","direccion","estado","municipio","parroquia",
            "reportero","afectados","verificado","confirmaciones","disputas",
            "fuente","id_externo","fecha_creacion","fecha_actualizacion","fotos",
          ];
          const hxl = [
            "#id","#report+title","#description","#report+type","#severity","#status",
            "#geo+lat","#geo+lon","#loc+name","#adm1+name","#adm2+name","#adm3+name",
            "#contact+name","#affected+num","#verified","#vote+confirm","#vote+dispute",
            "#meta+source","#meta+ext_id","#date+created","#date+updated","#meta+media",
          ];
          const data = rows.map((r) => [
            r.id, r.title, r.description, r.category, r.urgency, r.status,
            r.lat, r.lng, r.address, r.state, r.municipality, r.parish,
            r.reporter_name, r.affected_count, r.verified, r.confirm_count, r.dispute_count,
            r.source, r.external_id, r.created_at, r.updated_at, r.media_urls,
          ]);
          return csvResponse(buildCsv(headers, hxl, data), "venezuelaselevanta-reportes.csv");
        } catch (e) {
          return errorResponse(e, "csv");
        }
      },
    },
  },
});
