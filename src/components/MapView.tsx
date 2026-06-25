import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { CATEGORY_MAP, CATEGORIES, URGENCY_LABELS, STATUS_LABELS } from "@/lib/categories";
import type { Report, MissingPerson } from "@/lib/types";
import { format } from "date-fns";
import { getCredibility } from "@/lib/credibility";
import { useUSGSQuakes, quakeColor } from "@/hooks/useUSGSQuakes";
import { WhatsAppShareButton } from "@/components/WhatsAppShareButton";
import { Link } from "@tanstack/react-router";

const VZLA_CENTER: [number, number] = [9.5, -66.5];

function createIcon(color: string, emoji: string, pulse = false) {
  return L.divIcon({
    html: `<div class="crisis-marker ${pulse ? "pulse" : ""}" style="background:${color}">${emoji}</div>`,
    className: "crisis-marker-wrapper",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function createMissingIcon(name: string) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return L.divIcon({
    html: `<div class="crisis-marker" style="background:#f43f5e;border:2px solid white;color:white;font-weight:800;font-family:system-ui">${initial}</div>`,
    className: "crisis-marker-wrapper missing-marker",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}



function ClickPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export interface MapViewProps {
  reports: Report[];
  activeCategories?: string[];
  onMapClick?: (lat: number, lng: number) => void;
  pickedLocation?: { lat: number; lng: number } | null;
  height?: string;
  focusReport?: { id: string; lat: number; lng: number; nonce: number } | null;
  focusMissing?: { id: string; lat: number; lng: number; nonce: number } | null;
  onOpenDetail?: (id: string) => void;
  showQuakes?: boolean;
  missing?: MissingPerson[];
  showMissing?: boolean;
}

function FocusController({
  target,
  markersRef,
}: {
  target: { id: string; lat: number; lng: number; nonce: number } | null;
  markersRef: React.MutableRefObject<Map<string, L.Marker>>;
}) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    const targetZoom = Math.max(map.getZoom(), 13);
    map.flyTo([target.lat, target.lng], targetZoom, { duration: 0.8 });
    // Wait for the cluster group to settle so the marker exists at this zoom.
    const t = window.setTimeout(() => {
      const m = markersRef.current.get(target.id);
      if (m) m.openPopup();
    }, 700);
    return () => window.clearTimeout(t);
  }, [target, map, markersRef]);
  return null;
}

export function MapView({
  reports,
  activeCategories,
  onMapClick,
  pickedLocation,
  height = "100%",
  focusReport,
  focusMissing,
  onOpenDetail,
  showQuakes = true,
  missing = [],
  showMissing = true,
}: MapViewProps) {
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const missingMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const { data: quakes = [] } = useUSGSQuakes(showQuakes);
  const filtered = useMemo(
    () =>
      activeCategories && activeCategories.length > 0
        ? reports.filter((r) => activeCategories.includes(r.category))
        : reports,
    [reports, activeCategories],
  );

  return (
    <div style={{ height, width: "100%" }}>
      <MapContainer
        center={VZLA_CENTER}
        zoom={6}
        scrollWheelZoom
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {onMapClick ? <ClickPicker onPick={onMapClick} /> : null}
        <FocusController target={focusReport ?? null} markersRef={markersRef} />
        <FocusController target={focusMissing ?? null} markersRef={missingMarkersRef} />
        {pickedLocation ? (
          <Marker
            position={[pickedLocation.lat, pickedLocation.lng]}
            icon={createIcon("#FF6B35", "📍", true)}
          />
        ) : null}

        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={(cluster: { getChildCount: () => number }) =>
            L.divIcon({
              html: `<div class="marker-cluster-custom" style="width:40px;height:40px">${cluster.getChildCount()}</div>`,
              className: "",
              iconSize: [40, 40],
            })
          }
        >
          {filtered.map((r) => {
            const cat = CATEGORY_MAP[r.category] ?? CATEGORIES[0];
            const pulse = r.urgency === "critical" && r.status === "active";
            return (
              <Marker
                key={r.id}
                position={[r.lat, r.lng]}
                icon={createIcon(cat.color, cat.emoji, pulse)}
                ref={(instance) => {
                  if (instance) markersRef.current.set(r.id, instance);
                  else markersRef.current.delete(r.id);
                }}
              >
                <Popup maxWidth={260} minWidth={240}>
                  <div className="w-[240px] space-y-2">
                    <div
                      className="-mx-3 -mt-3 px-3 py-2 rounded-t flex items-center gap-2"
                      style={{ background: cat.color, color: "white" }}
                    >
                      <span className="text-lg leading-none">{cat.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase tracking-wide opacity-90 font-semibold leading-none">
                          {cat.name}
                        </div>
                        <div className="font-bold text-[13px] truncate leading-tight mt-0.5">
                          {r.title}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold text-white"
                        style={{ background: URGENCY_LABELS[r.urgency].color }}
                      >
                        {URGENCY_LABELS[r.urgency].label}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-700">
                        {STATUS_LABELS[r.status]}
                      </span>
                      {(() => {
                        const c = getCredibility(r);
                        return (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: c.bg, color: c.fg }}
                          >
                            {c.short}
                          </span>
                        );
                      })()}
                    </div>

                    {r.description ? (
                      <p className="text-xs text-neutral-600 line-clamp-2">{r.description}</p>
                    ) : null}

                    {r.address ? (
                      <div className="text-[11px] text-neutral-500 truncate">📍 {r.address}</div>
                    ) : null}

                    <div className="text-[10px] text-neutral-400">
                      {format(new Date(r.created_at), "dd MMM HH:mm")}
                      {r.reporter_name ? ` · ${r.reporter_name}` : " · anónimo"}
                    </div>

                    <div className="flex gap-1.5 items-stretch mt-1">
                      {onOpenDetail && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onOpenDetail(r.id);
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-white text-xs font-bold shadow-sm hover:opacity-90 transition"
                          style={{ background: cat.color }}
                        >
                          Ver detalle →
                        </button>
                      )}
                      <WhatsAppShareButton report={r} variant="icon" />
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>

        {showQuakes &&
          quakes.map((q) => (
            <CircleMarker
              key={q.id}
              center={[q.lat, q.lng]}
              radius={Math.max(4, q.mag * 4)}
              pathOptions={{
                color: "#ffffff",
                weight: 1,
                fillColor: quakeColor(q.mag),
                fillOpacity: 0.5,
              }}
            >
              <Popup>
                <div className="w-[220px] space-y-1">
                  <div className="font-bold text-sm">
                    M {q.mag.toFixed(1)} · Sismo
                  </div>
                  <div className="text-xs text-neutral-700">{q.place}</div>
                  <div className="text-[11px] text-neutral-500">
                    Profundidad: {q.depth?.toFixed(1)} km
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {new Date(q.time).toUTCString()}
                  </div>
                  <a
                    href={q.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-[11px] text-[color:var(--sunrise)] font-semibold hover:underline"
                  >
                    Ver en USGS →
                  </a>
                </div>
              </Popup>
            </CircleMarker>
          ))}

        {showMissing &&
          missing
            .filter((m) => m.last_seen_lat != null && m.last_seen_lng != null && m.status === "missing")
            .map((m) => {
              const waText = `🆘 *PERSONA DESAPARECIDA* — Venezuela Se Levanta\n\n👤 ${m.name}${m.age ? ` (${m.age} años)` : ""}\n${m.last_seen_location ? `📍 ${m.last_seen_location}\n` : ""}${m.description ? `📝 ${m.description}\n` : ""}${m.contact_phone ? `📞 ${m.contact_phone}\n` : ""}\nhttps://venezuelaselevanta.info/desaparecidos`;
              return (
                <Marker
                  key={`missing-${m.id}`}
                  position={[m.last_seen_lat as number, m.last_seen_lng as number]}
                  icon={createMissingIcon(m.name)}
                  ref={(instance) => {
                    if (instance) missingMarkersRef.current.set(m.id, instance);
                    else missingMarkersRef.current.delete(m.id);
                  }}
                >
                  <Popup maxWidth={260} minWidth={240}>
                    <div className="w-[240px] space-y-2">
                      <div className="-mx-3 -mt-3 px-3 py-2 rounded-t flex items-center gap-2" style={{ background: "#f43f5e", color: "white" }}>
                        {m.photo_url ? (
                          <img src={m.photo_url} alt="" className="h-8 w-8 rounded-full object-cover border border-white/60" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
                        ) : (
                          <span className="h-8 w-8 rounded-full bg-white/20 grid place-items-center text-sm font-black">{(m.name?.[0] ?? "?").toUpperCase()}</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] uppercase tracking-wide opacity-90 font-semibold leading-none">Desaparecida</div>
                          <div className="font-bold text-[13px] truncate leading-tight mt-0.5">{m.name}{m.age ? ` · ${m.age}a` : ""}</div>
                        </div>
                      </div>
                      {m.last_seen_location && (
                        <div className="text-[11px] text-neutral-600 truncate">📍 {m.last_seen_location}</div>
                      )}
                      {m.description && (
                        <p className="text-xs text-neutral-600 line-clamp-3">{m.description}</p>
                      )}
                      <div className="text-[10px] text-neutral-400">
                        Reportada {format(new Date(m.report_date), "dd MMM HH:mm")}
                      </div>
                      <div className="flex gap-1.5">
                        <Link to="/desaparecidos" className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-md bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition">
                          Ver ficha →
                        </Link>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center px-3 py-2 rounded-md bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition"
                          title="Difundir por WhatsApp"
                        >
                          Difundir
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
      </MapContainer>
    </div>
  );
}
