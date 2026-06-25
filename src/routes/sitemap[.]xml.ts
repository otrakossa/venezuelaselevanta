import { createFileRoute } from "@tanstack/react-router";

const SITE = "https://venezuelaselevanta.info";
const STATIC_PATHS = ["/", "/reportar", "/desaparecidos", "/estadisticas", "/donar", "/creditos"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { data: reports } = await supabase
          .from("reports")
          .select("id, updated_at")
          .order("created_at", { ascending: false })
          .limit(1000);

        const now = new Date().toISOString();
        const urls = [
          ...STATIC_PATHS.map(
            (p) =>
              `<url><loc>${SITE}${p}</loc><lastmod>${now}</lastmod><changefreq>${
                p === "/" ? "hourly" : "daily"
              }</changefreq></url>`,
          ),
          ...(reports ?? []).map(
            (r) =>
              `<url><loc>${SITE}/reportes/${r.id}</loc><lastmod>${
                (r.updated_at as string) ?? now
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
