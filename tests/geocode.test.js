import { describe, it, expect, vi, afterEach } from "vitest";
import fc from "fast-check";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { geocodeAddress } = require("../app.js");

const BASE = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=";

function okResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("geocodeAddress properties", () => {
  // Feature: health-access-agent, Property 22: Geocoder input guard
  // **Validates: Requirements 12.4, 12.5**
  it("Property 22: blank or over-long input fails without calling fetch", async () => {
    const blank = fc.array(fc.constantFrom(" ", "\t", "\n", "\u00a0"), { maxLength: 20 }).map((a) => a.join(""));
    const tooLong = fc.string({ minLength: 201, maxLength: 400 }).filter((s) => s.trim().length > 200);
    await fc.assert(
      fc.asyncProperty(fc.oneof(blank.map((s) => ({ s, r: "empty" })), tooLong.map((s) => ({ s, r: "too-long" }))), async ({ s, r }) => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const res = await geocodeAddress(s);
        expect(res).toEqual({ ok: false, reason: r });
        expect(fetchMock).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });

  // Feature: health-access-agent, Property 23: Geocoder request encoding
  // **Validates: Requirements 12.2**
  it("Property 23: request URL is the base plus encodeURIComponent(trimmed query)", async () => {
    const special = fc.stringOf(fc.oneof(fc.constantFrom("&", "#", "?", "%", " ", "é", "ñ", "中", "="), fc.char()), { minLength: 1, maxLength: 200 });
    await fc.assert(
      fc.asyncProperty(special.filter((s) => {
        const t = s.trim();
        return t.length >= 1 && t.length <= 200;
      }), async (s) => {
        const trimmed = s.trim();
        const fetchMock = vi.fn().mockResolvedValue(okResponse([]));
        vi.stubGlobal("fetch", fetchMock);
        await geocodeAddress(s);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const url = fetchMock.mock.calls[0][0];
        expect(url).toBe(BASE + encodeURIComponent(trimmed));
        expect(decodeURIComponent(new URL(url).search.split("&q=")[1])).toBe(trimmed);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: health-access-agent, Property 24: Geocoder never throws and classifies outcomes
  // **Validates: Requirements 12.3, 12.6, 12.7, 12.8**
  it("Property 24: never throws and classifies every fetch outcome", async () => {
    const validLat = fc.double({ min: -90, max: 90, noNaN: true });
    const validLon = fc.double({ min: -180, max: 180, noNaN: true });
    const junk = fc.constantFrom("abc", "NaN", "Infinity", "", null, undefined);
    const badLatNum = fc.oneof(fc.double({ min: 90.0001, max: 1e6, noNaN: true }), junk);
    const badLonNum = fc.oneof(fc.double({ min: 180.0001, max: 1e6, noNaN: true }), junk);
    const outcome = fc.oneof(
      fc.tuple(validLat, validLon).map(([a, b]) => ({ kind: "valid", a, b })),
      fc.constant({ kind: "empty" }),
      fc.constantFrom({ kind: "nonarray" }, { kind: "nonarray2" }),
      badLatNum.map((a) => ({ kind: "badlat", a })),
      badLonNum.map((b) => ({ kind: "badlon", b })),
      fc.integer({ min: 400, max: 599 }).map((status) => ({ kind: "status", status })),
      fc.constant({ kind: "reject" }),
      fc.constant({ kind: "abort" })
    );
    await fc.assert(
      fc.asyncProperty(outcome, async (o) => {
        let fetchMock;
        let expected;
        switch (o.kind) {
          case "valid":
            fetchMock = vi.fn().mockResolvedValue(okResponse([{ lat: String(o.a), lon: String(o.b) }]));
            expected = { ok: true, lat: Number(String(o.a)), lon: Number(String(o.b)) };
            break;
          case "empty":
            fetchMock = vi.fn().mockResolvedValue(okResponse([]));
            expected = { ok: false, reason: "not-found" };
            break;
          case "nonarray":
            fetchMock = vi.fn().mockResolvedValue(okResponse({ lat: "1", lon: "2" }));
            expected = { ok: false, reason: "not-found" };
            break;
          case "nonarray2":
            fetchMock = vi.fn().mockResolvedValue(okResponse(null));
            expected = { ok: false, reason: "not-found" };
            break;
          case "badlat":
            fetchMock = vi.fn().mockResolvedValue(okResponse([{ lat: o.a, lon: "10" }]));
            expected = { ok: false, reason: "not-found" };
            break;
          case "badlon":
            fetchMock = vi.fn().mockResolvedValue(okResponse([{ lat: "10", lon: o.b }]));
            expected = { ok: false, reason: "not-found" };
            break;
          case "status":
            fetchMock = vi.fn().mockResolvedValue({ ok: false, status: o.status, json: async () => [] });
            expected = { ok: false, reason: "network" };
            break;
          case "reject":
            fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
            expected = { ok: false, reason: "network" };
            break;
          case "abort":
            fetchMock = vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
            expected = { ok: false, reason: "timeout" };
            break;
        }
        vi.stubGlobal("fetch", fetchMock);
        const res = await geocodeAddress("Mexico City");
        expect(res).toEqual(expected);
        if (res.ok) {
          expect(Number.isFinite(res.lat) && Math.abs(res.lat) <= 90).toBe(true);
          expect(Number.isFinite(res.lon) && Math.abs(res.lon) <= 180).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe("geocodeAddress unit tests", () => {
  it("returns timeout after 10000 ms when fetch never resolves", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    let result;
    const p = geocodeAddress("Mexico City").then((r) => { result = r; });
    await vi.advanceTimersByTimeAsync(9999);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(result).toEqual({ ok: false, reason: "timeout" });
  });
});
