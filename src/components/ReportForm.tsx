import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/categories";
import { ClientOnly } from "./ClientOnly";
import { MapView } from "./MapView";
import { Locate, Send, Camera, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import exifr from "exifr";
import type { Report } from "@/lib/types";
import { enqueueReport } from "@/lib/offline-queue";
import { uploadMany } from "@/lib/media-upload";
import { reverseGeocode } from "@/lib/geocode";

const MAX_FILES = 4;
const MAX_SIZE_MB = 10;

type Preview = { url: string; type: string; name: string };

export function ReportForm({ existingReports }: { existingReports: Report[] }) {
  const [form, setForm] = useState({
    title: "",
    category: "medical",
    description: "",
    address: "",
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

  // Auto reverse-geocode when coords change (and user hasn't manually edited address)
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
          setForm((f) => ({ ...f, address: addr }));
        } else {
          toast.info("No se detectó la dirección. Puedes escribirla manualmente.", { duration: 3000 });
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
    setPreviews(
      merged.map((f) => ({ url: URL.createObjectURL(f), type: f.type, name: f.name })),
    );
    // EXIF GPS from first image (if no coords yet)
    const firstImage = allowed.find((f) => f.type.startsWith("image/"));
    if (firstImage && !coords) {
      try {
        const gps = await exifr.gps(firstImage);
        if (gps?.latitude && gps?.longitude) {
          setCoords({ lat: gps.latitude, lng: gps.longitude });
          toast.success("📸 Ubicación extraída de la foto");
        }
      } catch {
        /* no exif */
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    setPreviews(
      next.map((f) => ({ url: URL.createObjectURL(f), type: f.type, name: f.name })),
    );
  };

  const resetForm = () => {
    setForm({
      title: "", category: "medical", description: "", address: "",
      urgency: "medium", reporter_name: "", affected_count: "", status: "active",
    });
    setCoords(null);
    setFiles([]);
    setPreviews([]);
    setAddressTouched(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coords) return toast.error("Selecciona una ubicación o usa 📍 Mi ubicación");
    if (!form.title.trim()) return toast.error("Ingresa un título");
    setSubmitting(true);

    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    // Upload media first (skip if offline → queue without media)
    let mediaUrls: string[] = [];
    if (!isOffline && files.length > 0) {
      toast.loading(`Subiendo ${files.length} archivo${files.length > 1 ? "s" : ""}...`, { id: "up" });
      try {
        mediaUrls = await uploadMany(files);
        toast.success(`Archivos subidos`, { id: "up" });
      } catch (err) {
        toast.error("No se pudieron subir los archivos", { id: "up" });
      }
    }

    const photoUrl = mediaUrls.find((u) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u)) ?? null;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      urgency: form.urgency,
      status: form.status,
      address: form.address.trim() || null,
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

    const { error } = await supabase.from("reports").insert(payload);
    setSubmitting(false);
    if (error) {
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

  const field = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const label = "text-xs font-semibold text-foreground mb-1 block";
  const canAddMore = files.length < MAX_FILES;

  return (
    <form onSubmit={submit} className="grid lg:grid-cols-2 gap-4 pb-24 lg:pb-0">
      <div className="space-y-3 order-2 lg:order-1">
        <div>
          <label className={label}>Título del incidente *</label>
          <input className={field} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={120} placeholder="Ej. Edificio colapsado en Av. Bolívar" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Categoría *</label>
            <select className={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.emoji} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Urgencia *</label>
            <select className={field} value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
              <option value="critical">🔴 Crítico</option>
              <option value="high">🟠 Alto</option>
              <option value="medium">🟡 Medio</option>
              <option value="low">🟢 Bajo</option>
            </select>
          </div>
        </div>
        <div>
          <label className={label}>Descripción</label>
          <textarea className={field} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
        </div>
        <div>
          <label className={label}>
            Dirección {geocoding && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
          </label>
          <input
            className={field}
            value={form.address}
            onChange={(e) => { setForm({ ...form, address: e.target.value }); setAddressTouched(true); }}
            placeholder={geocoding ? "Detectando dirección..." : "Ej: Av. Bolívar, Caracas"}
            maxLength={200}
          />
        </div>

        {/* Photo + Location actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={geolocate}
            className="flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-3 rounded-lg bg-[color:var(--sky)] text-white active:scale-[0.98] transition"
          >
            <Locate className="h-4 w-4" /> Mi ubicación
          </button>
          <label
            className={`flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-3 rounded-lg bg-muted text-foreground border border-border active:scale-[0.98] transition cursor-pointer ${!canAddMore ? "opacity-50 pointer-events-none" : ""}`}
          >
            <Camera className="h-4 w-4" />
            {files.length === 0
              ? "Foto / video"
              : `${files.length}/${MAX_FILES} · agregar`}
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
        </div>
        {coords && (
          <div className="text-[11px] text-muted-foreground bg-muted/60 rounded-md px-2 py-1.5">
            📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </div>
        )}
        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {previews.map((p, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted">
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Tu nombre (opcional)</label>
            <input className={field} value={form.reporter_name} onChange={(e) => setForm({ ...form, reporter_name: e.target.value })} placeholder="Anónimo" maxLength={80} />
          </div>
          <div>
            <label className={label}>Personas afectadas</label>
            <input type="number" min="0" className={field} value={form.affected_count} onChange={(e) => setForm({ ...form, affected_count: e.target.value })} />
          </div>
        </div>
        <div>
          <label className={label}>Estado</label>
          <select className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Activo</option>
            <option value="attending">En atención</option>
            <option value="resolved">Resuelto</option>
          </select>
        </div>

        {/* Desktop submit */}
        <button
          type="submit"
          disabled={submitting}
          className="hidden lg:flex w-full items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-lg hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? "Enviando..." : "Enviar reporte"}
        </button>
      </div>

      <div className="space-y-2 order-1 lg:order-2">
        <p className="text-xs text-muted-foreground">
          Toca el mapa para fijar la ubicación exacta del incidente.
        </p>
        <div className="h-[280px] lg:h-[520px] rounded-lg overflow-hidden border border-border">
          <ClientOnly fallback={<div className="h-full bg-muted animate-pulse" />}>
            <MapView
              reports={existingReports}
              onMapClick={(lat, lng) => setCoords({ lat, lng })}
              pickedLocation={coords}
            />
          </ClientOnly>
        </div>
      </div>

      {/* Mobile sticky submit, above the bottom nav */}
      <div
        className="lg:hidden fixed inset-x-0 z-[950] bg-card/95 backdrop-blur border-t border-border px-3 py-3"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-[color:var(--sunrise)] text-white font-semibold py-3 rounded-lg shadow-lg shadow-[color:var(--sunrise)]/30 active:scale-[0.99] transition disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? "Enviando..." : "Enviar reporte"}
        </button>
      </div>
    </form>
  );
}
