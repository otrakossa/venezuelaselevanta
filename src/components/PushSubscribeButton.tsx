import { useEffect, useState } from "react";
import { Bell, BellRing, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isPushSupported, getStoredEndpoint, subscribePush, unsubscribePush } from "@/lib/web-push";

export function PushSubscribeButton() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [open, setOpen] = useState(false);
  const [radius, setRadius] = useState(10);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupported(isPushSupported());
    setSubscribed(!!getStoredEndpoint());
  }, []);

  if (!supported) return null;

  const handleSubscribe = async () => {
    setBusy(true);
    try {
      const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos.coords),
          () => resolve(null),
          { timeout: 8000, enableHighAccuracy: false },
        );
      });
      await subscribePush({
        lat: coords?.latitude,
        lng: coords?.longitude,
        radius_km: radius,
      });
      setSubscribed(true);
      setOpen(false);
      toast.success(
        coords
          ? `Te avisaremos de emergencias críticas en un radio de ${radius} km.`
          : "Te avisaremos de todas las emergencias críticas (sin ubicación).",
      );
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo activar");
    } finally {
      setBusy(false);
    }
  };

  const handleUnsubscribe = async () => {
    setBusy(true);
    try {
      await unsubscribePush();
      setSubscribed(false);
      toast.success("Notificaciones desactivadas");
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  };

  if (subscribed) {
    return (
      <button
        onClick={handleUnsubscribe}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium hover:bg-emerald-500/20 disabled:opacity-60"
        title="Desactivar avisos"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
        Avisos activos
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card font-medium hover:bg-muted"
      >
        <Bell className="h-3.5 w-3.5" /> Avisarme
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-lg shadow-xl p-3 z-50 space-y-3">
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <BellRing className="h-4 w-4 text-primary" /> Emergencias cerca de ti
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Recibe una notificación cuando entre un reporte crítico en tu zona.
            </p>
          </div>
          <div>
            <label className="text-xs font-medium flex justify-between">
              <span>Radio</span>
              <span className="text-muted-foreground">{radius} km</span>
            </label>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 text-xs px-3 py-2 rounded-md border border-border"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubscribe}
              disabled={busy}
              className="flex-1 text-xs px-3 py-2 rounded-md bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellOff className="h-3.5 w-3.5" />}
              Activar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
