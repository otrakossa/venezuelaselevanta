// ── Utilidades de api-public: parseLimit, cursor, bbox, CSV, metadata ──────
import { describe, it, expect } from "vitest";
import {
  parseLimit,
  encodeCursor,
  decodeCursor,
  cursorClause,
  bboxClause,
  commonFilters,
  buildCsv,
  csvCell,
  nextCursorFromRows,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "@/lib/api-public";

describe("api-public helpers", () => {
  it("parseLimit clampea a [1, MAX_LIMIT] y usa default", () => {
    expect(parseLimit(new URLSearchParams())).toBe(DEFAULT_LIMIT);
    expect(parseLimit(new URLSearchParams("limit=abc"))).toBe(DEFAULT_LIMIT);
    expect(parseLimit(new URLSearchParams("limit=-5"))).toBe(DEFAULT_LIMIT);
    expect(parseLimit(new URLSearchParams("limit=50"))).toBe(50);
    expect(parseLimit(new URLSearchParams(`limit=${MAX_LIMIT * 10}`))).toBe(MAX_LIMIT);
  });

  it("encodeCursor/decodeCursor es reversible", () => {
    const c = encodeCursor("2026-07-01T00:00:00Z", "abc-123");
    const d = decodeCursor(c);
    expect(d).toEqual({ createdAt: "2026-07-01T00:00:00Z", id: "abc-123" });
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor("###not-base64###")).toBeNull();
  });

  it("cursorClause genera un filtro PostgREST tuple-comparison", () => {
    const cl = cursorClause({ createdAt: "2026-01-01T00:00:00Z", id: "aaa" });
    expect(cl).toContain("or=");
    expect(cl).toContain("created_at.lt.");
    expect(cl).toContain("id.lt.aaa");
    expect(cursorClause(null)).toBe("");
  });

  it("bboxClause valida 4 números y descarta malformados", () => {
    const good = bboxClause(new URLSearchParams("bbox=-74,-1,-59,14"), "lat", "lng");
    expect(good).toContain("lng=gte.-74");
    expect(good).toContain("lat=lte.14");
    expect(bboxClause(new URLSearchParams("bbox=1,2,3"), "lat", "lng")).toBe("");
    expect(bboxClause(new URLSearchParams("bbox=a,b,c,d"), "lat", "lng")).toBe("");
    expect(bboxClause(new URLSearchParams(), "lat", "lng")).toBe("");
  });

  it("commonFilters sólo emite las claves permitidas y trata 'since' como gte", () => {
    const sp = new URLSearchParams("state=Miranda&urgency=critical&hack=1&since=2026-01-01");
    const out = commonFilters(sp, { allow: ["state", "urgency", "since"] });
    expect(out).toContain("state=eq.Miranda");
    expect(out).toContain("urgency=eq.critical");
    expect(out).toContain("created_at=gte.2026-01-01");
    expect(out).not.toContain("hack");
  });

  it("csvCell escapa comillas y buildCsv incluye header + HXL", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""');
    const csv = buildCsv(["id", "n"], ["#id", "#name"], [[1, "Ana"], [2, 'B"b']]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("id,n");
    expect(lines[1]).toBe("#id,#name");
    expect(lines[2]).toBe('"1","Ana"');
    expect(lines[3]).toBe('"2","B""b"');
  });

  it("nextCursorFromRows es null cuando la página no está llena", () => {
    expect(nextCursorFromRows([{ id: "a", created_at: "x" }], 10)).toBeNull();
    const c = nextCursorFromRows(
      Array.from({ length: 3 }, (_, i) => ({ id: `id${i}`, created_at: `t${i}` })),
      3,
    );
    expect(c).toBeTruthy();
    expect(decodeCursor(c!)).toEqual({ createdAt: "t2", id: "id2" });
  });
});
