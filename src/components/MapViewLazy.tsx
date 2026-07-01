import { lazy, Suspense } from "react";
import { HeartbeatLoader } from "./HeartbeatLoader";
import type { MapViewProps } from "./MapView";

// Lazily load the Leaflet-heavy MapView so the initial JS bundle stays small.
// This ensures react-leaflet, leaflet and react-leaflet-cluster are only
// fetched on demand (and never during SSR).
const MapView = lazy(() =>
  import("./MapView").then((m) => ({ default: m.MapView })),
);

function MapFallback() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-muted">
      <HeartbeatLoader className="size-14" label="Cargando mapa…" />
      <p className="text-xs font-medium text-muted-foreground tracking-wide">
        Cargando mapa…
      </p>
    </div>
  );
}

export function MapViewLazy(props: MapViewProps) {
  return (
    <Suspense fallback={<MapFallback />}>
      <MapView {...props} />
    </Suspense>
  );
}
