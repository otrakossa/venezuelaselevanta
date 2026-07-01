import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Search, X, HeartPulse, Loader2, RefreshCw, Plus,
  MapPin, User, ClipboardList, IdCard, Phone, Building2,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { MatchSuggestions } from "@/components/MatchSuggestions";
import { HealthCenterPicker } from "@/components/HealthCenterPicker";
import { PeopleTabs } from "@/components/PeopleTabs";
import { Wizard } from "@/components/wizard/Wizard";


const searchSchema = z.object({
  center: z.string().optional(),
});

export const Route = createFileRoute("/pacientes")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Atendidos en centros de salud — Venezuela Se Levanta" },
      { name: "description", content: "Busca y registra personas atendidas en centros de salud tras la emergencia en Venezuela." },
    ],
  }),
  component: AtendidosPage,
});

import { SUPA_URL, SUPA_ANON } from "@/lib/supabase-rest";
import { maskCedula, maskPhone, isValidCedula, isValidPhone, phoneIsEmpty, PHONE_DEFAULT, CEDULA_ERROR, PHONE_ERROR } from "@/lib/validators";

type PatientStatus = "stable" | "critical" | "recovering" | "discharged" | "admitted";
type Filter = "all" | "active" | "discharged";

interface Patient {
  id: string;
  name: string;
  age: number | null;
  sex: string | null;
  center_name: string;
  center_address: string | null;
  center_lat: number | null;
  center_lng: number | null;
  status: PatientStatus;
  notes: string | null;
  registered_by: string | null;
  discharged_at: string | null;
  created_at: string;
  id_number: string | null;
  phone: string | null;
  address: string | null;
  state: string | null;
  sector: string | null;
  matched_missing_id: string | null;
  source_url: string | null;
  source_label: string | null;
}

const STATUS_STYLES: Record<PatientStatus, { pill: string; dot: string; label: string }> = {
  stable:     { pill: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",    dot: "bg-yellow-500",    label: "Estable" },
  critical:   { pill: "bg-red-500/15 text-red-700 dark:text-red-400",             dot: "bg-red-500",       label: "Crítico" },
  recovering: { pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500",   label: "Recuperándose" },
  discharged: { pill: "bg-neutral-500/15 text-neutral-600 dark:text-neutral-400", dot: "bg-neutral-500",   label: "Alta médica" },
  admitted:   { pill: "bg-sky-500/15 text-sky-700 dark:text-sky-400",             dot: "bg-sky-500",       label: "Ingresado" },
};

const SEX_LABELS: Record<string, string> = {
  masculino: "Masculino",
  femenino:  "Femenino",
  "no indicado": "No indicado",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)    return "Hace un momento";
  if (mins < 60)   return `Hace ${mins}m`;
  if (hours < 24)  return `Hace ${hours}h`;
  return `Hace ${days}d`;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

async function fetchPatients(): Promise<Patient[]> {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/patients?order=created_at.desc&limit=3500`,
    {
      headers: {
        apikey: SUPA_ANON,
        Authorization: `Bearer ${SUPA_ANON}`,
      },
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchPatientsTotal(): Promise<number> {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/patients?select=id`,
    {
      headers: {
        apikey: SUPA_ANON,
        Authorization: `Bearer ${SUPA_ANON}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    },
  );
  const cr = res.headers.get("content-range");
  if (cr) {
    const m = cr.match(/\/(\d+)$/);
    if (m) return parseInt(m[1], 10);
  }
  return 0;
}

const PAGE_SIZE = 24;

function shortHospital(name: string) {
  return name
    .replace(/^Hospital\s+/i, "")
    .replace(/^Centro\s+Cl[ií]nico\s+/i, "CC ")
    .replace(/\s+Venezolana\s+[-–]\s+/i, " ")
    .replace(/\s+[-–]\s+/g, " ");
}

function AtendidosPage() {
  const navigate = useNavigate({ from: "/pacientes" });
  const { center } = Route.useSearch();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [showAllChips, setShowAllChips] = useState(false);
  const [stateFilter, setStateFilter] = useState<string>("");
  const [sectorFilter, setSectorFilter] = useState<string>("");

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [data, total] = await Promise.all([fetchPatients(), fetchPatientsTotal()]);
      setPatients(data);
      setTotalCount(total || data.length);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error cargando datos";
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [q, filter, center, stateFilter, sectorFilter]);
  useEffect(() => { setSectorFilter(""); }, [stateFilter]);

  const setCenter = (c?: string) =>
    navigate({ search: (prev: { center?: string }) => ({ ...prev, center: c }), replace: true });

  // counts overall (no filter applied)
  const counts = useMemo(() => ({
    all:        totalCount || patients.length,
    active:     patients.filter((p) => p.status !== "discharged").length,
    discharged: patients.filter((p) => p.status === "discharged").length,
  }), [patients, totalCount]);

  // hospitals: name -> active count, sorted desc
  const hospitals = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of patients) {
      if (p.status === "discharged") continue;
      m.set(p.center_name, (m.get(p.center_name) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [patients]);

  // distinct states & sectors (dependent)
  const statesList = useMemo(() => {
    const s = new Set<string>();
    for (const p of patients) if (p.state) s.add(p.state);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [patients]);

  const sectorsList = useMemo(() => {
    const s = new Set<string>();
    for (const p of patients) {
      if (!p.sector) continue;
      if (stateFilter && p.state !== stateFilter) continue;
      s.add(p.sector);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [patients, stateFilter]);

  const list = useMemo(() => {
    let src = patients;
    if (filter === "active")     src = src.filter((p) => p.status !== "discharged");
    if (filter === "discharged") src = src.filter((p) => p.status === "discharged");
    if (center)                  src = src.filter((p) => p.center_name === center);
    if (stateFilter)             src = src.filter((p) => p.state === stateFilter);
    if (sectorFilter)            src = src.filter((p) => p.sector === sectorFilter);
    if (q.trim().length >= 2) {
      const needle = q.trim().toLowerCase();
      const digits = needle.replace(/\D/g, "");
      src = src.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.center_name.toLowerCase().includes(needle) ||
          (p.sector ?? "").toLowerCase().includes(needle) ||
          (digits.length >= 4 && (p.id_number ?? "").includes(digits)),
      );
    }
    return src;
  }, [patients, filter, q, center, stateFilter, sectorFilter]);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 relative overflow-x-hidden">
      <PeopleTabs />
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 mb-5">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 mb-2">
              <HeartPulse className="h-3.5 w-3.5" /> Centros de salud
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Atendidos en centros de salud</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-prose">
              Registra y busca personas atendidas en centros de salud durante la emergencia.
            </p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="shrink-0 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-95 active:scale-[0.98] transition"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cerrar" : "Registrar atendido"}
          </button>
        </div>

        <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <Kpi tone="blue"    value={counts.all}        label="Total Registrados" />
          <Kpi tone="yellow"  value={counts.active}     label="En tratamiento" />
          <Kpi tone="slate"   value={counts.discharged} label="Con alta médica" />
          <Kpi tone="teal"    value={hospitals.length}  label="Hospitales activos" />
        </div>
      </section>

      {showForm && (
        <PatientForm
          onDone={() => { setShowForm(false); load(true); }}
        />
      )}

      <div className="sticky top-14 z-20 -mx-3 sm:mx-0 px-3 sm:px-0 pt-2 pb-2 mb-3 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border/60 space-y-2">
        {hospitals.length > 0 && (() => {
          const COLLAPSED = 4;
          const visible = showAllChips ? hospitals : hospitals.slice(0, COLLAPSED);
          const hidden = hospitals.length - visible.length;
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setCenter(undefined)}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-semibold transition border ${
                  !center
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building2 className="h-3.5 w-3.5" /> Todos
                <span className="text-[10px] opacity-80">{counts.active}</span>
              </button>
              {visible.map(([name, n]) => (
                <button
                  key={name}
                  onClick={() => setCenter(name)}
                  title={name}
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-semibold transition border max-w-[60vw] sm:max-w-[260px] ${
                    center === name
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="truncate">🏥 {shortHospital(name)}</span>
                  <span className="text-[10px] opacity-80 shrink-0">{n}</span>
                </button>
              ))}
              {hospitals.length > COLLAPSED && (
                <button
                  onClick={() => setShowAllChips((s) => !s)}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full font-semibold border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
                >
                  {showAllChips ? (
                    <>Ver menos <ChevronUp className="h-3.5 w-3.5" /></>
                  ) : (
                    <>+{hidden} más <ChevronDown className="h-3.5 w-3.5" /></>
                  )}
                </button>
              )}
            </div>
          );
        })()}


        <div className="flex items-stretch gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[260px] group">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary/40 via-sunrise/40 to-primary/40 opacity-60 group-focus-within:opacity-100 blur-sm transition" aria-hidden />
            <div className="relative flex items-center rounded-2xl border-2 border-primary/30 bg-card shadow-sm focus-within:border-primary focus-within:shadow-md transition">
              <Search className="ml-4 h-5 w-5 text-primary shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, cédula o centro…"
                aria-label="Buscar paciente"
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

          <div className="flex gap-1 bg-muted/70 rounded-xl p-1 flex-wrap">
            {(["active", "discharged", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition ${
                  filter === f ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "Todos" : f === "active" ? "En centro" : "Alta"}
                <span className="ml-1 text-[10px] opacity-70">{counts[f]}</span>
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

        {(statesList.length > 0 || sectorsList.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-input bg-card font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Todos los estados</option>
              {statesList.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              disabled={sectorsList.length === 0}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-input bg-card font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            >
              <option value="">{stateFilter ? "Todos los sectores" : "Selecciona un estado"}</option>
              {sectorsList.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {(center || q || filter !== "active" || stateFilter || sectorFilter) && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>
              Mostrando <span className="font-bold text-foreground">{list.length}</span> atendido{list.length === 1 ? "" : "s"}
              {(stateFilter || sectorFilter) && (
                <> en <span className="font-semibold text-foreground">{[sectorFilter, stateFilter].filter(Boolean).join(", ")}</span></>
              )}
              {center && <> · <span className="font-semibold text-foreground">{center}</span></>}
            </span>
            <button
              onClick={() => { setQ(""); setFilter("active"); setCenter(undefined); setStateFilter(""); setSectorFilter(""); }}
              className="text-primary font-semibold hover:underline"
            >
              Limpiar
            </button>
          </div>
        )}
      </div>


      {(() => {
        const total = list.length;
        const visible = list.slice(0, page * PAGE_SIZE);
        const hasMore = visible.length < total;
        return (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <div key={i} className="h-36 rounded-2xl bg-muted animate-pulse" />
                ))
              ) : total === 0 ? (
                <div className="col-span-full py-16 text-center">
                  <div className="text-4xl mb-3">🏥</div>
                  <p className="font-bold text-base mb-1">No hay atendidos registrados</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {q || filter !== "all" || center ? "Prueba ajustar la búsqueda o cambiar el filtro." : "Sé el primero en registrar un atendido."}
                  </p>
                  {(q || filter !== "all" || center) ? (
                    <button
                      onClick={() => { setQ(""); setFilter("all"); setCenter(undefined); }}
                      className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold"
                    >
                      Limpiar filtros
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowForm(true)}
                      className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold"
                    >
                      Registrar atendido
                    </button>
                  )}
                </div>
              ) : (
                visible.map((p) => <PatientCard key={p.id} patient={p} onChanged={() => load(true)} />)
              )}
            </div>

            {!loading && total > 0 && (
              <div className="flex flex-col items-center gap-2 mt-6 pb-4">
                <p className="text-[11px] text-muted-foreground">
                  Mostrando <span className="font-bold text-foreground">{visible.length}</span> de{" "}
                  <span className="font-bold text-foreground">{total}</span> atendido{total === 1 ? "" : "s"}
                </p>
                {hasMore ? (
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-card border border-border text-sm font-bold hover:bg-muted hover:border-primary/40 transition active:scale-[0.98]"
                  >
                    Cargar más
                    <ChevronDown className="h-4 w-4" />
                  </button>
                ) : total > PAGE_SIZE && (
                  <button
                    onClick={() => { setPage(1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="text-xs text-muted-foreground hover:text-foreground font-semibold"
                  >
                    ↑ Volver arriba
                  </button>
                )}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );


}

function Kpi({ value, label, tone }: { value: number; label: string; tone: "blue" | "yellow" | "slate" | "teal" }) {
  const tones = {
    blue:   "from-blue-500/15 to-blue-500/5 text-blue-600",
    yellow: "from-yellow-500/15 to-yellow-500/5 text-yellow-600",
    slate:  "from-slate-500/15 to-slate-500/5 text-foreground",
    teal:   "from-teal-500/15 to-teal-500/5 text-teal-600",
  } as const;
  return (
    <div className={`rounded-xl bg-gradient-to-br ${tones[tone]} border border-border/60 px-3 py-2.5`}>
      <div className="text-xl sm:text-2xl font-black leading-none">{value.toLocaleString("es-VE")}</div>
      <div className="text-[11px] sm:text-xs text-muted-foreground mt-1 font-medium">{label}</div>
    </div>
  );
}

function PatientCard({ patient: p, onChanged }: { patient: Patient; onChanged?: () => void }) {
  const s = STATUS_STYLES[p.status] ?? STATUS_STYLES.stable;
  return (
    <article className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-black text-muted-foreground shrink-0">
              {initials(p.name) || <User className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm leading-tight truncate">{p.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {(p.age != null || p.sex) && (
                  <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {[p.age != null ? `${p.age} años` : null, p.sex ? SEX_LABELS[p.sex] ?? p.sex : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${s.pill}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${p.status === "critical" ? "animate-pulse" : ""}`} />
            {s.label}
          </span>
        </div>

        <div className="flex items-start gap-1.5 text-xs">
          <span className="shrink-0 text-base leading-none mt-0.5">🏥</span>
          <div className="min-w-0">
            <div className="font-semibold truncate">{p.center_name}</div>
            {p.center_address && (
              <div className="text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{p.center_address}</span>
              </div>
            )}
          </div>
        </div>

        {(p.state || p.sector) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {p.state && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400">
                <MapPin className="h-2.5 w-2.5" /> {p.state}
              </span>
            )}
            {p.sector && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-400">
                {p.sector}
              </span>
            )}
          </div>
        )}


        {(p.id_number || p.phone || p.address) && (
          <div className="grid gap-1 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            {p.id_number && (
              <div className="flex items-center gap-1.5">
                <IdCard className="h-3 w-3 shrink-0" />
                <span className="font-mono font-semibold text-foreground/80">{p.id_number}</span>
              </div>
            )}
            {p.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3 w-3 shrink-0" />
                <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="font-semibold text-foreground/80 hover:text-primary">{p.phone}</a>
              </div>
            )}
            {p.address && (
              <div className="flex items-start gap-1.5">
                <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                <span className="line-clamp-1">{p.address}</span>
              </div>
            )}
          </div>
        )}

        {p.notes && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ClipboardList className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <p className="line-clamp-2 leading-relaxed">{p.notes}</p>
          </div>
        )}

        <MatchSuggestions
          kind="patient"
          selfId={p.id}
          matchedId={p.matched_missing_id}
          onChanged={onChanged}
        />

        {p.source_label === "localizapacientes.com" && (
          <div className="pt-1">
            <a
              href={p.source_url || "https://localizapacientes.com"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 transition"
              title="Fuente: localizapacientes.com"
            >
              <span>🔗</span> Fuente: localizapacientes.com
            </a>
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-border/60">
          <span className="text-[10px] text-muted-foreground">
            {timeAgo(p.created_at)}
          </span>
          {p.discharged_at && (
            <span className="text-[10px] text-neutral-500">
              Alta: {new Date(p.discharged_at).toLocaleDateString("es-VE")}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function PatientForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({
    name: "",
    age: "",
    sex: "no indicado",
    id_number: "",
    phone: PHONE_DEFAULT,
    address: "",
    center_name: "",
    center_address: "",
    center_lat: null as number | null,
    center_lng: null as number | null,
    center_phone: "" as string,
    status: "stable" as PatientStatus,
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  const field = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  const submit = async () => {
    if (!f.name.trim())        { toast.error("El nombre es requerido"); return; }
    if (!f.center_name.trim()) { toast.error("El nombre del centro es requerido"); return; }
    if (f.id_number.trim() && !isValidCedula(f.id_number)) { toast.error(CEDULA_ERROR); return; }
    if (!phoneIsEmpty(f.phone) && !isValidPhone(f.phone)) { toast.error(PHONE_ERROR); return; }

    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        name:           f.name.trim(),
        center_name:    f.center_name.trim(),
        status:         f.status,
        sex:            f.sex || null,
        age:            f.age ? Number(f.age) : null,
        center_address: f.center_address.trim() || null,
        center_lat:     f.center_lat,
        center_lng:     f.center_lng,
        notes:          f.notes.trim() || null,
        id_number:      f.id_number.trim() || null,
        phone:          phoneIsEmpty(f.phone) ? null : f.phone.trim(),
        address:        f.address.trim() || null,
      };

      const res = await fetch(`${SUPA_URL}/rest/v1/patients`, {
        method:  "POST",
        headers: {
          apikey:         SUPA_ANON,
          Authorization:  `Bearer ${SUPA_ANON}`,
          "Content-Type": "application/json",
          Prefer:         "return=minimal",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      toast.success("Atendido registrado correctamente");
      onDone();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrar";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const stepDatos = (
    <div className="grid sm:grid-cols-2 gap-3">
      <input
        className={`${field} sm:col-span-2`}
        placeholder="Nombre completo *"
        value={f.name}
        onChange={(e) => setF({ ...f, name: e.target.value })}
        required
        maxLength={100}
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
      <select
        className={field}
        value={f.sex}
        onChange={(e) => setF({ ...f, sex: e.target.value })}
      >
        <option value="no indicado">Sexo: No indicado</option>
        <option value="masculino">Masculino</option>
        <option value="femenino">Femenino</option>
      </select>
      <input
        className={field}
        placeholder="Cédula / ID (V-12345678)"
        value={f.id_number}
        onChange={(e) => setF({ ...f, id_number: maskCedula(e.target.value) })}
        maxLength={18}
      />
      <input
        className={field}
        placeholder="Teléfono de contacto (+58 4141234567)"
        value={f.phone}
        onChange={(e) => setF({ ...f, phone: maskPhone(e.target.value) })}
        maxLength={18}
        inputMode="tel"
      />
      <select
        className={`${field} sm:col-span-2`}
        value={f.status}
        onChange={(e) => setF({ ...f, status: e.target.value as PatientStatus })}
      >
        <option value="stable">Estable</option>
        <option value="critical">Crítico</option>
        <option value="recovering">Recuperándose</option>
        <option value="discharged">Alta médica</option>
      </select>
      <textarea
        className={`${field} sm:col-span-2 resize-none`}
        placeholder="Notas adicionales (diagnóstico, observaciones…)"
        rows={3}
        value={f.notes}
        onChange={(e) => setF({ ...f, notes: e.target.value })}
        maxLength={500}
      />
    </div>
  );

  const stepCentro = (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2 space-y-1.5">
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
          placeholder="Nombre del centro de salud *"
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
        className={`${field} sm:col-span-2`}
        placeholder="Dirección del centro (opcional)"
        value={f.center_address}
        onChange={(e) => setF({ ...f, center_address: e.target.value })}
        maxLength={200}
      />
      <input
        className={`${field} sm:col-span-2`}
        placeholder="Dirección / residencia del atendido (opcional)"
        value={f.address}
        onChange={(e) => setF({ ...f, address: e.target.value })}
        maxLength={200}
      />
    </div>
  );

  return (
    <Wizard
      title="Registrar atendido"
      submitLabel="Registrar atendido"
      submitting={busy}
      onSubmit={submit}
      onCancel={onDone}
      steps={[
        { key: "datos", label: "Datos del atendido", content: stepDatos, isValid: () => f.name.trim().length > 0, invalidMessage: "El nombre es requerido" },
        { key: "centro", label: "Centro de salud y ubicación", content: stepCentro, isValid: () => f.center_name.trim().length > 0, invalidMessage: "El nombre del centro es requerido" },
      ]}
    />
  );
}

