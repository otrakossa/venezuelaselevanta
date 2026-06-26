import { useEffect, useState } from "react";

export type HealthCenter = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
};

let cache: HealthCenter[] | null = null;
let inflight: Promise<HealthCenter[]> | null = null;

async function fetchAll(): Promise<HealthCenter[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  inflight = fetch(
    `${url}/rest/v1/health_centers?select=id,name,city,state&order=name.asc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  )
    .then((r) => {
      if (!r.ok) throw new Error(`health_centers ${r.status}`);
      return r.json() as Promise<HealthCenter[]>;
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

export function useHealthCenters() {
  const [centers, setCenters] = useState<HealthCenter[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    fetchAll()
      .then((rows) => alive && (setCenters(rows), setLoading(false)))
      .catch((e) => alive && (setError(String(e?.message ?? e)), setLoading(false)));
    return () => {
      alive = false;
    };
  }, []);

  return { centers, loading, error };
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}
