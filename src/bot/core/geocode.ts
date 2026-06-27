// ── Geocoding (Nominatim / OpenStreetMap) + bounding box de Venezuela ──────
export const VE_MIN_LAT = -1;
export const VE_MAX_LAT = 14;
export const VE_MIN_LNG = -74;
export const VE_MAX_LNG = -59;

export async function geocodeText(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(`${address}, Venezuela`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ve`,
      { headers: { "User-Agent": "VenezuelaSeLevanta/1.0 (venezuelaselevanta.info)" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}
