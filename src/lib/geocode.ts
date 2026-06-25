/**
 * Nominatim geocoding with cache, throttle, retry and clear errors.
 * Free Nominatim policy: max 1 req/s, identify your app, cache results.
 *  - https://operations.osmfoundation.org/policies/nominatim/
 */

type CacheEntry<T> = { value: T | null; at: number };

const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const NEG_TTL_MS = 5 * 60 * 1000;   // 5m for nulls
const MAX_LS_ENTRIES = 200;
const LS_REVERSE_KEY = "vsl-geo-rev-cache";
const LS_FORWARD_KEY = "vsl-geo-fwd-cache";

const memReverse = new Map<string, CacheEntry<string>>();
const memForward = new Map<string, CacheEntry<{ lat: number; lng: number; display: string }>>();

function loadLS<T>(key: string): Map<string, CacheEntry<T>> {
  if (typeof localStorage === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, CacheEntry<T>>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function saveLS<T>(key: string, map: Map<string, CacheEntry<T>>) {
  if (typeof localStorage === "undefined") return;
  try {
    // Cap size
    if (map.size > MAX_LS_ENTRIES) {
      const sorted = [...map.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, MAX_LS_ENTRIES);
      map = new Map(sorted);
    }
    localStorage.setItem(key, JSON.stringify(Object.fromEntries(map)));
  } catch {
    /* quota */
  }
}

let lsLoaded = false;
function ensureLSLoaded() {
  if (lsLoaded) return;
  lsLoaded = true;
  for (const [k, v] of loadLS<string>(LS_REVERSE_KEY)) memReverse.set(k, v);
  for (const [k, v] of loadLS<{ lat: number; lng: number; display: string }>(LS_FORWARD_KEY))
    memForward.set(k, v);
}

function fromCache<T>(map: Map<string, CacheEntry<T>>, key: string): T | null | undefined {
  ensureLSLoaded();
  const hit = map.get(key);
  if (!hit) return undefined;
  const ttl = hit.value == null ? NEG_TTL_MS : TTL_MS;
  if (Date.now() - hit.at > ttl) {
    map.delete(key);
    return undefined;
  }
  return hit.value;
}

function setCache<T>(map: Map<string, CacheEntry<T>>, lsKey: string, key: string, value: T | null) {
  map.set(key, { value, at: Date.now() });
  saveLS(lsKey, map);
}

// ---- Throttle: serial queue with min 1.1s between requests ----
let chain: Promise<unknown> = Promise.resolve();
let lastCall = 0;
const MIN_GAP_MS = 1100;

function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = Math.max(0, lastCall + MIN_GAP_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  };
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next as Promise<T>;
}

async function fetchWithRetry(url: string, signal?: AbortSignal): Promise<Response | null> {
  let attempt = 0;
  // up to 3 attempts on 429/503 with backoff
  while (attempt < 3) {
    try {
      const res = await fetch(url, {
        signal,
        headers: {
          Accept: "application/json",
          // Browser also sends Referer — both satisfy Nominatim policy.
          "Accept-Language": "es",
        },
      });
      if (res.ok) return res;
      if (res.status === 429 || res.status === 503) {
        attempt++;
        const backoff = 1500 * attempt;
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      return res;
    } catch (e) {
      if ((e as Error).name === "AbortError") return null;
      attempt++;
      if (attempt >= 3) return null;
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  return null;
}

/**
 * Reverse-geocode lat/lng to a human-readable address.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = fromCache(memReverse, key);
  if (cached !== undefined) return cached;

  return throttle(async () => {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", lat.toFixed(6));
    url.searchParams.set("lon", lng.toFixed(6));
    url.searchParams.set("zoom", "16");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "es");
    const res = await fetchWithRetry(url.toString(), signal);
    if (!res || !res.ok) {
      setCache(memReverse, LS_REVERSE_KEY, key, null);
      return null;
    }
    try {
      const data = await res.json();
      const a = data?.address ?? {};
      const parts = [
        [a.road, a.house_number].filter(Boolean).join(" "),
        a.neighbourhood || a.suburb || a.village || a.hamlet,
        a.city || a.town || a.municipality,
        a.state,
      ].filter((p) => p && String(p).trim().length > 0);
      const value = parts.length > 0 ? parts.join(", ") : (data?.display_name ?? null);
      setCache(memReverse, LS_REVERSE_KEY, key, value);
      return value;
    } catch {
      setCache(memReverse, LS_REVERSE_KEY, key, null);
      return null;
    }
  });
}

/**
 * Forward geocode an address string to lat/lng. Biased to Venezuela.
 */
export async function geocodeAddress(
  address: string,
  signal?: AbortSignal,
): Promise<{ lat: number; lng: number; display: string } | null> {
  const q = address.trim();
  if (!q) return null;
  const key = q.toLowerCase();
  const cached = fromCache(memForward, key);
  if (cached !== undefined) return cached;

  return throttle(async () => {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", q);
    url.searchParams.set("countrycodes", "ve");
    url.searchParams.set("limit", "1");
    url.searchParams.set("accept-language", "es");
    const res = await fetchWithRetry(url.toString(), signal);
    if (!res || !res.ok) {
      setCache(memForward, LS_FORWARD_KEY, key, null);
      return null;
    }
    try {
      const data = await res.json();
      const hit = Array.isArray(data) ? data[0] : null;
      if (!hit) {
        setCache(memForward, LS_FORWARD_KEY, key, null);
        return null;
      }
      const lat = parseFloat(hit.lat);
      const lng = parseFloat(hit.lon);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        setCache(memForward, LS_FORWARD_KEY, key, null);
        return null;
      }
      const value = { lat, lng, display: hit.display_name ?? q };
      setCache(memForward, LS_FORWARD_KEY, key, value);
      return value;
    } catch {
      setCache(memForward, LS_FORWARD_KEY, key, null);
      return null;
    }
  });
}
