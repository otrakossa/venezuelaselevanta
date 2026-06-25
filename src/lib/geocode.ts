/**
 * Reverse-geocode lat/lng to a human-readable address using Nominatim.
 * Nominatim's free endpoint requires a meaningful User-Agent / Referer; the
 * browser already sends Referer with our domain, which satisfies their policy.
 * Returns null on any failure — caller falls back to coordinates.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", lat.toFixed(6));
    url.searchParams.set("lon", lng.toFixed(6));
    url.searchParams.set("zoom", "16");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "es");
    const res = await fetch(url.toString(), {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data?.address ?? {};
    // Build a friendly Venezuelan-style address: road + suburb + city + state
    const parts = [
      [a.road, a.house_number].filter(Boolean).join(" "),
      a.neighbourhood || a.suburb || a.village || a.hamlet,
      a.city || a.town || a.municipality,
      a.state,
    ].filter((p) => p && String(p).trim().length > 0);
    if (parts.length > 0) return parts.join(", ");
    return data?.display_name ?? null;
  } catch {
    return null;
  }
}

/**
 * Forward geocode an address string to lat/lng via Nominatim.
 * Biases results to Venezuela. Returns null on failure.
 */
export async function geocodeAddress(
  address: string,
  signal?: AbortSignal,
): Promise<{ lat: number; lng: number; display: string } | null> {
  try {
    const q = address.trim();
    if (!q) return null;
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", q);
    url.searchParams.set("countrycodes", "ve");
    url.searchParams.set("limit", "1");
    url.searchParams.set("accept-language", "es");
    const res = await fetch(url.toString(), {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    if (!hit) return null;
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng, display: hit.display_name ?? q };
  } catch {
    return null;
  }
}
