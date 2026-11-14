import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { APPOINTMENTS, nextAvailableAppointment, initials, renderFeaturedAppointment, renderResults } =
  require("../app.js");

const slotArb = fc.record({
  doctor: fc.string(),
  specialty: fc.string(),
  date: fc.constantFrom("2030-01-01", "2030-01-02", "2030-02-10"),
  time: fc.constantFrom("08:00", "09:30", "14:00"),
  available: fc.boolean(),
});

describe("nextAvailableAppointment", () => {
  // Feature: health-access-agent, Property 32: nextAvailableAppointment returns the earliest available slot
  // **Validates: Requirements 17.11, 17.13, 17.14**
  it("Property 32: returns the earliest available slot or null", () => {
    fc.assert(
      fc.property(fc.array(slotArb), (slots) => {
        const r = nextAvailableAppointment(slots);
        const avail = slots.filter((s) => s.available === true);
        if (avail.length === 0) return r === null;
        const key = (s) => s.date + "T" + s.time;
        return slots.includes(r) && r.available === true && avail.every((s) => key(r) <= key(s));
      }),
      { numRuns: 100 }
    );
  });
  it("returns null for empty or non-array input", () => {
    expect(nextAvailableAppointment([])).toBeNull();
    expect(nextAvailableAppointment(null)).toBeNull();
  });
});

describe("initials", () => {
  // Feature: health-access-agent, Property 33: initials is a non-empty uppercase string
  // **Validates: Requirements 17.12, 17.13**
  it("Property 33: non-blank strings give 1-2 uppercase chars; blank or non-string gives ?", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const r = initials(s);
        if (s.trim() === "") return r === "?";
        const n = Array.from(r).length;
        return n >= 1 && n <= 2 && r === r.toUpperCase();
      }),
      { numRuns: 100 }
    );
    for (const v of [null, undefined, 5, {}, "   "]) expect(initials(v)).toBe("?");
  });
  it("uses the first letters of the first two words", () => {
    expect(initials("ana maría pérez")).toBe("AM");
    expect(initials("Luis")).toBe("L");
  });
});

describe("renderFeaturedAppointment", () => {
  const original = APPOINTMENTS.slice();
  beforeEach(() => {
    APPOINTMENTS.splice(0, APPOINTMENTS.length, ...original);
    document.body.innerHTML = '<div id="featured-appointment" class="featured-card" hidden></div>';
  });

  it("shows the earliest available slot", () => {
    APPOINTMENTS.splice(0, APPOINTMENTS.length,
      { doctor: "Zoe <b>X</b>", specialty: "Cardiología", date: "2030-01-02", time: "09:00", available: true },
      { doctor: "Ana Gil", specialty: "Pediatría", date: "2030-01-01", time: "10:00", available: false });
    renderFeaturedAppointment();
    const el = document.getElementById("featured-appointment");
    expect(el.hidden).toBe(false);
    expect(el.textContent).toContain("Zoe <b>X</b>");
    expect(el.querySelector("b")).toBeNull();
    expect(el.querySelector(".featured-avatar").textContent).toBe("Z<");
  });

  it("hides the card when no slot is available", () => {
    APPOINTMENTS.splice(0, APPOINTMENTS.length,
      { doctor: "A", specialty: "B", date: "2030-01-01", time: "10:00", available: false });
    renderFeaturedAppointment();
    expect(document.getElementById("featured-appointment").hidden).toBe(true);
  });
});

describe("renderResults icon", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="out"></div>';
  });
  // Feature: health-access-agent, Property 34: Renderer output is unchanged when no icon is given, and shows the icon when given
  // **Validates: Requirements 17.18, 17.19, 17.27**
  it("Property 34: no icon gives no avatar; icon gives exactly one escaped avatar", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string(), (icon, title) => {
        renderResults("out", [{ title }]);
        const without = document.getElementById("out").innerHTML;
        const noAvatar = document.querySelectorAll("#out .card-avatar").length === 0;
        renderResults("out", [{ title, icon }]);
        const avatars = document.querySelectorAll("#out .card-avatar");
        const stripped = document.getElementById("out").innerHTML.replace(/<span class="card-avatar"[^>]*>[\s\S]*?<\/span>/, "");
        return noAvatar && avatars.length === 1 && avatars[0].textContent === icon && stripped === without;
      }),
      { numRuns: 100 }
    );
  });
  it("escapes HTML in the icon", () => {
    renderResults("out", [{ title: "t", icon: "<i>x</i>" }]);
    expect(document.querySelector("#out .card-avatar i")).toBeNull();
    expect(document.querySelector("#out .card-avatar").textContent).toBe("<i>x</i>");
  });
});
