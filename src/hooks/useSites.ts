import { useEffect, useState } from "react";

export type Site = {
  id: string;
  name: string;
  type: string;
  lat: number | null;
  lng: number | null;
  state: string | null;
  municipality: string | null;
  parish: string | null;
};

export const SITE_TYPES = [
  { value: "hospital", label: "🏥 Hospital" },
  { value: "acopio", label: "📦 Centro de acopio" },
  { value: "rescate", label: "🚨 Punto de rescate" },
  { value: "salud", label: "🩺 Centro de salud" },
  { value: "otro", label: "📍 Otro punto" },
];

const TYPE_LABEL: Record<string, string> = {
  hospital: "Hospital",
  acopio: "Centro de acopio",
  rescate: "Punto de rescate",
  salud: "Centro de salud",
  otro: "Punto",
};
export const siteTypeLabel = (t: string): string => TYPE_LABEL[t] ?? "Punto";

let cache: Site[] | null = null;
let inflight: Promise<Site[]> | null = null;

export function invalidateSitesCache(): void {
  cache = null;
}

async function fetchAll(): Promise<Site[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  inflight = fetch(
    `${url}/rest/v1/sites?select=id,name,type,lat,lng,state,municipality,parish&order=name.asc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  )
    .then((r) => {
      if (!r.ok) throw new Error(`sites ${r.status}`);
      return r.json() as Promise<Site[]>;
    })
    .then((rows) => {
      cache = rows;
      inflight = null;
      return rows;
    })
    .catch((e) => {
      inflight = null;
      throw e;
    });
  return inflight;
}

export function useSites() {
  const [sites, setSites] = useState<Site[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchAll()
      .then((rows) => alive && (setSites(rows), setLoading(false)))
      .catch((e) => alive && (setError(String(e?.message ?? e)), setLoading(false)));
    return () => {
      alive = false;
    };
  }, []);

  return { sites, loading, error };
}
