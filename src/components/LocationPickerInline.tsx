import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Locate, X, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isValidCoords } from "@/lib/geo";

function pinIcon() {
  return L.divIcon({
    html: `<div class="crisis-marker" style="background:#FF6B35">📍</div>`,
    className: "crisis-marker-wrapper",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function ClickToPin({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (isValidCoords(lat, lng)) {
      map.flyTo([lat as number, lng as number], Math.max(map.getZoom(), 14), { duration: 0.5 });
    }
  }, [lat, lng, map]);
  return null;
}

export function LocationPickerInline({
  lat,
  lng,
  onChange,
  height = 200,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  height?: number;
}) {
  const [busy, setBusy] = useState(false);
  const hasPin = isValidCoords(lat, lng);
  const initialCenter = useRef<[number, number]>(
    hasPin ? [lat as number, lng as number] : [9.5, -66.5],
  );

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Tu navegador no soporta geolocalización");
    setBusy(true);
    toast.loading("Buscando tu ubicación...", { id: "geo-need" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
        toast.success(`Ubicación detectada (±${Math.round(pos.coords.accuracy)} m)`, { id: "geo-need" });
        setBusy(false);
      },
      (err) => {
        toast.error("No se pudo obtener: " + err.message, { id: "geo-need" });
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Locate className="h-3.5 w-3.5" />}
          Usar mi ubicación
        </button>
        {hasPin && (
          <>
            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 text-primary" />
              {(lat as number).toFixed(5)}, {(lng as number).toFixed(5)}
            </span>
            <button
              type="button"
              onClick={() => onChange(null, null)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" /> Quitar
            </button>
          </>
        )}
      </div>

      <div className="rounded-lg overflow-hidden border border-border" style={{ height }}>
        <MapContainer
          center={initialCenter.current}
          zoom={hasPin ? 14 : 6}
          scrollWheelZoom={false}
          attributionControl={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickToPin onPick={(la, ln) => onChange(la, ln)} />
          <Recenter lat={lat} lng={lng} />
          {hasPin && (
            <Marker
              position={[lat as number, lng as number]}
              icon={pinIcon()}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker;
                  const p = m.getLatLng();
                  onChange(p.lat, p.lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Toca el mapa para fijar el punto o arrastra el pin para ajustarlo.
      </p>
    </div>
  );
}
