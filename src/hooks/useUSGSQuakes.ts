import { useQuery } from "@tanstack/react-query";

export interface USGSQuake {
  id: string;
  mag: number;
  place: string;
  time: number;
  depth: number;
  url: string;
  lat: number;
  lng: number;
}

const USGS_URL =
  "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=1&maxlatitude=13&minlongitude=-74&maxlongitude=-59&minmagnitude=2.5&orderby=time&limit=100";

interface UsgsFeature {
  id: string;
  properties: { mag: number; place: string; time: number; url: string };
  geometry: { coordinates: [number, number, number] };
}

async function fetchQuakes(): Promise<USGSQuake[]> {
  const res = await fetch(USGS_URL);
  if (!res.ok) throw new Error(`USGS ${res.status}`);
  const data = (await res.json()) as { features: UsgsFeature[] };
  return data.features
    .filter((f) => f.geometry?.coordinates && typeof f.properties?.mag === "number")
    .map((f) => ({
      id: f.id,
      mag: f.properties.mag,
      place: f.properties.place,
      time: f.properties.time,
      depth: f.geometry.coordinates[2],
      url: f.properties.url,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }));
}

export function useUSGSQuakes(enabled = true) {
  return useQuery({
    queryKey: ["usgs-quakes"],
    queryFn: fetchQuakes,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function quakeColor(mag: number): string {
  if (mag < 4.0) return "#FFC93C";
  if (mag < 5.5) return "#FF6B35";
  return "#DC2626";
}
