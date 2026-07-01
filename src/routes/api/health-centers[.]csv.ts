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

const SAFE_COLS = "id,name,type,lat,lng,address,city,state,phone,osm_id,osm_type,created_at";

export const Route = createFileRoute("/api/health-centers.csv")({
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
            `health_centers?select=${SAFE_COLS}&order=name.asc&limit=${limit}` +
            commonFilters(sp, { allow: ["state", "city"] });
          const rows = await supaFetch(q);
          const headers = [
            "id","nombre","tipo","latitud","longitud","direccion","ciudad","estado","telefono","osm_id","osm_tipo","fecha_creacion",
          ];
          const hxl = [
            "#id","#loc+facility","#facility+type","#geo+lat","#geo+lon","#loc+address","#adm2+name","#adm1+name","#contact+phone","#meta+osm_id","#meta+osm_type","#date+created",
          ];
          const data = rows.map((r) => [
            r.id, r.name, r.type, r.lat, r.lng, r.address, r.city, r.state, r.phone, r.osm_id, r.osm_type, r.created_at,
          ]);
          return csvResponse(buildCsv(headers, hxl, data), "venezuelaselevanta-centros-salud.csv");
        } catch (e) {
          return errorResponse(e, "csv");
        }
      },
    },
  },
});
