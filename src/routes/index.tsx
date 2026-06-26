import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { MapViewLazy as MapView } from "@/components/MapViewLazy";
import { CATEGORIES, CATEGORY_MAP, URGENCY_LABELS, STATUS_LABELS } from "@/lib/categories";
import { useReports, useMissing } from "@/hooks/useReports";
import { format } from "date-fns";
import { AlertTriangle, FilePlus, Map as MapIcon, X, ChevronUp, ChevronDown, BadgeCheck, ShieldCheck, Activity, Search, Users, RefreshCw } from "lucide-react";
import { PushSubscribeButton } from "@/components/PushSubscribeButton";
import heroImage from "@/assets/hero-rescate.jpg";
import { cn } from "@/lib/utils";
import { getCredibility } from "@/lib/credibility";
import { ReportDetailSheet } from "@/components/ReportDetailSheet";
import { WhatsAppShareButton } from "@/components/WhatsAppShareButton";
import { ReportListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/EmptyState";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { toast } from "sonner";

type TrustMode = "all" | "verified" | "trusted";
type TimeWindow = "all" | "24h" | "7d";

const HERO_DISMISS_KEY = "vsl-hero-dismissed";

function parseList(v: unknown): string[] {
  if (typeof v !== "string" || !v.trim()) return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}
function joinList(xs: string[]): string | undefined {
  return xs.length ? xs.join(",") : undefined;
}

export const Route = createFileRoute("/")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => {
    const trustV = search.trust === "verified" || search.trust === "trusted" ? search.trust : undefined;
    const tV = search.t === "24h" || search.t === "7d" ? search.t : undefined;
    return {
      report: typeof search.report === "string" ? search.report : undefined,
      missing: typeof search.missing === "string" ? search.missing : undefined,
      cat: typeof search.cat === "string" ? search.cat : undefined,
      urg: typeof search.urg === "string" ? search.urg : undefined,
      trust: trustV as TrustMode | undefined,
      t: tV as TimeWindow | undefined,
      q: typeof search.q === "string" && search.q ? search.q : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Venezuela Se Levanta — venezuelaselevanta.info" },
      { name: "description", content: "Plataforma ciudadana de respuesta al terremoto de Venezuela. Reporta y consulta incidentes en tiempo real." },
      { property: "og:title", content: "Venezuela Se Levanta — venezuelaselevanta.info" },
      { property: "og:description", content: "Venezuela Se Levanta: mapa colaborativo de respuesta al terremoto. venezuelaselevanta.info" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { reports, loading, refetch } = useReports();
  const { missing, refetch: refetchMissing } = useMissing();

  // Filter state derived from URL search params (persistent + shareable).
  const active = useMemo(() => parseList(search.cat), [search.cat]);
  const urgencies = useMemo(() => parseList(search.urg), [search.urg]);
  const trust: TrustMode = search.trust ?? "all";
  const timeWindow: TimeWindow = search.t ?? "all";
  const search2 = search.q ?? "";

  type SearchShape = {
    report?: string; missing?: string;
    cat?: string; urg?: string;
    trust?: TrustMode; t?: TimeWindow; q?: string;
  };
  const setSearch = (
    patch: Partial<{ cat: string[]; urg: string[]; trust: TrustMode; t: TimeWindow; q: string }>,
  ) => {
    navigate({
      search: ((prev: SearchShape) => ({
        ...prev,
        cat: patch.cat !== undefined ? joinList(patch.cat) : prev.cat,
        urg: patch.urg !== undefined ? joinList(patch.urg) : prev.urg,
        trust: patch.trust !== undefined ? (patch.trust === "all" ? undefined : patch.trust) : prev.trust,
        t: patch.t !== undefined ? (patch.t === "all" ? undefined : patch.t) : prev.t,
        q: patch.q !== undefined ? (patch.q.trim() ? patch.q : undefined) : prev.q,
      })) as never,
      replace: true,
    });
  };

  const [showFilters, setShowFilters] = useState(false);
  const [showHero, setShowHero] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showQuakes, setShowQuakes] = useState(true);
  const [showMissing, setShowMissing] = useState(true);
  const [focusReport, setFocusReport] = useState<{ id: string; lat: number; lng: number; nonce: number } | null>(null);
  const [focusMissing, setFocusMissing] = useState<{ id: string; lat: number; lng: number; nonce: number } | null>(null);

  const openReportId = search.report ?? null;
  const openDetail = (id: string) =>
    navigate({ search: ((prev: SearchShape) => ({ ...prev, report: id })) as never, replace: false });
  const closeDetail = () =>
    navigate({ search: ((prev: SearchShape) => ({ ...prev, report: undefined })) as never, replace: false });

  // Sync ?missing=<id> -> focus rose marker + ensure layer visible
  useEffect(() => {
    if (!search.missing) return;
    const m = missing.find((x) => x.id === search.missing);
    if (m && m.last_seen_lat != null && m.last_seen_lng != null) {
      setShowMissing(true);
      setFocusMissing({ id: m.id, lat: m.last_seen_lat, lng: m.last_seen_lng, nonce: Date.now() });
      navigate({ search: ((prev: SearchShape) => ({ ...prev, missing: undefined })) as never, replace: true });
    }
  }, [search.missing, missing, navigate]);

  useEffect(() => {
    if (localStorage.getItem(HERO_DISMISS_KEY) === "1") setShowHero(false);
  }, []);
  const dismissHero = () => {
    setShowHero(false);
    localStorage.setItem(HERO_DISMISS_KEY, "1");
  };

  const toggle = (slug: string) =>
    setSearch({ cat: active.includes(slug) ? active.filter((s) => s !== slug) : [...active, slug] });
  const toggleUrgency = (u: string) =>
    setSearch({ urg: urgencies.includes(u) ? urgencies.filter((s) => s !== u) : [...urgencies, u] });

  const visible = useMemo(() => {
    const q = search2.trim().toLowerCase();
    const cutoff =
      timeWindow === "24h"
        ? Date.now() - 24 * 3600 * 1000
        : timeWindow === "7d"
          ? Date.now() - 7 * 24 * 3600 * 1000
          : 0;
    return reports.filter((r) => {
      if (active.length > 0 && !active.includes(r.category)) return false;
      if (urgencies.length > 0 && !urgencies.includes(r.urgency)) return false;
      if (trust === "verified" && !r.verified) return false;
      if (trust === "trusted") {
        const c = getCredibility(r);
        if (c.level !== "verified" && c.level !== "trusted") return false;
      }
      if (cutoff && new Date(r.created_at).getTime() < cutoff) return false;
      if (q) {
        const hay = `${r.title} ${r.description ?? ""} ${r.address ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, active, urgencies, trust, timeWindow, search2]);

  // Combined feed: reports + geolocated missing persons, sorted by date desc.
  type FeedItem =
    | { kind: "report"; data: typeof visible[number]; sortDate: number }
    | { kind: "missing"; data: typeof missing[number]; sortDate: number };
  const feed = useMemo<FeedItem[]>(() => {
    const q = search2.trim().toLowerCase();
    const cutoff =
      timeWindow === "24h"
        ? Date.now() - 24 * 3600 * 1000
        : timeWindow === "7d"
          ? Date.now() - 7 * 24 * 3600 * 1000
          : 0;
    const reportItems: FeedItem[] = visible.map((r) => ({
      kind: "report",
      data: r,
      sortDate: new Date(r.created_at).getTime(),
    }));
    const missingItems: FeedItem[] = showMissing
      ? missing
          .filter((m) => m.last_seen_lat != null && m.last_seen_lng != null)
          .filter((m) => {
            const t = new Date(m.report_date ?? m.created_at).getTime();
            if (cutoff && t < cutoff) return false;
            if (q) {
              const hay = `${m.name} ${m.last_seen_location ?? ""} ${m.description ?? ""}`.toLowerCase();
              if (!hay.includes(q)) return false;
            }
            return true;
          })
          .map((m) => ({
            kind: "missing",
            data: m,
            sortDate: new Date(m.report_date ?? m.created_at).getTime(),
          }))
      : [];
    return [...reportItems, ...missingItems].sort((a, b) => b.sortDate - a.sortDate);
  }, [visible, missing, showMissing, timeWindow, search2]);

  const activeFilterCount =
    (active.length > 0 ? 1 : 0) +
    (urgencies.length > 0 ? 1 : 0) +
    (trust !== "all" ? 1 : 0) +
    (timeWindow !== "all" ? 1 : 0) +
    (search2 ? 1 : 0);

  // Pull-to-refresh on the lateral list
  const onPullRefresh = async () => {
    await Promise.all([refetch(), refetchMissing()]);
    toast.success("Lista actualizada");
  };
  const ptr = usePullToRefresh<HTMLElement>({ onRefresh: onPullRefresh });



  return (
    <div className="flex flex-col">
      {showHero && (
        <section
          className="relative overflow-hidden border-b border-border lg:block"
          style={{ backgroundColor: "var(--midnight)" }}
        >
          <img
            src={heroImage}
            alt="Amanecer sobre Venezuela"
            className="absolute inset-0 h-full w-full object-cover opacity-70"
            width={1536}
            height={1024}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(13,43,69,0.92) 0%, rgba(13,43,69,0.7) 45%, rgba(13,43,69,0.25) 100%)",
            }}
          />
          <button
            onClick={dismissHero}
            className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white"
            aria-label="Ocultar portada"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-10 text-[color:var(--cream)]">
            <div className="max-w-2xl space-y-2 sm:space-y-4">
              <span className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] bg-[color:var(--sunrise)]/20 border border-[color:var(--sunrise)]/40 text-[color:var(--gold)] px-2.5 py-1 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--sunrise)] animate-pulse" />
                Respuesta ciudadana
              </span>
              <h1 className="font-display text-2xl sm:text-5xl leading-[1.05] tracking-tight">
                La tierra se movió,
                <br />
                <span className="text-[color:var(--gold)]">pero Venezuela sigue firme.</span>
              </h1>
              <p className="text-xs sm:text-base text-white/85 max-w-xl hidden sm:block">
                Mapa colaborativo de crisis del terremoto. Reporta, consulta y coordina ayuda en tiempo real.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  to="/reportar"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[color:var(--sunrise)] hover:bg-[#e85a28] text-white font-semibold text-sm shadow-lg shadow-[color:var(--sunrise)]/30"
                >
                  <FilePlus className="h-4 w-4" />
                  Reportar
                </Link>
                <button
                  onClick={dismissHero}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm"
                >
                  <MapIcon className="h-4 w-4" />
                  Ver mapa
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <div
        className={cn(
          "flex flex-col lg:flex-row",
          // Mobile: fill the viewport minus header (3.5rem) and bottom nav spacer area
          showHero
            ? "h-[60vh] min-h-[360px] lg:h-[calc(100vh-22rem)]"
            : "h-[calc(100vh-3.5rem-5rem)] lg:h-[calc(100vh-7rem)]",
        )}
      >
        <div className="flex-1 relative">
          {/* Floating top bar: scrollable category chips + count */}
          <div className="absolute top-2 left-2 right-2 z-[400] flex items-center gap-2 pointer-events-none">
            <div className="pointer-events-auto flex-1 overflow-x-auto no-scrollbar">
              <div className="flex gap-1.5 pr-2">
                <button
                  onClick={() => setSearch({ cat: [] })}
                  className={cn(
                    "shrink-0 text-[11px] px-2.5 py-1.5 rounded-full font-semibold border whitespace-nowrap",
                    active.length === 0
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card/95 text-foreground border-border",
                  )}
                >
                  Todos
                </button>
                {CATEGORIES.map((c) => {
                  const isOn = active.includes(c.slug);
                  return (
                    <button
                      key={c.slug}
                      onClick={() => toggle(c.slug)}
                      className={cn(
                        "shrink-0 flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-full border font-semibold whitespace-nowrap shadow-sm transition",
                        isOn ? "text-white border-transparent" : "bg-card/95 text-foreground border-border",
                      )}
                      style={isOn ? { background: c.color } : undefined}
                    >
                      <span>{c.emoji}</span>
                      <span>{c.name.split(" ")[0]}</span>
                    </button>
                  );
                })}
                <span className="shrink-0 w-px self-stretch bg-border/60 mx-0.5" aria-hidden />
                <button
                  onClick={() => setSearch({ trust: trust === "verified" ? "all" : "verified" })}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-full border font-semibold whitespace-nowrap shadow-sm transition",
                    trust === "verified"
                      ? "bg-[color:var(--gold)] text-[color:var(--midnight)] border-transparent"
                      : "bg-card/95 text-foreground border-border",
                  )}
                  title="Solo reportes verificados oficialmente"
                >
                  <BadgeCheck className="h-3 w-3" /> Verificados
                </button>
                <button
                  onClick={() => setSearch({ trust: trust === "trusted" ? "all" : "trusted" })}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-full border font-semibold whitespace-nowrap shadow-sm transition",
                    trust === "trusted"
                      ? "bg-emerald-500 text-white border-transparent"
                      : "bg-card/95 text-foreground border-border",
                  )}
                  title="Verificados + confiables por la comunidad (≥70%)"
                >
                  <ShieldCheck className="h-3 w-3" /> Confiables
                </button>
                <button
                  onClick={() => setShowQuakes((s) => !s)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-full border font-semibold whitespace-nowrap shadow-sm transition",
                    showQuakes
                      ? "bg-[#DC2626] text-white border-transparent"
                      : "bg-card/95 text-foreground border-border",
                  )}
                  title="Mostrar sismos recientes (USGS)"
                >
                  <Activity className="h-3 w-3" /> 🌍 Sismos USGS
                </button>
                <button
                  onClick={() => setShowMissing((s) => !s)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-full border font-semibold whitespace-nowrap shadow-sm transition",
                    showMissing
                      ? "bg-rose-500 text-white border-transparent"
                      : "bg-card/95 text-foreground border-border",
                  )}
                  title="Mostrar personas desaparecidas en el mapa"
                >
                  <Users className="h-3 w-3" /> Desaparecidos
                  <span className="ml-0.5 bg-white/25 rounded-full px-1.5 text-[9px] font-bold">
                    {missing.filter((m) => m.last_seen_lat != null && m.last_seen_lng != null && m.status === "missing").length}
                  </span>
                </button>
                <button
                  onClick={() => setShowFilters((s) => !s)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-full border font-semibold whitespace-nowrap shadow-sm transition",
                    showFilters || activeFilterCount > 0
                      ? "bg-[color:var(--midnight)] text-white border-transparent"
                      : "bg-card/95 text-foreground border-border",
                  )}
                  title="Más filtros"
                >
                  <Search className="h-3 w-3" /> Filtros
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 bg-[color:var(--sunrise)] text-white rounded-full px-1.5 text-[9px] font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <PushSubscribeButton />
              </div>
            </div>
            <div className="pointer-events-auto bg-card/95 border border-border rounded-full px-2.5 py-1.5 text-[11px] font-bold shadow-sm shrink-0">
              {visible.length}
            </div>
          </div>

          {/* Expanded filter panel */}
          {showFilters && (
            <div className="absolute top-12 left-2 right-2 z-[399] bg-card/95 backdrop-blur border border-border rounded-lg shadow-lg p-3 space-y-2.5 max-w-md">
              <div>
                <label className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground block mb-1">Buscar</label>
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search2}
                    onChange={(e) => setSearch({ q: e.target.value })}
                    placeholder="Título, descripción o dirección..."
                    className="w-full pl-7 pr-2 py-1.5 rounded-md border border-input bg-background text-xs"
                  />
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground mb-1">Urgencia</div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(URGENCY_LABELS).map(([k, v]) => {
                    const isOn = urgencies.includes(k);
                    return (
                      <button
                        key={k}
                        onClick={() => toggleUrgency(k)}
                        className={cn(
                          "text-[10px] px-2 py-1 rounded-full font-semibold border transition",
                          isOn ? "text-white border-transparent" : "bg-background text-foreground border-border",
                        )}
                        style={isOn ? { background: v.color } : undefined}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground mb-1">Tiempo</div>
                <div className="flex gap-1">
                  {([
                    { k: "all", label: "Todos" },
                    { k: "24h", label: "Últimas 24h" },
                    { k: "7d", label: "7 días" },
                  ] as const).map((t) => (
                    <button
                      key={t.k}
                      onClick={() => setSearch({ t: t.k })}
                      className={cn(
                        "text-[10px] px-2 py-1 rounded-full font-semibold border transition",
                        timeWindow === t.k
                          ? "bg-[color:var(--sky)] text-white border-transparent"
                          : "bg-background text-foreground border-border",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setSearch({ cat: [], urg: [], trust: "all", t: "all", q: "" });
                  }}
                  className="w-full text-[11px] py-1.5 rounded-md bg-muted hover:bg-muted/70 font-semibold"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}

          <ClientOnly
            fallback={
              <div className="h-full flex items-center justify-center bg-muted">
                <AlertTriangle className="h-8 w-8 text-[color:var(--sunrise)] animate-pulse" />
              </div>
            }
          >
            <MapView reports={visible} focusReport={focusReport} focusMissing={focusMissing} onOpenDetail={openDetail} showQuakes={showQuakes} missing={missing} showMissing={showMissing} />
          </ClientOnly>

          {/* USGS Legend */}
          {showQuakes && (
            <div className="absolute left-2 bottom-16 lg:bottom-3 z-[400] bg-card/95 border border-border rounded-lg shadow-md p-2 text-[10px] backdrop-blur">
              <div className="font-bold mb-1 text-[11px]">🌍 Sismos USGS</div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full" style={{ background: "#FFC93C", width: 10, height: 10, opacity: 0.7 }} />
                  <span>M &lt; 4.0</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full" style={{ background: "#FF6B35", width: 14, height: 14, opacity: 0.7 }} />
                  <span>M 4.0 – 5.5</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full" style={{ background: "#DC2626", width: 18, height: 18, opacity: 0.7 }} />
                  <span>M ≥ 5.5</span>
                </div>
              </div>
            </div>
          )}

          {/* Mobile bottom-sheet handle for the recent reports list */}
          <button
            onClick={() => setSheetOpen((s) => !s)}
            className="lg:hidden absolute left-1/2 -translate-x-1/2 bottom-3 z-[450] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/95 border border-border shadow-md text-[11px] font-semibold"
          >
            {sheetOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            {sheetOpen ? "Ocultar lista" : `${feed.length} registros`}
          </button>
        </div>

        {/* Sidebar (desktop) / Bottom sheet (mobile) */}
        <aside
          ref={ptr.ref as React.RefObject<HTMLElement>}
          className={cn(
            "border-l border-border bg-card relative",
            // Desktop: standard sidebar
            "lg:w-80 lg:overflow-y-auto",
            // Mobile: fixed bottom sheet that slides up
            "lg:static lg:translate-y-0 lg:max-h-none",
            "fixed inset-x-0 bottom-16 z-[900] rounded-t-2xl border-t shadow-2xl transition-transform duration-300 max-h-[55vh] overflow-y-auto lg:rounded-none lg:shadow-none",
            sheetOpen ? "translate-y-0" : "translate-y-full lg:translate-y-0",
          )}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {(ptr.pull > 0 || ptr.refreshing) && (
            <div
              className="ptr-indicator"
              style={{ height: Math.max(28, ptr.pull), transition: ptr.refreshing ? "height 0.2s" : undefined }}
            >
              {ptr.refreshing ? (
                <span className="flex items-center gap-1.5"><span className="ptr-spinner" /> Actualizando…</span>
              ) : ptr.pull >= ptr.threshold ? (
                <span className="flex items-center gap-1.5"><RefreshCw className="h-3 w-3" /> Suelta para actualizar</span>
              ) : (
                <span className="flex items-center gap-1.5 opacity-70"><ChevronDown className="h-3 w-3" /> Desliza para actualizar</span>
              )}
            </div>
          )}
          <div className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
            <div>
              <h2 className="font-bold text-sm">Reportes recientes</h2>
              <p className="text-[11px] text-muted-foreground">
                {loading ? "Cargando..." : `${feed.length} registros`}
              </p>
            </div>
            <button
              onClick={() => setSheetOpen(false)}
              className="lg:hidden p-1.5 rounded-md hover:bg-muted"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {loading && feed.length === 0 ? (
            <ReportListSkeleton count={6} />
          ) : (
            <ul className="divide-y divide-border">
              {feed.slice(0, 30).map((item) => {
                if (item.kind === "report") {
                  const r = item.data;
                  const cat = CATEGORY_MAP[r.category];
                  const cred = getCredibility(r);
                  return (
                    <li key={`r-${r.id}`} className="relative flex items-stretch">
                      <button
                        type="button"
                        onClick={() => {
                          setFocusReport({ id: r.id, lat: r.lat, lng: r.lng, nonce: Date.now() });
                          setSheetOpen(false);
                        }}
                        className="flex-1 min-w-0 text-left p-3 active:bg-muted/70 hover:bg-muted/50 transition"
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 shadow-sm"
                            style={{ background: cat?.color, color: "white" }}
                          >
                            {cat?.emoji}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-sm truncate">{r.title}</span>
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-0.5"
                                style={{ background: cred.bg, color: cred.fg }}
                                title={cred.label}
                              >
                                {cred.level === "verified" && <BadgeCheck className="h-2.5 w-2.5" />}
                                {cred.short}
                              </span>
                            </div>
                            {r.address && (
                              <div className="text-[11px] text-muted-foreground truncate">📍 {r.address}</div>
                            )}
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded text-white font-semibold"
                                style={{ background: URGENCY_LABELS[r.urgency].color }}
                              >
                                {URGENCY_LABELS[r.urgency].label}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {STATUS_LABELS[r.status]} · {format(new Date(r.created_at), "dd MMM HH:mm")}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                · 👍 {r.confirm_count ?? 0} · 👎 {r.dispute_count ?? 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center pr-3">
                        <WhatsAppShareButton report={r} variant="icon" />
                      </div>
                    </li>
                  );
                }
                // Missing person row
                const m = item.data;
                const statusColors: Record<string, string> = {
                  missing: "#E11D48",
                  reunited: "#10B981",
                  found: "#1A8FE3",
                };
                const statusLabels: Record<string, string> = {
                  missing: "Sin encontrar",
                  reunited: "Reunido",
                  found: "Encontrado",
                };
                const dateStr = format(new Date(m.report_date ?? m.created_at), "dd MMM HH:mm");
                return (
                  <li key={`m-${m.id}`} className="relative flex items-stretch">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMissing(true);
                        setFocusMissing({
                          id: m.id,
                          lat: m.last_seen_lat as number,
                          lng: m.last_seen_lng as number,
                          nonce: Date.now(),
                        });
                        setSheetOpen(false);
                      }}
                      className="flex-1 min-w-0 text-left p-3 active:bg-muted/70 hover:bg-muted/50 transition"
                    >
                      <div className="flex items-start gap-2.5">
                        {m.photo_url ? (
                          <img
                            src={m.photo_url}
                            alt={m.name}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const img = e.currentTarget;
                              img.style.display = "none";
                              const fb = img.nextElementSibling as HTMLElement | null;
                              if (fb) fb.style.display = "flex";
                            }}
                            className="w-9 h-9 rounded-full object-cover shrink-0 shadow-sm ring-2 ring-rose-500 bg-rose-100"
                          />
                        ) : null}
                        <div
                          className="w-9 h-9 rounded-full items-center justify-center shrink-0 shadow-sm bg-rose-500 text-white"
                          style={{ display: m.photo_url ? "none" : "flex" }}
                        >
                          <Users className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm truncate">{m.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-rose-100 text-rose-700">
                              Desaparecido
                            </span>
                          </div>
                          {m.last_seen_location && (
                            <div className="text-[11px] text-muted-foreground truncate">📍 {m.last_seen_location}</div>
                          )}
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded text-white font-semibold"
                              style={{ background: statusColors[m.status] ?? "#E11D48" }}
                            >
                              {statusLabels[m.status] ?? m.status}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {dateStr}
                              {m.age != null ? ` · ${m.age} años` : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
              {feed.length === 0 && !loading && (
                <li className="p-4">
                  <EmptyState
                    emoji="🔎"
                    title="Sin registros que coincidan"
                    description={
                      activeFilterCount > 0
                        ? "Prueba quitar algún filtro o limpia la búsqueda."
                        : "Aún no hay reportes en esta área."
                    }
                    action={
                      activeFilterCount > 0 ? (
                        <button
                          onClick={() => setSearch({ cat: [], urg: [], trust: "all", t: "all", q: "" })}
                          className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold"
                        >
                          Limpiar filtros
                        </button>
                      ) : (
                        <Link
                          to="/reportar"
                          className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold"
                        >
                          Iniciar un reporte
                        </Link>
                      )
                    }
                  />
                </li>
              )}
            </ul>
          )}
        </aside>
      </div>


      <ReportDetailSheet
        reportId={openReportId}
        onClose={closeDetail}
        onFocusMap={(lat, lng, id) => setFocusReport({ id, lat, lng, nonce: Date.now() })}
      />
    </div>
  );
}
