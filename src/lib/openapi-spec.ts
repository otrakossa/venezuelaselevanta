// OpenAPI 3.0 spec for Venezuela Se Levanta public API.
// Served as JSON from /api/openapi.json and rendered with Swagger UI at /api/docs.

export const SERVERS = [
  { url: "https://venezuelaselevanta.info", description: "Producción" },
];

const COMMON_QUERY = {
  limit: {
    name: "limit",
    in: "query",
    description: "Tamaño de página (1-5000, por defecto 500).",
    schema: { type: "integer", minimum: 1, maximum: 5000, default: 500 },
  },
  cursor: {
    name: "cursor",
    in: "query",
    description: "Cursor opaco para paginar. Tomar del campo `next_cursor` de la respuesta anterior.",
    schema: { type: "string" },
  },
  state: { name: "state", in: "query", schema: { type: "string" }, description: "Estado (DIVIPOL)." },
  municipality: { name: "municipality", in: "query", schema: { type: "string" }, description: "Municipio." },
  parish: { name: "parish", in: "query", schema: { type: "string" }, description: "Parroquia." },
  category: { name: "category", in: "query", schema: { type: "string" }, description: "Slug de categoría." },
  urgency: {
    name: "urgency",
    in: "query",
    schema: { type: "string", enum: ["critical", "high", "medium", "low"] },
  },
  status: { name: "status", in: "query", schema: { type: "string" } },
  since: {
    name: "since",
    in: "query",
    description: "ISO-8601 — solo registros creados desde esta fecha.",
    schema: { type: "string", format: "date-time" },
    example: "2025-06-01T00:00:00Z",
  },
  city: { name: "city", in: "query", schema: { type: "string" } },
  bbox: {
    name: "bbox",
    in: "query",
    description: "Caja delimitadora `minLng,minLat,maxLng,maxLat`.",
    schema: { type: "string" },
    example: "-74,-1,-59,14",
  },
} as const;

type ParamRef = keyof typeof COMMON_QUERY;

function paramsOf(keys: ParamRef[]) {
  return keys.map((k) => COMMON_QUERY[k]);
}

const PAGINATED_JSON = {
  type: "object",
  properties: {
    data: { type: "array", items: { type: "object" } },
    next_cursor: { type: "string", nullable: true },
    count: { type: "integer" },
    license: { type: "string", example: "https://creativecommons.org/licenses/by/4.0/" },
    source: { type: "string", example: "https://venezuelaselevanta.info" },
  },
};

const GEOJSON_FC = {
  type: "object",
  properties: {
    type: { type: "string", example: "FeatureCollection" },
    features: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", example: "Feature" },
          geometry: {
            type: "object",
            properties: {
              type: { type: "string", example: "Point" },
              coordinates: { type: "array", items: { type: "number" }, example: [-66.9, 10.5] },
            },
          },
          properties: { type: "object" },
        },
      },
    },
    next_cursor: { type: "string", nullable: true },
  },
};

const CSV_RESPONSE = {
  description: "CSV con cabecera HXL en la segunda fila.",
  content: { "text/csv": { schema: { type: "string" } } },
};

type EndpointDef = {
  path: string;
  summary: string;
  description: string;
  tag: string;
  params: ParamRef[];
  format: "json" | "geojson" | "csv";
};

const ENDPOINTS: EndpointDef[] = [
  // Reports
  { path: "/api/reports.geojson", summary: "Reportes (GeoJSON)", description: "Incidentes ciudadanos georreferenciados.", tag: "Reportes", params: ["limit", "cursor", "state", "municipality", "parish", "category", "urgency", "status", "since", "bbox"], format: "geojson" },
  { path: "/api/reports.csv", summary: "Reportes (CSV+HXL)", description: "Incidentes ciudadanos en CSV con etiquetas HXL.", tag: "Reportes", params: ["limit", "cursor", "state", "municipality", "parish", "category", "urgency", "status", "since", "bbox"], format: "csv" },
  // Missing persons
  { path: "/api/missing-persons.json", summary: "Desaparecidos (JSON)", description: "Registro consolidado y deduplicado (~67k).", tag: "Desaparecidos", params: ["limit", "cursor", "state", "municipality", "parish", "status", "since", "bbox"], format: "json" },
  { path: "/api/missing-persons.geojson", summary: "Desaparecidos (GeoJSON)", description: "Solo registros con `last_seen_lat`/`lng`.", tag: "Desaparecidos", params: ["limit", "cursor", "state", "municipality", "parish", "status", "since", "bbox"], format: "geojson" },
  { path: "/api/missing-persons.csv", summary: "Desaparecidos (CSV+HXL)", description: "Exporte tabular con etiquetas HXL.", tag: "Desaparecidos", params: ["limit", "cursor", "state", "municipality", "parish", "status", "since", "bbox"], format: "csv" },
  // Patients
  { path: "/api/patients.json", summary: "Atendidos (JSON)", description: "Pacientes registrados en centros médicos.", tag: "Atendidos", params: ["limit", "cursor", "state", "status", "since"], format: "json" },
  { path: "/api/patients.csv", summary: "Atendidos (CSV+HXL)", description: "Pacientes en CSV con etiquetas HXL.", tag: "Atendidos", params: ["limit", "cursor", "state", "status", "since"], format: "csv" },
  // Needs
  { path: "/api/needs.json", summary: "Necesidades (JSON)", description: "Demandas publicadas por comunidades.", tag: "Necesidades", params: ["limit", "cursor", "category", "urgency", "status", "since", "bbox"], format: "json" },
  { path: "/api/needs.geojson", summary: "Necesidades (GeoJSON)", description: "Demandas geolocalizadas.", tag: "Necesidades", params: ["limit", "cursor", "category", "urgency", "status", "since", "bbox"], format: "geojson" },
  { path: "/api/needs.csv", summary: "Necesidades (CSV+HXL)", description: "Demandas en CSV con etiquetas HXL.", tag: "Necesidades", params: ["limit", "cursor", "category", "urgency", "status", "since", "bbox"], format: "csv" },
  // Offers
  { path: "/api/offers.json", summary: "Ofertas (JSON)", description: "Insumos y servicios ofrecidos.", tag: "Ofertas", params: ["limit", "cursor", "category", "status", "state", "city", "since"], format: "json" },
  { path: "/api/offers.geojson", summary: "Ofertas (GeoJSON)", description: "Ofertas geolocalizadas (cuando aplica).", tag: "Ofertas", params: ["limit", "cursor", "category", "status", "state", "city", "since"], format: "geojson" },
  { path: "/api/offers.csv", summary: "Ofertas (CSV+HXL)", description: "Ofertas en CSV con etiquetas HXL.", tag: "Ofertas", params: ["limit", "cursor", "category", "status", "state", "city", "since"], format: "csv" },
  // Health centers
  { path: "/api/health-centers.json", summary: "Centros de salud (JSON)", description: "Directorio de hospitales y ambulatorios.", tag: "Centros de salud", params: ["limit", "cursor", "state", "city", "bbox"], format: "json" },
  { path: "/api/health-centers.geojson", summary: "Centros de salud (GeoJSON)", description: "Centros georreferenciados.", tag: "Centros de salud", params: ["limit", "cursor", "state", "city", "bbox"], format: "geojson" },
  { path: "/api/health-centers.csv", summary: "Centros de salud (CSV+HXL)", description: "Centros en CSV con etiquetas HXL.", tag: "Centros de salud", params: ["limit", "cursor", "state", "city", "bbox"], format: "csv" },
  // Categories
  { path: "/api/categories.json", summary: "Categorías (JSON)", description: "Catálogo de categorías de reporte.", tag: "Categorías", params: [], format: "json" },
];

function responseFor(format: "json" | "geojson" | "csv") {
  if (format === "csv") return CSV_RESPONSE;
  if (format === "geojson") {
    return {
      description: "FeatureCollection GeoJSON.",
      content: { "application/geo+json": { schema: GEOJSON_FC } },
    };
  }
  return {
    description: "Respuesta JSON paginada.",
    content: { "application/json": { schema: PAGINATED_JSON } },
  };
}

export function buildOpenApiSpec() {
  const paths: Record<string, unknown> = {};
  for (const ep of ENDPOINTS) {
    paths[ep.path] = {
      get: {
        tags: [ep.tag],
        summary: ep.summary,
        description: ep.description,
        parameters: paramsOf(ep.params),
        responses: {
          "200": responseFor(ep.format),
          "500": { description: "Error interno." },
        },
      },
    };
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "Venezuela Se Levanta — API pública",
      version: "1.0.0",
      description:
        "Datos abiertos sobre la respuesta al terremoto de Venezuela.\n\n" +
        "- Sin autenticación, CORS abierto.\n" +
        "- Sin PII: nunca expone teléfonos, cédulas ni datos de reporteros.\n" +
        "- Licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).\n" +
        "- Paginación por cursor: usa `next_cursor` de la respuesta anterior en `?cursor=`.\n\n" +
        "**Ejemplo:** `curl https://venezuelaselevanta.info/api/missing-persons.json?state=Sucre&limit=100`",
      contact: { name: "Venezuela Se Levanta", url: "https://venezuelaselevanta.info" },
      license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
    },
    servers: SERVERS,
    tags: [
      { name: "Reportes" },
      { name: "Desaparecidos" },
      { name: "Atendidos" },
      { name: "Necesidades" },
      { name: "Ofertas" },
      { name: "Centros de salud" },
      { name: "Categorías" },
    ],
    paths,
  };
}
