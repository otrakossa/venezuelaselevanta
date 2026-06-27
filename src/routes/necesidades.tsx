import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { HealthCenterPicker } from "@/components/HealthCenterPicker";
import { Wizard } from "@/components/wizard/Wizard";

import {
  Search, X, HandHeart, Loader2, RefreshCw, Plus, Phone, User,
  Info, ChevronDown, PackageOpen,
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

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPA_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

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

const CATEGORY_META: Record<NeedCategory, { emoji: string; label: string }> = {
  medicine:   { emoji: "💊", label: "Medicinas" },
  food:       { emoji: "🍎", label: "Alimentos" },
  water:      { emoji: "💧", label: "Agua" },
  volunteers: { emoji: "🤝", label: "Voluntarios" },
  equipment:  { emoji: "🔧", label: "Equipos" },
  blood:      { emoji: "🩸", label: "Sangre" },
  money:      { emoji: "💰", label: "Dinero" },
  hygiene:    { emoji: "🧼", label: "Kit higiene/menstrual" },
  diapers:    { emoji: "👶", label: "Pañales" },
  other:      { emoji: "📦", label: "Otro" },
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
  const catQ = category !== "all" ? `&category=eq.${category}` : "";
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
  return res.json();
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

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 relative">

      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 mb-5">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 mb-2">
              <HandHeart className="h-3.5 w-3.5" /> Ayuda solidaria
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Necesidades de la comunidad</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-prose">
              Publica lo que necesitas o encuentra cómo ayudar a quienes más lo necesitan.
            </p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="shrink-0 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-95 active:scale-[0.98] transition"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cerrar" : "Publicar necesidad"}
          </button>
        </div>

        <div className="relative mt-5 grid grid-cols-4 gap-2 sm:gap-3">
          <Kpi tone="red"    value={counts.critical} label="🔴 Crítica" />
          <Kpi tone="orange" value={counts.high}     label="🟠 Alta" />
          <Kpi tone="yellow" value={counts.medium}   label="🟡 Media" />
          <Kpi tone="green"  value={counts.low}      label="🟢 Baja" />
        </div>
      </section>

      {showForm && (
        <NeedForm
          onDone={() => { setShowForm(false); load(true); }}
        />
      )}

      <div className="sticky top-14 z-20 -mx-3 sm:mx-0 px-3 sm:px-0 pt-2 pb-2 mb-3 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border/60 space-y-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setCategory("all")}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition border ${
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
              className={`shrink-0 inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold transition border ${
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
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por título, centro o descripción…"
              className="w-full pl-9 pr-9 py-2 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
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
    </div>
  );
}

function Kpi({ value, label, tone }: { value: number; label: string; tone: "red" | "orange" | "yellow" | "green" }) {
  const tones = {
    red:    "from-red-500/15 to-red-500/5 text-red-600",
    orange: "from-orange-500/15 to-orange-500/5 text-orange-600",
    yellow: "from-yellow-500/15 to-yellow-500/5 text-yellow-600",
    green:  "from-green-500/15 to-green-500/5 text-green-600",
  } as const;
  return (
    <div className={`rounded-xl bg-gradient-to-br ${tones[tone]} border border-border/60 px-2 py-2`}>
      <div className="text-xl sm:text-2xl font-black leading-none">{value}</div>
      <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 font-medium leading-tight">{label}</div>
    </div>
  );
}

function NeedCard({ need: n, onOffer }: { need: Need; onOffer: () => void }) {
  const cat = CATEGORY_META[n.category];
  const urg = URGENCY_STYLES[n.urgency];
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      <div className="p-4 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl leading-none shrink-0">{cat.emoji}</span>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{cat.label}</div>
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
        <span className="text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
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
    </article>
  );
}


function NeedForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({
    category:      "other" as NeedCategory,
    title:         "",
    description:   "",
    quantity:      "",
    urgency:       "high" as NeedUrgency,
    center_name:   "",
    center_address: "",
    center_lat:    null as number | null,
    center_lng:    null as number | null,
    center_phone:  "" as string,
    contact_name:  "",
    contact_phone: "",
    contact_info:  "",
  });
  const [busy, setBusy] = useState(false);
  const field = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  const submit = async () => {
    if (!f.title.trim())       { toast.error("El título es requerido"); return; }
    if (!f.center_name.trim()) { toast.error("El nombre del centro es requerido"); return; }

    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        category:       f.category,
        title:          f.title.trim(),
        description:    f.description.trim() || null,
        quantity:       f.quantity.trim() || null,
        urgency:        f.urgency,
        center_name:    f.center_name.trim(),
        center_address: f.center_address.trim() || null,
        lat:            f.center_lat,
        lng:            f.center_lng,
        contact_name:   f.contact_name.trim() || null,
        contact_phone:  f.contact_phone.trim() || null,
        contact_info:   f.contact_info.trim() || null,
        status:         "open" as NeedStatus,
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
      <select
        className={field}
        value={f.category}
        onChange={(e) => setF({ ...f, category: e.target.value as NeedCategory })}
      >
        {(Object.keys(CATEGORY_META) as NeedCategory[]).map((c) => (
          <option key={c} value={c}>
            {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
          </option>
        ))}
      </select>
      <select
        className={field}
        value={f.urgency}
        onChange={(e) => setF({ ...f, urgency: e.target.value as NeedUrgency })}
      >
        <option value="critical">🔴 Urgencia crítica</option>
        <option value="high">🟠 Urgencia alta</option>
        <option value="medium">🟡 Urgencia media</option>
        <option value="low">🟢 Urgencia baja</option>
      </select>
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
          onChange={(name, c) =>
            setF({
              ...f,
              center_name: name,
              center_address: c?.address ?? (c ? [c.city, c.state].filter(Boolean).join(", ") : ""),
              center_lat: c?.lat ?? null,
              center_lng: c?.lng ?? null,
              center_phone: c?.phone ?? "",
            })
          }
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
      <input
        className={field}
        placeholder="Dirección (opcional)"
        value={f.center_address}
        onChange={(e) => setF({ ...f, center_address: e.target.value })}
        maxLength={200}
      />
    </div>
  );

  const stepContacto = (
    <div className="grid sm:grid-cols-2 gap-3">
      <input
        className={field}
        placeholder="Nombre del contacto (opcional)"
        value={f.contact_name}
        onChange={(e) => setF({ ...f, contact_name: e.target.value })}
        maxLength={100}
      />
      <input
        className={field}
        placeholder="Teléfono del contacto (opcional)"
        value={f.contact_phone}
        onChange={(e) => setF({ ...f, contact_phone: e.target.value })}
        maxLength={40}
      />
      <input
        className={`${field} sm:col-span-2`}
        placeholder="Info de pago / transferencia (Zelle, cuenta bancaria, etc.)"
        value={f.contact_info}
        onChange={(e) => setF({ ...f, contact_info: e.target.value })}
        maxLength={200}
      />
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
        { key: "que", label: "¿Qué se necesita?", content: stepQue, isValid: () => f.title.trim().length > 0, invalidMessage: "El título es requerido" },
        { key: "donde", label: "¿Dónde se necesita?", content: stepDonde, isValid: () => f.center_name.trim().length > 0, invalidMessage: "El nombre del centro es requerido" },
        { key: "contacto", label: "Contacto", content: stepContacto },
      ]}
    />
  );
}

