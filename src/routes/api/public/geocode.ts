import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-side Nominatim proxy with aggressive HTTP caching.
 *
 * Why this exists:
 *  - Browser-side calls to nominatim.openstreetmap.org are rate-limited
 *    (1 req/s/IP) and have no shared cache across users.
 *  - By proxying through our origin and emitting long-lived
 *    `Cache-Control` headers, nginx/CDN (and the browser's HTTP cache)
 *    serve identical lookups instantly without ever hitting Nominatim.
 *
 *  Usage:
 *    GET /api/public/geocode?reverse=1&lat=10.5&lng=-66.9
 *    GET /api/public/geocode?q=Plaza+Bolivar+Caracas
 *
 *  Notes:
 *   - Pure passthrough on shape: returns Nominatim JSON unchanged.
 *   - We do not store anything server-side; cache is HTTP only.
 *   - Errors are returned with `no-store` so clients don't pin failures.
 */

const VE_BOUNDS = { minLat: -1, maxLat: 14, minLng: -74, maxLng: -59 };

function jsonResponse(body: unknown, status: number, cacheable: boolean) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheable
        ? // 24h client + 7d CDN with SWR
          "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
        : "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

async function callNominatim(url: URL, signal: AbortSignal): Promise<Response | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        signal,
        headers: {
          Accept: "application/json",
          "Accept-Language": "es",
          "User-Agent": "VenezuelaSeLevanta/1.0 (+https://venezuelaselevanta.info)",
        },
      });
      if (res.ok) return res;
      if (res.status === 429 || res.status === 503) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (e) {
      if ((e as Error).name === "AbortError") return null;
      if (attempt === 2) return null;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return null;
}

export const Route = createFileRoute("/api/public/geocode")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const isReverse = u.searchParams.get("reverse") === "1";
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);

        try {
          if (isReverse) {
            const lat = parseFloat(u.searchParams.get("lat") ?? "");
            const lng = parseFloat(u.searchParams.get("lng") ?? "");
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              return jsonResponse({ error: "lat/lng required" }, 400, false);
            }
            if (
              lat < VE_BOUNDS.minLat || lat > VE_BOUNDS.maxLat ||
              lng < VE_BOUNDS.minLng || lng > VE_BOUNDS.maxLng
            ) {
              return jsonResponse({ error: "outside Venezuela bounds" }, 400, false);
            }
            const url = new URL("https://nominatim.openstreetmap.org/reverse");
            url.searchParams.set("format", "jsonv2");
            url.searchParams.set("lat", lat.toFixed(6));
            url.searchParams.set("lon", lng.toFixed(6));
            url.searchParams.set("zoom", "16");
            url.searchParams.set("addressdetails", "1");
            url.searchParams.set("accept-language", "es");
            const res = await callNominatim(url, ctrl.signal);
            if (!res || !res.ok) return jsonResponse({ error: "upstream unavailable" }, 502, false);
            const data = await res.json();
            return jsonResponse(data, 200, true);
          }

          const q = (u.searchParams.get("q") ?? "").trim();
          if (!q || q.length < 3 || q.length > 200) {
            return jsonResponse({ error: "q required (3..200 chars)" }, 400, false);
          }
          const url = new URL("https://nominatim.openstreetmap.org/search");
          url.searchParams.set("format", "jsonv2");
          url.searchParams.set("q", q);
          url.searchParams.set("countrycodes", "ve");
          url.searchParams.set("limit", "1");
          url.searchParams.set("accept-language", "es");
          const res = await callNominatim(url, ctrl.signal);
          if (!res || !res.ok) return jsonResponse({ error: "upstream unavailable" }, 502, false);
          const data = await res.json();
          return jsonResponse(data, 200, true);
        } finally {
          clearTimeout(t);
        }
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, OPTIONS",
            "access-control-allow-headers": "content-type",
            "access-control-max-age": "86400",
          },
        }),
    },
  },
});
