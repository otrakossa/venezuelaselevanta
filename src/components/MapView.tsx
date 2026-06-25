import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { CATEGORY_MAP, CATEGORIES, URGENCY_LABELS, STATUS_LABELS } from "@/lib/categories";
import type { Report } from "@/lib/types";
import { format } from "date-fns";

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
  selectedId?: string | null;
}

export function MapView({
  reports,
  activeCategories,
  onMapClick,
  pickedLocation,
  height = "100%",
  selectedId,
}: MapViewProps) {
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
              >
                <Popup>
                  <div className="min-w-[220px] space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ background: cat.color }}
                      />
                      <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                        {cat.name}
                      </span>
                    </div>
                    <div className="font-semibold text-sm">{r.title}</div>
                    {r.description ? (
                      <p className="text-xs text-neutral-600">{r.description}</p>
                    ) : null}
                    {r.address ? (
                      <div className="text-[11px] text-neutral-500">📍 {r.address}</div>
                    ) : null}
                    {(() => {
                      const media = (r.media_urls && r.media_urls.length > 0)
                        ? r.media_urls
                        : (r.photo_url ? [r.photo_url] : []);
                      if (media.length === 0) return null;
                      const thumbs = r.media_thumbs ?? [];
                      return (
                        <div className={`grid gap-1 pt-1 ${media.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                          {media.map((url, i) => {
                            const isVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
                            const thumb = thumbs[i] || (isVideo ? null : url);
                            return isVideo ? (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="relative block w-full h-24 rounded overflow-hidden bg-black"
                                aria-label={`Reproducir video ${i + 1}`}
                              >
                                {thumb ? (
                                  <img
                                    src={thumb}
                                    alt={`Video ${i + 1}`}
                                    className="w-full h-full object-cover opacity-90"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : null}
                                <span className="absolute inset-0 flex items-center justify-center">
                                  <span className="w-8 h-8 rounded-full bg-black/60 text-white text-base flex items-center justify-center">▶</span>
                                </span>
                              </a>
                            ) : (
                              <a key={i} href={url} target="_blank" rel="noreferrer">
                                <img
                                  src={thumb ?? url}
                                  alt={`Adjunto ${i + 1}`}
                                  className="w-full h-24 object-cover rounded"
                                  loading="lazy"
                                  decoding="async"
                                />
                              </a>
                            );
                          })}
                        </div>
                      );
                    })()}
                    <div className="flex flex-wrap gap-1 pt-1">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold text-white"
                        style={{ background: URGENCY_LABELS[r.urgency].color }}
                      >
                        {URGENCY_LABELS[r.urgency].label}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-700">
                        {STATUS_LABELS[r.status]}
                      </span>
                      {r.verified ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500 text-white">
                          ✓ Verificado
                        </span>
                      ) : null}
                    </div>
                    {r.affected_count ? (
                      <div className="text-[11px] text-neutral-600 pt-1">
                        👥 {r.affected_count} personas afectadas
                      </div>
                    ) : null}
                    <div className="text-[10px] text-neutral-400 pt-1">
                      {format(new Date(r.created_at), "dd MMM yyyy HH:mm")}
                      {r.reporter_name ? ` · ${r.reporter_name}` : " · anónimo"}
                    </div>
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
