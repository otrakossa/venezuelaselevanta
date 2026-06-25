import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/categories";
import { ClientOnly } from "./ClientOnly";
import { MapView } from "./MapView";
import { Locate, Send, Camera, X } from "lucide-react";
import { toast } from "sonner";
import exifr from "exifr";
import type { Report } from "@/lib/types";

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
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const onPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    try {
      const gps = await exifr.gps(file);
      if (gps?.latitude && gps?.longitude && !coords) {
        setCoords({ lat: gps.latitude, lng: gps.longitude });
        toast.success("📸 Ubicación extraída de la foto");
      }
    } catch {
      /* photo has no EXIF */
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coords) return toast.error("Selecciona una ubicación o usa 📍 Mi ubicación");
    if (!form.title.trim()) return toast.error("Ingresa un título");
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
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
    });
    setSubmitting(false);
    if (error) return toast.error("Error: " + error.message);
    if (navigator.vibrate) navigator.vibrate([15, 40, 15]);
    toast.success("✅ Reporte enviado. Gracias por ayudar.");
    setForm({
      title: "", category: "medical", description: "", address: "",
      urgency: "medium", reporter_name: "", affected_count: "", status: "active",
    });
    setCoords(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const field = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const label = "text-xs font-semibold text-foreground mb-1 block";

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
          <label className={label}>Dirección (texto)</label>
          <input className={field} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Ej: Av. Bolívar, Caracas" maxLength={200} />
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
          <label className="flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-3 rounded-lg bg-muted text-foreground border border-border active:scale-[0.98] transition cursor-pointer">
            <Camera className="h-4 w-4" /> {photoPreview ? "Cambiar foto" : "Foto"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPhotoChange}
              className="hidden"
            />
          </label>
        </div>
        {coords && (
          <div className="text-[11px] text-muted-foreground bg-muted/60 rounded-md px-2 py-1.5">
            📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </div>
        )}
        {photoPreview && (
          <div className="relative w-full h-40 rounded-lg overflow-hidden border border-border">
            <img src={photoPreview} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => { setPhotoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white"
              aria-label="Quitar foto"
            >
              <X className="h-3.5 w-3.5" />
            </button>
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
          <Send className="h-4 w-4" /> {submitting ? "Enviando..." : "Enviar reporte"}
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
          <Send className="h-4 w-4" /> {submitting ? "Enviando..." : "Enviar reporte"}
        </button>
      </div>
    </form>
  );
}
