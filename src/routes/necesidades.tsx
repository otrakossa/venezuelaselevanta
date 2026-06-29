import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { HealthCenterPicker } from "@/components/HealthCenterPicker";
import { LocationPickerInline } from "@/components/LocationPickerInline";
import { Wizard } from "@/components/wizard/Wizard";
import { reverseGeocode } from "@/lib/geocode";

import {
  Search, X, HandHeart, Loader2, RefreshCw, Plus, Phone, User,
  Info, ChevronDown, PackageOpen, Share2,
  Pill, Apple, Droplet, HandHelping, Wrench, Droplets, Banknote, SprayCan, Baby, Package,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/necesidades")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Necesidades — Venezuela Se Levanta" },
      { name: "description", content: "Publica necesidades urgentes y ofrece ayuda a los afectados en Venezuela." },
    ],
  }),
  component: NecesidadesPage,
});

import { SUPA_URL, SUPA_ANON } from "@/lib/supabase-rest";

type NeedCategory = "medicine" | "food" | "water" | "volunteers" | "equipment" | "blood" | "money" | "hygiene" | "diapers" | "other";
type NeedUrgency  = "critical" | "high" | "medium" | "low";
type NeedStatus   = "open" | "partial" | "fulfilled";


interface Need {
  id: string;
  center_name: string;
  center_address: string | null;
  lat: number | null;
  lng: number | null;
  category: NeedCategory;
  categories: NeedCategory[];
  title: string;
  description: string | null;
  quantity: string | null;
  urgency: NeedUrgency;
  status: NeedStatus;
  contact_name: string | null;
  contact_phone: string | null;
  contact_info: string | null;
  reporter_name: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORY_META: Record<NeedCategory, { emoji: string; label: string; icon: LucideIcon; color: string }> = {
  medicine:   { emoji: "💊", label: "Medicinas",             icon: Pill,        color: "#DC2626" },
  food:       { emoji: "🍎", label: "Alimentos",             icon: Apple,       color: "#16A34A" },
  water:      { emoji: "💧", label: "Agua",                  icon: Droplet,     color: "#2563EB" },
  volunteers: { emoji: "🤝", label: "Voluntarios",           icon: HandHelping, color: "#EA580C" },
  equipment:  { emoji: "🔧", label: "Equipos",               icon: Wrench,      color: "#7C3AED" },
  blood:      { emoji: "🩸", label: "Sangre",                icon: Droplets,    color: "#B91C1C" },
  money:      { emoji: "💰", label: "Dinero",                icon: Banknote,    color: "#CA8A04" },
  hygiene:    { emoji: "🧼", label: "Kit higiene/menstrual", icon: SprayCan,    color: "#0EA5E9" },
  diapers:    { emoji: "👶", label: "Pañales",               icon: Baby,        color: "#DB2777" },
  other:      { emoji: "📦", label: "Otro",                  icon: Package,     color: "#6B7280" },
};

const URGENCY_STYLES: Record<NeedUrgency, { pill: string; dot: string; label: string; emoji: string }> = {
  critical: { pill: "bg-red-500/15 text-red-700 dark:text-red-400",         dot: "bg-red-500",    label: "Crítica",  emoji: "🔴" },
  high:     { pill: "bg-orange-500/15 text-orange-700 dark:text-orange-400", dot: "bg-orange-500", label: "Alta",     emoji: "🟠" },
  medium:   { pill: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400", dot: "bg-yellow-500", label: "Media",    emoji: "🟡" },
  low:      { pill: "bg-green-500/15 text-green-700 dark:text-green-400",    dot: "bg-green-500",  label: "Baja",     emoji: "🟢" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "Hace un momento";
  if (mins < 60)  return `Hace ${mins}m`;
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${days}d`;
}

async function fetchNeeds(statusFilter: "active" | "fulfilled", category: NeedCategory | "all"): Promise<Need[]> {
  const statusQ =
    statusFilter === "active" ? "status=in.(open,partial)" : "status=eq.fulfilled";
  // `cs` = contains: matches rows whose `categories` array includes the selected one.
  const catQ = category !== "all" ? `&categories=cs.{${category}}` : "";
  const res = await fetch(
    `${SUPA_URL}/rest/v1/needs?${statusQ}${catQ}&order=created_at.desc&limit=200`,
    {
      headers: {
        apikey:        SUPA_ANON,
        Authorization: `Bearer ${SUPA_ANON}`,
      },
    },
  );
  if (!res.ok) throw new Error(await res.text());
  const rows = (await res.json()) as Need[];
  // Backfill `categories` in memory in case some old row was missed.
  return rows.map((r) => ({
    ...r,
    categories:
      Array.isArray(r.categories) && r.categories.length > 0
        ? r.categories
        : r.category
        ? [r.category]
        : [],
  }));
}

function NecesidadesPage() {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ]                   = useState("");
  const [category, setCategory]     = useState<NeedCategory | "all">("all");
  const [urgency, setUrgency]       = useState<NeedUrgency | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "fulfilled">("active");
  const [showForm, setShowForm]     = useState(false);
  const navigate = useNavigate({ from: "/necesidades" });

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await fetchNeeds(statusFilter, category);
      setNeeds(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error cargando datos";
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    let src = needs;
    if (urgency !== "all") src = src.filter((n) => n.urgency === urgency);
    if (q.trim().length >= 2) {
      const needle = q.trim().toLowerCase();
      src = src.filter(
        (n) =>
          n.title.toLowerCase().includes(needle) ||
          n.center_name.toLowerCase().includes(needle) ||
          (n.description ?? "").toLowerCase().includes(needle),
      );
    }
    return src;
  }, [needs, urgency, q]);

  const counts = useMemo(() => ({
    critical: needs.filter((n) => n.urgency === "critical").length,
    high:     needs.filter((n) => n.urgency === "high").length,
    medium:   needs.filter((n) => n.urgency === "medium").length,
    low:      needs.filter((n) => n.urgency === "low").length,
  }), [needs]);

  // Deep-link: ?need=<id> opens a focused detail modal for that need.
  const [focused, setFocused] = useState<Need | null>(null);
  const [focusedLoading, setFocusedLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("need");
    if (!id) { setFocused(null); return; }
    const inList = needs.find((n) => n.id === id);
    if (inList) { setFocused(inList); return; }
    setFocusedLoading(true);
    fetch(`${SUPA_URL}/rest/v1/needs?id=eq.${id}&limit=1`, {
      headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` },
    })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("No encontrado")))
      .then((rows: Need[]) => {
        const row = rows[0];
        if (!row) { toast.error("Esta necesidad ya no está disponible"); return; }
        setFocused({
          ...row,
          categories: Array.isArray(row.categories) && row.categories.length > 0
            ? row.categories
            : row.category ? [row.category] : [],
        });
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo cargar"))
      .finally(() => setFocusedLoading(false));
  }, [needs]);

  const closeFocused = () => {
    setFocused(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("need");
    window.history.replaceState({}, "", url.toString());
  };



  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 relative">

      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 mb-5">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 whitespace-nowrap">
                <HandHeart className="h-3.5 w-3.5" /> Ayuda solidaria
              </div>
              <button
                onClick={() => setShowForm((s) => !s)}
                className="sm:hidden shrink-0 inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition"
              >
                {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {showForm ? "Cerrar" : "Publicar"}
              </button>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">Necesidades de la comunidad</h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-prose">
              Publica lo que necesitas o encuentra cómo ayudar a quienes más lo necesitan.
            </p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="hidden sm:inline-flex shrink-0 items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-95 active:scale-[0.98] transition"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cerrar" : "Publicar necesidad"}
          </button>
        </div>

        <div className="relative mt-4 grid grid-cols-4 gap-1.5 sm:gap-3">
          <Kpi tone="red"    value={counts.critical} label="Crítica" emoji="🔴" />
          <Kpi tone="orange" value={counts.high}     label="Alta"    emoji="🟠" />
          <Kpi tone="yellow" value={counts.medium}   label="Media"   emoji="🟡" />
          <Kpi tone="green"  value={counts.low}      label="Baja"    emoji="🟢" />
        </div>
      </section>

      {showForm && (
        <NeedForm
          onDone={() => { setShowForm(false); load(true); }}
        />
      )}

      <div className="sticky top-14 z-20 -mx-3 sm:mx-0 px-3 sm:px-0 pt-2 pb-2 mb-3 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border/60 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setCategory("all")}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold transition border ${
              category === "all"
                ? "bg-primary text-primary-foreground border-primary shadow"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Todas
          </button>
          {(Object.keys(CATEGORY_META) as NeedCategory[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold transition border ${
                category === c
                  ? "bg-primary text-primary-foreground border-primary shadow"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
            </button>
          ))}
        </div>


        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[260px] group">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary/40 via-sunrise/40 to-primary/40 opacity-60 group-focus-within:opacity-100 blur-sm transition" aria-hidden />
            <div className="relative flex items-center rounded-2xl border-2 border-primary/30 bg-card shadow-sm focus-within:border-primary focus-within:shadow-md transition">
              <Search className="ml-4 h-5 w-5 text-primary shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por título, centro o descripción…"
                aria-label="Buscar necesidad"
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

          <div className="flex flex-wrap gap-1 bg-muted/70 rounded-xl p-1">
            {(["all", "critical", "high", "medium", "low"] as const).map((u) => (
              <button
                key={u}
                onClick={() => setUrgency(u)}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition ${
                  urgency === u ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {u === "all"
                  ? "Todas"
                  : `${URGENCY_STYLES[u].emoji} ${URGENCY_STYLES[u].label}`}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-muted/70 rounded-xl p-1">
            <button
              onClick={() => setStatusFilter("active")}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition ${
                statusFilter === "active" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Activas
            </button>
            <button
              onClick={() => setStatusFilter("fulfilled")}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition ${
                statusFilter === "fulfilled" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Cubiertas
            </button>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50"
            aria-label="Actualizar"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {loading ? (
          <div className="col-span-full flex flex-col gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <div className="text-4xl mb-3">🤲</div>
            <p className="font-bold text-base mb-1">No hay necesidades publicadas</p>
            <p className="text-sm text-muted-foreground mb-4">
              {q || urgency !== "all" || category !== "all"
                ? "Prueba ajustar los filtros de búsqueda."
                : "Sé el primero en publicar una necesidad."}
            </p>
            {(q || urgency !== "all" || category !== "all") ? (
              <button
                onClick={() => { setQ(""); setUrgency("all"); setCategory("all"); }}
                className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold"
              >
                Limpiar filtros
              </button>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold"
              >
                Publicar necesidad
              </button>
            )}
          </div>
        ) : (
          list.map((n) => (
            <NeedCard key={n.id} need={n} onOffer={() => navigate({ to: "/ofertas", search: { need: n.id } })} />
          ))
        )}
      </div>

      {(focused || focusedLoading) && (
        <NeedDetailModal
          need={focused}
          loading={focusedLoading}
          onClose={closeFocused}
          onOffer={() => { if (focused) navigate({ to: "/ofertas", search: { need: focused.id } }); }}
        />
      )}
    </div>
  );
}

function NeedDetailModal({
  need, loading, onClose, onOffer,
}: { need: Need | null; loading: boolean; onClose: () => void; onOffer: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  const cats = need ? (need.categories.length > 0 ? need.categories : [need.category]) : [];
  const primary = need ? (CATEGORY_META[cats[0]] ?? CATEGORY_META.other) : null;
  const urg = need ? URGENCY_STYLES[need.urgency] : null;

  const share = () => {
    if (!need) return;
    const url = `${window.location.origin}/necesidades?need=${need.id}`;
    const cat = (CATEGORY_META[cats[0]] ?? CATEGORY_META.other).label;
    const text =
      `🆘 NECESIDAD ${urg!.label.toUpperCase()} — ${cat}\n\n` +
      `${need.title}\n` +
      `📍 ${need.center_name}${need.center_address ? " · " + need.center_address : ""}\n` +
      (need.description ? `\n${need.description}\n` : "") +
      (need.quantity ? `\nCantidad: ${need.quantity}\n` : "") +
      (need.contact_name ? `\nContacto: ${need.contact_name}` : "") +
      (need.contact_phone ? ` · ${need.contact_phone}` : "") +
      `\n\n¿Puedes ayudar? Ofrece tu apoyo aquí:\n${url}`;
    if (navigator.share) {
      navigator.share({ title: need.title, text, url }).catch(() => {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
      });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        className="relative bg-card w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-background/90 border border-border shadow hover:bg-muted transition"
        >
          <X className="h-4 w-4" />
        </button>

        {loading || !need || !primary || !urg ? (
          <div className="p-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="p-5 pr-12 border-b border-border bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {cats.map((c) => {
                  const m = CATEGORY_META[c] ?? CATEGORY_META.other;
                  return (
                    <span key={c} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wide">
                      {m.emoji} {m.label}
                    </span>
                  );
                })}
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${urg.pill}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${urg.dot} ${need.urgency === "critical" ? "animate-pulse" : ""}`} />
                  {urg.label}
                </span>
                {need.status === "fulfilled" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700">✅ Cubierta</span>
                )}
              </div>
              <h2 className="text-xl font-black leading-tight">{need.title}</h2>
              <div className="text-xs text-muted-foreground mt-2">
                <span className="font-semibold text-foreground">🏥 {need.center_name}</span>
                {need.center_address && <span className="ml-1">· {need.center_address}</span>}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Publicado {timeAgo(need.created_at)} · {new Date(need.created_at).toLocaleString("es-VE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {need.description && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{need.description}</p>
              )}
              {need.quantity && (
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                  <Info className="h-3.5 w-3.5" /> Cantidad: {need.quantity}
                </div>
              )}
              {(need.contact_name || need.contact_phone || need.contact_info) && (
                <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Contacto</div>
                  {need.contact_name && (
                    <div className="flex items-center gap-1.5 text-sm"><User className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-medium">{need.contact_name}</span></div>
                  )}
                  {need.contact_phone && (
                    <a href={`tel:${need.contact_phone}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                      <Phone className="h-3.5 w-3.5" /> {need.contact_phone}
                    </a>
                  )}
                  {need.contact_info && (
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5 shrink-0 mt-0.5" /><span>{need.contact_info}</span></div>
                  )}
                </div>
              )}
            </div>

            <div
              className="p-4 border-t border-border bg-card flex flex-wrap items-center gap-2 sticky bottom-0 shadow-[0_-4px_12px_-6px_rgba(0,0,0,0.15)]"
              style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
            >
              {need.status !== "fulfilled" && (
                <button
                  onClick={onOffer}
                  className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/30 transition"
                >
                  <PackageOpen className="h-4 w-4" /> Ofrecer ayuda
                </button>
              )}
              <button
                onClick={share}
                className="inline-flex items-center justify-center gap-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-400 text-sm font-bold py-3 px-4 rounded-xl transition"
              >
                <Share2 className="h-4 w-4" /> Difundir
              </button>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/necesidades?need=${need.id}`;
                  navigator.clipboard.writeText(url).then(() => toast.success("Enlace copiado"));
                }}
                className="inline-flex items-center justify-center gap-1.5 bg-muted hover:bg-muted/70 text-foreground text-sm font-bold py-3 px-4 rounded-xl transition"
              >
                Copiar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}





function Kpi({ value, label, tone, emoji }: { value: number; label: string; tone: "red" | "orange" | "yellow" | "green"; emoji?: string }) {
  const tones = {
    red:    "from-red-500/15 to-red-500/5 text-red-600",
    orange: "from-orange-500/15 to-orange-500/5 text-orange-600",
    yellow: "from-yellow-500/15 to-yellow-500/5 text-yellow-600",
    green:  "from-green-500/15 to-green-500/5 text-green-600",
  } as const;
  return (
    <div className={`rounded-xl bg-gradient-to-br ${tones[tone]} border border-border/60 px-2 py-2 min-w-0`}>
      <div className="text-lg sm:text-2xl font-black leading-none">{value}</div>
      <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 font-medium leading-tight flex items-center gap-1 truncate">
        {emoji && <span className="text-[10px]">{emoji}</span>}
        <span className="truncate">{label}</span>
      </div>
    </div>
  );
}

function NeedCard({ need: n, onOffer }: { need: Need; onOffer: () => void }) {
  const cats = n.categories.length > 0 ? n.categories : [n.category];
  const primary = CATEGORY_META[cats[0]] ?? CATEGORY_META.other;
  const urg = URGENCY_STYLES[n.urgency];
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      <div className="p-4 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <span className="text-2xl leading-none shrink-0 mt-0.5">{primary.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-1 mb-1">
                {cats.map((c) => {
                  const m = CATEGORY_META[c] ?? CATEGORY_META.other;
                  return (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wide"
                    >
                      {m.emoji} {m.label}
                    </span>
                  );
                })}
              </div>
              <h3 className="font-bold text-sm leading-tight line-clamp-2">{n.title}</h3>
            </div>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${urg.pill}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${urg.dot} ${n.urgency === "critical" ? "animate-pulse" : ""}`} />
            {urg.label}
          </span>
        </div>

        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">🏥 {n.center_name}</span>
          {n.center_address && <span className="ml-1">· {n.center_address}</span>}
        </div>

        {n.description && (
          <p className={`text-xs text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>
            {n.description}
          </p>
        )}
        {n.description && n.description.length > 120 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground font-semibold"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Ver menos" : "Ver más"}
          </button>
        )}

        {n.quantity && (
          <div className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            <Info className="h-3 w-3" /> Cantidad: {n.quantity}
          </div>
        )}

        {(n.contact_name || n.contact_phone || n.contact_info) && (
          <div className="border-t border-border/60 pt-2 space-y-1">
            {n.contact_name && (
              <div className="flex items-center gap-1.5 text-xs">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{n.contact_name}</span>
              </div>
            )}
            {n.contact_phone && (
              <a
                href={`tel:${n.contact_phone}`}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Phone className="h-3 w-3" /> {n.contact_phone}
              </a>
            )}
            {n.contact_info && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3 w-3 shrink-0 mt-0.5" />
                <span>{n.contact_info}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-4 pt-1 flex items-center justify-between gap-2 border-t border-border/60">
        <span className="text-[10px] text-muted-foreground flex flex-col leading-tight">
          <span>{timeAgo(n.created_at)}</span>
          <time dateTime={n.created_at} className="text-[10px] opacity-75">
            {new Date(n.created_at).toLocaleString("es-VE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </time>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              const url = `${window.location.origin}/necesidades?need=${n.id}`;
              const cat = (CATEGORY_META[cats[0]] ?? CATEGORY_META.other).label;
              const text =
                `🆘 NECESIDAD ${urg.label.toUpperCase()} — ${cat}\n\n` +
                `${n.title}\n` +
                `📍 ${n.center_name}${n.center_address ? " · " + n.center_address : ""}\n` +
                (n.description ? `\n${n.description}\n` : "") +
                (n.quantity ? `\nCantidad: ${n.quantity}\n` : "") +
                (n.contact_name ? `\nContacto: ${n.contact_name}` : "") +
                (n.contact_phone ? ` · ${n.contact_phone}` : "") +
                `\n\n¿Puedes ayudar? Ofrece tu apoyo aquí:\n${url}`;
              if (navigator.share) {
                navigator.share({ title: n.title, text, url }).catch(() => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                });
              } else {
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
              }
            }}
            title="Difundir esta necesidad"
            className="inline-flex items-center gap-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-400 text-xs font-bold py-2 px-3 rounded-lg transition"
          >
            <Share2 className="h-3.5 w-3.5" /> Difundir
          </button>
          {n.status !== "fulfilled" && (
            <button
              onClick={onOffer}
              className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold py-2 px-3 rounded-lg transition"
            >
              <PackageOpen className="h-3.5 w-3.5" /> Ofrecer ayuda
            </button>
          )}
          {n.status === "fulfilled" && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-muted text-muted-foreground">
              ✅ Cubierta
            </span>
          )}
        </div>
      </div>
    </article>
  );
}


function NeedForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({
    categories:    [] as NeedCategory[],
    title:         "",
    description:   "",
    quantity:      "",
    urgency:       "high" as NeedUrgency,
    center_name:   "",
    center_address: "",
    center_lat:    null as number | null,
    center_lng:    null as number | null,
    center_phone:  "" as string,
    contact_name:    "",
    reporter_cedula: "",
    contact_phone:   "",
    contact_info:    "",
  });
  const [busy, setBusy] = useState(false);
  const [geocodingAddr, setGeocodingAddr] = useState(false);
  // Tracks whether the address field was last set by the user (true) or by autofill (false).
  const addressManuallyEdited = useRef(false);
  const field = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  // Auto-fill address from lat/lng when the pin moves, unless the user edited it manually.
  useEffect(() => {
    if (f.center_lat == null || f.center_lng == null) return;
    if (addressManuallyEdited.current && f.center_address.trim().length > 0) return;
    const ctrl = new AbortController();
    setGeocodingAddr(true);
    reverseGeocode(f.center_lat, f.center_lng, ctrl.signal)
      .then((addr) => {
        if (addr && !ctrl.signal.aborted) {
          setF((prev) => {
            // Skip if user typed something in the meantime and it's not empty
            if (addressManuallyEdited.current && prev.center_address.trim().length > 0) return prev;
            return { ...prev, center_address: addr };
          });
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setGeocodingAddr(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.center_lat, f.center_lng]);

  const toggleCat = (c: NeedCategory) => {
    setF((prev) => ({
      ...prev,
      categories: prev.categories.includes(c)
        ? prev.categories.filter((x) => x !== c)
        : [...prev.categories, c],
    }));
  };

  const submit = async () => {
    if (f.categories.length === 0) { toast.error("Selecciona al menos una categoría"); return; }
    if (!f.title.trim())           { toast.error("El título es requerido"); return; }
    if (!f.center_name.trim())     { toast.error("El nombre del centro es requerido"); return; }
    if (!f.contact_name.trim())    { toast.error("Tu nombre es obligatorio"); return; }
    if (!f.reporter_cedula.trim()) { toast.error("Tu cédula es obligatoria"); return; }
    if (!f.contact_phone.trim())   { toast.error("Tu teléfono es obligatorio"); return; }


    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        // `category` keeps the first one for backward compatibility with old code paths.
        category:       f.categories[0],
        categories:     f.categories,
        title:          f.title.trim(),
        description:    f.description.trim() || null,
        quantity:       f.quantity.trim() || null,
        urgency:        f.urgency,
        center_name:    f.center_name.trim(),
        center_address: f.center_address.trim() || null,
        lat:            f.center_lat,
        lng:            f.center_lng,
        contact_name:    f.contact_name.trim(),
        reporter_cedula: f.reporter_cedula.trim(),
        contact_phone:   f.contact_phone.trim(),
        contact_info:    f.contact_info.trim() || null,
        status:          "open" as NeedStatus,
      };


      const res = await fetch(`${SUPA_URL}/rest/v1/needs`, {
        method:  "POST",
        headers: {
          apikey:         SUPA_ANON,
          Authorization:  `Bearer ${SUPA_ANON}`,
          "Content-Type": "application/json",
          Prefer:         "return=minimal",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await res.text());
      toast.success("Necesidad publicada");
      onDone();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al publicar";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const stepQue = (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2">
        <label className="block text-xs font-bold text-[color:var(--midnight)] mb-1 uppercase tracking-wider">
          Categorías * <span className="text-muted-foreground font-medium normal-case">(puedes elegir varias)</span>
        </label>
        {f.categories.length > 0 && (
          <p className="text-[11px] text-muted-foreground mb-2">
            {f.categories.length} seleccionada{f.categories.length === 1 ? "" : "s"}
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {(Object.keys(CATEGORY_META) as NeedCategory[]).map((c) => {
            const meta = CATEGORY_META[c];
            const active = f.categories.includes(c);
            const Icon = meta.icon;
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCat(c)}
                aria-pressed={active}
                className={`relative flex flex-col items-center text-center p-3 rounded-2xl border-2 transition-all active:scale-95 min-h-[96px] ${
                  active
                    ? "border-[color:var(--sunrise)] bg-[color:var(--sunrise)]/5 text-[color:var(--sunrise)]"
                    : "border-border bg-card text-muted-foreground hover:border-[color:var(--sky)]/30"
                }`}
              >
                {active && (
                  <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-[color:var(--sunrise)] text-white text-[10px] font-bold flex items-center justify-center">
                    ✓
                  </span>
                )}
                <div
                  className={`w-10 h-10 mb-2 rounded-xl flex items-center justify-center ${
                    active ? "text-white" : "bg-muted text-muted-foreground"
                  }`}
                  style={active ? { background: meta.color } : undefined}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold leading-tight">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-bold text-[color:var(--midnight)] mb-3 uppercase tracking-wider">Urgencia *</label>
        <div className="flex p-1 bg-muted rounded-xl gap-1">
          {(["low","medium","high","critical"] as NeedUrgency[]).map((u) => {
            const active = f.urgency === u;
            const accent: Record<NeedUrgency, string> = {
              low: "bg-emerald-100 text-emerald-800",
              medium: "bg-[color:var(--gold)] text-[color:var(--midnight)]",
              high: "bg-orange-200 text-orange-900",
              critical: "bg-red-200 text-red-900",
            };
            const label: Record<NeedUrgency, string> = { low: "Baja", medium: "Media", high: "Alta", critical: "Crítica" };
            return (
              <button
                key={u}
                type="button"
                onClick={() => setF({ ...f, urgency: u })}
                aria-pressed={active}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all min-h-[40px] ${
                  active ? `${accent[u]} shadow-sm` : "text-muted-foreground"
                }`}
              >
                {label[u]}
              </button>
            );
          })}
        </div>
      </div>
      <input
        className={`${field} sm:col-span-2`}
        placeholder="Título de la necesidad *"
        value={f.title}
        onChange={(e) => setF({ ...f, title: e.target.value })}
        required
        maxLength={150}
      />
      <textarea
        className={`${field} sm:col-span-2 resize-none`}
        placeholder="Descripción detallada (opcional)"
        rows={3}
        value={f.description}
        onChange={(e) => setF({ ...f, description: e.target.value })}
        maxLength={800}
      />
      <input
        className={`${field} sm:col-span-2`}
        placeholder="Cantidad o detalle (ej: 50 bolsas de suero, 3 voluntarios...)"
        value={f.quantity}
        onChange={(e) => setF({ ...f, quantity: e.target.value })}
        maxLength={100}
      />
    </div>
  );

  const stepDonde = (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <HealthCenterPicker
          value={f.center_name}
          onChange={(name, c) => {
            // Picking from the registry replaces the address with the canonical one,
            // so reset the manual-edit flag so the reverse-geocoder can refine it if needed.
            addressManuallyEdited.current = false;
            setF({
              ...f,
              center_name: name,
              center_address: c?.address ?? (c ? [c.city, c.state].filter(Boolean).join(", ") : ""),
              center_lat: c?.lat ?? null,
              center_lng: c?.lng ?? null,
              center_phone: c?.phone ?? "",
            });
          }}
          placeholder="Centro / comunidad donde se necesita *"
          required
        />
        {(f.center_lat != null || f.center_phone) && (
          <p className="text-[11px] text-muted-foreground pl-1">
            {f.center_lat != null && <span>📍 ubicación geolocalizada</span>}
            {f.center_lat != null && f.center_phone && <span> · </span>}
            {f.center_phone && <span>📞 {f.center_phone}</span>}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <input
          className={field}
          placeholder="Dirección (opcional, se autocompleta al fijar el pin)"
          value={f.center_address}
          onChange={(e) => {
            addressManuallyEdited.current = true;
            setF({ ...f, center_address: e.target.value });
          }}
          maxLength={200}
        />
        {geocodingAddr && (
          <p className="text-[11px] text-muted-foreground pl-1">Buscando dirección…</p>
        )}
        {!geocodingAddr && f.center_lat != null && !addressManuallyEdited.current && f.center_address && (
          <p className="text-[11px] text-muted-foreground pl-1">
            Dirección autocompletada — puedes editarla para complementar o corregir.
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground pl-1">
          Ubicación en el mapa
        </label>
        <LocationPickerInline
          lat={f.center_lat}
          lng={f.center_lng}
          onChange={(lat, lng) => setF({ ...f, center_lat: lat, center_lng: lng })}
        />
      </div>
    </div>
  );

  const stepContacto = (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Estos datos son obligatorios para canalizar la entrega de ayuda.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          className={field}
          placeholder="Tu nombre completo *"
          value={f.contact_name}
          onChange={(e) => setF({ ...f, contact_name: e.target.value })}
          maxLength={100}
          required
        />
        <input
          className={field}
          placeholder="Cédula *"
          value={f.reporter_cedula}
          onChange={(e) => setF({ ...f, reporter_cedula: e.target.value })}
          maxLength={30}
          required
        />
        <input
          className={field}
          placeholder="Teléfono *"
          value={f.contact_phone}
          onChange={(e) => setF({ ...f, contact_phone: e.target.value })}
          maxLength={40}
          required
        />
        {f.categories.includes("money") && (
          <input
            className={`${field} sm:col-span-2`}
            placeholder="Datos de pago (banco, cuenta, Pago Móvil, etc.)"
            value={f.contact_info}
            onChange={(e) => setF({ ...f, contact_info: e.target.value })}
            maxLength={200}
          />
        )}
      </div>
    </div>
  );


  return (
    <Wizard
      title="Publicar necesidad"
      submitLabel="Publicar necesidad"
      submitting={busy}
      onSubmit={submit}
      onCancel={onDone}
      steps={[
        { key: "que", label: "¿Qué se necesita?", content: stepQue, isValid: () => f.categories.length > 0 && f.title.trim().length > 0, invalidMessage: f.categories.length === 0 ? "Selecciona al menos una categoría" : "El título es requerido" },
        { key: "donde", label: "¿Dónde se necesita?", content: stepDonde, isValid: () => f.center_name.trim().length > 0, invalidMessage: "El nombre del centro es requerido" },
        { key: "contacto", label: "Contacto", content: stepContacto, isValid: () => f.contact_name.trim().length > 0 && f.reporter_cedula.trim().length > 0 && f.contact_phone.trim().length > 0, invalidMessage: "Nombre, cédula y teléfono son obligatorios" },
      ]}
    />
  );
}

