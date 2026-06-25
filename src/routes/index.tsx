import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { MapView } from "@/components/MapView";
import { CATEGORIES, CATEGORY_MAP, URGENCY_LABELS, STATUS_LABELS } from "@/lib/categories";
import { useReports } from "@/hooks/useReports";
import { format } from "date-fns";
import { AlertTriangle, FilePlus, Map as MapIcon, X, ChevronUp, ChevronDown, BadgeCheck, ShieldCheck } from "lucide-react";
import heroImage from "@/assets/hero-amanecer.jpg";
import { cn } from "@/lib/utils";
import { getCredibility } from "@/lib/credibility";
import { ReportDetailSheet } from "@/components/ReportDetailSheet";

export const Route = createFileRoute("/")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    report: typeof search.report === "string" ? search.report : undefined,
  }),
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

const HERO_DISMISS_KEY = "vsl-hero-dismissed";

function HomePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { reports, loading } = useReports();
  const [active, setActive] = useState<string[]>([]);
  const [trust, setTrust] = useState<"all" | "verified" | "trusted">("all");
  const [showHero, setShowHero] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focusReport, setFocusReport] = useState<{ id: string; lat: number; lng: number; nonce: number } | null>(null);

  const openReportId = search.report ?? null;
  const openDetail = (id: string) => navigate({ search: { report: id }, replace: false });
  const closeDetail = () => navigate({ search: {}, replace: false });

  useEffect(() => {
    if (localStorage.getItem(HERO_DISMISS_KEY) === "1") setShowHero(false);
  }, []);
  const dismissHero = () => {
    setShowHero(false);
    localStorage.setItem(HERO_DISMISS_KEY, "1");
  };

  const toggle = (slug: string) =>
    setActive((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));

  const visible = useMemo(() => {
    return reports.filter((r) => {
      if (active.length > 0 && !active.includes(r.category)) return false;
      if (trust === "verified" && !r.verified) return false;
      if (trust === "trusted") {
        const c = getCredibility(r);
        if (c.level !== "verified" && c.level !== "trusted") return false;
      }
      return true;
    });
  }, [reports, active, trust]);

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
                Juntos mapeamos.
                <br />
                <span className="text-[color:var(--gold)]">Juntos nos levantamos.</span>
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
                  onClick={() => setActive([])}
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
                  onClick={() => setTrust((t) => (t === "verified" ? "all" : "verified"))}
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
                  onClick={() => setTrust((t) => (t === "trusted" ? "all" : "trusted"))}
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
              </div>
            </div>
            <div className="pointer-events-auto bg-card/95 border border-border rounded-full px-2.5 py-1.5 text-[11px] font-bold shadow-sm shrink-0">
              {visible.length}
            </div>
          </div>

          <ClientOnly
            fallback={
              <div className="h-full flex items-center justify-center bg-muted">
                <AlertTriangle className="h-8 w-8 text-[color:var(--sunrise)] animate-pulse" />
              </div>
            }
          >
            <MapView reports={visible} focusReport={focusReport} />
          </ClientOnly>

          {/* Mobile bottom-sheet handle for the recent reports list */}
          <button
            onClick={() => setSheetOpen((s) => !s)}
            className="lg:hidden absolute left-1/2 -translate-x-1/2 bottom-3 z-[450] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/95 border border-border shadow-md text-[11px] font-semibold"
          >
            {sheetOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            {sheetOpen ? "Ocultar lista" : `${visible.length} reportes`}
          </button>
        </div>

        {/* Sidebar (desktop) / Bottom sheet (mobile) */}
        <aside
          className={cn(
            "border-l border-border bg-card",
            // Desktop: standard sidebar
            "lg:w-80 lg:overflow-y-auto",
            // Mobile: fixed bottom sheet that slides up
            "lg:static lg:translate-y-0 lg:max-h-none",
            "fixed inset-x-0 bottom-16 z-[900] rounded-t-2xl border-t shadow-2xl transition-transform duration-300 max-h-[55vh] overflow-y-auto lg:rounded-none lg:shadow-none",
            sheetOpen ? "translate-y-0" : "translate-y-full lg:translate-y-0",
          )}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm">Reportes recientes</h2>
              <p className="text-[11px] text-muted-foreground">
                {loading ? "Cargando..." : `${visible.length} incidentes`}
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
          <ul className="divide-y divide-border">
            {visible.slice(0, 30).map((r) => {
              const cat = CATEGORY_MAP[r.category];
              const cred = getCredibility(r);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setFocusReport({ id: r.id, lat: r.lat, lng: r.lng, nonce: Date.now() });
                      setSheetOpen(false);
                    }}
                    className="w-full text-left p-3 active:bg-muted/70 hover:bg-muted/50 transition"
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
                </li>
              );
            })}
            {visible.length === 0 && !loading && (
              <li className="p-6 text-center text-xs text-muted-foreground">No hay reportes</li>
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}
