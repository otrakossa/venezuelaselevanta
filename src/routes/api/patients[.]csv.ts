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
import { guardPublicApi } from "@/lib/api-rate-limit";

const SAFE_COLS =
  "id,name,age,sex,center_name,center_address,center_lat,center_lng,status,notes,discharged_at,created_at,state,sector,health_center_id";

export const Route = createFileRoute("/api/patients.csv")({
  server: {
    handlers: {
      OPTIONS: async () => optionsHandler(),
      GET: async ({ request }) => {
        const _rl = guardPublicApi(request, "csv");
        if (_rl.response) return _rl.response;
        try {
          const url = new URL(request.url);
          const sp = url.searchParams;
          const limit = parseLimit(sp);
          const q =
            `patients?select=${SAFE_COLS}&order=created_at.desc&limit=${limit}` +
            commonFilters(sp, { allow: ["state", "status", "since"] });
          const rows = await supaFetch(q);
          const headers = [
            "id","nombre","edad","sexo","centro","direccion_centro","centro_latitud","centro_longitud",
            "estado_clinico","notas","fecha_egreso","fecha_creacion","estado","sector","centro_id",
          ];
          const hxl = [
            "#id","#person+name","#person+age","#person+sex","#loc+facility","#loc+address","#geo+lat","#geo+lon",
            "#status+health","#description","#date+discharged","#date+created","#adm1+name","#loc+sector","#loc+facility+id",
          ];
          const data = rows.map((r) => [
            r.id, r.name, r.age, r.sex, r.center_name, r.center_address, r.center_lat, r.center_lng,
            r.status, r.notes, r.discharged_at, r.created_at, r.state, r.sector, r.health_center_id,
          ]);
          return csvResponse(buildCsv(headers, hxl, data), "venezuelaselevanta-pacientes.csv");
        } catch (e) {
          return errorResponse(e, "csv");
        }
      },
    },
  },
});
