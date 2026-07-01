// SSR share route for a specific "need" (a request for help). Purpose: give
// WhatsApp / social crawlers dynamic OG tags so previews aren't generic.
// Real users are redirected to /necesidades?need=<id>.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { supaFetch } from "@/lib/api-public";

type Loaded = {
  id: string;
  title: string;
  category: string | null;
  urgency: string | null;
  center_name: string | null;
  center_address: string | null;
  description: string | null;
  quantity: string | null;
};

const SITE = "https://venezuelaselevanta.info";
const URGENCY_ES: Record<string, string> = {
  critical: "🚨 Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export const Route = createFileRoute("/n/$id")({
  ssr: true,
  loader: async ({ params }): Promise<Loaded | null> => {
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) return null;
    try {
      const rows = await supaFetch(
        `needs?id=eq.${params.id}&select=id,title,category,urgency,center_name,center_address,description,quantity&limit=1`,
      );
      return (rows[0] as unknown as Loaded) ?? null;
    } catch (e) {
      console.error("[/n/$id] loader error", e);
      return null;
    }
  },
  head: ({ loaderData, params }) => {
    const d = loaderData;
    if (!d) {
      return {
        meta: [
          { title: "Necesidad no encontrada — Venezuela Se Levanta" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const urgency = d.urgency ? URGENCY_ES[d.urgency] ?? d.urgency : "";
    const title = `Necesitamos: ${d.title}${urgency ? ` — ${urgency}` : ""} · Venezuela Se Levanta`;
    const bits = [
      d.center_name && `📍 ${d.center_name}`,
      d.quantity && `Cantidad: ${d.quantity}`,
      d.description,
    ].filter(Boolean).join(" · ");
    const desc = (bits || "Ayúdanos a cubrir esta necesidad.").slice(0, 200);
    const image = `${SITE}/og-default.jpg`;
    const url = `${SITE}/n/${params.id}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: image },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: `${SITE}/necesidades?need=${params.id}` }],
    };
  },
  component: RedirectPage,
});

function RedirectPage() {
  const { id } = Route.useParams();
  const data = Route.useLoaderData();
  useEffect(() => {
    window.location.replace(`/necesidades?need=${id}`);
  }, [id]);
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-lg font-semibold">{data?.title ?? "Cargando…"}</div>
      <p className="text-sm text-muted-foreground">Abriendo la necesidad completa…</p>
      <a href={`/necesidades?need=${id}`} className="text-sm underline text-primary">
        Continuar
      </a>
    </div>
  );
}
