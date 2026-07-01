// ── Rate limiting: guardPublicApi() ────────────────────────────────────────
// Pure in-memory limiter (per PM2 worker). Tests reset state between cases.
import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  guardPublicApi,
  _resetRateLimitForTests,
} from "@/lib/api-rate-limit";

function req(headers: Record<string, string> = {}, ip = "1.2.3.4"): Request {
  return new Request("http://localhost/api/test.json", {
    headers: { "x-forwarded-for": ip, ...headers },
  });
}

beforeEach(() => {
  _resetRateLimitForTests();
  delete process.env.PUBLIC_API_KEYS;
  delete process.env.PUBLIC_API_ANON_LIMIT;
});

describe("api-rate-limit", () => {
  it("clasifica requests anónimos por IP y devuelve headers X-RateLimit-*", () => {
    process.env.PUBLIC_API_ANON_LIMIT = "3";
    _resetRateLimitForTests();
    const r = checkRateLimit(req());
    expect(r.limited).toBe(false);
    expect(r.tier).toBe("anonymous");
    expect(r.limit).toBe(3);
    expect(r.remaining).toBe(2);
    expect(r.identity).toBe("ip:1.2.3.4");
  });

  it("bloquea con 429 al superar la cuota anónima", () => {
    process.env.PUBLIC_API_ANON_LIMIT = "2";
    _resetRateLimitForTests();
    guardPublicApi(req());
    guardPublicApi(req());
    const g = guardPublicApi(req());
    expect(g.response).not.toBeNull();
    expect(g.response!.status).toBe(429);
    expect(g.response!.headers.get("Retry-After")).toBeTruthy();
    expect(g.response!.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("aísla IPs distintas en buckets separados", () => {
    process.env.PUBLIC_API_ANON_LIMIT = "1";
    _resetRateLimitForTests();
    expect(guardPublicApi(req({}, "1.1.1.1")).response).toBeNull();
    expect(guardPublicApi(req({}, "2.2.2.2")).response).toBeNull();
    expect(guardPublicApi(req({}, "1.1.1.1")).response?.status).toBe(429);
  });

  it("promueve a tier api-key con cuota elevada cuando X-API-Key es válida", () => {
    process.env.PUBLIC_API_KEYS = "abc123:500,partner-x:5000";
    process.env.PUBLIC_API_ANON_LIMIT = "1";
    _resetRateLimitForTests();
    const r = checkRateLimit(req({ "x-api-key": "abc123" }));
    expect(r.tier).toBe("api-key");
    expect(r.limit).toBe(500);
    expect(r.identity.startsWith("key:")).toBe(true);
  });

  it("trata una API key desconocida como anónima (no filtra validez)", () => {
    process.env.PUBLIC_API_KEYS = "abc123:500";
    process.env.PUBLIC_API_ANON_LIMIT = "10";
    _resetRateLimitForTests();
    const r = checkRateLimit(req({ "x-api-key": "no-existe" }));
    expect(r.tier).toBe("anonymous");
    expect(r.limit).toBe(10);
  });

  it("responde CSV cuando format=csv", () => {
    process.env.PUBLIC_API_ANON_LIMIT = "0";
    _resetRateLimitForTests();
    const g = guardPublicApi(req(), "csv");
    expect(g.response!.status).toBe(429);
    expect(g.response!.headers.get("Content-Type")).toContain("text/csv");
  });
});
