import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search, X, PackageOpen, Loader2, RefreshCw, Plus, Phone, User,
  Info, ChevronDown, Link2, Check, Unlink2,
  Pill, Apple, Droplet, HandHelping, Wrench, Droplets, Banknote, SprayCan, Baby, Package,
  type LucideIcon,
} from "lucide-react";
import { Wizard } from "@/components/wizard/Wizard";
import { ESTADOS, MUNICIPIOS } from "@/lib/venezuela-divipol";


const searchSchema = z.object({
  need: fallback(z.string().uuid(), undefined as unknown as string).optional(),
});

export const Route = createFileRoute("/ofertas")({
  ssr: false,
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Ofrecimiento de ayuda — Venezuela Se Levanta" },
      { name: "description", content: "Publica recursos, insumos o voluntariado disponibles y vincúlalos con las necesidades de la comunidad." },
      { property: "og:title", content: "Ofrecimiento de ayuda — Venezuela Se Levanta" },
      { property: "og:description", content: "Quien quiera ayudar puede publicar lo que ofrece y conectarlo con quienes lo necesitan." },
    ],
  }),
  component: OfertasPage,
});

import { SUPA_URL, SUPA_ANON } from "@/lib/supabase-rest";

type Category   = "medicine" | "food" | "water" | "volunteers" | "equipment" | "blood" | "money" | "hygiene" | "diapers" | "other";
type OfferStatus = "available" | "matched" | "delivered" | "cancelled";
type NeedLite = {
  id: string;
  title: string;
  category: Category;
  center_name: string;
  status: "open" | "partial" | "fulfilled";
};

interface Offer {
  id: string;
  need_id: string | null;
  category: Category;
  title: string;
  description: string | null;
  quantity: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_info: string | null;
  location_desc: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  status: OfferStatus | "open"; // tolerate legacy 'open'
  created_at: string;
}

const CATEGORY_META: Record<Category, { emoji: string; label: string; icon: LucideIcon; color: string }> = {
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "Hace un momento";
  if (mins < 60) return `Hace ${mins}m`;
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${days}d`;
}

function normalizeStatus(s: string): "available" | "matched" | "delivered" {
  if (s === "delivered") return "delivered";
  if (s === "matched") return "matched";
  return "available"; // 'open', 'available', or anything else
}

const HEADERS = {
  apikey: SUPA_ANON,
  Authorization: `Bearer ${SUPA_ANON}`,
};

async function fetchOffers(tab: "available" | "matched" | "delivered", category: Category | "all"): Promise<Offer[]> {
  const statusQ = tab === "available"
    ? "status=in.(open,available)"
    : tab === "matched"
    ? "status=eq.matched"
    : "status=eq.delivered";
  const catQ = category !== "all" ? `&category=eq.${category}` : "";
  const res = await fetch(
    `${SUPA_URL}/rest/v1/offers?${statusQ}${catQ}&order=created_at.desc&limit=200`,
    { headers: HEADERS },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchNeed(id: string): Promise<NeedLite | null> {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/needs?id=eq.${id}&select=id,title,category,center_name,status&limit=1`,
    { headers: HEADERS },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] ?? null;
}

async function fetchOpenNeeds(category: Category | "all", q: string): Promise<NeedLite[]> {
  const catQ = category !== "all" ? `&category=eq.${category}` : "";
  const search = q.trim().length >= 2
    ? `&or=(title.ilike.*${encodeURIComponent(q.trim())}*,center_name.ilike.*${encodeURIComponent(q.trim())}*)`
    : "";
  const res = await fetch(
    `${SUPA_URL}/rest/v1/needs?status=in.(open,partial)${catQ}${search}&select=id,title,category,center_name,status&order=urgency.asc,created_at.desc&limit=50`,
    { headers: HEADERS },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function OfertasPage() {
  const { need: prefilledNeedId } = Route.useSearch();
  const navigate = useNavigate({ from: "/ofertas" });

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [tab, setTab] = useState<"available" | "matched" | "delivered">("available");
  const [showForm, setShowForm] = useState(false);
  const [matchTarget, setMatchTarget] = useState<Offer | null>(null);
  const [prefilledNeed, setPrefilledNeed] = useState<NeedLite | null>(null);

  // Resolve ?need=<uuid> into a need + open form
  useEffect(() => {
    if (!prefilledNeedId) return;
    fetchNeed(prefilledNeedId).then((n) => {
      if (n) {
        setPrefilledNeed(n);
        setShowForm(true);
      }
    });
  }, [prefilledNeedId]);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await fetchOffers(tab, category);
      setOffers(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error cargando ofertas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [tab, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    if (q.trim().length < 2) return offers;
    const n = q.trim().toLowerCase();
    return offers.filter((o) =>
      o.title.toLowerCase().includes(n) ||
      (o.description ?? "").toLowerCase().includes(n) ||
      (o.contact_name ?? "").toLowerCase().includes(n) ||
      (o.location_desc ?? "").toLowerCase().includes(n),
    );
  }, [offers, q]);

  const counts = useMemo(() => {
    const c = { available: 0, matched: 0, delivered: 0 };
    for (const o of offers) {
      const s = normalizeStatus(o.status);
      c[s]++;
    }
    return c;
  }, [offers]);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 relative">
      {matchTarget && (
        <MatchPicker
          offer={matchTarget}
          onClose={() => setMatchTarget(null)}
          onLinked={() => { setMatchTarget(null); load(true); }}
        />
      )}

      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-emerald-500/10 via-card to-card p-4 sm:p-7 mb-5">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between gap-2 mb-2 sm:hidden">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 min-w-0">
              <PackageOpen className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">¡Quiero ayudar!</span>
            </div>
            <button
              onClick={() => setShowForm((s) => !s)}
              className="shrink-0 inline-flex items-center gap-1.5 bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/30 active:scale-[0.98] transition"
            >
              {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {showForm ? "Cerrar" : "Publicar"}
            </button>
          </div>
          <div className="sm:flex sm:items-end sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <div className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 mb-2">
                <PackageOpen className="h-3.5 w-3.5" /> ¡Quiero ayudar!
              </div>
              <h1 className="text-xl sm:text-3xl font-black tracking-tight">Ofrecimiento de ayuda</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-prose">
                Publica insumos, recursos o voluntariado que puedas aportar. Después puedes vincularlos a una necesidad concreta.
              </p>
            </div>
            <button
              onClick={() => setShowForm((s) => !s)}
              className="hidden sm:inline-flex shrink-0 items-center gap-2 bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/30 hover:opacity-95 active:scale-[0.98] transition"
            >
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? "Cerrar" : "Publicar ayuda"}
            </button>
          </div>
        </div>

        <div className="relative mt-4 sm:mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <Kpi tone="emerald" value={counts.available} label="📦 Disponibles" />
          <Kpi tone="amber"   value={counts.matched}   label="🔗 Vinculadas" />
          <Kpi tone="slate"   value={counts.delivered} label="✅ Entregadas" />
        </div>
      </section>


      {showForm && (
        <OfferForm
          prefilledNeed={prefilledNeed}
          onDone={() => {
            setShowForm(false);
            setPrefilledNeed(null);
            if (prefilledNeedId) navigate({ search: {} });
            load(true);
          }}
        />
      )}

      <div className="sticky top-14 z-20 -mx-3 sm:mx-0 px-3 sm:px-0 pt-2 pb-2 mb-3 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border/60 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setCategory("all")}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold transition border ${
              category === "all"
                ? "bg-emerald-500 text-white border-emerald-500 shadow"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Todas
          </button>
          {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold transition border ${
                category === c
                  ? "bg-emerald-500 text-white border-emerald-500 shadow"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
            </button>
          ))}
        </div>


        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[260px] group">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-emerald-500/40 via-primary/40 to-emerald-500/40 opacity-60 group-focus-within:opacity-100 blur-sm transition" aria-hidden />
            <div className="relative flex items-center rounded-2xl border-2 border-emerald-500/30 bg-card shadow-sm focus-within:border-emerald-500 focus-within:shadow-md transition">
              <Search className="ml-4 h-5 w-5 text-emerald-600 shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por título, descripción o contacto…"
                aria-label="Buscar oferta de ayuda"
                className="w-full px-3 py-3.5 sm:py-4 bg-transparent text-base sm:text-lg font-medium placeholder:text-muted-foreground/70 placeholder:font-normal focus:outline-none"
              />
              {q && (
                <button onClick={() => setQ("")} className="mr-2 p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition" aria-label="Limpiar">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-1 bg-muted/70 rounded-xl p-1">
            {(["available", "matched", "delivered"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition ${
                  tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "available" ? "Disponibles" : t === "matched" ? "Vinculadas" : "Entregadas"}
              </button>
            ))}
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
          [...Array(6)].map((_, i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)
        ) : list.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <div className="text-4xl mb-3">🤝</div>
            <p className="font-bold text-base mb-1">No hay ayudas {tab === "available" ? "disponibles" : tab === "matched" ? "vinculadas" : "entregadas"}</p>
            <p className="text-sm text-muted-foreground mb-4">
              {q || category !== "all" ? "Prueba ajustar los filtros." : "Sé la primera persona en ofrecer ayuda."}
            </p>
            {!q && category === "all" && (
              <button
                onClick={() => setShowForm(true)}
                className="text-xs px-3 py-1.5 rounded-md bg-emerald-500 text-white font-semibold"
              >
                Publicar ayuda
              </button>
            )}
          </div>
        ) : (
          list.map((o) => (
            <OfferCard
              key={o.id}
              offer={o}
              onMatch={() => setMatchTarget(o)}
              onChanged={() => load(true)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Kpi({ value, label, tone }: { value: number; label: string; tone: "emerald" | "amber" | "slate" }) {
  const tones = {
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-400",
    amber:   "from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-400",
    slate:   "from-slate-500/15 to-slate-500/5 text-slate-700 dark:text-slate-400",
  } as const;
  return (
    <div className={`rounded-xl bg-gradient-to-br ${tones[tone]} border border-border/60 px-2 py-2 min-w-0`}>
      <div className="text-lg sm:text-2xl font-black leading-none truncate">{value}</div>
      <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 font-medium leading-tight truncate">{label}</div>

    </div>
  );
}

function OfferCard({ offer: o, onMatch, onChanged }: { offer: Offer; onMatch: () => void; onChanged: () => void }) {
  const cat = CATEGORY_META[o.category];
  const [expanded, setExpanded] = useState(false);
  const [linkedNeed, setLinkedNeed] = useState<NeedLite | null>(null);
  const [busy, setBusy] = useState(false);
  const status = normalizeStatus(o.status);

  useEffect(() => {
    if (o.need_id) fetchNeed(o.need_id).then(setLinkedNeed);
    else setLinkedNeed(null);
  }, [o.need_id]);

  const setOfferStatus = async (next: "delivered" | "available", clearNeed = false) => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { status: next };
      if (clearNeed) body.need_id = null;
      const res = await fetch(`${SUPA_URL}/rest/v1/offers?id=eq.${o.id}`, {
        method: "PATCH",
        headers: { ...HEADERS, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(next === "delivered" ? "Marcada como entregada" : "Oferta desvinculada");
      onChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      <div className="p-4 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl leading-none shrink-0">{cat.emoji}</span>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{cat.label}</div>
              <h3 className="font-bold text-sm leading-tight line-clamp-2">{o.title}</h3>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {o.description && (
          <>
            <p className={`text-xs text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>{o.description}</p>
            {o.description.length > 120 && (
              <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground font-semibold">
                <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                {expanded ? "Ver menos" : "Ver más"}
              </button>
            )}
          </>
        )}

        {o.quantity && (
          <div className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            <Info className="h-3 w-3" /> {o.quantity}
          </div>
        )}

        {(o.state || o.city || o.address || o.location_desc) && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {(o.city || o.state) && (
              <div className="font-semibold text-foreground/80">
                📍 {[o.city, o.state].filter(Boolean).join(", ")}
              </div>
            )}
            {o.address && <div className="line-clamp-2">🏠 {o.address}</div>}
            {o.location_desc && <div className="line-clamp-2 italic">{o.location_desc}</div>}
          </div>
        )}

        {(o.contact_name || o.contact_phone || o.contact_info) && (
          <div className="border-t border-border/60 pt-2 space-y-1">
            {o.contact_name && (
              <div className="flex items-center gap-1.5 text-xs">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{o.contact_name}</span>
              </div>
            )}
            {o.contact_phone && (
              <a href={`tel:${o.contact_phone}`} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <Phone className="h-3 w-3" /> {o.contact_phone}
              </a>
            )}
            {o.contact_info && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3 w-3 shrink-0 mt-0.5" />
                <span>{o.contact_info}</span>
              </div>
            )}
          </div>
        )}

        {linkedNeed && (
          <div className="border-t border-border/60 pt-2 text-xs">
            <div className="font-semibold flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <Link2 className="h-3 w-3" /> Vinculada a:
            </div>
            <div className="mt-1 rounded-lg bg-muted/60 px-2 py-1.5">
              <div className="font-semibold line-clamp-1">{linkedNeed.title}</div>
              <div className="text-muted-foreground text-[11px]">🏥 {linkedNeed.center_name}</div>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-4 pt-1 flex items-center justify-between gap-2 border-t border-border/60">
        <span className="text-[10px] text-muted-foreground">{timeAgo(o.created_at)}</span>
        <div className="flex items-center gap-1.5">
          {status === "available" && (
            <button
              onClick={onMatch}
              disabled={busy}
              className="inline-flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold py-2 px-3 rounded-lg transition disabled:opacity-50"
            >
              <Link2 className="h-3.5 w-3.5" /> Vincular
            </button>
          )}
          {status === "matched" && (
            <>
              <button
                onClick={() => setOfferStatus("available", true)}
                disabled={busy}
                className="inline-flex items-center gap-1 text-[11px] py-1.5 px-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
                title="Desvincular"
              >
                <Unlink2 className="h-3 w-3" />
              </button>
              <button
                onClick={() => setOfferStatus("delivered")}
                disabled={busy}
                className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold py-2 px-3 rounded-lg transition disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> Entregada
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: "available" | "matched" | "delivered" }) {
  const map = {
    available: { cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", label: "Disponible" },
    matched:   { cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400",       label: "Vinculada" },
    delivered: { cls: "bg-slate-500/15 text-slate-700 dark:text-slate-400",       label: "Entregada" },
  };
  const s = map[status];
  return <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${s.cls}`}>{s.label}</span>;
}

function MatchPicker({ offer, onClose, onLinked }: { offer: Offer; onClose: () => void; onLinked: () => void }) {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"same-cat" | "all">("same-cat");
  const [needs, setNeeds] = useState<NeedLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchOpenNeeds(scope === "same-cat" ? offer.category : "all", q)
      .then((r) => { if (alive) setNeeds(r); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error"))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [q, scope, offer.category]);

  const link = async (need: NeedLite) => {
    setLinking(need.id);
    try {
      const r1 = await fetch(`${SUPA_URL}/rest/v1/offers?id=eq.${offer.id}`, {
        method: "PATCH",
        headers: { ...HEADERS, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ need_id: need.id, status: "matched" }),
      });
      if (!r1.ok) throw new Error(await r1.text());
      // Bump need to partial if it was open
      if (need.status === "open") {
        await fetch(`${SUPA_URL}/rest/v1/needs?id=eq.${need.id}`, {
          method: "PATCH",
          headers: { ...HEADERS, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ status: "partial" }),
        });
      }
      toast.success("Oferta vinculada");
      onLinked();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al vincular");
    } finally {
      setLinking(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <div className="min-w-0">
            <div className="font-bold text-sm">Vincular oferta</div>
            <div className="text-xs text-muted-foreground line-clamp-1">{CATEGORY_META[offer.category].emoji} {offer.title}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-border/60 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar necesidades…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex gap-1 bg-muted/70 rounded-lg p-1 w-fit">
            <button
              onClick={() => setScope("same-cat")}
              className={`text-xs px-2.5 py-1 rounded-md font-semibold transition ${scope === "same-cat" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              Misma categoría
            </button>
            <button
              onClick={() => setScope("all")}
              className={`text-xs px-2.5 py-1 rounded-md font-semibold transition ${scope === "all" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              Todas
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-3 py-2 flex-1">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : needs.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No hay necesidades abiertas {scope === "same-cat" ? "en esta categoría" : ""}.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {needs.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => link(n)}
                    disabled={linking !== null}
                    className="w-full text-left p-3 rounded-xl border border-border hover:border-emerald-500/60 hover:bg-emerald-500/5 transition disabled:opacity-50 flex items-center gap-3"
                  >
                    <span className="text-xl">{CATEGORY_META[n.category].emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm line-clamp-1">{n.title}</div>
                      <div className="text-[11px] text-muted-foreground line-clamp-1">🏥 {n.center_name}</div>
                    </div>
                    {linking === n.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function OfferForm({ prefilledNeed, onDone }: { prefilledNeed: NeedLite | null; onDone: () => void }) {
  const [f, setF] = useState({
    category: (prefilledNeed?.category ?? "other") as Category,
    title: prefilledNeed ? `Oferta para: ${prefilledNeed.title}` : "",
    description: "",
    quantity: "",
    state: "",
    city: "",
    address: "",
    location_desc: "",
    contact_name: "",
    contact_phone: "",
    contact_info: "",
  });
  const [busy, setBusy] = useState(false);
  const field = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

  const submit = async () => {
    if (!f.title.trim()) { toast.error("El título es requerido"); return; }
    if (!f.state) { toast.error("Selecciona el estado"); return; }
    if (!f.city.trim()) { toast.error("Indica la ciudad o municipio"); return; }
    if (!f.address.trim()) { toast.error("Indica la dirección de entrega"); return; }
    if (!f.contact_name.trim()) { toast.error("Tu nombre es requerido"); return; }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        category: f.category,
        title: f.title.trim(),
        description: f.description.trim() || null,
        quantity: f.quantity.trim() || null,
        state: f.state,
        city: f.city.trim(),
        address: f.address.trim(),
        location_desc: f.location_desc.trim() || null,
        contact_name: f.contact_name.trim(),
        contact_phone: f.contact_phone.trim() || null,
        contact_info: f.contact_info.trim() || null,
        status: prefilledNeed ? "matched" : "available",
        need_id: prefilledNeed?.id ?? null,
      };
      const res = await fetch(`${SUPA_URL}/rest/v1/offers`, {
        method: "POST",
        headers: { ...HEADERS, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());

      if (prefilledNeed && prefilledNeed.status === "open") {
        await fetch(`${SUPA_URL}/rest/v1/needs?id=eq.${prefilledNeed.id}`, {
          method: "PATCH",
          headers: { ...HEADERS, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ status: "partial" }),
        });
      }

      toast.success(prefilledNeed ? "Oferta publicada y vinculada" : "Oferta publicada");
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al publicar");
    } finally {
      setBusy(false);
    }
  };

  const stepQue = (
    <div className="grid sm:grid-cols-2 gap-3">
      {prefilledNeed && (
        <div className="sm:col-span-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs">
          <div className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <Link2 className="h-3 w-3" /> Se vinculará a esta necesidad:
          </div>
          <div className="font-bold mt-0.5">{prefilledNeed.title}</div>
          <div className="text-muted-foreground">🏥 {prefilledNeed.center_name}</div>
        </div>
      )}
      <div className="sm:col-span-2">
        <label className="block text-xs font-bold text-[color:var(--midnight)] mb-3 uppercase tracking-wider">Categoría *</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {(Object.keys(CATEGORY_META) as Category[]).map((c) => {
            const meta = CATEGORY_META[c];
            const active = f.category === c;
            const Icon = meta.icon;
            const disabled = !!prefilledNeed && f.category !== c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => !prefilledNeed && setF({ ...f, category: c })}
                aria-pressed={active}
                disabled={disabled}
                className={`flex flex-col items-center text-center p-3 rounded-2xl border-2 transition-all active:scale-95 min-h-[96px] disabled:opacity-40 disabled:cursor-not-allowed ${
                  active
                    ? "border-[color:var(--sunrise)] bg-[color:var(--sunrise)]/5 text-[color:var(--sunrise)]"
                    : "border-border bg-card text-muted-foreground hover:border-[color:var(--sky)]/30"
                }`}
              >
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
      <input
        className={field}
        placeholder="Cantidad o detalle (ej: 100 mascarillas, 2 voluntarios…)"
        value={f.quantity}
        onChange={(e) => setF({ ...f, quantity: e.target.value })}
        maxLength={100}
      />
      <input
        className={`${field} sm:col-span-2`}
        placeholder="Título de tu oferta *"
        value={f.title}
        onChange={(e) => setF({ ...f, title: e.target.value })}
        required
        maxLength={150}
      />
      <textarea
        className={`${field} sm:col-span-2 resize-none`}
        placeholder="Describe lo que ofreces (opcional)"
        rows={3}
        value={f.description}
        onChange={(e) => setF({ ...f, description: e.target.value })}
        maxLength={800}
      />
    </div>
  );

  const municipios = f.state ? (MUNICIPIOS[f.state] ?? []) : [];

  const stepDisponibilidad = (
    <div className="space-y-3">
      <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 px-3 py-2 text-[11px] text-emerald-800 dark:text-emerald-300">
        📍 La ubicación es <b>clave</b> para canalizar rápidamente la entrega de la ayuda. Indica dónde estás o desde dónde puedes entregar.
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Estado *</label>
          <select
            className={field}
            value={f.state}
            onChange={(e) => setF({ ...f, state: e.target.value, city: "" })}
            required
          >
            <option value="">— Selecciona el estado —</option>
            {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Ciudad / Municipio *</label>
          {municipios.length > 0 ? (
            <select
              className={field}
              value={f.city}
              onChange={(e) => setF({ ...f, city: e.target.value })}
              required
            >
              <option value="">— Selecciona —</option>
              {municipios.map((m) => <option key={m} value={m}>{m}</option>)}
              <option value="__other__">Otra ciudad…</option>
            </select>
          ) : (
            <input
              className={field}
              placeholder="Selecciona primero un estado"
              value={f.city}
              onChange={(e) => setF({ ...f, city: e.target.value })}
              disabled={!f.state}
              maxLength={120}
            />
          )}
          {f.city === "__other__" && (
            <input
              className={`${field} mt-2`}
              placeholder="Escribe la ciudad / municipio"
              onChange={(e) => setF({ ...f, city: e.target.value })}
              maxLength={120}
              autoFocus
            />
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Dirección de entrega *</label>
          <input
            className={field}
            placeholder="Parroquia, sector, calle, punto de referencia…"
            value={f.address}
            onChange={(e) => setF({ ...f, address: e.target.value })}
            required
            maxLength={250}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Notas logísticas (opcional)</label>
          <input
            className={field}
            placeholder="Horario disponible, si puedes trasladarlo, etc."
            value={f.location_desc}
            onChange={(e) => setF({ ...f, location_desc: e.target.value })}
            maxLength={200}
          />
        </div>
      </div>
    </div>
  );

  const stepContacto = (
    <div className="grid sm:grid-cols-2 gap-3">
      <input
        className={field}
        placeholder="Tu nombre *"
        value={f.contact_name}
        onChange={(e) => setF({ ...f, contact_name: e.target.value })}
        required
        maxLength={100}
      />
      <input
        className={field}
        placeholder="Teléfono / WhatsApp (opcional)"
        value={f.contact_phone}
        onChange={(e) => setF({ ...f, contact_phone: e.target.value })}
        maxLength={40}
      />
      <input
        className={`${field} sm:col-span-2`}
        placeholder="Otro contacto / detalles de entrega (opcional)"
        value={f.contact_info}
        onChange={(e) => setF({ ...f, contact_info: e.target.value })}
        maxLength={200}
      />
    </div>
  );

  return (
    <Wizard
      title="Publicar ofrecimiento de ayuda"
      submitLabel={prefilledNeed ? "Publicar y vincular" : "Publicar ayuda"}
      submitting={busy}
      onSubmit={submit}
      onCancel={onDone}
      steps={[
        { key: "que", label: "¿Qué ofreces?", content: stepQue, isValid: () => f.title.trim().length > 0, invalidMessage: "El título es requerido" },
        { key: "disponibilidad", label: "Ubicación de entrega", content: stepDisponibilidad, isValid: () => !!f.state && f.city.trim().length > 0 && f.city !== "__other__" && f.address.trim().length > 0, invalidMessage: "Estado, ciudad y dirección son requeridos" },
        { key: "contacto", label: "Tu contacto", content: stepContacto, isValid: () => f.contact_name.trim().length > 0, invalidMessage: "Tu nombre es requerido" },
      ]}
    />
  );
}

