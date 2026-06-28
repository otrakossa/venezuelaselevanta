import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, URGENCY_LABELS, STATUS_LABELS, CATEGORY_MAP } from "@/lib/categories";
import { ClientOnly } from "./ClientOnly";
import { MapViewLazy as MapView } from "./MapViewLazy";
import {
  Locate, Send, Camera, X, Loader2, ArrowLeft, ArrowRight,
  Check, MapPin as MapPinIcon, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import exifr from "exifr";
import type { Report } from "@/lib/types";
import { enqueueReport } from "@/lib/offline-queue";
import { uploadMany } from "@/lib/media-upload";
import { reverseGeocode } from "@/lib/geocode";
import { LocationSelect } from "./LocationSelect";
import { detectStateFromAddress } from "@/lib/venezuela-divipol";
import { flags } from "@/lib/flags";
import { TELEGRAM_BOT } from "@/lib/credits";

const MAX_FILES = 4;
const MAX_SIZE_MB = 10;

type Preview = { url: string; type: string; name: string };

const URGENCY_ORDER = ["low", "medium", "high", "critical"] as const;
const URGENCY_ACCENT: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-[color:var(--gold)] text-[color:var(--midnight)]",
  high: "bg-orange-200 text-orange-900",
  critical: "bg-red-200 text-red-900",
};

export function ReportForm({ existingReports }: { existingReports: Report[] }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState({
    title: "",
    category: "medical",
    description: "",
    address: "",
    state: "",
    municipality: "",
    parish: "",
    urgency: "medium",
    reporter_name: "",
    affected_count: "",
    status: "active",
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [addressTouched, setAddressTouched] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const geocodeAbort = useRef<AbortController | null>(null);
  const autoGeoTried = useRef(false);
  const quick = flags.quickReport;
  const [showMore, setShowMore] = useState(false);
  const showOptional = !quick || showMore;

  useEffect(() => {
    if (!coords) return;
    if (addressTouched && form.address.trim().length > 0) return;
    geocodeAbort.current?.abort();
    const ctrl = new AbortController();
    geocodeAbort.current = ctrl;
    setGeocoding(true);
    reverseGeocode(coords.lat, coords.lng, ctrl.signal)
      .then((addr) => {
        if (ctrl.signal.aborted) return;
        if (addr) {
          setForm((f) => {
            const detected = !f.state ? detectStateFromAddress(addr) : null;
            return { ...f, address: addr, state: detected ?? f.state };
          });
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setGeocoding(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lng]);

  const geolocate = () => {
    if (!navigator.geolocation) return toast.error("Geolocalización no disponible");
    toast.loading("Buscando tu ubicación...", { id: "geo" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success(`Ubicación detectada (±${Math.round(pos.coords.accuracy)} m)`, { id: "geo" });
        if (navigator.vibrate) navigator.vibrate(15);
      },
      (err) => toast.error("No se pudo obtener: " + err.message, { id: "geo" }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Modo rápido: dispara el GPS automáticamente al entrar al paso de ubicación
  // (una sola vez). Reusa el mismo geolocate() del botón "Usar mi ubicación".
  useEffect(() => {
    if (!quick || step !== 2 || coords || autoGeoTried.current) return;
    autoGeoTried.current = true;
    geolocate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quick, step, coords]);

  const onFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? []);
    if (incoming.length === 0) return;
    const allowed: File[] = [];
    for (const f of incoming) {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.warning(`"${f.name}" supera ${MAX_SIZE_MB} MB y fue omitido`);
        continue;
      }
      allowed.push(f);
    }
    const merged = [...files, ...allowed].slice(0, MAX_FILES);
    setFiles(merged);
    setPreviews(merged.map((f) => ({ url: URL.createObjectURL(f), type: f.type, name: f.name })));
    const firstImage = allowed.find((f) => f.type.startsWith("image/"));
    if (firstImage && !coords) {
      try {
        const gps = await exifr.gps(firstImage);
        if (gps?.latitude && gps?.longitude) {
          setCoords({ lat: gps.latitude, lng: gps.longitude });
          toast.success("📸 Ubicación extraída de la foto");
        }
      } catch {/* no exif */}
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    setPreviews(next.map((f) => ({ url: URL.createObjectURL(f), type: f.type, name: f.name })));
  };

  const resetForm = () => {
    setForm({
      title: "", category: "medical", description: "", address: "",
      state: "", municipality: "", parish: "",
      urgency: "medium", reporter_name: "", affected_count: "", status: "active",
    });
    setCoords(null);
    setFiles([]);
    setPreviews([]);
    setAddressTouched(false);
    setStep(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async () => {
    if (!coords) { setStep(2); return toast.error("Selecciona una ubicación o usa 📍 Mi ubicación"); }
    // En modo rápido el título es opcional: si falta, usamos el nombre de la categoría.
    const title = form.title.trim() || (quick ? (CATEGORY_MAP[form.category]?.name ?? "Reporte") : "");
    if (!title) { setStep(1); return toast.error("Ingresa un título"); }
    setSubmitting(true);

    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    let mediaUrls: string[] = [];
    if (!isOffline && files.length > 0) {
      toast.loading(`Subiendo ${files.length} archivo${files.length > 1 ? "s" : ""}...`, { id: "up" });
      try {
        mediaUrls = await uploadMany(files);
        toast.success(`Archivos subidos`, { id: "up" });
      } catch {
        toast.error("No se pudieron subir los archivos", { id: "up" });
      }
    }

    const photoUrl = mediaUrls.find((u) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u)) ?? null;
    const payload = {
      title,
      description: form.description.trim() || null,
      category: form.category,
      urgency: form.urgency,
      status: form.status,
      address: form.address.trim() || null,
      state: form.state || null,
      municipality: form.municipality || null,
      parish: form.parish.trim() || null,
      lat: coords.lat,
      lng: coords.lng,
      reporter_name: form.reporter_name.trim() || null,
      affected_count: form.affected_count ? Number(form.affected_count) : null,
      photo_url: photoUrl,
      ...(mediaUrls.length > 0 ? { media_urls: mediaUrls } : {}),
    };

    if (isOffline) {
      await enqueueReport(payload);
      window.dispatchEvent(new Event("queue:changed"));
      setSubmitting(false);
      if (navigator.vibrate) navigator.vibrate(20);
      toast.success("📥 Sin conexión: reporte guardado. Se enviará al volver la señal.");
      resetForm();
      return;
    }

    const res = await fetch("/api/public/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      await enqueueReport(payload);
      window.dispatchEvent(new Event("queue:changed"));
      toast.warning("Conexión inestable. Reporte guardado para reintentar.");
      resetForm();
      return;
    }
    if (navigator.vibrate) navigator.vibrate([15, 40, 15]);
    toast.success("✅ Reporte enviado. Gracias por ayudar.");
    resetForm();
  };

  // Step validation
  const step1Valid = useMemo(() => (quick || form.title.trim().length > 0) && !!form.category && !!form.urgency, [quick, form.title, form.category, form.urgency]);
  const step2Valid = !!coords;

  const goNext = () => {
    if (step === 1) {
      if (!step1Valid) return toast.error("Completa título, categoría y urgencia");
      setStep(2);
    } else if (step === 2) {
      if (!step2Valid) return toast.error("Marca la ubicación en el mapa o usa 📍 Mi ubicación");
      setStep(3);
    }
  };
  const goBack = () => { if (step > 1) setStep((step - 1) as 1 | 2); };

  const stepLabel = step === 1 ? "Qué pasa" : step === 2 ? "Dónde" : "Evidencia y envío";
  const canAddMore = files.length < MAX_FILES;
  const selectedCat = CATEGORY_MAP[form.category];

  const field = "w-full px-4 py-3 rounded-xl bg-muted/50 border border-transparent focus:bg-background focus:border-[color:var(--sky)] outline-none transition-all text-[color:var(--midnight)] placeholder:text-muted-foreground/50 text-sm";

  return (
    <div className="max-w-2xl mx-auto">
      {/* Stepper Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-[color:var(--midnight)]">Iniciar reporte</h2>
          <span className="text-xs font-semibold text-[color:var(--sunrise)] bg-[color:var(--sunrise)]/10 px-3 py-1 rounded-full whitespace-nowrap">
            Paso {step} de 3
          </span>
        </div>
        <div className="flex gap-2 mb-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-colors ${s <= step ? "bg-[color:var(--sunrise)]" : "bg-muted"}`}
            />
          ))}
        </div>
        <p className="text-sm text-muted-foreground font-medium">{stepLabel}</p>
      </div>

      {/* STEP 1 — Qué pasa */}
      {step === 1 && (
        <div className="space-y-7">
          <section>
            <label className="block text-xs font-bold text-[color:var(--midnight)] mb-3 uppercase tracking-wider">Categoría *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {CATEGORIES.filter((c) => c.slug !== "earthquake").map((c) => {
                const active = form.category === c.slug;
                const Icon = c.icon;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => setForm({ ...form, category: c.slug })}
                    aria-pressed={active}
                    className={`flex flex-col items-center text-center p-3 rounded-2xl border-2 transition-all active:scale-95 min-h-[96px] ${
                      active
                        ? "border-[color:var(--sunrise)] bg-[color:var(--sunrise)]/5 text-[color:var(--sunrise)]"
                        : "border-border bg-card text-muted-foreground hover:border-[color:var(--sky)]/30"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 mb-2 rounded-xl flex items-center justify-center ${
                        active ? "text-white" : "bg-muted text-muted-foreground"
                      }`}
                      style={active ? { background: c.color } : undefined}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold leading-tight">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <label className="block text-xs font-bold text-[color:var(--midnight)] mb-3 uppercase tracking-wider">Urgencia *</label>
            <div className="flex p-1 bg-muted rounded-xl gap-1">
              {URGENCY_ORDER.map((u) => {
                const active = form.urgency === u;
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setForm({ ...form, urgency: u })}
                    aria-pressed={active}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all min-h-[40px] ${
                      active ? `${URGENCY_ACCENT[u]} shadow-sm` : "text-muted-foreground"
                    }`}
                  >
                    {URGENCY_LABELS[u].label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-widest">Título *</label>
              <input
                type="text"
                className={field}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={120}
                placeholder="Ej. Edificio colapsado en Av. Bolívar"
              />
            </div>
            {showOptional ? (
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-widest">Descripción</label>
                <textarea
                  className={`${field} resize-none`}
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  maxLength={1000}
                  placeholder="Detalla lo que ocurre, cuántas personas, qué se necesita..."
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowMore(true)}
                className="text-sm font-semibold text-[color:var(--sky)] hover:underline"
              >
                + Agregar descripción (opcional)
              </button>
            )}
          </section>
        </div>
      )}

      {/* STEP 2 — Dónde */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Toca el mapa para fijar la ubicación exacta del incidente, o usa tu GPS.
          </p>
          <div className="h-[320px] sm:h-[420px] rounded-2xl overflow-hidden border border-border">
            <ClientOnly fallback={<div className="h-full bg-muted animate-pulse" />}>
              <MapView
                reports={existingReports}
                onMapClick={(lat, lng) => setCoords({ lat, lng })}
                pickedLocation={coords}
              />
            </ClientOnly>
          </div>

          <button
            type="button"
            onClick={geolocate}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-3 py-3 rounded-xl bg-[color:var(--sky)] text-white active:scale-[0.98] transition min-h-[48px]"
          >
            <Locate className="h-4 w-4" /> Usar mi ubicación
          </button>

          {coords ? (
            <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-800 rounded-xl px-3 py-2.5 border border-emerald-200">
              <MapPinIcon className="h-4 w-4 shrink-0" />
              <span className="font-mono">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs bg-amber-50 text-amber-800 rounded-xl px-3 py-2.5 border border-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Aún no hay ubicación seleccionada.</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-widest">
              Dirección {geocoding && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
            </label>
            <input
              className={field}
              value={form.address}
              onChange={(e) => { setForm({ ...form, address: e.target.value }); setAddressTouched(true); }}
              placeholder={geocoding ? "Detectando dirección..." : "Av. Bolívar, Caracas"}
              maxLength={200}
            />
          </div>

          <LocationSelect
            state={form.state}
            municipality={form.municipality}
            parish={form.parish}
            onChange={(v) => setForm({ ...form, ...v })}
          />
        </div>
      )}

      {/* STEP 3 — Evidencia y envío */}
      {step === 3 && (
        <div className="space-y-6">
          <section>
            <label className="block text-xs font-bold text-[color:var(--midnight)] mb-2 uppercase tracking-wider">
              Foto o video <span className="text-muted-foreground font-medium normal-case">(opcional, hasta {MAX_FILES})</span>
            </label>
            <label
              className={`flex items-center justify-center gap-2 text-sm font-semibold px-3 py-3 rounded-xl bg-muted text-foreground border border-dashed border-border active:scale-[0.98] transition cursor-pointer min-h-[56px] ${!canAddMore ? "opacity-50 pointer-events-none" : ""}`}
            >
              <Camera className="h-5 w-5" />
              {files.length === 0
                ? "Agregar foto o video"
                : `${files.length}/${MAX_FILES} · agregar más`}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,video/webm,video/quicktime"
                capture="environment"
                multiple
                onChange={onFilesChange}
                className="hidden"
              />
            </label>
            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {previews.map((p, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border bg-muted">
                    {p.type.startsWith("video/") ? (
                      <video src={p.url} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white"
                      aria-label="Quitar archivo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {showOptional ? (
          <>
          <section className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-widest">Tu nombre</label>
              <input
                className={field}
                value={form.reporter_name}
                onChange={(e) => setForm({ ...form, reporter_name: e.target.value })}
                placeholder="Anónimo"
                maxLength={80}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-widest">Afectados</label>
              <input
                type="number"
                min="0"
                className={field}
                value={form.affected_count}
                onChange={(e) => setForm({ ...form, affected_count: e.target.value })}
                placeholder="0"
              />
            </div>
          </section>

          <section>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-widest">Estado del caso</label>
            <select
              className={field}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </section>
          </>
          ) : (
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className="w-full text-sm font-semibold text-[color:var(--sky)] border border-dashed border-[color:var(--sky)]/40 rounded-xl py-3 hover:bg-[color:var(--sky)]/5 transition min-h-[48px]"
            >
              + Más detalles (nombre, afectados, estado)
            </button>
          )}

          {/* Summary */}
          <section className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--midnight)] mb-1">Resumen</h3>
            <SummaryRow label="Título" value={form.title.trim() || (quick ? (CATEGORY_MAP[form.category]?.name ?? "—") : "—")} />
            <SummaryRow label="Categoría" value={selectedCat ? `${selectedCat.emoji} ${selectedCat.name}` : "—"} />
            <SummaryRow label="Urgencia" value={URGENCY_LABELS[form.urgency]?.label ?? "—"} />
            <SummaryRow
              label="Ubicación"
              value={coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "—"}
            />
            {form.address && <SummaryRow label="Dirección" value={form.address} />}
            {(form.state || form.municipality) && (
              <SummaryRow label="Zona" value={[form.state, form.municipality, form.parish].filter(Boolean).join(" · ")} />
            )}
            <SummaryRow label="Adjuntos" value={files.length ? `${files.length} archivo${files.length > 1 ? "s" : ""}` : "Ninguno"} />
          </section>
        </div>
      )}

      {/* Footer actions (inline, no float) */}
      <div className="mt-8 pt-4 border-t border-border">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 1 || submitting}
            className="px-4 sm:px-6 py-3.5 rounded-xl text-foreground font-semibold border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 min-h-[48px]"
          >
            <ArrowLeft className="h-4 w-4" /> Atrás
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              className="flex-1 bg-[color:var(--sky)] hover:opacity-90 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[color:var(--sky)]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] min-h-[48px]"
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex-1 bg-[color:var(--sunrise)] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[color:var(--sunrise)]/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 min-h-[48px]"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {submitting ? "Enviando..." : "Enviar reporte"}
            </button>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          ¿Sin internet estable?{" "}
          <a
            href={TELEGRAM_BOT}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[color:var(--sky)] underline underline-offset-2"
          >
            <Send className="h-3 w-3" /> Reporta por Telegram
          </a>
        </p>
      </div>
    </div>
  );
}


function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-[color:var(--midnight)] font-medium text-right break-words">{value}</span>
    </div>
  );
}
