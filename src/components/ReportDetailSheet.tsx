import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Users, User, Share2, Send, Image as ImageIcon, Video } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { CATEGORY_MAP, URGENCY_LABELS, STATUS_LABELS } from "@/lib/categories";
import { useReportDetail, useReportComments } from "@/hooks/useReportDetail";
import { ReportRating } from "@/components/ReportRating";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VIDEO_RE = /\.(mp4|mov|webm|m4v)(\?|$)/i;

interface Props {
  reportId: string | null;
  onClose: () => void;
  onFocusMap?: (lat: number, lng: number, id: string) => void;
}

export function ReportDetailSheet({ reportId, onClose, onFocusMap }: Props) {
  const open = !!reportId;
  const { report, loading, notFound } = useReportDetail(reportId);
  const { comments } = useReportComments(reportId);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!open) {
      setAuthor("");
      setContent("");
      setLightbox(null);
    }
  }, [open]);

  const submitComment = async () => {
    const text = content.trim();
    if (!text || !reportId) return;
    setPosting(true);
    const { error } = await supabase.from("report_comments").insert({
      report_id: reportId,
      author_name: author.trim() || null,
      content: text,
    });
    setPosting(false);
    if (error) {
      toast.error("No se pudo publicar tu actualización");
      return;
    }
    setContent("");
    toast.success("Actualización publicada");
  };

  const share = async () => {
    if (!report) return;
    const url = `${window.location.origin}/reportes/${report.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: report.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Enlace copiado");
      }
    } catch {
      /* user cancelled */
    }
  };

  const cat = report ? CATEGORY_MAP[report.category] : null;
  const media = report
    ? (report.media_urls && report.media_urls.length > 0
        ? report.media_urls
        : report.photo_url
          ? [report.photo_url]
          : [])
    : [];
  const thumbs = report?.media_thumbs ?? [];

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg p-0 overflow-y-auto bg-[color:var(--cream)] flex flex-col z-[1000]"
        >
          {loading && !report && (
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {notFound && (
            <div className="p-8 text-center space-y-2">
              <h2 className="font-display text-xl">Reporte no encontrado</h2>
              <p className="text-sm text-muted-foreground">Puede haber sido eliminado.</p>
            </div>
          )}

          {report && cat && (() => {
            const heroImage = (() => {
              const candidates = [
                ...(report.media_thumbs ?? []),
                ...(report.media_urls ?? []),
                report.photo_url,
              ].filter(Boolean) as string[];
              return candidates.find((u) => !VIDEO_RE.test(u)) ?? null;
            })();
            return (
            <>
              {/* Header */}
              <div
                className="relative text-white overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${cat.color} 0%, var(--midnight) 140%)`,
                }}
              >
                {heroImage && (
                  <>
                    <img
                      src={heroImage}
                      alt={report.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-70"
                      loading="lazy"
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(180deg, ${cat.color}55 0%, rgba(13,43,69,0.85) 100%)`,
                      }}
                    />
                  </>
                )}
                <div className={cn("relative p-5 pb-4", heroImage && "pt-32")}>
                  <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-white/20 backdrop-blur font-semibold">
                      <span>{cat.emoji}</span> {cat.name}
                    </span>
                    <span
                      className="text-[11px] px-2 py-1 rounded-full font-bold"
                      style={{ background: URGENCY_LABELS[report.urgency].color, color: "white" }}
                    >
                      {URGENCY_LABELS[report.urgency].label}
                    </span>
                    <span className="text-[11px] px-2 py-1 rounded-full bg-white/15 font-semibold">
                      {STATUS_LABELS[report.status]}
                    </span>
                  </div>
                  <h2 className="font-display text-2xl leading-tight pr-8 drop-shadow-sm">{report.title}</h2>
                  <div className="text-[11px] text-white/85 mt-2 flex items-center gap-2 flex-wrap">
                    <span>
                      {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: es })}
                    </span>
                    <span>·</span>
                    <span>{format(new Date(report.created_at), "dd MMM yyyy HH:mm")}</span>
                  </div>
                  <button
                    onClick={share}
                    className="absolute top-4 right-12 p-2 rounded-full bg-white/15 hover:bg-white/25 transition"
                    aria-label="Compartir"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              </div>


              <div className="p-5 space-y-5 flex-1">
                {/* Rating */}
                <ReportRating report={report} variant="full" />

                <Separator />

                {/* Main info */}
                <section className="space-y-3">
                  <h3 className="font-display text-sm uppercase tracking-wider text-[color:var(--midnight)]">
                    Información
                  </h3>
                  {report.description && (
                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                      {report.description}
                    </p>
                  )}

                  {report.address && (
                    <div className="rounded-lg border border-border bg-card p-3 flex items-start gap-2.5">
                      <MapPin className="h-4 w-4 text-[color:var(--sunrise)] mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Ubicación
                        </div>
                        <div className="text-sm break-words">{report.address}</div>
                        {onFocusMap && (
                          <button
                            onClick={() => {
                              onFocusMap(report.lat, report.lng, report.id);
                              onClose();
                            }}
                            className="mt-1.5 text-xs font-semibold text-[color:var(--sunrise)] hover:underline"
                          >
                            Ver en mapa →
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {report.affected_count != null && (
                      <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-2">
                        <Users className="h-4 w-4 text-[color:var(--sky)]" />
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground font-semibold">
                            Afectados
                          </div>
                          <div className="text-sm font-bold">{report.affected_count}</div>
                        </div>
                      </div>
                    )}
                    <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-2">
                      <User className="h-4 w-4 text-[color:var(--midnight)]" />
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase text-muted-foreground font-semibold">
                          Reportado por
                        </div>
                        <div className="text-sm font-bold truncate">
                          {report.reporter_name || "Anónimo"}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Media */}
                <section className="space-y-3">
                  <h3 className="font-display text-sm uppercase tracking-wider text-[color:var(--midnight)]">
                    Multimedia
                  </h3>
                  {media.length > 0 ? (
                    <div className={cn("grid gap-2", media.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                      {media.map((url, i) => {
                        const isVideo = VIDEO_RE.test(url);
                        const thumb = thumbs[i] || (isVideo ? null : url);
                        return (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setLightbox(url)}
                            className="relative block rounded-lg overflow-hidden bg-muted aspect-video group"
                          >
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={`Adjunto ${i + 1}`}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white bg-black">
                                <Video className="h-8 w-8" />
                              </div>
                            )}
                            {isVideo && (
                              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <span className="w-10 h-10 rounded-full bg-black/70 text-white flex items-center justify-center text-lg">▶</span>
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center bg-card/60">
                      <div
                        className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-xl mb-2"
                        style={{ background: cat.color, color: "white" }}
                      >
                        {cat.emoji}
                      </div>
                      <p className="text-xs text-muted-foreground">Sin fotografía adjunta</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span>{media.length} {media.length === 1 ? "archivo" : "archivos"}</span>
                    <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[10px] font-semibold">
                      <Video className="h-3 w-3" /> Video · próximamente
                    </span>
                  </div>
                </section>

                <Separator />

                {/* Comments */}
                <section className="space-y-3">
                  <h3 className="font-display text-sm uppercase tracking-wider text-[color:var(--midnight)]">
                    Comentarios y actualizaciones
                  </h3>

                  {comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Sé el primero en agregar información sobre este reporte.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {comments.map((c) => {
                        const name = c.author_name?.trim() || "Anónimo";
                        const initial = name.charAt(0).toUpperCase();
                        return (
                          <li key={c.id} className="flex gap-2.5">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ background: "var(--midnight)" }}
                            >
                              {initial}
                            </div>
                            <div className="flex-1 min-w-0 rounded-lg bg-card border border-border p-2.5">
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs font-bold truncate">{name}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: es })}
                                </span>
                              </div>
                              <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{c.content}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="space-y-2 pt-1">
                    <input
                      value={author}
                      onChange={(e) => setAuthor(e.target.value.slice(0, 60))}
                      placeholder="Tu nombre (opcional)"
                      className="w-full px-3 py-2 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--sunrise)]/40"
                    />
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value.slice(0, 500))}
                      placeholder="Agrega información, confirma o aporta una actualización…"
                      rows={3}
                      className="w-full px-3 py-2 rounded-md border border-border bg-card text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[color:var(--sunrise)]/40"
                    />
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[11px] tabular-nums",
                        content.length >= 480 ? "text-rose-600 font-semibold" : "text-muted-foreground",
                      )}>
                        {content.length}/500
                      </span>
                      <button
                        type="button"
                        disabled={!content.trim() || posting}
                        onClick={submitComment}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[color:var(--sunrise)] text-white text-sm font-semibold hover:bg-[#e85a28] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {posting ? "Publicando…" : "Publicar actualización"}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <Dialog open={!!lightbox} onOpenChange={(v) => !v && setLightbox(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black border-0 z-[1100]">
          {lightbox && (VIDEO_RE.test(lightbox) ? (
            <video src={lightbox} controls autoPlay className="w-full max-h-[80vh] rounded" />
          ) : (
            <img src={lightbox} alt="Adjunto" className="w-full max-h-[80vh] object-contain rounded" />
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
