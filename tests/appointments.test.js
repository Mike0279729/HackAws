import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { APPOINTMENTS, searchAppointments, addDaysISO } = require("../app.js");

const original = APPOINTMENTS.slice();

const cards = () => Array.from(document.querySelectorAll("#appointments-results .card"));
const noResults = () => Array.from(document.querySelectorAll("#appointments-results .no-results"));

// jsdom only reports a select value that matches an existing option.
function search(value) {
  const select = document.getElementById("specialty-select");
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = value;
  select.appendChild(opt);
  select.value = value;
  searchAppointments();
}

function setCatalog(slots) {
  APPOINTMENTS.splice(0, APPOINTMENTS.length, ...slots);
}

beforeEach(() => {
  document.body.innerHTML =
    '<select id="specialty-select"><option value=""></option></select><div id="appointments-results"></div>';
});

afterEach(() => {
  vi.restoreAllMocks();
  setCatalog(original);
});

const specialtyArb = fc.constantFrom("Cardiología", "Pediatría", "Dermatología", "Neurología");
const slotArb = fc.record({
  specialty: specialtyArb,
  doctor: fc.string({ minLength: 1, maxLength: 20 }),
  date: fc
    .date({ min: new Date("2025-01-01"), max: new Date("2030-12-31"), noInvalidDate: true })
    .map((d) => d.toISOString().slice(0, 10)),
  time: fc
    .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
    .map(([h, m]) => String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0")),
  available: fc.boolean()
});
const catalogArb = fc.array(slotArb, { maxLength: 15 });

describe("searchAppointments properties", () => {
  // Feature: health-access-agent, Property 11: Available-only appointment filter
  // **Validates: Requirements 5.1, 5.5**
  it("Property 11: never renders a card for an unavailable slot", () => {
    fc.assert(
      fc.property(catalogArb, specialtyArb, (catalog, specialty) => {
        setCatalog(catalog);
        search(specialty);
        const expected = catalog.filter((a) => a.specialty === specialty && a.available);
        const rendered = cards();
        expect(rendered.length).toBe(expected.length);
        rendered.forEach((card) => {
          expect(card.querySelector(".card-badge").textContent).toBe("Disponible");
        });
        // Every rendered (doctor, detail) pair must come from an available slot.
        const availablePairs = expected.map((a) => a.doctor + "|" + a.date + " a las " + a.time);
        rendered.forEach((card, i) => {
          const pair = card.querySelector(".card-title").textContent + "|" + card.querySelector(".card-detail").textContent;
          expect(pair).toBe(availablePairs[i]);
        });
      }),
      { numRuns: 100 }
    );
  });

  // Feature: health-access-agent, Property 12: Appointment card completeness
  // **Validates: Requirements 5.4**
  it("Property 12: each card shows doctor, specialty, ISO date and HH:MM time", () => {
    fc.assert(
      fc.property(catalogArb, specialtyArb, (catalog, specialty) => {
        setCatalog(catalog);
        search(specialty);
        const expected = catalog.filter((a) => a.specialty === specialty && a.available);
        const rendered = cards();
        expect(rendered.length).toBe(expected.length);
        rendered.forEach((card, i) => {
          const a = expected[i];
          expect(card.querySelector(".card-title").textContent).toBe(a.doctor);
          expect(card.querySelector(".card-subtitle").textContent).toBe(a.specialty);
          const detail = card.querySelector(".card-detail").textContent;
          expect(detail).toMatch(/^\d{4}-\d{2}-\d{2} a las ([01]\d|2[0-3]):[0-5]\d$/);
          expect(detail).toBe(a.date + " a las " + a.time);
        });
      }),
      { numRuns: 100 }
    );
  });
});

describe("searchAppointments unit tests", () => {
  it("prompts for a specialty and renders no cards when nothing is selected", () => {
    document.getElementById("specialty-select").value = "";
    searchAppointments();
    expect(cards().length).toBe(0);
    expect(noResults().length).toBe(1);
    expect(noResults()[0].textContent).toBe("Selecciona una especialidad.");
  });

  it("renders 'No se encontraron resultados.' when every slot of the specialty is taken", () => {
    setCatalog([
      { specialty: "Cardiología", doctor: "Dr. A", date: addDaysISO(new Date(), 3), time: "09:00", available: false },
      { specialty: "Cardiología", doctor: "Dr. B", date: addDaysISO(new Date(), 4), time: "10:00", available: false },
      { specialty: "Pediatría", doctor: "Dra. C", date: addDaysISO(new Date(), 5), time: "11:00", available: true }
    ]);
    search("Cardiología");
    expect(cards().length).toBe(0);
    expect(noResults()[0].textContent).toBe("No se encontraron resultados.");
  });

  it("renders only available slots from the real catalog", () => {
    search("Dermatología");
    expect(cards().length).toBe(1);
    expect(cards()[0].querySelector(".card-title").textContent).toBe("Dr. Jorge Paredes");
  });

  it("renders an error message and no cards when the data source fails", () => {
    vi.spyOn(APPOINTMENTS, "filter").mockImplementation(() => {
      throw new Error("data unavailable");
    });
    search("Cardiología");
    expect(cards().length).toBe(0);
    expect(noResults().length).toBe(1);
    expect(noResults()[0].textContent).toBe("No se pudieron cargar las citas.");
  });
});

const isoToday = () => {
  const t = new Date();
  return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
};

describe("addDaysISO and dynamic dates", () => {
  // Feature: health-access-agent, Property 29: addDaysISO yields a valid later ISO date
  // **Validates: Requirements 16.1, 16.2, 16.5**
  it("Property 29: addDaysISO yields a valid ISO date exactly n days later", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2000-01-01T12:00:00"), max: new Date("2100-12-31T12:00:00"), noInvalidDate: true }),
        fc.integer({ min: 1, max: 365 }),
        (base, n) => {
          const out = addDaysISO(base, n);
          expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          const [y, m, d] = out.split("-").map(Number);
          const result = new Date(y, m - 1, d);
          // Round-trips to a real calendar date.
          expect(result.getFullYear()).toBe(y);
          expect(result.getMonth()).toBe(m - 1);
          expect(result.getDate()).toBe(d);
          const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
          const expected = new Date(start.getFullYear(), start.getMonth(), start.getDate() + n);
          expect(result.getTime()).toBe(expected.getTime());
          expect(out > addDaysISO(base, 0)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("addDaysISO handles month and year boundaries and leap days", () => {
    expect(addDaysISO(new Date(2024, 0, 31), 1)).toBe("2024-02-01");
    expect(addDaysISO(new Date(2024, 1, 28), 1)).toBe("2024-02-29");
    expect(addDaysISO(new Date(2023, 1, 28), 1)).toBe("2023-03-01");
    expect(addDaysISO(new Date(2023, 11, 31), 1)).toBe("2024-01-01");
    expect(addDaysISO(new Date(2023, 5, 10), 0)).toBe("2023-06-10");
  });

  // Feature: health-access-agent, Property 30: Every appointment date is after today
  // **Validates: Requirements 16.3, 16.4, 16.6**
  it("Property 30: every APPOINTMENTS date is a valid ISO date strictly after today", () => {
    const today = isoToday();
    expect(original.length).toBeGreaterThan(0);
    for (const a of original) {
      expect(a.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.date > today).toBe(true);
      expect(a.date <= addDaysISO(new Date(), 30)).toBe(true);
    }
    expect(original.some((a) => a.available)).toBe(true);
    expect(original.some((a) => !a.available)).toBe(true);
    expect(new Set(original.map((a) => a.specialty)).size).toBeGreaterThanOrEqual(2);
  });
});
