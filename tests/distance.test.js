import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { distanceKm } = require("../app.js");

const lat = fc.double({ min: -90, max: 90, noNaN: true });
const lon = fc.double({ min: -180, max: 180, noNaN: true });

describe("distanceKm properties", () => {
  // Feature: health-access-agent, Property 1: Distance non-negativity
  // **Validates: Requirements 1.3**
  it("Property 1: returns a value >= 0 for any valid coordinates", () => {
    fc.assert(
      fc.property(lat, lon, lat, lon, (a, b, c, d) => {
        expect(distanceKm(a, b, c, d)).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: health-access-agent, Property 2: Distance identity
  // **Validates: Requirements 1.2**
  it("Property 2: distance from a point to itself is exactly 0", () => {
    fc.assert(
      fc.property(lat, lon, (a, b) => {
        expect(distanceKm(a, b, a, b)).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: health-access-agent, Property 3: Distance symmetry
  // **Validates: Requirements 1.4**
  it("Property 3: distance is symmetric", () => {
    fc.assert(
      fc.property(lat, lon, lat, lon, (a, b, c, d) => {
        expect(distanceKm(a, b, c, d)).toBeCloseTo(distanceKm(c, d, a, b), 9);
      }),
      { numRuns: 100 }
    );
  });
});

describe("distanceKm unit tests", () => {
  it("matches a known reference distance within 0.5% (Madrid-Barcelona ~504.6 km)", () => {
    const d = distanceKm(40.4168, -3.7038, 41.3874, 2.1686);
    const expected = 504.6;
    expect(Math.abs(d - expected) / expected).toBeLessThanOrEqual(0.005);
  });

  it("antipodal points are at most 20,037 km apart", () => {
    const d = distanceKm(0, 0, 0, 180);
    expect(d).toBeGreaterThan(20000);
    expect(d).toBeLessThanOrEqual(20037);
    expect(distanceKm(90, 0, -90, 0)).toBeLessThanOrEqual(20037);
  });

  it("throws on non-finite or non-number arguments", () => {
    expect(() => distanceKm(NaN, 0, 0, 0)).toThrow();
    expect(() => distanceKm(0, Infinity, 0, 0)).toThrow();
    expect(() => distanceKm("1", 0, 0, 0)).toThrow();
    expect(() => distanceKm(0, 0, undefined, 0)).toThrow();
    expect(() => distanceKm(0, 0, 0, null)).toThrow();
  });

  it("throws on out-of-range arguments", () => {
    expect(() => distanceKm(91, 0, 0, 0)).toThrow();
    expect(() => distanceKm(0, -181, 0, 0)).toThrow();
    expect(() => distanceKm(0, 0, -90.1, 0)).toThrow();
    expect(() => distanceKm(0, 0, 0, 180.1)).toThrow();
  });
});
