import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/categories";
import { ClientOnly } from "./ClientOnly";
import { MapView } from "./MapView";
import { Locate, Send } from "lucide-react";
import { toast } from "sonner";
import type { Report } from "@/lib/types";

export function ReportForm({ existingReports }: { existingReports: Report[] }) {
  const [form, setForm] = useState({
    title: "",
    category: "heridos",
    description: "",
    location_text: "",
    urgency: "medio",
    reporter_name: "",
    affected_count: "",
    status: "activo",
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const geolocate = () => {
    if (!navigator.geolocation) return toast.error("Geolocalización no disponible");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Ubicación detectada");
      },
      () => toast.error("No se pudo obtener la ubicación"),
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coords) return toast.error("Selecciona una ubicación en el mapa o usa geolocalización");
    if (!form.title.trim()) return toast.error("Ingresa un título");
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      urgency: form.urgency,
      status: form.status,
      location_text: form.location_text.trim() || null,
      lat: coords.lat,
      lng: coords.lng,
      reporter_name: form.reporter_name.trim() || null,
      affected_count: form.affected_count ? Number(form.affected_count) : null,
    });
    setSubmitting(false);
    if (error) return toast.error("Error: " + error.message);
    toast.success("Reporte enviado. Gracias por ayudar.");
    setForm({
      title: "", category: "heridos", description: "", location_text: "",
      urgency: "medio", reporter_name: "", affected_count: "", status: "activo",
    });
    setCoords(null);
  };

  const field = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const label = "text-xs font-semibold text-foreground mb-1 block";

  return (
    <form onSubmit={submit} className="grid lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div>
          <label className={label}>Título del incidente *</label>
          <input className={field} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={120} />
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
              <option value="critico">🔴 Crítico</option>
              <option value="alto">🟠 Alto</option>
              <option value="medio">🟡 Medio</option>
              <option value="bajo">🟢 Bajo</option>
            </select>
          </div>
        </div>
        <div>
          <label className={label}>Descripción</label>
          <textarea className={field} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
        </div>
        <div>
          <label className={label}>Dirección (texto)</label>
          <input className={field} value={form.location_text} onChange={(e) => setForm({ ...form, location_text: e.target.value })} placeholder="Ej: Av. Bolívar, Caracas" maxLength={200} />
        </div>
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
            <option value="activo">Activo</option>
            <option value="en_atencion">En atención</option>
            <option value="resuelto">Resuelto</option>
          </select>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button type="button" onClick={geolocate} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md bg-accent text-accent-foreground hover:opacity-90">
            <Locate className="h-3.5 w-3.5" /> Mi ubicación
          </button>
          {coords && (
            <span className="text-[11px] text-muted-foreground">
              📍 {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-md hover:opacity-90 transition disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> {submitting ? "Enviando..." : "Enviar reporte"}
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Toca el mapa para fijar la ubicación exacta del incidente.
        </p>
        <div className="h-[400px] lg:h-[520px] rounded-lg overflow-hidden border border-border">
          <ClientOnly fallback={<div className="h-full bg-muted animate-pulse" />}>
            <MapView
              reports={existingReports}
              onMapClick={(lat, lng) => setCoords({ lat, lng })}
              pickedLocation={coords}
            />
          </ClientOnly>
        </div>
      </div>
    </form>
  );
}
