// Rate limiting for public API endpoints (`/api/*.json|geojson|csv`).
//
// Two-tier model (in-memory, per PM2 worker):
//   • Anonymous  → identified by client IP. Default 120 req/hour.
//   • API key    → identified by `X-API-Key` header. Quota comes from env
//                  `PUBLIC_API_KEYS` = "key1:600,key2:5000,partner-x:20000".
//                  Higher tier for identified consumers; abuse can be
//                  cut by removing the key from the env.
//
// This is NOT a global rate limiter — a multi-node deploy would need Redis
// or a DB-backed counter. In our single-VPS/PM2-fork setup it is enough to
// keep casual scrapers in line and to attribute traffic per API key.

export interface RateLimitResult {
  limited: boolean
  limit: number
  remaining: number
  resetAt: number // epoch seconds
  retryAfter: number // seconds until reset (only when limited)
  identity: string // "ip:1.2.3.4" | "key:xxxx"
  tier: 'anonymous' | 'api-key'
}

const WINDOW_MS = 60 * 60 * 1000
function anonLimit(): number {
  const raw = Number(process.env.PUBLIC_API_ANON_LIMIT ?? 120)
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 120
}

interface Bucket {
  count: number
  resetAt: number
  limit: number
}
const buckets = new Map<string, Bucket>()

let cachedKeys: Map<string, number> | null = null
function loadKeys(): Map<string, number> {
  if (cachedKeys) return cachedKeys
  const raw = process.env.PUBLIC_API_KEYS ?? ''
  const map = new Map<string, number>()
  for (const entry of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [key, quotaStr] = entry.split(':')
    if (!key) continue
    const q = Number(quotaStr)
    map.set(key, Number.isFinite(q) && q > 0 ? Math.floor(q) : 1000)
  }
  cachedKeys = map
  return map
}

// Test-only escape hatch.
export function _resetRateLimitForTests(): void {
  buckets.clear()
  cachedKeys = null
}

function getIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export function checkRateLimit(req: Request): RateLimitResult {
  const now = Date.now()
  const keyHeader = req.headers.get('x-api-key')?.trim()
  let identity: string
  let limit: number
  let tier: 'anonymous' | 'api-key'
  if (keyHeader) {
    const quota = loadKeys().get(keyHeader)
    if (quota) {
      identity = `key:${keyHeader.slice(0, 8)}`
      limit = quota
      tier = 'api-key'
    } else {
      // Unknown key → treat as anonymous, do not leak validity.
      identity = `ip:${getIp(req)}`
      limit = anonLimit()
      tier = 'anonymous'
    }
  } else {
    identity = `ip:${getIp(req)}`
    limit = anonLimit()
    tier = 'anonymous'
  }

  const b = buckets.get(identity)
  if (!b || now >= b.resetAt) {
    const resetAt = now + WINDOW_MS
    if (limit <= 0) {
      buckets.set(identity, { count: 0, resetAt, limit })
      return {
        limited: true,
        limit,
        remaining: 0,
        resetAt: Math.floor(resetAt / 1000),
        retryAfter: Math.ceil(WINDOW_MS / 1000),
        identity,
        tier,
      }
    }
    buckets.set(identity, { count: 1, resetAt, limit })
    return {
      limited: false,
      limit,
      remaining: limit - 1,
      resetAt: Math.floor(resetAt / 1000),
      retryAfter: 0,
      identity,
      tier,
    }
  }
  if (b.count >= b.limit) {
    return {
      limited: true,
      limit: b.limit,
      remaining: 0,
      resetAt: Math.floor(b.resetAt / 1000),
      retryAfter: Math.ceil((b.resetAt - now) / 1000),
      identity,
      tier,
    }
  }
  b.count++
  return {
    limited: false,
    limit: b.limit,
    remaining: b.limit - b.count,
    resetAt: Math.floor(b.resetAt / 1000),
    retryAfter: 0,
    identity,
    tier,
  }
}

export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  const h: Record<string, string> = {
    'X-RateLimit-Limit': String(r.limit),
    'X-RateLimit-Remaining': String(r.remaining),
    'X-RateLimit-Reset': String(r.resetAt),
    'X-RateLimit-Tier': r.tier,
  }
  if (r.limited) h['Retry-After'] = String(r.retryAfter)
  return h
}

/**
 * Guards a public API handler. Returns a 429 Response if rate-limited,
 * or a headers object to merge into the successful response.
 */
export function guardPublicApi(
  request: Request,
  format: 'json' | 'geojson' | 'csv' = 'json',
): { response: Response | null; headers: Record<string, string> } {
  const r = checkRateLimit(request)
  const headers = rateLimitHeaders(r)
  if (!r.limited) return { response: null, headers }
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  }
  if (format === 'csv') {
    return {
      response: new Response('error\n"rate_limited"', {
        status: 429,
        headers: { 'Content-Type': 'text/csv; charset=utf-8', ...CORS, ...headers },
      }),
      headers,
    }
  }
  const ct = format === 'geojson' ? 'application/geo+json' : 'application/json'
  return {
    response: new Response(
      JSON.stringify({
        error: 'rate_limited',
        message:
          r.tier === 'anonymous'
            ? 'Límite anónimo alcanzado. Solicita una API key para mayor cuota.'
            : 'Límite de tu API key alcanzado.',
        retry_after_seconds: r.retryAfter,
      }),
      {
        status: 429,
        headers: { 'Content-Type': `${ct}; charset=utf-8`, ...CORS, ...headers },
      },
    ),
    headers,
  }
}
