import { createFileRoute } from "@tanstack/react-router";
import { Database, Download, FileJson, FileText, MapPin, Tag, Filter, Info } from "lucide-react";

export const Route = createFileRoute("/api")({
  head: () => ({
    meta: [
      { title: "API pública — Venezuela Se Levanta" },
      {
        name: "description",
        content:
          "Datos abiertos en JSON, GeoJSON y CSV con etiquetas HXL. Sin autenticación, licencia CC BY 4.0.",
      },
      { property: "og:title", content: "API pública — Venezuela Se Levanta" },
      {
        property: "og:description",
        content: "Endpoints abiertos para integrar nuestros datos en tu sistema.",
      },
    ],
  }),
  component: ApiDocsPage,
});

type Endpoint = {
  recurso: string;
  desc: string;
  formats: Array<"JSON" | "GeoJSON" | "CSV">;
  base: string;
  filters: string[];
};

const ENDPOINTS: Endpoint[] = [
  {
    recurso: "Reportes",
    desc: "Incidentes ciudadanos del terremoto: rescates, daños, ayuda médica, refugios.",
    formats: ["GeoJSON", "CSV"],
    base: "/api/reports",
    filters: ["state", "municipality", "parish", "category", "urgency", "status", "since", "bbox"],
  },
  {
    recurso: "Personas desaparecidas",
    desc: "Registro consolidado y deduplicado (>67k registros).",
    formats: ["JSON", "GeoJSON", "CSV"],
    base: "/api/missing-persons",
    filters: ["state", "municipality", "parish", "status", "since", "bbox"],
  },
  {
    recurso: "Pacientes / Atendidos",
    desc: "Personas registradas en centros médicos.",
    formats: ["JSON", "CSV"],
    base: "/api/patients",
    filters: ["state", "status", "since"],
  },
  {
    recurso: "Necesidades",
    desc: "Demandas publicadas por comunidades y centros.",
    formats: ["JSON", "GeoJSON", "CSV"],
    base: "/api/needs",
    filters: ["category", "urgency", "status", "since", "bbox"],
  },
  {
    recurso: "Ofertas de ayuda",
    desc: "Insumos y servicios disponibles para canalizar.",
    formats: ["JSON", "CSV"],
    base: "/api/offers",
    filters: ["category", "status", "state", "city", "since"],
  },
  {
    recurso: "Centros de salud",
    desc: "Directorio de hospitales y ambulatorios activos.",
    formats: ["JSON", "GeoJSON", "CSV"],
    base: "/api/health-centers",
    filters: ["state", "city", "bbox"],
  },
  {
    recurso: "Categorías",
    desc: "Catálogo de categorías de reporte.",
    formats: ["JSON"],
    base: "/api/categories",
    filters: [],
  },
];

const FORMAT_EXT: Record<string, string> = {
  JSON: ".json",
  GeoJSON: ".geojson",
  CSV: ".csv",
};

function Pill({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
      style={{
        background: color ?? "var(--cream)",
        color: "var(--midnight)",
      }}
    >
      {children}
    </span>
  );
}

function ApiDocsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Database className="h-5 w-5 text-[color:var(--sunrise)]" />
          <h1 className="font-display text-3xl font-bold">API pública v1</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Todos los datos abiertos de Venezuela Se Levanta en un solo lugar.
          Sin autenticación, CORS abierto, licencia CC BY 4.0. Diseñada para que
          medios, ONGs, instituciones y otras plataformas puedan consumirlos.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Pill color="hsl(40 95% 65%)">CC BY 4.0</Pill>
          <Pill color="hsl(140 50% 80%)">Sin auth</Pill>
          <Pill color="hsl(200 70% 80%)">CORS *</Pill>
          <Pill color="hsl(20 90% 80%)">JSON · GeoJSON · CSV+HXL</Pill>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <a
            href="/api/docs"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-[color:var(--midnight)] text-white text-sm font-semibold hover:opacity-90"
          >
            <FileJson className="h-4 w-4" /> Swagger UI interactivo
          </a>
          <a
            href="/api/openapi.json"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm font-semibold hover:bg-accent"
          >
            <Download className="h-4 w-4" /> openapi.json
          </a>
        </div>
      </header>

      <section className="mb-10">
        <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2">
          <FileJson className="h-4 w-4" /> Endpoints
        </h2>
        <div className="space-y-3">
          {ENDPOINTS.map((ep) => (
            <div key={ep.base} className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold">{ep.recurso}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{ep.desc}</p>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {ep.formats.map((f) => (
                    <a
                      key={f}
                      href={`${ep.base}${FORMAT_EXT[f]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-border hover:bg-muted font-semibold"
                    >
                      {f === "CSV" ? <FileText className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                      {f}
                      <Download className="h-3 w-3 opacity-60" />
                    </a>
                  ))}
                </div>
              </div>
              {ep.filters.length > 0 && (
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <Filter className="h-3 w-3 text-muted-foreground" />
                  {ep.filters.map((f) => (
                    <code
                      key={f}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono"
                    >
                      ?{f}=
                    </code>
                  ))}
                </div>
              )}
              <pre className="mt-3 text-[11px] bg-muted/40 border border-border rounded p-2 overflow-x-auto">
{`curl https://venezuelaselevanta.info${ep.base}${FORMAT_EXT[ep.formats[0]]}`}
              </pre>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-xl font-bold mb-3">Paginación por cursor</h2>
        <p className="text-sm mb-2">
          Los endpoints JSON y GeoJSON paginan con cursor opaco. Default{" "}
          <code className="bg-muted px-1 rounded">limit=500</code>, máximo{" "}
          <code className="bg-muted px-1 rounded">5000</code>.
        </p>
        <pre className="text-[11px] bg-muted/40 border border-border rounded p-3 overflow-x-auto">
{`# Primera página
GET /api/missing-persons.json?limit=1000

# Respuesta incluye:
{
  "metadata": { "next_cursor": "MjAyNi0wNi0yN1QwOTowMHwxYjJj..." },
  "data": [ ... ]
}

# También se devuelve en header HTTP:
Link: </api/missing-persons.json?limit=1000&cursor=...>; rel="next"

# Siguiente página
GET /api/missing-persons.json?limit=1000&cursor=MjAyNi0wNi0y...`}
        </pre>
        <p className="text-xs text-muted-foreground mt-2">
          Cuando <code className="bg-muted px-1 rounded">next_cursor</code> es{" "}
          <code className="bg-muted px-1 rounded">null</code>, no hay más páginas.
          El CSV no usa cursor — un solo dump por petición con{" "}
          <code className="bg-muted px-1 rounded">?limit=</code>.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4" /> Filtros comunes
        </h2>
        <ul className="text-sm space-y-1.5 list-disc pl-5">
          <li><code className="bg-muted px-1 rounded">state</code>, <code className="bg-muted px-1 rounded">municipality</code>, <code className="bg-muted px-1 rounded">parish</code> — coincidencia exacta (DIVIPOL).</li>
          <li><code className="bg-muted px-1 rounded">category</code>, <code className="bg-muted px-1 rounded">urgency</code>, <code className="bg-muted px-1 rounded">status</code> — coincidencia exacta.</li>
          <li><code className="bg-muted px-1 rounded">since=2026-06-25</code> — registros creados desde esa fecha (ISO).</li>
          <li><code className="bg-muted px-1 rounded">bbox=minLng,minLat,maxLng,maxLat</code> — sólo GeoJSON.</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2">
          <Tag className="h-4 w-4" /> Etiquetas HXL en CSV
        </h2>
        <p className="text-sm">
          Cada CSV trae una segunda fila con etiquetas{" "}
          <a
            href="https://hxlstandard.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[color:var(--sky)]"
          >
            HXL (Humanitarian Exchange Language)
          </a>
          {" "}para que herramientas como HDX y OCHA lo procesen automáticamente.
        </p>
        <pre className="text-[11px] bg-muted/40 border border-border rounded p-3 overflow-x-auto mt-2">
{`id,titulo,categoria,latitud,longitud,estado,fecha_creacion
#id,#report+title,#report+type,#geo+lat,#geo+lon,#adm1+name,#date+created
"abc...","Derrumbe en Cumaná","infrastructure",10.45,-64.18,"Sucre","2026-06-27T03:00:00Z"`}
        </pre>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2">
          <Info className="h-4 w-4" /> Licencia y atribución
        </h2>
        <p className="text-sm">
          Todos los datos están bajo{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[color:var(--sky)]"
          >
            CC BY 4.0
          </a>
          . Puedes usar, redistribuir y construir sobre ellos para cualquier fin,
          incluso comercial, siempre que cites la fuente:
        </p>
        <pre className="text-[11px] bg-muted/40 border border-border rounded p-3 overflow-x-auto mt-2">
{`Fuente: Venezuela Se Levanta — https://venezuelaselevanta.info — CC BY 4.0`}
        </pre>
        <p className="text-xs text-muted-foreground mt-3">
          No exponemos teléfonos, cédulas ni correos del reportante. Si necesitas
          acceso a datos sensibles para coordinación humanitaria, escríbenos:{" "}
          <a
            href="mailto:kenny@codextecnologia.com"
            className="underline text-[color:var(--sky)]"
          >
            kenny@codextecnologia.com
          </a>
          .
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-xl font-bold mb-3">Uso responsable</h2>
        <p className="text-sm">
          La API no tiene rate-limit duro hoy. Para descargas masivas y mirrors,
          usa los CSV con <code className="bg-muted px-1 rounded">?limit=5000</code>{" "}
          y respeta el header <code className="bg-muted px-1 rounded">Cache-Control</code>.
          Si tu integración necesita volumen alto sostenido, contáctanos para
          coordinar un endpoint dedicado.
        </p>
      </section>
    </div>
  );
}
