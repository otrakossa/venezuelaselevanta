// SSR share route for a missing person. Purpose: give WhatsApp / Twitter / Facebook
// crawlers dynamic OG tags per person (photo, name, description). Real users get
// redirected to /desaparecidos?person=<id> so they land on the full detail sheet.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { supaFetch } from "@/lib/api-public";

type Loaded = {
  id: string;
  name: string;
  age: number | null;
  photo_url: string | null;
  last_seen_location: string | null;
  description: string | null;
  status: string;
};

const SITE = "https://venezuelaselevanta.info";

export const Route = createFileRoute("/m/$id")({
  ssr: true,
  loader: async ({ params }): Promise<Loaded | null> => {
    // UUID guard
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) return null;
    try {
      const rows = await supaFetch(
        `missing_persons?id=eq.${params.id}&select=id,name,age,photo_url,last_seen_location,description,status&limit=1`,
      );
      return (rows[0] as unknown as Loaded) ?? null;
    } catch (e) {
      console.error("[/m/$id] loader error", e);
      return null;
    }
  },
  head: ({ loaderData, params }) => {
    const d = loaderData;
    if (!d) {
      return {
        meta: [
          { title: "Persona no encontrada — Venezuela Se Levanta" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `${d.name}${d.age ? `, ${d.age} años` : ""} — ${d.status === "found" ? "Encontrado/a" : d.status === "deceased" ? "Fallecido/a" : "Desaparecido/a"} · Venezuela Se Levanta`;
    const desc =
      d.last_seen_location
        ? `Visto por última vez: ${d.last_seen_location}. ${d.description ?? ""}`.slice(0, 200)
        : (d.description ?? "Ayúdanos a difundir este caso.").slice(0, 200);
    const image = d.photo_url ?? `${SITE}/og-default.jpg`;
    const url = `${SITE}/m/${params.id}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:type", content: "profile" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: image },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: `${SITE}/desaparecidos?person=${params.id}` }],
    };
  },
  component: RedirectPage,
});

function RedirectPage() {
  const { id } = Route.useParams();
  const data = Route.useLoaderData();
  useEffect(() => {
    // Redirect real users to the full detail view.
    window.location.replace(`/desaparecidos?person=${id}`);
  }, [id]);
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-lg font-semibold">{data?.name ?? "Cargando…"}</div>
      <p className="text-sm text-muted-foreground">Abriendo ficha completa…</p>
      <a href={`/desaparecidos?person=${id}`} className="text-sm underline text-primary">
        Continuar
      </a>
    </div>
  );
}
