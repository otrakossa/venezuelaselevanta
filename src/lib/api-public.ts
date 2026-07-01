// Shared helpers for public API endpoints.
// All endpoints: CORS abierto, sin auth, sin PII, licencia CC BY 4.0.

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
  "Access-Control-Expose-Headers": "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-RateLimit-Tier, Retry-After, Link",
  "Access-Control-Max-Age": "86400",
};

export const JSON_CACHE = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

export const LICENSE = "https://creativecommons.org/licenses/by/4.0/";
export const SOURCE = "https://venezuelaselevanta.info";

export const DEFAULT_LIMIT = 500;
export const MAX_LIMIT = 5000;

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

/** Direct REST fetch to Supabase (no createClient — Node 20 sin WS). */
export async function supaFetch(
  pathAndQuery: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
): Promise<Record<string, unknown>[]> {
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_PUBLISHABLE_KEY");
  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init?.headers ?? {}),
    },
    signal: init?.signal,
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json() as Promise<Record<string, unknown>[]>;
}

/** Parses ?limit= and clamps. */
export function parseLimit(sp: URLSearchParams): number {
  const raw = Number(sp.get("limit") ?? DEFAULT_LIMIT);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(raw), MAX_LIMIT);
}

/** Cursor = base64("<createdAt>|<id>"). Forward-only over created_at DESC, id DESC. */
export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`).toString("base64url");
}
export function decodeCursor(c: string | null): { createdAt: string; id: string } | null {
  if (!c) return null;
  try {
    const [createdAt, id] = Buffer.from(c, "base64url").toString("utf8").split("|");
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/** Builds a PostgREST cursor filter for created_at DESC, id DESC ordering. */
export function cursorClause(c: { createdAt: string; id: string } | null): string {
  if (!c) return "";
  // (created_at, id) < (cursor) — PostgREST supports `or` for tuple comparison
  // older OR (same instant AND smaller id)
  return `&or=(created_at.lt.${encodeURIComponent(c.createdAt)},and(created_at.eq.${encodeURIComponent(
    c.createdAt,
  )},id.lt.${encodeURIComponent(c.id)}))`;
}

/** Build PostgREST query string with common filters from search params. */
export function commonFilters(
  sp: URLSearchParams,
  opts: { allow: Array<"state" | "municipality" | "parish" | "category" | "urgency" | "status" | "since" | "city"> },
): string {
  const parts: string[] = [];
  const eq = (col: string, v: string) => parts.push(`${col}=eq.${encodeURIComponent(v)}`);
  for (const k of opts.allow) {
    const v = sp.get(k);
    if (!v) continue;
    if (k === "since") {
      parts.push(`created_at=gte.${encodeURIComponent(v)}`);
    } else {
      eq(k, v);
    }
  }
  return parts.length ? `&${parts.join("&")}` : "";
}

/** Parse ?bbox=minLng,minLat,maxLng,maxLat. */
export function bboxClause(
  sp: URLSearchParams,
  latCol: string,
  lngCol: string,
): string {
  const raw = sp.get("bbox");
  if (!raw) return "";
  const parts = raw.split(",").map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return "";
  const [minLng, minLat, maxLng, maxLat] = parts;
  return `&${lngCol}=gte.${minLng}&${lngCol}=lte.${maxLng}&${latCol}=gte.${minLat}&${latCol}=lte.${maxLat}`;
}

/** Build standard metadata block. */
export function metadata(opts: {
  title: string;
  description: string;
  count: number;
  nextCursor?: string | null;
}) {
  return {
    generated: new Date().toISOString(),
    title: opts.title,
    description: opts.description,
    license: LICENSE,
    source: SOURCE,
    count: opts.count,
    next_cursor: opts.nextCursor ?? null,
  };
}

/** Pick next cursor from a result page given the page limit. */
export function nextCursorFromRows(
  rows: Array<Record<string, unknown>>,
  limit: number,
): string | null {
  if (rows.length < limit) return null;
  const last = rows[rows.length - 1];
  const createdAt = last.created_at as string | undefined;
  const id = last.id as string | undefined;
  if (!createdAt || !id) return null;
  return encodeCursor(createdAt, id);
}

/** CSV cell escaping. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return `"${v.join(", ").replace(/"/g, '""')}"`;
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
}

/** Build CSV with HXL tags row. */
export function buildCsv(headers: string[], hxl: string[], rows: unknown[][]): string {
  return [
    headers.join(","),
    hxl.join(","),
    ...rows.map((r) => r.map(csvCell).join(",")),
  ].join("\n");
}

export function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": JSON_CACHE,
      ...CORS,
      ...extraHeaders,
    },
  });
}

export function geojsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/geo+json; charset=utf-8",
      "Cache-Control": JSON_CACHE,
      ...CORS,
      ...extraHeaders,
    },
  });
}

export function csvResponse(body: string, filename: string) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": JSON_CACHE,
      ...CORS,
    },
  });
}

export function errorResponse(err: unknown, format: "json" | "csv" = "json") {
  const msg = err instanceof Error ? err.message : String(err);
  if (format === "csv") {
    return new Response(`error\n"${msg.replace(/"/g, '""')}"`, {
      status: 500,
      headers: { "Content-Type": "text/csv; charset=utf-8", ...CORS },
    });
  }
  return new Response(JSON.stringify({ error: msg }), {
    status: 500,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export function optionsHandler() {
  return new Response(null, { status: 204, headers: CORS });
}

/** Link header for cursor pagination. */
export function linkHeader(baseUrl: string, sp: URLSearchParams, nextCursor: string | null): Record<string, string> {
  if (!nextCursor) return {};
  const next = new URLSearchParams(sp);
  next.set("cursor", nextCursor);
  return { Link: `<${baseUrl}?${next.toString()}>; rel="next"` };
}
