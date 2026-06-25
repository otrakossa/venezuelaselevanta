import { createFileRoute } from "@tanstack/react-router";

const SITE = "https://venezuelaselevanta.info";
const STATIC_PATHS = ["/", "/reportar", "/desaparecidos", "/estadisticas", "/donar", "/creditos"];

async function fetchReportsMeta(): Promise<{ id: string; updated_at: string }[]> {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const res = await fetch(
    `${url}/rest/v1/reports?select=id,updated_at&order=created_at.desc&limit=1000`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const now = new Date().toISOString();
        let reports: { id: string; updated_at: string }[] = [];
        try {
          reports = await fetchReportsMeta();
        } catch {
          // serve static-only sitemap on error
        }

        const urls = [
          ...STATIC_PATHS.map(
            (p) =>
              `<url><loc>${SITE}${p}</loc><lastmod>${now}</lastmod><changefreq>${
                p === "/" ? "hourly" : "daily"
              }</changefreq></url>`,
          ),
          ...reports.map(
            (r) =>
              `<url><loc>${SITE}/reportes/${r.id}</loc><lastmod>${
                r.updated_at ?? now
              }</lastmod></url>`,
          ),
        ];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=600, s-maxage=600",
          },
        });
      },
    },
  },
});
