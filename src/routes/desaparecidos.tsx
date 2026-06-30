import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMissing } from "@/hooks/useReports";
import { MISSING_STATUS_LABELS } from "@/lib/categories";
import type { MissingPerson, MissingStatus } from "@/lib/types";
import { toast } from "sonner";
import {
  Search, UserPlus, MapPin, Phone, Mail, User,
  CalendarDays, Share2, Link as LinkIcon, X, HeartHandshake, Loader2, Crosshair, Map as MapIcon, RefreshCw, ChevronDown,
  MessageCircle, Hospital, Camera,
} from "lucide-react";
import { uploadOne } from "@/lib/media-upload";

import { geocodeAddress } from "@/lib/geocode";
import { MissingGridSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/EmptyState";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PeopleTabs } from "@/components/PeopleTabs";
import { LocationSelect } from "@/components/LocationSelect";
import { MatchSuggestions } from "@/components/MatchSuggestions";
import { MissingDetailSheet } from "@/components/MissingDetailSheet";
import { Wizard } from "@/components/wizard/Wizard";


export const Route = createFileRoute("/desaparecidos")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    person: typeof search.person === "string" ? search.person : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Personas desaparecidas — Venezuela Se Levanta" },
      { name: "description", content: "Reporta y busca personas desaparecidas tras el terremoto en Venezuela." },
    ],
  }),
  component: MissingPage,
});


type Filter = "all" | "missing" | "found" | "deceased";

const STATUS_STYLES: Record<MissingStatus, { ring: string; pill: string; dot: string; label: string }> = {
  missing:  { ring: "ring-rose-500/40",    pill: "bg-rose-500 text-white",         dot: "bg-rose-500",    label: "Desaparecido" },
  found:    { ring: "ring-emerald-500/40", pill: "bg-emerald-500 text-white",      dot: "bg-emerald-500", label: "Encontrado" },
  deceased: { ring: "ring-neutral-500/40", pill: "bg-neutral-800 text-white",      dot: "bg-neutral-800", label: "Fallecido" },
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function MissingPage() {
  const { missing, counts, refetch, loadMore, hasMore, loadingMore } = useMissing();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("missing");
  const [showForm, setShowForm] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [searchResults, setSearchResults] = useState<MissingPerson[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<MissingPerson | null>(null);
  // Mark loaded once we have any data, or after first render tick.
  useMemo(() => { if (missing.length > 0) setLoaded(true); }, [missing.length]);
  const ptr = usePullToRefresh<HTMLDivElement>({
    onRefresh: async () => { await refetch(); toast.success("Lista actualizada"); },
  });

  // Open detail sheet when ?person=<id> is present (shared links).
  useEffect(() => {
    const id = search.person;
    if (!id) return;
    if (selected?.id === id) return;
    const found = missing.find((m) => m.id === id);
    if (found) { setSelected(found); return; }
    // Fetch from DB if not already in the loaded list.
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("missing_persons")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!cancelled && !error && data) setSelected(data as unknown as MissingPerson);
    })();
    return () => { cancelled = true; };
  }, [search.person, missing, selected?.id]);


  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) { setSearchResults(null); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        // Escape PostgREST .or() reserved chars: , ( ) : and also % _ (ilike wildcards)
        const needle = q.trim().replace(/[,()":%_\\]/g, " ").replace(/\s+/g, " ").trim();
        if (!needle) { setSearchResults([]); return; }
        const pattern = `%${needle}%`;
        const { MISSING_PUBLIC_COLUMNS } = await import("@/lib/missing-columns");
        const { data, error } = await supabase
          .from("missing_persons")
          .select(MISSING_PUBLIC_COLUMNS)
          .or(`name.ilike.${pattern},last_seen_location.ilike.${pattern},description.ilike.${pattern}`)
          .order("report_date", { ascending: false })
          .limit(200);

        if (error) {
          console.error("[desaparecidos] search error", error);
          toast.error("No se pudo buscar. Intenta de nuevo.");
          setSearchResults([]);
        } else {
          setSearchResults((data ?? []) as unknown as MissingPerson[]);
        }
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [q]);

  const list = useMemo(() => {
    // While searching, ignore the status tab so results aren't hidden by it.
    if (searchResults) return searchResults;
    return missing.filter((m) => filter === "all" || m.status === filter);
  }, [searchResults, missing, filter]);


  const markFound = async (id: string) => {
    const { getDeviceId } = await import("@/lib/device-id");
    const { data, error } = await supabase.rpc("mark_missing_person_found" as any, {
      _person_id: id,
      _device_id: getDeviceId(),
    });
    if (error) { toast.error(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    toast.success(`Marcada como encontrada ❤️ (${row?.found_marks ?? 1} confirmación${(row?.found_marks ?? 1) === 1 ? "" : "es"})`);
    refetch();
  };


  return (
    <div ref={ptr.ref} className="max-w-6xl mx-auto px-3 sm:px-6 py-6 relative">
      {(ptr.pull > 0 || ptr.refreshing) && (
        <div className="ptr-indicator" style={{ height: Math.max(28, ptr.pull) }}>
          {ptr.refreshing ? (
            <span className="flex items-center gap-1.5"><span className="ptr-spinner" /> Actualizando…</span>
          ) : ptr.pull >= ptr.threshold ? (
            <span className="flex items-center gap-1.5"><RefreshCw className="h-3 w-3" /> Suelta para actualizar</span>
          ) : (
            <span className="flex items-center gap-1.5 opacity-70"><ChevronDown className="h-3 w-3" /> Desliza para actualizar</span>
          )}
        </div>
      )}
      <PeopleTabs />
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 mb-5">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 mb-2">
              <HeartHandshake className="h-3.5 w-3.5" /> Búsqueda colaborativa
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Registro de Personas desaparecidas</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-prose">
              Comparte, busca y ayuda a reunir familias. Cada reporte llega a toda la red de voluntarios.
            </p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="shrink-0 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-95 active:scale-[0.98] transition"
          >
            {showForm ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {showForm ? "Cerrar" : "Reportar"}
          </button>
        </div>

        {/* KPI strip */}
        <div className="relative mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <Kpi tone="rose"    value={counts.missing}  label="Registros Sin Encontrar" />
          <Kpi tone="emerald" value={counts.found}    label="Registros de Encontrados" />
          <Kpi tone="slate"   value={counts.all}      label="Total Registrados" />
        </div>

        {/* Aviso de no oficialidad */}
        <div className="relative mt-4 rounded-xl border border-amber-300/60 bg-amber-50 text-amber-900 px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed">
          <strong className="font-bold">Aviso importante:</strong> Estos registros <strong>no son oficiales</strong>. Son aportes ciudadanos consolidados desde múltiples fuentes públicas, por lo que pueden existir <strong>duplicados</strong> (una misma persona reportada varias veces), datos incompletos o desactualizados. Verifica siempre con autoridades competentes.
        </div>

      </section>

      {showForm && <MissingForm onDone={() => setShowForm(false)} />}

      {/* Sticky search + tabs */}
      <div className="sticky top-14 z-20 -mx-3 sm:mx-0 px-3 sm:px-0 py-2 mb-3 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border/60">
        <div className="flex items-stretch gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[260px] group">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary/40 via-sunrise/40 to-primary/40 opacity-60 group-focus-within:opacity-100 blur-sm transition" aria-hidden />
            <div className="relative flex items-center rounded-2xl border-2 border-primary/30 bg-card shadow-sm focus-within:border-primary focus-within:shadow-md transition">
              <Search className="ml-4 h-5 w-5 text-primary shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, ubicación o señas…"
                aria-label="Buscar persona desaparecida"
                className="w-full px-3 py-3.5 sm:py-4 bg-transparent text-base sm:text-lg font-medium placeholder:text-muted-foreground/70 placeholder:font-normal focus:outline-none"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  className="mr-2 p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition"
                  aria-label="Limpiar"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-1 bg-muted/70 rounded-xl p-1 overflow-x-auto">
            {(["missing", "found", "deceased", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition ${
                  filter === f ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "Todos" : MISSING_STATUS_LABELS[f]}
                <span className="ml-1.5 text-[10px] opacity-70">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {!loaded && missing.length === 0 ? (
          <div className="col-span-full">
            <MissingGridSkeleton count={6} />
          </div>
        ) : (
          <>
            {list.map((m) => (
              <MissingCard key={m.id} person={m} onMarkFound={() => markFound(m.id)} onChanged={refetch} onOpen={() => setSelected(m)} />
            ))}
            {list.length === 0 && (
              <div className="col-span-full">
                <EmptyState
                  emoji="🕊️"
                  title="No hay registros que coincidan"
                  description="Prueba ajustar la búsqueda o cambiar el filtro de estado."
                  action={
                    (q || filter !== "all") ? (
                      <button
                        onClick={() => { setQ(""); setFilter("all"); }}
                        className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold"
                      >
                        Limpiar filtros
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowForm(true)}
                        className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold"
                      >
                        Reportar persona desaparecida
                      </button>
                    )
                  }
                />
              </div>
            )}
            {!searchResults && hasMore && list.length > 0 && (
              <div className="col-span-full flex justify-center pt-4">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-muted disabled:opacity-60"
                >
                  {loadingMore ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</>
                  ) : (
                    <>Ver más personas ({Math.max(counts.all - missing.length, 0)} sin cargar)</>
                  )}
                </button>
              </div>
            )}
            {searchResults && (
              <div className="col-span-full text-center text-xs text-muted-foreground pt-2">
                {searching ? "Buscando en toda la base de datos..." : `${list.length} resultado(s) encontrado(s) en toda la base de datos`}
              </div>
            )}
          </>
        )}
      </div>

      <MissingDetailSheet
        person={selected}
        open={selected !== null}
        onClose={() => {
          setSelected(null);
          if (search.person) navigate({ search: ((prev: { person?: string }) => ({ ...prev, person: undefined })) as never, replace: true });

        }}
      />

    </div>
  );
}

function Kpi({ value, label, tone }: { value: number; label: string; tone: "rose" | "emerald" | "slate" }) {
  const tones = {
    rose: "from-rose-500/15 to-rose-500/5 text-rose-600",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    slate: "from-slate-500/15 to-slate-500/5 text-foreground",
  } as const;
  return (
    <div className={`rounded-xl bg-gradient-to-br ${tones[tone]} border border-border/60 px-3 py-2.5`}>
      <div className="text-xl sm:text-2xl font-black leading-none">{value.toLocaleString("es-VE")}</div>
      <div className="text-[11px] sm:text-xs text-muted-foreground mt-1 font-medium">{label}</div>
    </div>
  );
}

function MissingCard({ person, onMarkFound, onChanged, onOpen }: { person: MissingPerson; onMarkFound: () => void; onChanged?: () => void; onOpen: () => void }) {
  const navigate = useNavigate();
  const hasCoords = person.last_seen_lat != null && person.last_seen_lng != null;
  const openOnMap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasCoords) {
      toast.error("Esta persona no tiene ubicación geolocalizada");
      return;
    }
    navigate({ to: "/", search: { missing: person.id } });
  };
  const s = STATUS_STYLES[person.status];
  const reported = new Date(person.report_date);
  const daysAgo = Math.floor((Date.now() - reported.getTime()) / 86_400_000);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://venezuelaselevanta.info";
  const directLink = `${origin}/desaparecidos?person=${person.id}`;

  const shareWA = () => {
    const lines = [
      `🆘 PERSONA DESAPARECIDA — Venezuela Se Levanta`,
      ``,
      `👤 ${person.name}${person.age ? ` (${person.age} años)` : ""}`,
    ];
    if (person.last_seen_location) lines.push(`📍 Última ubicación: ${person.last_seen_location}`);
    if (person.description) lines.push(`📝 ${person.description}`);
    if (person.contact_phone) lines.push(`📞 Contacto: ${person.contact_phone}`);
    lines.push(``, `Ver ficha completa: ${directLink}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(directLink);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const [commentsCount, setCommentsCount] = useState<number | null>(null);
  const [matchesCount, setMatchesCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      const { count } = await supabase
        .from("missing_person_comments" as any)
        .select("id", { count: "exact", head: true })
        .eq("missing_person_id", person.id);
      if (active) setCommentsCount(count ?? 0);
    })();
    (async () => {
      if (person.matched_patient_id) { if (active) setMatchesCount(0); return; }
      const { data } = await supabase.rpc("suggest_patient_matches" as any, { p_missing_id: person.id });
      if (active) setMatchesCount(Array.isArray(data) ? data.length : 0);
    })();
    return () => { active = false; };
  }, [person.id, person.matched_patient_id]);


  return (
    <article className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
      {/* Status ribbon */}
      <div className={`absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md ${s.pill}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse" />
        {s.label}
      </div>

      {/* Clickable area → open detail sheet */}
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-primary/40 flex-1"
        title="Ver ficha completa"
      >
        {/* Photo / avatar */}
        <div className={`relative h-40 bg-gradient-to-br from-muted to-muted/40 ring-2 ring-inset ${s.ring}`}>
          <div className="absolute inset-0 grid place-items-center">
            <div className="h-20 w-20 rounded-full bg-card border-2 border-border grid place-items-center text-2xl font-black text-muted-foreground">
              {initials(person.name) || <User className="h-8 w-8" />}
            </div>
          </div>
          {person.photo_url && (
            <img
              src={person.photo_url}
              alt={person.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              className="absolute inset-0 w-full h-full object-cover object-center scale-110"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 via-black/55 to-transparent" />
          <div className="absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-black/55 text-white backdrop-blur">
            Ver ficha
          </div>
          <div className="absolute bottom-2 left-3 right-3 text-white">
            <h3
              className="font-bold text-lg leading-tight line-clamp-1"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)" }}
            >
              {person.name}
            </h3>
            <div className="flex items-center gap-2 text-[11px] opacity-95 mt-0.5" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>
              {person.age != null && <span>{person.age} años</span>}
              {person.age != null && <span className="opacity-60">•</span>}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {daysAgo === 0 ? "Hoy" : `Hace ${daysAgo}d`}
              </span>
            </div>
          </div>

        </div>

        {/* Body */}
        <div className="p-4 space-y-2.5">
          {person.matched_patient_id && (
            <div className="flex items-start gap-1.5 text-xs rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-2">
              <span className="shrink-0">✅</span>
              <div className="min-w-0">
                <div className="font-bold text-emerald-700 dark:text-emerald-400 leading-tight">Localizado</div>
                {person.matched_patient?.center_name && (
                  <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 line-clamp-2">
                    🏥 {person.matched_patient.center_name}
                  </div>
                )}
              </div>
            </div>
          )}
          {person.last_seen_location && (
            <div className="flex items-start gap-1.5 text-xs">
              <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
              <span className="text-foreground/90 line-clamp-2">{person.last_seen_location}</span>
            </div>
          )}

          {person.description && (
            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{person.description}</p>
          )}
        </div>
      </button>

      {(person.contact_name || person.contact_phone || person.contact_email) && (
        <div className="px-4 pb-2 pt-1 border-t border-border/60 space-y-1">
          {person.contact_name && (
            <div className="flex items-center gap-1.5 text-xs">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{person.contact_name}</span>
            </div>
          )}
          {person.contact_phone && (
            <a href={`tel:${person.contact_phone}`} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <Phone className="h-3 w-3" /> {person.contact_phone}
            </a>
          )}
          {person.contact_email && (
            <a href={`mailto:${person.contact_email}`} className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate">
              <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{person.contact_email}</span>
            </a>
          )}
        </div>
      )}

      {/* Actions — icon row (bolder, larger) */}
      <div className="px-3 pb-3 pt-2 flex items-center justify-between gap-1 border-t border-border/40">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition font-bold"
          title={`Comentarios${commentsCount != null ? ` (${commentsCount})` : ""}`}
          aria-label="Comentarios"
        >
          <MessageCircle className="h-5 w-5" strokeWidth={2.5} />
          <span className="text-sm tabular-nums">{commentsCount ?? "—"}</span>
        </button>

        {!person.matched_patient_id && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-sky-700 hover:bg-sky-500/10 transition font-bold"
            title={`Coincidencias en atendidos${matchesCount != null ? ` (${matchesCount})` : ""} — abrir ficha`}
            aria-label="Coincidencias"
          >
            <Hospital className="h-5 w-5" strokeWidth={2.5} />
            <span className="text-sm tabular-nums">{matchesCount ?? "—"}</span>
          </button>
        )}

        {hasCoords && (
          <button
            type="button"
            onClick={openOnMap}
            className="flex-1 inline-flex items-center justify-center px-2 py-2.5 rounded-xl text-primary hover:bg-primary/10 transition"
            title="Ver en el mapa"
            aria-label="Ver en mapa"
          >
            <MapIcon className="h-5 w-5" strokeWidth={2.5} />
          </button>
        )}

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); shareWA(); }}
          className="flex-1 inline-flex items-center justify-center px-2 py-2.5 rounded-xl text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition"
          title="Difundir por WhatsApp"
          aria-label="Difundir"
        >
          <Share2 className="h-5 w-5" strokeWidth={2.5} />
        </button>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); copyLink(); }}
          className="flex-1 inline-flex items-center justify-center px-2 py-2.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition"
          title="Copiar enlace"
          aria-label="Copiar enlace"
        >
          <LinkIcon className="h-5 w-5" strokeWidth={2.5} />
        </button>


      </div>

    </article>
  );
}

function MissingForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({
    name: "",
    id_number: "",
    age: "",
    description: "",
    last_seen_location: "",
    state: "",
    municipality: "",
    parish: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const field = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Solo se permiten imágenes"); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error("La imagen supera 15 MB"); return; }
    setPhotoBusy(true);
    try {
      const url = await uploadOne(file);
      setPhotoUrl(url);
      toast.success("Foto cargada");
    } catch (err) {
      toast.error((err as Error).message || "No se pudo subir la foto");
    } finally {
      setPhotoBusy(false);
    }
  };

  const doGeocode = async () => {
    if (!f.last_seen_location.trim()) return toast.error("Escribe la ubicación primero");
    setGeoBusy(true);
    const hit = await geocodeAddress(f.last_seen_location);
    setGeoBusy(false);
    if (!hit) return toast.error("No se pudo localizar esa dirección");
    setCoords({ lat: hit.lat, lng: hit.lng });
    toast.success("Ubicación encontrada en el mapa");
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Tu navegador no soporta geolocalización");
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoBusy(false);
        toast.success("Usando tu ubicación actual");
      },
      (err) => {
        setGeoBusy(false);
        toast.error(err.message || "No se pudo obtener tu ubicación");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submit = async () => {
    if (!f.name.trim()) { toast.error("Nombre requerido"); return; }
    setBusy(true);
    const { error } = await supabase.from("missing_persons").insert({
      name: f.name.trim(),
      id_number: f.id_number.trim() || null,
      age: f.age ? Number(f.age) : null,
      description: f.description.trim() || null,
      last_seen_location: f.last_seen_location.trim() || null,
      last_seen_lat: coords?.lat ?? null,
      last_seen_lng: coords?.lng ?? null,
      state: f.state || null,
      municipality: f.municipality || null,
      parish: f.parish.trim() || null,
      contact_name: f.contact_name.trim() || null,
      contact_phone: f.contact_phone.trim() || null,
      contact_email: f.contact_email.trim() || null,
      photo_url: photoUrl,
    } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(coords ? "Publicada y geolocalizada en el mapa" : "Reporte enviado");
    onDone();
  };


  const stepPersona = (
    <div className="grid sm:grid-cols-2 gap-3">
      <input className={field} placeholder="Nombre completo *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={100} />
      <input
        className={field}
        placeholder="Cédula (V-12345678)"
        value={f.id_number}
        onChange={(e) => setF({ ...f, id_number: e.target.value })}
        maxLength={20}
        inputMode="text"
        autoComplete="off"
      />
      <input
        type="number"
        min="0"
        max="120"
        className={field}
        placeholder="Edad"
        value={f.age}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || (Number(v) >= 0 && Number(v) <= 120)) setF({ ...f, age: v });
        }}
      />
      <textarea
        className={`${field} sm:col-span-2 resize-none`}
        rows={3}
        placeholder="Descripción física (ropa, altura, señas particulares)"
        value={f.description}
        onChange={(e) => setF({ ...f, description: e.target.value })}
        maxLength={500}
      />
      <div className="sm:col-span-2">
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Foto (opcional, ayuda mucho a identificar)</label>
        <div className="flex items-center gap-3">
          {photoUrl ? (
            <div className="relative">
              <img src={photoUrl} alt="Foto" className="h-20 w-20 rounded-lg object-cover border border-border" />
              <button
                type="button"
                onClick={() => setPhotoUrl(null)}
                className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-0.5 shadow"
                aria-label="Quitar foto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border bg-muted/40 hover:bg-muted cursor-pointer text-sm font-semibold ${photoBusy ? "opacity-60 pointer-events-none" : ""}`}>
              {photoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {photoBusy ? "Subiendo…" : "Subir foto"}
              <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} disabled={photoBusy} />
            </label>
          )}
          <span className="text-[11px] text-muted-foreground">JPG/PNG, máx 15 MB. Se comprime automáticamente.</span>
        </div>
      </div>
    </div>
  );

  const stepUbicacion = (
    <div className="space-y-3">
      <input
        className={field}
        placeholder="Última ubicación conocida (ej: Av. Bolívar, Caracas)"
        value={f.last_seen_location}
        onChange={(e) => { setF({ ...f, last_seen_location: e.target.value }); setCoords(null); }}
        maxLength={200}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={doGeocode}
          disabled={geoBusy || !f.last_seen_location.trim()}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-50 font-semibold"
        >
          {geoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
          Localizar dirección
        </button>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={geoBusy}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-50 font-semibold"
        >
          <Crosshair className="h-3.5 w-3.5" /> Mi ubicación
        </button>
        {coords ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-700 font-semibold">
            <MapPin className="h-3 w-3" /> En el mapa ({coords.lat.toFixed(3)}, {coords.lng.toFixed(3)})
            <button type="button" onClick={() => setCoords(null)} className="ml-1 opacity-70 hover:opacity-100" aria-label="Quitar">
              <X className="h-3 w-3" />
            </button>
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Sin coordenadas → solo aparece en la lista.</span>
        )}
      </div>
      <LocationSelect
        state={f.state}
        municipality={f.municipality}
        parish={f.parish}
        onChange={(v) => setF({ ...f, ...v })}
      />
    </div>
  );

  const stepContacto = (
    <div className="grid sm:grid-cols-2 gap-3">
      <input className={field} placeholder="Nombre del contacto" value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} maxLength={100} />
      <input className={field} placeholder="Teléfono del contacto" value={f.contact_phone} onChange={(e) => setF({ ...f, contact_phone: e.target.value })} maxLength={40} />
      <input type="email" className={`${field} sm:col-span-2`} placeholder="Email del contacto" value={f.contact_email} onChange={(e) => setF({ ...f, contact_email: e.target.value })} maxLength={150} />
      <p className="sm:col-span-2 text-[11px] text-muted-foreground">
        Al menos un medio de contacto ayuda a coordinar la búsqueda. Esta información se mantiene reservada.
      </p>
    </div>
  );

  return (
    <Wizard
      title="Nuevo reporte de desaparecido"
      submitLabel="Publicar reporte"
      submitting={busy}
      onSubmit={submit}
      onCancel={onDone}
      steps={[
        { key: "persona", label: "Datos de la persona", content: stepPersona, isValid: () => f.name.trim().length > 0, invalidMessage: "El nombre es requerido" },
        { key: "ubicacion", label: "Última ubicación conocida", content: stepUbicacion },
        { key: "contacto", label: "Contacto del reportante", content: stepContacto },
      ]}
    />
  );
}

