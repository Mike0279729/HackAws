import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { MEDICATIONS, searchMedications } = require("../app.js");

const container = () => document.getElementById("medications-results");
const cards = () => Array.from(document.querySelectorAll("#medications-results .card"));
const noResults = () => Array.from(document.querySelectorAll("#medications-results .no-results"));

function search(value) {
  document.getElementById("medication-input").value = value;
  searchMedications();
}

beforeEach(() => {
  document.body.innerHTML =
    '<input id="medication-input" /><div id="medications-results"></div>';
});

// Queries: random text, or a random substring of a catalog name with random casing.
const substringQuery = fc
  .tuple(
    fc.constantFrom(...MEDICATIONS.map((m) => m.name)),
    fc.nat(20),
    fc.integer({ min: 1, max: 8 }),
    fc.boolean()
  )
  .map(([name, start, len, upper]) => {
    const s = name.substr(start % name.length, len);
    return upper ? s.toUpperCase() : s.toLowerCase();
  });
const anyQuery = fc.oneof(substringQuery, fc.string({ minLength: 1, maxLength: 30 }));

describe("searchMedications properties", () => {
  // Feature: health-access-agent, Property 6: Case-insensitive medication search
  // **Validates: Requirements 3.1**
  it("Property 6: every card name contains the query case-insensitively, and all matches render", () => {
    fc.assert(
      fc.property(anyQuery, (q) => {
        const norm = q.trim().toLowerCase();
        fc.pre(norm !== "");
        search(q);
        const titles = cards().map((c) => c.querySelector(".card-title").textContent.toLowerCase());
        for (const t of titles) expect(t).toContain(norm);
        const expected = MEDICATIONS.filter((m) => m.name.toLowerCase().includes(norm)).length;
        expect(titles.length).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: health-access-agent, Property 7: Whitespace query guard
  // **Validates: Requirements 3.2**
  it("Property 7: whitespace-only queries render a prompt and zero cards", () => {
    const ws = fc
      .array(fc.constantFrom(" ", "\t", "\n", "\r", "\u00a0", "\u2003"), { maxLength: 50 })
      .map((a) => a.join(""));
    fc.assert(
      fc.property(ws, (q) => {
        search(q);
        expect(cards().length).toBe(0);
        expect(noResults().length).toBe(1);
        expect(noResults()[0].textContent.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: health-access-agent, Property 8: Medication card completeness
  // **Validates: Requirements 3.4**
  it("Property 8: each card shows name, pharmacy, status and $-formatted price", () => {
    fc.assert(
      fc.property(substringQuery, (q) => {
        const norm = q.trim().toLowerCase();
        // A whitespace-only substring (e.g. " " from "Vitamina C") is a blank query, not a match-all.
        fc.pre(norm !== "");
        search(q);
        const rendered = cards();
        const expected = MEDICATIONS.filter((m) => m.name.toLowerCase().includes(norm));
        expect(rendered.length).toBe(expected.length);
        rendered.forEach((card, i) => {
          const m = expected[i];
          expect(card.querySelector(".card-title").textContent).toBe(m.name);
          expect(card.querySelector(".card-subtitle").textContent).toBe(m.pharmacy);
          expect(card.querySelector(".card-badge").textContent).toBe(m.status);
          const detail = card.querySelector(".card-detail").textContent;
          expect(detail).toMatch(/^\$\d+\.\d{2}$/);
          expect(detail).toBe("$" + m.price.toFixed(2));
        });
      }),
      { numRuns: 100 }
    );
  });
});

describe("searchMedications unit tests", () => {
  it("renders 'No se encontraron resultados.' when nothing matches", () => {
    search("zzz-not-a-medication");
    expect(cards().length).toBe(0);
    expect(noResults()[0].textContent).toBe("No se encontraron resultados.");
  });

  it("rejects queries over 200 characters with a too-long error and no cards", () => {
    search("a".repeat(201));
    expect(cards().length).toBe(0);
    expect(noResults()[0].textContent.toLowerCase()).toContain("demasiado larga");
  });

  it("accepts a query of exactly 200 characters (no too-long error)", () => {
    search("a".repeat(200));
    expect(container().textContent.toLowerCase()).not.toContain("demasiado larga");
  });

  it("renders a data-retrieval error and no cards when the data source fails", () => {
    // A malformed entry makes the filter throw, simulating a failing data source.
    MEDICATIONS.push({ name: null, pharmacy: "x", status: "En stock", price: 1 });
    try {
      expect(() => search("ibuprofeno")).not.toThrow();
      expect(cards().length).toBe(0);
      expect(noResults()[0].textContent.toLowerCase()).toContain("no se pudieron obtener");
    } finally {
      MEDICATIONS.pop();
    }
  });
});
