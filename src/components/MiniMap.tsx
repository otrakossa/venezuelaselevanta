import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";

function pinIcon(color: string, emoji: string) {
  return L.divIcon({
    html: `<div class="crisis-marker" style="background:${color}">${emoji}</div>`,
    className: "crisis-marker-wrapper",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function MiniMap({
  lat,
  lng,
  color = "#FF6B35",
  emoji = "📍",
  zoom = 14,
  height = 160,
}: {
  lat: number;
  lng: number;
  color?: string;
  emoji?: string;
  zoom?: number;
  height?: number;
}) {
  return (
    <div className="rounded-lg overflow-hidden border border-border" style={{ height }}>
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        zoomControl={false}
        attributionControl={false}
        touchZoom={false}
        keyboard={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[lat, lng]} icon={pinIcon(color, emoji)} />
      </MapContainer>
    </div>
  );
}
