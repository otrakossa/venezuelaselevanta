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
