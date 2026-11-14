import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { renderResults } = require("../app.js");

const item = fc.record({
  title: fc.string(),
  subtitle: fc.string(),
  badge: fc.string(),
  detail: fc.string()
});

beforeEach(() => {
  document.body.innerHTML = '<div id="x"></div>';
});

describe("renderResults properties", () => {
  // Feature: health-access-agent, Property 13: Renderer card count
  // **Validates: Requirements 6.1**
  it("Property 13: renders exactly N .card elements for N >= 1 items", () => {
    fc.assert(
      fc.property(fc.array(item, { minLength: 1, maxLength: 20 }), (items) => {
        renderResults("x", items);
        expect(document.getElementById("x").querySelectorAll(".card").length).toBe(items.length);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: health-access-agent, Property 14: Renderer idempotence
  // **Validates: Requirements 6.3**
  it("Property 14: calling twice with same arguments gives identical DOM", () => {
    fc.assert(
      fc.property(fc.array(item, { maxLength: 20 }), (items) => {
        renderResults("x", items);
        const first = document.getElementById("x").innerHTML;
        renderResults("x", items);
        expect(document.getElementById("x").innerHTML).toBe(first);
      }),
      { numRuns: 100 }
    );
  });
});

describe("renderResults unit tests", () => {
  it("empty array gives one .no-results and no cards", () => {
    renderResults("x", []);
    const c = document.getElementById("x");
    expect(c.querySelectorAll(".no-results").length).toBe(1);
    expect(c.querySelectorAll(".card").length).toBe(0);
  });

  it("N items then M items leaves M cards", () => {
    const mk = (n) => Array.from({ length: n }, (_, i) => ({ title: "t" + i, subtitle: "s", badge: "b", detail: "d" }));
    renderResults("x", mk(5));
    renderResults("x", mk(2));
    expect(document.querySelectorAll("#x .card").length).toBe(2);
  });

  it("missing container throws and leaves the DOM unchanged", () => {
    const before = document.body.innerHTML;
    expect(() => renderResults("missing", [{ title: "a" }])).toThrow();
    expect(document.body.innerHTML).toBe(before);
  });

  it("missing title renders an empty title", () => {
    renderResults("x", [{ subtitle: "s", badge: "b", detail: "d" }]);
    const title = document.querySelector("#x .card-title");
    expect(title).not.toBeNull();
    expect(title.textContent).toBe("");
  });
});
