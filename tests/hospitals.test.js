import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { CENTERS, distanceKm, nearbyHospitals } = require("../app.js");

function mockGeolocation(impl) {
  Object.defineProperty(navigator, "geolocation", {
    value: { getCurrentPosition: impl },
    configurable: true
  });
}

function mockPosition(latitude, longitude) {
  mockGeolocation((success) => success({ coords: { latitude, longitude } }));
}

const cards = () => Array.from(document.querySelectorAll("#hospitals-results .card"));
const text = (el, sel) => el.querySelector(sel).textContent;

// Resolves once nearbyHospitals/findHospitalsFrom has replaced the placeholders.
async function settled() {
  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 0));
    const el = document.getElementById("hospitals-results");
    if (el && el.innerHTML !== "" && !el.querySelector(".placeholder")) return;
  }
  throw new Error("hospitals-results never settled");
}

async function locate() {
  nearbyHospitals();
  await settled();
}

beforeEach(() => {
  document.body.innerHTML = '<div id="hospitals-results"></div>';
  // Overpass fails, so findHospitalsFrom falls back to the local CENTERS catalog.
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network down"))));
});

afterEach(() => {
  delete navigator.geolocation;
  vi.unstubAllGlobals();
});

const coords = fc.record({
  lat: fc.double({ min: -90, max: 90, noNaN: true }),
  lon: fc.double({ min: -180, max: 180, noNaN: true })
});

describe("nearbyHospitals properties", () => {
  // Feature: health-access-agent, Property 4: Top-3 bound and sort order
  // **Validates: Requirements 2.2, 2.3**
  it("Property 4: at most 3 cards, nearest first, ascending distance", async () => {
    await fc.assert(
      fc.asyncProperty(coords, async ({ lat, lon }) => {
        mockPosition(lat, lon);
        await locate();
        const rendered = cards();
        expect(rendered.length).toBe(Math.min(3, CENTERS.length));

        const expected = CENTERS
          .map((c) => ({ c, d: distanceKm(lat, lon, c.lat, c.lon) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, rendered.length);
        const names = rendered.map((el) => text(el, ".card-title"));
        const kms = rendered.map((el) => parseFloat(text(el, ".card-badge")));
        for (let i = 1; i < kms.length; i++) {
          expect(kms[i]).toBeGreaterThanOrEqual(kms[i - 1]);
        }
        // Compare by distance (names may tie at equal distances)
        kms.forEach((km, i) => expect(km).toBe(Number(expected[i].d.toFixed(1))));
        expect(names.every((n) => CENTERS.some((c) => c.name === n))).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: health-access-agent, Property 5: Hospital card completeness
  // **Validates: Requirements 2.4, 2.5**
  it("Property 5: each card shows name, type, address, distance (1 decimal) and phone", async () => {
    await fc.assert(
      fc.asyncProperty(coords, async ({ lat, lon }) => {
        mockPosition(lat, lon);
        await locate();
        for (const el of cards()) {
          const title = text(el, ".card-title");
          const center = CENTERS.find((c) => c.name === title);
          expect(center).toBeDefined();
          const subtitle = text(el, ".card-subtitle");
          expect(subtitle).toContain(center.type);
          expect(subtitle).toContain(center.address);
          expect(text(el, ".card-badge")).toMatch(/^\d+\.\d km$/);
          expect(text(el, ".card-detail")).toBe(center.phone);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe("nearbyHospitals unit tests", () => {
  it("renders a permission-denied message and no cards on error code 1", () => {
    mockGeolocation((_ok, fail) => fail({ code: 1 }));
    expect(() => nearbyHospitals()).not.toThrow();
    expect(cards().length).toBe(0);
    expect(document.querySelector("#hospitals-results .no-results").textContent).toMatch(/denegado/i);
  });

  it("renders a timeout message on error code 3", () => {
    mockGeolocation((_ok, fail) => fail({ code: 3 }));
    nearbyHospitals();
    expect(document.querySelector("#hospitals-results .no-results").textContent).toMatch(/se agotó el tiempo/i);
  });

  it("requests a 10-second timeout", () => {
    let opts;
    mockGeolocation((_ok, _fail, o) => { opts = o; });
    nearbyHospitals();
    expect(opts.timeout).toBe(10000);
  });

  it("keeps previously rendered cards when an error occurs", async () => {
    mockPosition(19.4, -99.15);
    await locate();
    const before = cards().length;
    expect(before).toBeGreaterThan(0);
    mockGeolocation((_ok, fail) => fail({ code: 1 }));
    nearbyHospitals();
    expect(cards().length).toBe(before);
    expect(document.querySelector("#hospitals-results .no-results")).not.toBeNull();
  });

  it("renders a message and does not throw when geolocation is missing", () => {
    expect(navigator.geolocation).toBeUndefined();
    expect(() => nearbyHospitals()).not.toThrow();
    expect(document.querySelector("#hospitals-results .no-results")).not.toBeNull();
  });

  it("renders a 'no medical centers' message for an empty catalog", async () => {
    const saved = CENTERS.splice(0, CENTERS.length);
    try {
      mockPosition(19.4, -99.15);
      await locate();
      expect(cards().length).toBe(0);
      expect(document.querySelector("#hospitals-results .no-results").textContent).toMatch(/no hay centros médicos/i);
    } finally {
      CENTERS.push(...saved);
    }
  });

  it("renders all entries when the catalog has fewer than 3 centers", async () => {
    const saved = CENTERS.splice(0, CENTERS.length, ...CENTERS.slice(0, 2));
    try {
      mockPosition(19.4, -99.15);
      await locate();
      expect(cards().length).toBe(2);
    } finally {
      CENTERS.splice(0, CENTERS.length, ...saved);
    }
  });
});
