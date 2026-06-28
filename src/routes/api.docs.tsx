import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/docs")({
  head: () => ({
    meta: [
      { title: "API Docs (Swagger UI) — Venezuela Se Levanta" },
      {
        name: "description",
        content:
          "Documentación interactiva OpenAPI 3.0 de la API pública de Venezuela Se Levanta. Prueba endpoints, copia ejemplos curl, descarga el spec.",
      },
      { property: "og:title", content: "API Docs — Venezuela Se Levanta" },
      {
        property: "og:description",
        content: "Swagger UI con todos los endpoints públicos.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css",
      },
    ],
    scripts: [
      {
        src: "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js",
        defer: true,
      },
      {
        children: `
          window.addEventListener('load', function () {
            if (!window.SwaggerUIBundle) {
              var t = setInterval(function () {
                if (window.SwaggerUIBundle) {
                  clearInterval(t);
                  mount();
                }
              }, 80);
            } else {
              mount();
            }
            function mount() {
              window.SwaggerUIBundle({
                url: '/api/openapi.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                docExpansion: 'list',
                tryItOutEnabled: true,
                requestSnippetsEnabled: true,
                requestSnippets: {
                  generators: {
                    curl_bash: { title: 'cURL (bash)', syntax: 'bash' },
                  },
                  defaultExpanded: true,
                  languages: ['curl_bash'],
                },
              });
            }
          });
        `,
      },
    ],
  }),
  component: ApiDocsPage,
});

function ApiDocsPage() {
  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
      <div className="px-4 py-6 border-b" style={{ background: "var(--midnight)", color: "white" }}>
        <h1 className="text-2xl font-black">API Docs — Venezuela Se Levanta</h1>
        <p className="text-sm opacity-90">
          OpenAPI 3.0 · Sin autenticación · CC BY 4.0 ·{" "}
          <a className="underline" href="/api/openapi.json">descargar spec</a> ·{" "}
          <a className="underline" href="/api">ver guía</a>
        </p>
      </div>
      <div id="swagger-ui" />
    </div>
  );
}
