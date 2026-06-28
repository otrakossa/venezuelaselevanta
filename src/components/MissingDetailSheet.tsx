import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  X, MapPin, Phone, Mail, User, CalendarDays, Share2, Link as LinkIcon,
  Map as MapIcon, MessageCircle, Send, Loader2, ShieldCheck, Hospital, Search,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { MissingPerson, MissingStatus } from "@/lib/types";

type Comment = {
  id: string;
  missing_person_id: string;
  author_name: string | null;
  content: string;
  created_at: string;
};

type PatientMatch = {
  patient_id: string;
  patient_name: string;
  patient_age: number | null;
  center_name: string | null;
  status: string | null;
  score: number;
};

const STATUS_PILL: Record<MissingStatus, string> = {
  missing: "bg-rose-500 text-white",
  found: "bg-emerald-500 text-white",
  deceased: "bg-neutral-800 text-white",
};
const STATUS_LABEL: Record<MissingStatus, string> = {
  missing: "Desaparecido",
  found: "Encontrado",
  deceased: "Fallecido",
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function fmtRel(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

export function MissingDetailSheet({
  person,
  open,
  onClose,
}: {
  person: MissingPerson | null;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [matches, setMatches] = useState<PatientMatch[] | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Reset transient state when changing person
  useEffect(() => {
    setMatches(null);
    setMatchLoading(false);
  }, [person?.id]);

  // Load comments + realtime
  useEffect(() => {
    if (!person || !open) return;
    let mounted = true;
    setLoading(true);
    (supabase as any)
      .from("missing_person_comments")
      .select("*")
      .eq("missing_person_id", person.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }: { data: Comment[] | null; error: { message: string } | null }) => {
        if (!mounted) return;
        if (error) toast.error("No se pudieron cargar los comentarios");
        setComments((data ?? []) as Comment[]);
        setLoading(false);
      });

    const ch = supabase
      .channel(`mpc-${person.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "missing_person_comments", filter: `missing_person_id=eq.${person.id}` },
        (payload) => {
          setComments((prev) => {
            const next = payload.new as Comment;
            if (prev.some((c) => c.id === next.id)) return prev;
            return [...prev, next];
          });
        },
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [person, open]);

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [comments.length]);

  if (!person) return null;

  const hasCoords = person.last_seen_lat != null && person.last_seen_lng != null;
  const reported = new Date(person.report_date);
  const daysAgo = Math.floor((Date.now() - reported.getTime()) / 86_400_000);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://venezuelaselevanta.info";
  const directLink = `${origin}/?missing=${person.id}`;

  const openOnMap = () => {
    if (!hasCoords) {
      toast.error("Esta persona no tiene ubicación geolocalizada");
      return;
    }
    onClose();
    navigate({ to: "/", search: { missing: person.id } });
  };

  const shareWA = () => {
    const text =
      `🆘 *PERSONA DESAPARECIDA* — Venezuela Se Levanta\n\n` +
      `👤 ${person.name}${person.age ? ` (${person.age} años)` : ""}\n` +
      (person.last_seen_location ? `📍 Última ubicación: ${person.last_seen_location}\n` : "") +
      (person.description ? `📝 ${person.description}\n` : "") +
      (person.contact_phone ? `📞 Contacto: ${person.contact_phone}\n` : "") +
      `\nVer ficha: ${directLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(directLink);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const searchMatches = async () => {
    if (!person) return;
    setMatchLoading(true);
    const { data, error } = await (supabase as any).rpc("suggest_patient_matches", {
      p_missing_id: person.id,
    });
    setMatchLoading(false);
    if (error) { toast.error("No se pudo buscar coincidencias"); return; }
    setMatches((data ?? []) as PatientMatch[]);
  };


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    const name = author.trim();
    if (!name) { toast.error("Escribe tu nombre"); return; }
    if (!text) return;
    if (text.length > 1000) { toast.error("Máximo 1000 caracteres"); return; }
    setSubmitting(true);
    const { error } = await (supabase as any).from("missing_person_comments").insert({
      missing_person_id: person.id,
      author_name: name,
      content: text,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setContent("");
    toast.success("Comentario publicado");
  };

  return (
    <div className={`fixed inset-0 z-[100] ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
      />
      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha de ${person.name}`}
        className={`absolute right-0 top-0 h-full w-full sm:max-w-xl bg-background shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="relative shrink-0 border-b border-border bg-card">
          <div className="flex items-start gap-3 p-4 pr-12">
            <div className="relative h-16 w-16 shrink-0 rounded-full bg-muted border-2 border-border grid place-items-center text-xl font-black text-muted-foreground overflow-hidden">
              {person.photo_url ? (
                <img
                  src={person.photo_url}
                  alt={person.name}
                  className="absolute inset-0 h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : null}
              <span>{initials(person.name) || <User className="h-6 w-6" />}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_PILL[person.status]}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse" />
                  {STATUS_LABEL[person.status]}
                </span>
                {person.matched_patient_id && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700">
                    <ShieldCheck className="h-3 w-3" /> Localizado
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black leading-tight mt-1 line-clamp-2">{person.name}</h2>
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                {person.age != null && <span>{person.age} años</span>}
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {daysAgo === 0 ? "Reportado hoy" : `Hace ${daysAgo} día${daysAgo === 1 ? "" : "s"}`}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute right-3 top-3 p-2 rounded-lg hover:bg-muted text-muted-foreground"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div ref={scrollerRef} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Hero photo (mirrors card) */}
            <div className="relative h-56 sm:h-64 rounded-xl overflow-hidden bg-gradient-to-br from-muted to-muted/40 ring-2 ring-inset ring-border">
              <div className="absolute inset-0 grid place-items-center">
                <div className="h-24 w-24 rounded-full bg-card border-2 border-border grid place-items-center text-3xl font-black text-muted-foreground">
                  {initials(person.name) || <User className="h-10 w-10" />}
                </div>
              </div>
              {person.photo_url && (
                <img
                  src={person.photo_url}
                  alt={person.name}
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <h3 className="font-bold text-xl leading-tight drop-shadow line-clamp-2">{person.name}</h3>
                <div className="flex items-center gap-2 text-xs opacity-95 mt-1">
                  {person.age != null && <><span>{person.age} años</span><span className="opacity-50">•</span></>}
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {daysAgo === 0 ? "Reportado hoy" : `Hace ${daysAgo} día${daysAgo === 1 ? "" : "s"}`}
                  </span>
                </div>
              </div>
            </div>

            {person.matched_patient_id && (
              <div className="flex items-start gap-2 text-sm rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2.5">
                <span className="shrink-0 text-base">✅</span>
                <div className="min-w-0">
                  <div className="font-bold text-emerald-700 leading-tight">Localizado</div>
                  {person.matched_patient?.center_name && (
                    <div className="text-xs text-emerald-700/80 mt-0.5">🏥 {person.matched_patient.center_name}</div>
                  )}
                </div>
              </div>
            )}

            {person.last_seen_location && (
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Última ubicación</h3>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                  <span>{person.last_seen_location}</span>
                </div>
                {(person.state || person.municipality || person.parish) && (
                  <div className="text-xs text-muted-foreground mt-1 ml-6">
                    {[person.parish, person.municipality, person.state].filter(Boolean).join(" · ")}
                  </div>
                )}
              </section>
            )}


            {person.description && (
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Descripción</h3>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{person.description}</p>
              </section>
            )}

            {(person.contact_name || person.contact_phone || person.contact_email) && (
              <section className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Contacto del reportante</h3>
                {person.contact_name && (
                  <div className="flex items-center gap-2 text-sm"><User className="h-3.5 w-3.5 text-muted-foreground" /> {person.contact_name}</div>
                )}
                {person.contact_phone && (
                  <a href={`tel:${person.contact_phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Phone className="h-3.5 w-3.5" /> {person.contact_phone}
                  </a>
                )}
                {person.contact_email && (
                  <a href={`mailto:${person.contact_email}`} className="flex items-center gap-2 text-sm text-primary hover:underline break-all">
                    <Mail className="h-3.5 w-3.5 shrink-0" /> {person.contact_email}
                  </a>
                )}
              </section>
            )}

            {/* Actions */}
            <section className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={openOnMap}
                disabled={!hasCoords}
                className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-bold px-3.5 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow shadow-primary/20"
                title={hasCoords ? "Ver en el mapa" : "Sin ubicación geolocalizada"}
              >
                <MapIcon className="h-4 w-4" /> Ver en mapa
              </button>
              <button
                onClick={shareWA}
                className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 text-sm font-bold px-3 py-2 rounded-lg"
              >
                <Share2 className="h-4 w-4" /> Difundir
              </button>
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-3 py-2 rounded-lg hover:bg-muted"
              >
                <LinkIcon className="h-4 w-4" /> Copiar enlace
              </button>
            </section>

            {/* Match search */}
            {!person.matched_patient_id && (
              <section className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Hospital className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold leading-tight">¿Estará en un centro de salud?</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Busca coincidencias por nombre y ubicación entre los pacientes atendidos en hospitales.
                    </p>
                  </div>
                </div>
                <button
                  onClick={searchMatches}
                  disabled={matchLoading}
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold px-3 py-2 rounded-lg disabled:opacity-60"
                >
                  {matchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Buscar en registros de atendidos
                </button>

                {matches !== null && (
                  matches.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic text-center py-2">
                      No se encontraron coincidencias en este momento.
                    </div>
                  ) : (
                    <ul className="space-y-1.5 pt-1">
                      {matches.map((m) => (
                        <li key={m.patient_id} className="rounded-lg border border-border bg-card p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-bold truncate">{m.patient_name}</div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {m.patient_age != null ? `${m.patient_age} años` : "Edad N/D"}
                                {m.center_name ? ` · 🏥 ${m.center_name}` : ""}
                                {m.status ? ` · ${m.status}` : ""}
                              </div>
                            </div>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-600/15 text-sky-700 shrink-0">
                              {Math.round(m.score * 100)}%
                            </span>
                          </div>
                        </li>
                      ))}
                      <li className="text-[10px] text-muted-foreground italic pt-1">
                        Estas coincidencias son sugerencias automáticas; un coordinador puede confirmar la vinculación.
                      </li>
                    </ul>
                  )
                )}
              </section>
            )}



            {/* Comments */}
            <section className="pt-2">
              <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                Comentarios y pistas
                <span className="text-xs font-normal text-muted-foreground">({comments.length})</span>
              </h3>
              <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                Si la viste, sabes algo o tienes información que pueda ayudar, déjalo aquí. Sé respetuoso/a; no publiques datos sensibles.
              </p>

              {loading ? (
                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando comentarios…
                </div>
              ) : comments.length === 0 ? (
                <div className="text-xs text-muted-foreground italic py-3 text-center border border-dashed border-border rounded-lg">
                  Aún no hay comentarios. Sé el primero en aportar información.
                </div>
              ) : (
                <ul className="space-y-2">
                  {comments.map((c) => (
                    <li key={c.id} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center gap-2 text-xs mb-1">
                        <span className="font-bold text-foreground">{c.author_name?.trim() || "Anónimo"}</span>
                        <span className="text-muted-foreground">· {fmtRel(c.created_at)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{c.content}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        {/* Composer */}
        <form onSubmit={submit} className="shrink-0 border-t border-border bg-card p-3 space-y-2">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Tu nombre *"
            required
            maxLength={60}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex items-end gap-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe lo que sepas: dónde la viste, cuándo, con quién…"
              rows={2}
              maxLength={1000}
              className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <button
              type="submit"
              disabled={submitting || !content.trim() || !author.trim()}
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-bold px-3 py-2.5 rounded-lg disabled:opacity-50"
              aria-label="Publicar comentario"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="hidden sm:inline">Publicar</span>
            </button>
          </div>
          <div className="text-[10px] text-muted-foreground text-right">{content.length}/1000</div>
        </form>
      </div>
    </div>
  );
}
