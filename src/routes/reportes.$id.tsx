import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Report } from "@/lib/types";
import { CATEGORY_MAP, URGENCY_LABELS, STATUS_LABELS } from "@/lib/categories";
import { format } from "date-fns";
import { ArrowLeft, MapPin, User, Users, AlertTriangle, Share2, BadgeCheck } from "lucide-react";
import { ReportRating } from "@/components/ReportRating";
import { getCredibility } from "@/lib/credibility";
import { useAuth } from "@/hooks/useReports";
import { toast } from "sonner";

export const Route = createFileRoute("/reportes/$id")({
  ssr: false,
  component: ReportDetailPage,
});

const VIDEO_RE = /\.(mp4|mov|webm|m4v)(\?|$)/i;

function ReportDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { isAuthenticated, userId } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        if (!data) setNotFound(true);
        else setReport(data as unknown as Report);
        setLoading(false);
      });

    const ch = supabase
      .channel(`report-detail-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reports", filter: `id=eq.${id}` },
        (payload) => {
          setReport(payload.new as unknown as Report);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [id]);

  const toggleVerify = async () => {
    if (!report) return;
    const next = !report.verified;
    const { error } = await supabase
      .from("reports")
      .update({
        verified: next,
        verified_by: next ? userId : null,
        verified_at: next ? new Date().toISOString() : null,
      })
      .eq("id", report.id);
    if (error) toast.error(error.message);
    else toast.success(next ? "Marcado como verificado" : "Verificación retirada");
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-[color:var(--sunrise)] animate-pulse" />
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center space-y-4">
        <h1 className="text-xl font-bold">Reporte no encontrado</h1>
        <Link to="/" className="text-[color:var(--sky)] underline">Volver al mapa</Link>
      </div>
    );
  }

  const cat = CATEGORY_MAP[report.category];
  const urgency = URGENCY_LABELS[report.urgency];
  const status = STATUS_LABELS[report.status];
  const media = report.media_urls ?? (report.photo_url ? [report.photo_url] : []);
  const thumbs = report.media_thumbs ?? [];

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: report.title, text: report.title, url });
      } catch {}
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-24 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => navigate({ to: "/" })}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <button
          onClick={share}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted"
        >
          <Share2 className="h-4 w-4" /> Compartir
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {cat && (
            <span
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full text-white font-semibold"
              style={{ background: cat.color }}
            >
              <span>{cat.emoji}</span> {cat.name}
            </span>
          )}
          <span
            className="text-xs px-2 py-1 rounded text-white font-semibold"
            style={{ background: urgency.color }}
          >
            {urgency.label}
          </span>
          <span className="text-xs px-2 py-1 rounded bg-muted font-semibold">{status}</span>
          {(() => {
            const c = getCredibility(report);
            return (
              <span
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background: c.bg, color: c.fg }}
                title={c.label}
              >
                {c.level === "verified" && <BadgeCheck className="h-3.5 w-3.5" />}
                {c.label}
              </span>
            );
          })()}
        </div>

        <h1 className="font-display text-2xl sm:text-3xl leading-tight">{report.title}</h1>
        <div className="text-xs text-muted-foreground">
          Reportado {format(new Date(report.created_at), "dd MMM yyyy · HH:mm")}
          {report.verified_at && (
            <> · Verificado {format(new Date(report.verified_at), "dd MMM yyyy")}</>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold">¿Puedes corroborar este reporte?</h2>
            <p className="text-xs text-muted-foreground">
              Tu voto ayuda a la comunidad a saber qué información es confiable. 1 voto por dispositivo.
            </p>
          </div>
          {isAuthenticated && (
            <button
              onClick={toggleVerify}
              className={cnVerify(report.verified)}
            >
              <BadgeCheck className="h-4 w-4" />
              {report.verified ? "Quitar verificación" : "Marcar como verificado"}
            </button>
          )}
        </div>
        <ReportRating report={report} variant="full" showBadge={false} />
      </div>


      {media.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {media.map((url, i) => {
            const isVideo = VIDEO_RE.test(url);
            const thumb = thumbs[i] || url;
            return (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block rounded-lg overflow-hidden bg-muted aspect-square"
              >
                <img
                  src={thumb}
                  alt={`Adjunto ${i + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                {isVideo && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-3xl">
                    ▶
                  </span>
                )}
              </a>
            );
          })}
        </div>
      )}

      {report.description && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-2">Descripción</h2>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.description}</p>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <h2 className="text-sm font-semibold">Ubicación</h2>
        {report.address && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <span>{report.address}</span>
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
        </div>
        <div className="flex gap-2 pt-1">
          <Link
            to="/"
            className="text-xs px-3 py-1.5 rounded-md bg-[color:var(--sky)] text-white font-semibold"
          >
            Ver en el mapa
          </Link>
          <a
            href={`https://www.google.com/maps?q=${report.lat},${report.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-md border border-border font-semibold"
          >
            Abrir en Google Maps
          </a>
        </div>
      </div>

      {(report.reporter_name || report.affected_count != null) && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          {report.reporter_name && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Reportado por <strong>{report.reporter_name}</strong></span>
            </div>
          )}
          {report.affected_count != null && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span><strong>{report.affected_count}</strong> personas afectadas</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function cnVerify(verified: boolean) {
  return verified
    ? "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-emerald-500 text-white font-semibold hover:bg-emerald-600"
    : "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-emerald-500 text-emerald-700 font-semibold hover:bg-emerald-50";
}
