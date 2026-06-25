import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { CATEGORY_MAP, CATEGORIES, URGENCY_LABELS, STATUS_LABELS } from "@/lib/categories";
import type { Report } from "@/lib/types";
import { format } from "date-fns";
import { ReportRating } from "@/components/ReportRating";
import { getCredibility } from "@/lib/credibility";

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
  onOpenDetail?: (id: string) => void;
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
  onOpenDetail,
}: MapViewProps) {
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
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
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {onMapClick ? <ClickPicker onPick={onMapClick} /> : null}
        <FocusController target={focusReport ?? null} markersRef={markersRef} />
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

                    {onOpenDetail && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onOpenDetail(r.id);
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 mt-1 px-3 py-2 rounded-md text-white text-xs font-bold shadow-sm hover:opacity-90 transition"
                        style={{ background: cat.color }}
                      >
                        Ver detalle completo →
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
