import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { PRICES, comparePrices } = require("../app.js");

const cards = () => Array.from(document.querySelectorAll("#prices-results .card"));
const noResults = () => Array.from(document.querySelectorAll("#prices-results .no-results"));

// jsdom only reports a select value that matches an existing option,
// so each selection is added as an option first.
function compare(value) {
  const select = document.getElementById("service-select");
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = value;
  select.appendChild(opt);
  select.value = value;
  comparePrices();
}

beforeEach(() => {
  document.body.innerHTML =
    '<select id="service-select"><option value=""></option></select><div id="prices-results"></div>';
});

const services = [...new Set(PRICES.map((p) => p.service))];
const anyService = fc.oneof(
  fc.constantFrom(...services),
  fc.constantFrom(...services).map((s) => s.toUpperCase()),
  fc.constantFrom(...services).map((s) => s + " "),
  fc.string({ minLength: 1, maxLength: 30 })
);

describe("comparePrices properties", () => {
  // Feature: health-access-agent, Property 9: Price filter exactness
  // **Validates: Requirements 4.1**
  it("Property 9: rendered cards are exactly the entries whose service equals the selection", () => {
    fc.assert(
      fc.property(anyService, (service) => {
        compare(service);
        const expected = PRICES.filter((p) => p.service === service);
        const rendered = cards();
        expect(rendered.length).toBe(expected.length);
        rendered.forEach((card) => {
          expect(card.querySelector(".card-detail").textContent).toBe(service);
        });
      }),
      { numRuns: 100 }
    );
  });

  // Feature: health-access-agent, Property 10: Price card completeness
  // **Validates: Requirements 4.4**
  it("Property 10: each card shows provider, service, includes and $-formatted price", () => {
    fc.assert(
      fc.property(fc.constantFrom(...services), (service) => {
        compare(service);
        const expected = PRICES.filter((p) => p.service === service);
        const rendered = cards();
        expect(rendered.length).toBe(expected.length);
        rendered.forEach((card, i) => {
          const p = expected[i];
          expect(card.querySelector(".card-title").textContent).toBe(p.provider);
          expect(card.querySelector(".card-subtitle").textContent).toBe(p.includes);
          expect(card.querySelector(".card-detail").textContent).toBe(p.service);
          const badge = card.querySelector(".card-badge").textContent;
          expect(badge).toMatch(/^\$\d+\.\d{2}$/);
          expect(badge).toBe("$" + p.price.toFixed(2));
        });
      }),
      { numRuns: 100 }
    );
  });
});

describe("comparePrices unit tests", () => {
  it("prompts for a service and renders no cards when nothing is selected", () => {
    document.getElementById("service-select").value = "";
    comparePrices();
    expect(cards().length).toBe(0);
    expect(noResults().length).toBe(1);
    expect(noResults()[0].textContent).toBe("Selecciona un tipo de servicio.");
  });

  it("renders 'No se encontraron resultados.' when no entry matches the selected service", () => {
    compare("Servicio Inexistente");
    expect(cards().length).toBe(0);
    expect(noResults()[0].textContent).toBe("No se encontraron resultados.");
  });

  it("replaces previously rendered content with the new results", () => {
    compare("Consulta General");
    const first = cards().length;
    expect(first).toBe(PRICES.filter((p) => p.service === "Consulta General").length);

    compare("Radiografía");
    const titles = cards().map((c) => c.querySelector(".card-detail").textContent);
    expect(titles.length).toBe(PRICES.filter((p) => p.service === "Radiografía").length);
    expect(titles.every((t) => t === "Radiografía")).toBe(true);

    document.getElementById("service-select").value = "";
    comparePrices();
    expect(cards().length).toBe(0);
    expect(noResults().length).toBe(1);
  });
});
