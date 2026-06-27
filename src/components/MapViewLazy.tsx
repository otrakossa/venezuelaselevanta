import { lazy, Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import type { MapViewProps } from "./MapView";

// Lazily load the Leaflet-heavy MapView so the initial JS bundle stays small.
// This ensures react-leaflet, leaflet and react-leaflet-cluster are only
// fetched on demand (and never during SSR).
const MapView = lazy(() =>
  import("./MapView").then((m) => ({ default: m.MapView })),
);

function MapFallback() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-muted">
      <AlertTriangle className="h-8 w-8 text-[color:var(--sunrise)] animate-pulse" />
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
