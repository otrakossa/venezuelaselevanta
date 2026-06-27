import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMissing } from "@/hooks/useReports";
import { MISSING_STATUS_LABELS } from "@/lib/categories";
import type { MissingPerson, MissingStatus } from "@/lib/types";
import { toast } from "sonner";
import {
  Search, UserPlus, UserCheck, MapPin, Phone, Mail, User,
  CalendarDays, Share2, Link as LinkIcon, X, HeartHandshake, Loader2, Crosshair, Map as MapIcon, RefreshCw, ChevronDown,
} from "lucide-react";
import { geocodeAddress } from "@/lib/geocode";
import { MissingGridSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/EmptyState";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { LocationSelect } from "@/components/LocationSelect";
import { MatchSuggestions } from "@/components/MatchSuggestions";
import { Wizard } from "@/components/wizard/Wizard";


export const Route = createFileRoute("/desaparecidos")({
  ssr: false,
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
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("missing");
  const [showForm, setShowForm] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [searchResults, setSearchResults] = useState<MissingPerson[] | null>(null);
  const [searching, setSearching] = useState(false);
  // Mark loaded once we have any data, or after first render tick.
  useMemo(() => { if (missing.length > 0) setLoaded(true); }, [missing.length]);
  const ptr = usePullToRefresh<HTMLDivElement>({
    onRefresh: async () => { await refetch(); toast.success("Lista actualizada"); },
  });

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) { setSearchResults(null); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const needle = q.trim();
        const { MISSING_PUBLIC_COLUMNS } = await import("@/lib/missing-columns");
        const { data } = await supabase
          .from("missing_persons")
          .select(MISSING_PUBLIC_COLUMNS)
          .or(`name.ilike.%${needle}%,last_seen_location.ilike.%${needle}%,description.ilike.%${needle}%`)
          .order("report_date", { ascending: false })
          .limit(200);

        setSearchResults((data ?? []) as unknown as MissingPerson[]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [q]);

  const list = useMemo(() => {
    const source = searchResults ?? missing;
    return source.filter((m) => filter === "all" || m.status === filter);
  }, [searchResults, missing, filter]);


  const markFound = async (id: string) => {
    const { error } = await supabase
      .from("missing_persons")
      .update({ status: "found", found_date: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Marcada como encontrada ❤️");
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
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 mb-5">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 mb-2">
              <HeartHandshake className="h-3.5 w-3.5" /> Búsqueda colaborativa
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Personas desaparecidas</h1>
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
          <Kpi tone="rose"    value={counts.missing}  label="Sin encontrar" />
          <Kpi tone="emerald" value={counts.found}    label="Encontrados" />
          <Kpi tone="slate"   value={counts.all}      label="Total registrados" />
        </div>
      </section>

      {showForm && <MissingForm onDone={() => setShowForm(false)} />}

      {/* Sticky search + tabs */}
      <div className="sticky top-14 z-20 -mx-3 sm:mx-0 px-3 sm:px-0 py-2 mb-3 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border/60">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, ubicación o señas…"
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:bg-muted"
                aria-label="Limpiar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
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
              <MissingCard key={m.id} person={m} onMarkFound={() => markFound(m.id)} onChanged={refetch} />
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

function MissingCard({ person, onMarkFound, onChanged }: { person: MissingPerson; onMarkFound: () => void; onChanged?: () => void }) {
  const navigate = useNavigate();
  const hasCoords = person.last_seen_lat != null && person.last_seen_lng != null;
  const openOnMap = () => {
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
  const directLink = `${origin}/?missing=${person.id}`;

  const shareWA = () => {
    const text =
      `🆘 *PERSONA DESAPARECIDA* — Venezuela Se Levanta\n\n` +
      `👤 ${person.name}${person.age ? ` (${person.age} años)` : ""}\n` +
      (person.last_seen_location ? `📍 Última ubicación: ${person.last_seen_location}\n` : "") +
      (person.description ? `📝 ${person.description}\n` : "") +
      (person.contact_phone ? `📞 Contacto: ${person.contact_phone}\n` : "") +
      `\nVer en el mapa: ${directLink}`;
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

  return (
    <article className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200">
      {/* Status ribbon */}
      <div className={`absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md ${s.pill}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse" />
        {s.label}
      </div>

      {/* Clickable area → focus on map */}
      <button
        type="button"
        onClick={openOnMap}
        className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-primary/40"
        title={hasCoords ? "Ver en el mapa" : "Sin ubicación geolocalizada"}
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
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
          {hasCoords && (
            <div className="absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-black/55 text-white backdrop-blur">
              <MapIcon className="h-3 w-3" /> Ver en mapa
            </div>
          )}
          <div className="absolute bottom-2 left-3 right-3 text-white">
            <h3 className="font-bold text-lg leading-tight drop-shadow line-clamp-1">{person.name}</h3>
            <div className="flex items-center gap-2 text-[11px] opacity-90 mt-0.5">
              {person.age != null && <span>{person.age} años</span>}
              {person.age != null && <span className="opacity-50">•</span>}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {daysAgo === 0 ? "Hoy" : `Hace ${daysAgo}d`}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-2.5">
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

      <div className="px-4 pb-2">
        <MatchSuggestions
          kind="missing"
          selfId={person.id}
          matchedId={person.matched_patient_id}
          onChanged={onChanged}
        />
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex items-center gap-2">
        <button
          onClick={shareWA}
          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold py-2 rounded-lg transition"
          title="Compartir por WhatsApp"
        >
          <Share2 className="h-3.5 w-3.5" /> Difundir
        </button>
        <button
          onClick={copyLink}
          className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted transition"
          aria-label="Copiar enlace"
          title="Copiar enlace"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </button>
        {person.status === "missing" && (
          <button
            onClick={onMarkFound}
            className="inline-flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 px-3 rounded-lg transition shadow shadow-emerald-500/20"
            title="Marcar como encontrada"
          >
            <UserCheck className="h-3.5 w-3.5" /> Encontrada
          </button>
        )}
      </div>
    </article>
  );
}

function MissingForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({
    name: "",
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
  const field = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

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
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(coords ? "Publicada y geolocalizada en el mapa" : "Reporte enviado");
    onDone();
  };


  const stepPersona = (
    <div className="grid sm:grid-cols-2 gap-3">
      <input className={field} placeholder="Nombre completo *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={100} />
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

