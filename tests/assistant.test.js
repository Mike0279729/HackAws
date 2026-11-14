import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve } from "path";

const require = createRequire(import.meta.url);
const app = require("../app.js");
const {
  MEDICATIONS, PRICES, APPOINTMENTS, addDaysISO, normalizeText, interpretMessage, assistantReply,
  appendMessage, openAssistant, handleAssistantSubmit, initAssistant, EMERGENCY_KEYWORDS, SYMPTOM_SPECIALTIES,
} = app;

const html = readFileSync(resolve(__dirname, "../index.html"), "utf8");
const RUNS = { numRuns: 100 };
const INTENTS = ["emergency", "hospitals", "medication", "prices", "appointments", "greeting", "thanks", "help", "unknown", "empty", "too_long"];
const ACTIONS = ["hospitals", "medication", "prices", "appointments"];

// Any kind of string: ASCII, full unicode, and keyword-flavoured text.
const anyString = fc.oneof(
  fc.string(),
  fc.fullUnicodeString(),
  fc.constantFrom("hola", "gracias", "ayuda", "busco ibuprofeno", "cita cardiología", "precio radiografía", "hospital cerca", "dolor de pecho", "<b>x</b>")
);

// Random letter case driven by an integer seed.
function mixCase(s, seed) {
  return Array.from(s).map((ch, i) => ((seed >> (i % 30)) & 1 ? ch.toUpperCase() : ch.toLowerCase())).join("");
}
const stripMarks = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const unique = (arr) => Array.from(new Set(arr));
const SPECIALTIES = unique(APPOINTMENTS.map((a) => a.specialty));
const SERVICES = unique(PRICES.map((p) => p.service));
const MED_NAMES = unique(MEDICATIONS.map((m) => m.name));

function withCatalog(catalog, items, fn) {
  const original = catalog.slice();
  try {
    catalog.splice(0, catalog.length, ...items);
    return fn();
  } finally {
    catalog.splice(0, catalog.length, ...original);
  }
}

// ---------------------------------------------------------------------------
// Pure logic
// ---------------------------------------------------------------------------

describe("assistant pure logic: properties", () => {
  // Feature: health-access-agent, Property 35: Emergency priority
  // **Validates: Requirements 18.23, 18.38**
  it("Property 35: emergency keywords win over any other text", () => {
    const variants = [...EMERGENCY_KEYWORDS, "convulsión", "dolor de pecho", "URGENCIA"];
    fc.assert(
      fc.property(
        fc.constantFrom(...variants),
        fc.integer({ min: 0, max: 2 ** 30 }),
        fc.string({ maxLength: 80 }),
        fc.string({ maxLength: 80 }),
        fc.constantFrom("", "hospital cerca", "busco ibuprofeno", "precio radiografía", "cita cardiología", "hola gracias"),
        (kw, seed, before, after, other) => {
          const msg = before + " " + mixCase(kw, seed) + " " + other + " " + after;
          expect(interpretMessage(msg).intent).toBe("emergency");
          const r = assistantReply(msg);
          expect(r.text).toMatch(/emergencia/);
          expect(r.text).toMatch(/llama/);
          expect(r.actions.some((a) => a.label === "Buscar hospitales cerca de mí")).toBe(true);
        }
      ),
      RUNS
    );
  });

  // Feature: health-access-agent, Property 36: interpretMessage is total and returns a known intent
  // **Validates: Requirements 18.20, 18.21, 18.22, 18.30**
  it("Property 36: never throws and returns a known intent with params object", () => {
    fc.assert(
      fc.property(fc.oneof(anyString, fc.anything(), fc.string({ minLength: 290, maxLength: 400 })), (v) => {
        const r = interpretMessage(v);
        expect(INTENTS).toContain(r.intent);
        expect(r.params !== null && typeof r.params === "object").toBe(true);
        if (typeof v !== "string") expect(r.intent).toBe("empty");
        else if (v.trim() === "") expect(r.intent).toBe("empty");
        else if (v.trim().length > 300) expect(r.intent).toBe("too_long");
      }),
      RUNS
    );
  });

  // Feature: health-access-agent, Property 37: normalizeText is idempotent and strips diacritics
  // **Validates: Requirements 18.19**
  it("Property 37: idempotent, no marks, no uppercase, trimmed, single spaces", () => {
    fc.assert(
      fc.property(anyString, (s) => {
        const r = normalizeText(s);
        expect(normalizeText(r)).toBe(r);
        expect(/[\u0300-\u036f]/.test(r)).toBe(false);
        expect(r).toBe(r.toLowerCase());
        expect(r).toBe(r.trim());
        expect(/\s{2,}/.test(r)).toBe(false);
      }),
      RUNS
    );
    expect(normalizeText(42)).toBe("");
  });

  // Feature: health-access-agent, Property 38: Catalog params are exact catalog values
  // **Validates: Requirements 18.25, 18.26, 18.27, 18.29**
  it("Property 38: catalog names give the exact catalog value", () => {
    const cases = [
      ...SPECIALTIES.map((v) => ["appointments", "specialty", v]),
      ...SERVICES.map((v) => ["prices", "service", v]),
      ...MED_NAMES.map((v) => ["medication", "query", v]),
    ];
    fc.assert(
      fc.property(fc.constantFrom(...cases), fc.integer({ min: 0, max: 2 ** 30 }), fc.boolean(), (c, seed, strip) => {
        const [intent, key, value] = c;
        const msg = mixCase(strip ? stripMarks(value) : value, seed);
        const r = interpretMessage(msg);
        expect(r.intent).toBe(intent);
        expect(r.params[key]).toBe(value);
      }),
      RUNS
    );
  });

  it("Property 38: an extracted query word is a substring of the normalised message", () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(..."qxzkjw"), { minLength: 1, maxLength: 8 }), (chars) => {
        const msg = "Busco " + chars.join("");
        const r = interpretMessage(msg);
        expect(r.intent).toBe("medication");
        expect(normalizeText(msg)).toContain(r.params.query);
        expect(r.params.query).toBe(chars.join(""));
      }),
      RUNS
    );
    fc.assert(
      fc.property(anyString, (s) => {
        const r = interpretMessage(s);
        if (r.intent === "medication") {
          expect(MED_NAMES.includes(r.params.query) || normalizeText(s).includes(r.params.query)).toBe(true);
        }
      }),
      RUNS
    );
  });

  // Feature: health-access-agent, Property 39: Symptom words map to a specialty
  // **Validates: Requirements 18.28, 18.29**
  it("Property 39: symptom words map to their specialty", () => {
    const words = [...Object.keys(SYMPTOM_SPECIALTIES).map((w) => (w === "nino" ? "niño" : w)), "corazón", "bebé"];
    fc.assert(
      fc.property(
        fc.constantFrom(...words),
        fc.integer({ min: 0, max: 2 ** 30 }),
        fc.boolean(),
        fc.constantFrom("tengo", "mi", "con", "problemas", "en la", "el", "y"),
        (w, seed, strip, filler) => {
          const msg = filler + " " + mixCase(strip ? stripMarks(w) : w, seed);
          const r = interpretMessage(msg);
          expect(r.intent).toBe("appointments");
          expect(r.params.specialty).toBe(SYMPTOM_SPECIALTIES[normalizeText(w)]);
        }
      ),
      RUNS
    );
  });

  // Feature: health-access-agent, Property 40: Medication reply lists only matching names, at most 3
  // **Validates: Requirements 18.32**
  it("Property 40: medication replies list at most 3 matching entries with exact prices", () => {
    const firstWords = MED_NAMES.map((n) => normalizeText(n).split(" ")[0]);
    const sub = fc.constantFrom(...firstWords).chain((w) =>
      fc.tuple(fc.integer({ min: 0, max: w.length - 1 }), fc.integer({ min: 1, max: w.length })).map(([a, b]) => w.slice(Math.min(a, b - 1), b))
    );
    const letters = fc.array(fc.constantFrom(..."qxzkjw"), { minLength: 1, maxLength: 8 }).map((c) => c.join(""));
    fc.assert(
      fc.property(fc.oneof(sub, letters), (word) => {
        const msg = "busco " + word;
        const q = interpretMessage(msg).params.query;
        const reply = assistantReply(msg);
        const entries = reply.text.split("\n").filter((l) => /^.+ en .+: .+, \$\d+\.\d{2}$/.test(l));
        expect(entries.length).toBeLessThanOrEqual(3);
        const nq = normalizeText(q);
        const expected = nq === "" ? [] : MEDICATIONS.filter((m) => normalizeText(m.name).includes(nq));
        expect(entries.length).toBe(Math.min(3, expected.length));
        for (const line of entries) {
          const hit = MEDICATIONS.find((m) => line === m.name + " en " + m.pharmacy + ": " + m.status + ", $" + m.price.toFixed(2));
          expect(hit, line).toBeDefined();
          expect(normalizeText(hit.name)).toContain(nq);
        }
        if (expected.length === 0 && nq !== "") expect(reply.text).toMatch(/No encontré/);
      }),
      RUNS
    );
  });

  // Feature: health-access-agent, Property 41: Prices reply is sorted ascending with the cheapest marked
  // **Validates: Requirements 18.33**
  it("Property 41: providers sorted by ascending price, only the first marked", () => {
    const entry = fc.record({ service: fc.constantFrom(...SERVICES), cents: fc.integer({ min: 1, max: 500000 }) });
    fc.assert(
      fc.property(fc.array(entry, { maxLength: 12 }), fc.constantFrom(...SERVICES), fc.integer({ min: 0, max: 2 ** 30 }), (rows, service, seed) => {
        fc.pre(rows.some((r) => r.service === service));
        const catalog = rows.map((r, i) => ({ service: r.service, provider: "Prov" + i, price: r.cents / 100, includes: "x" }));
        withCatalog(PRICES, catalog, () => {
          const reply = assistantReply("precio " + mixCase(service, seed));
          const lines = reply.text.split("\n").map((l) => /^(Prov\d+): \$(\d+\.\d{2})( \(más económico\))?$/.exec(l)).filter(Boolean);
          const expected = catalog.filter((c) => c.service === service);
          expect(lines.map((m) => m[1]).sort()).toEqual(expected.map((c) => c.provider).sort());
          const prices = lines.map((m) => Number(m[2]));
          for (let i = 1; i < prices.length; i++) expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
          lines.forEach((m) => {
            const c = expected.find((e) => e.provider === m[1]);
            expect(m[2]).toBe(c.price.toFixed(2));
          });
          lines.forEach((m, i) => expect(Boolean(m[3])).toBe(i === 0));
        });
      }),
      RUNS
    );
  });

  // Feature: health-access-agent, Property 42: Appointments reply contains only available future slots
  // **Validates: Requirements 18.35**
  it("Property 42: at most 3 earliest available future slots of the specialty", () => {
    const slot = fc.record({
      specialty: fc.constantFrom(...SPECIALTIES),
      offset: fc.integer({ min: 1, max: 60 }),
      time: fc.constantFrom("08:00", "09:30", "12:00", "16:45"),
      available: fc.boolean(),
    });
    const today = addDaysISO(new Date(), 0);
    fc.assert(
      fc.property(fc.array(slot, { maxLength: 12 }), fc.constantFrom(...SPECIALTIES), (rows, specialty) => {
        fc.pre(rows.some((r) => r.specialty === specialty));
        const catalog = rows.map((r, i) => ({
          specialty: r.specialty, doctor: "Doc" + i, date: addDaysISO(new Date(), r.offset), time: r.time, available: r.available,
        }));
        withCatalog(APPOINTMENTS, catalog, () => {
          const reply = assistantReply("quiero una cita de " + specialty);
          const lines = reply.text.split("\n").map((l) => /^(Doc\d+): (\d{4}-\d{2}-\d{2}) a las (\d{2}:\d{2})$/.exec(l)).filter(Boolean);
          const eligible = catalog
            .filter((c) => c.specialty === specialty && c.available)
            .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
          expect(lines.length).toBe(Math.min(3, eligible.length));
          lines.forEach((m) => {
            const c = catalog.find((e) => e.doctor === m[1]);
            expect(c.available && c.specialty === specialty).toBe(true);
            expect(m[2] > today).toBe(true);
          });
          const keys = lines.map((m) => m[2] + m[3]);
          expect(keys).toEqual(eligible.slice(0, 3).map((c) => c.date + c.time));
          if (eligible.length === 0) expect(reply.text).toMatch(/No hay citas disponibles/);
        });
      }),
      RUNS
    );
  });

  // Feature: health-access-agent, Property 43: assistantReply is pure with respect to the network and well-formed
  // **Validates: Requirements 18.31, 18.39**
  it("Property 43: well-formed replies and zero fetch calls", () => {
    const original = globalThis.fetch;
    const spy = vi.fn();
    globalThis.fetch = spy;
    try {
      fc.assert(
        fc.property(fc.oneof(anyString, fc.string({ minLength: 290, maxLength: 400 })), (s) => {
          const r = assistantReply(s);
          expect(typeof r.text).toBe("string");
          expect(r.text.length).toBeGreaterThan(0);
          expect(Array.isArray(r.actions)).toBe(true);
          for (const a of r.actions) {
            expect(typeof a.label).toBe("string");
            expect(a.label.length).toBeGreaterThan(0);
            expect(ACTIONS).toContain(a.action);
          }
        }),
        RUNS
      );
      expect(spy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = original;
    }
  });
});

// ---------------------------------------------------------------------------
// Unit tests for each intent
// ---------------------------------------------------------------------------

describe("interpretMessage and assistantReply: examples", () => {
  it("detects emergencies", () => {
    expect(interpretMessage("tengo dolor de pecho").intent).toBe("emergency");
    const r = assistantReply("tengo dolor de pecho");
    expect(r.text.startsWith("⚠️")).toBe(true);
    expect(r.actions).toEqual([{ label: "Buscar hospitales cerca de mí", action: "hospitals" }]);
  });

  it("handles a medication search with prices", () => {
    expect(interpretMessage("busco ibuprofeno")).toEqual({ intent: "medication", params: { query: "Ibuprofeno 400mg" } });
    const r = assistantReply("busco ibuprofeno");
    expect(r.text).toContain("Ibuprofeno 400mg en Farmacia del Ahorro: En stock, $45.50");
    expect(r.actions).toEqual([{ label: "Ver en Medicamentos", action: "medication", value: "Ibuprofeno 400mg" }]);
  });

  it("states when a medication is not found", () => {
    const r = assistantReply("busco zzzz");
    expect(r.text).toMatch(/No encontré «zzzz»/);
    expect(r.actions).toEqual([]);
  });

  it("compares prices for a service", () => {
    expect(interpretMessage("cuanto cuesta una radiografia").params.service).toBe("Radiografía");
    const r = assistantReply("cuanto cuesta una radiografia");
    const lines = r.text.split("\n");
    expect(lines[0]).toBe("Hospital General de México: $350.00 (más económico)");
    expect(lines[1]).toBe("Clínica Roma Norte: $600.00");
    expect(r.actions[0]).toMatchObject({ label: "Ver en Precios", action: "prices", value: "Radiografía" });
  });

  it("asks for the service when none is detected", () => {
    const r = assistantReply("comparar precios");
    expect(r.text).toMatch(/¿Qué servicio quieres comparar\?/);
    for (const s of SERVICES) expect(r.text).toContain(s);
  });

  it("finds appointments by specialty", () => {
    expect(interpretMessage("quiero una cita de cardiologia").params.specialty).toBe("Cardiología");
    const r = assistantReply("quiero una cita de cardiologia");
    expect(r.text).toContain("Dra. Laura Méndez");
    expect(r.text).not.toContain("Ricardo Salas: " + APPOINTMENTS[1].date);
    expect(r.actions[0]).toMatchObject({ action: "appointments", value: "Cardiología" });
  });

  it("asks for the specialty when none is detected", () => {
    const r = assistantReply("quiero una cita");
    expect(r.text).toBe("¿Qué especialidad necesitas?");
  });

  it("maps a symptom sentence to an appointments intent", () => {
    const r = interpretMessage("mi hijo tiene sarpullido");
    expect(r.intent).toBe("appointments");
    expect(["Dermatología", "Pediatría"]).toContain(r.params.specialty);
  });

  it("handles hospitals, greeting, thanks, help and unknown", () => {
    expect(interpretMessage("hospital cerca").intent).toBe("hospitals");
    expect(assistantReply("hospital cerca").text).toMatch(/dirección en la sección Hospitales/);
    expect(interpretMessage("Hola").intent).toBe("greeting");
    expect(interpretMessage("gracias").intent).toBe("thanks");
    expect(interpretMessage("¿qué puedes hacer?").intent).toBe("help");
    expect(interpretMessage("blablabla").intent).toBe("unknown");
    expect(assistantReply("blablabla").text).toMatch(/Puedo ayudarte/);
  });

  it("handles empty and too long input", () => {
    expect(interpretMessage("   ").intent).toBe("empty");
    expect(interpretMessage(null).intent).toBe("empty");
    expect(interpretMessage("a".repeat(301)).intent).toBe("too_long");
    expect(interpretMessage("a".repeat(300)).intent).not.toBe("too_long");
    expect(assistantReply("a".repeat(301)).text).toMatch(/300 caracteres/);
  });

  it("does not match keywords inside other words", () => {
    expect(interpretMessage("capacita").intent).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// UI wiring (jsdom)
// ---------------------------------------------------------------------------

function stubMatchMedia({ reduced = false, mobile = false } = {}) {
  window.matchMedia = (q) => ({
    matches: q.includes("prefers-reduced-motion") ? reduced : q.includes("max-width") ? mobile : false,
    media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
}

const $ = (id) => document.getElementById(id);
const logTexts = () => [...$("assistant-log").querySelectorAll(".msg-text")].map((p) => p.textContent);

function loadPage() {
  document.documentElement.innerHTML = html;
  initAssistant();
}

describe("assistant UI properties", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="assistant-log"></div><input id="assistant-input"><div id="assistant-suggestions"></div>';
  });
  afterEach(() => {
    delete window.matchMedia;
  });

  // Feature: health-access-agent, Property 44: appendMessage never interprets text as HTML
  // **Validates: Requirements 18.17, 18.18**
  it("Property 44: text is inserted verbatim and no foreign elements appear", () => {
    const htmlish = fc.constantFrom("<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "&amp; &lt;b&gt;", '"><svg onload=1>');
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.fullUnicodeString(), htmlish),
        fc.constantFrom("user", "assistant"),
        fc.boolean(),
        (text, role, withActions) => {
          const log = $("assistant-log");
          log.innerHTML = "";
          const actions = withActions ? [{ label: "<b>Ver</b>", action: "prices", value: "x" }] : undefined;
          const bubble = appendMessage(role, text, actions);
          expect(bubble.querySelector("p").textContent).toBe(text);
          for (const el of bubble.querySelectorAll("*")) expect(["P", "BUTTON"]).toContain(el.tagName);
          expect(bubble.querySelectorAll("button").length).toBe(withActions ? 1 : 0);
          if (withActions) expect(bubble.querySelector("button").textContent).toBe("<b>Ver</b>");
          expect(bubble.classList.contains(role === "user" ? "msg-user" : "msg-assistant")).toBe(true);
        }
      ),
      RUNS
    );
  });

  // Feature: health-access-agent, Property 45: Submit handling ignores blank input and clears valid input
  // **Validates: Requirements 18.14, 18.13**
  it("Property 45: blank input adds nothing; valid input adds one pair and clears the field", () => {
    stubMatchMedia({ reduced: true });
    const blank = fc.array(fc.constantFrom(" ", "\t", "\n", "\u00a0", "\u2003"), { maxLength: 20 }).map((a) => a.join(""));
    fc.assert(
      fc.property(blank, (s) => {
        $("assistant-log").innerHTML = "";
        $("assistant-input").value = s;
        handleAssistantSubmit(s);
        expect($("assistant-log").children.length).toBe(0);
      }),
      RUNS
    );
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.fullUnicodeString()), (s) => {
        fc.pre(s.trim() !== "");
        $("assistant-log").innerHTML = "";
        $("assistant-input").value = s;
        handleAssistantSubmit(s);
        const log = $("assistant-log");
        expect(log.querySelectorAll(".msg-user").length).toBe(1);
        expect(log.querySelectorAll(".msg-assistant").length).toBe(1);
        expect(log.children.length).toBe(2);
        expect($("assistant-input").value).toBe("");
      }),
      RUNS
    );
  });
});

describe("assistant UI wiring", () => {
  beforeEach(() => {
    loadPage();
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
    // Hide the panel so Escape listeners left by this page instance become no-ops.
    const panel = $("assistant-panel");
    if (panel) panel.hidden = true;
    delete window.matchMedia;
    delete Element.prototype.scrollIntoView;
    sessionStorage.clear();
    localStorage.clear();
  });

  const submit = (text) => {
    $("assistant-input").value = text;
    $("assistant-send").click();
  };

  it("opens with aria-expanded and focuses the input", () => {
    $("assistant-fab").click();
    expect($("assistant-panel").hidden).toBe(false);
    expect($("assistant-fab").getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe($("assistant-input"));
  });

  it("Escape closes the panel and returns focus to the button", () => {
    $("assistant-fab").click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect($("assistant-panel").hidden).toBe(true);
    expect($("assistant-fab").getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe($("assistant-fab"));
  });

  it("Escape does nothing while the panel is closed", () => {
    const other = document.getElementById("medication-input");
    other.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.activeElement).toBe(other);
  });

  it("the close button closes the panel and returns focus", () => {
    $("assistant-fab").click();
    $("assistant-close").click();
    expect($("assistant-panel").hidden).toBe(true);
    expect(document.activeElement).toBe($("assistant-fab"));
  });

  it("shows the welcome message with the disclaimer only once", () => {
    $("assistant-fab").click();
    $("assistant-close").click();
    $("assistant-fab").click();
    const texts = logTexts();
    expect(texts.length).toBe(1);
    expect(texts[0]).toMatch(/no es consejo m\u00e9dico/);
  });

  it("submits the form with the send button and clears the input", () => {
    stubMatchMedia({ reduced: true });
    $("assistant-fab").click();
    submit("hola");
    expect(logTexts()[1]).toBe("hola");
    expect($("assistant-input").value).toBe("");
    expect($("assistant-log").querySelectorAll(".msg-assistant").length).toBe(2);
  });

  it("ignores blank submissions", () => {
    stubMatchMedia({ reduced: true });
    $("assistant-fab").click();
    submit("   ");
    expect($("assistant-log").children.length).toBe(1);
  });

  it("shows the typing indicator for 400ms, then the reply", () => {
    vi.useFakeTimers();
    $("assistant-fab").click();
    submit("hola");
    expect($("assistant-log").querySelector(".typing-indicator")).not.toBeNull();
    expect($("assistant-log").querySelectorAll(".msg-assistant").length).toBe(2);
    vi.advanceTimersByTime(399);
    expect($("assistant-log").querySelector(".typing-indicator")).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect($("assistant-log").querySelector(".typing-indicator")).toBeNull();
    expect($("assistant-log").querySelectorAll(".msg-assistant").length).toBe(2);
    expect(logTexts().pop()).toMatch(/Puedo ayudarte/);
  });

  it("skips the typing indicator under prefers-reduced-motion", () => {
    vi.useFakeTimers();
    stubMatchMedia({ reduced: true });
    $("assistant-fab").click();
    submit("hola");
    expect($("assistant-log").querySelector(".typing-indicator")).toBeNull();
    expect(logTexts().length).toBe(3);
  });

  it("never interprets user text as HTML", () => {
    stubMatchMedia({ reduced: true });
    $("assistant-fab").click();
    submit("<img src=x onerror=alert(1)><b>negrita</b>");
    expect($("assistant-log").querySelector("img")).toBeNull();
    expect($("assistant-log").querySelector("b")).toBeNull();
    expect(logTexts()[1]).toBe("<img src=x onerror=alert(1)><b>negrita</b>");
  });

  it("the clear button empties the log, restores the welcome and stays open", () => {
    vi.useFakeTimers();
    $("assistant-fab").click();
    submit("hola");
    $("assistant-clear").click();
    vi.advanceTimersByTime(1000);
    expect($("assistant-panel").hidden).toBe(false);
    const texts = logTexts();
    expect(texts.length).toBe(1);
    expect(texts[0]).toMatch(/asistente de salud/);
    expect($("assistant-log").querySelector(".typing-indicator")).toBeNull();
  });

  it("suggestion chips submit their label as a user message", () => {
    stubMatchMedia({ reduced: true });
    $("assistant-fab").click();
    const chips = [...document.querySelectorAll("#assistant-suggestions .chip")];
    expect(chips.length).toBe(4);
    for (const chip of chips) {
      const label = chip.textContent;
      chip.click();
      const users = [...$("assistant-log").querySelectorAll(".msg-user .msg-text")].map((p) => p.textContent);
      expect(users[users.length - 1]).toBe(label);
    }
  });

  it("offers one chip per specialty when no specialty is detected", () => {
    stubMatchMedia({ reduced: true });
    $("assistant-fab").click();
    submit("quiero una cita");
    const chips = [...document.querySelectorAll("#assistant-suggestions [data-specialty-chip]")];
    expect(chips.map((c) => c.textContent)).toEqual(SPECIALTIES);
    chips.find((c) => c.textContent === "Pediatría").click();
    expect(document.querySelectorAll("#assistant-suggestions [data-specialty-chip]").length).toBe(0);
    expect(logTexts().pop()).toContain("Dra. Ana Torres");
  });

  it("the medication action fills the input and runs the search", () => {
    stubMatchMedia({ reduced: true });
    $("assistant-fab").click();
    submit("busco ibuprofeno");
    [...$("assistant-log").querySelectorAll(".msg-action")].find((b) => b.textContent === "Ver en Medicamentos").click();
    expect($("medication-input").value).toBe("Ibuprofeno 400mg");
    expect($("medications-results").querySelectorAll(".card").length).toBe(2);
    expect(document.getElementById("medications").scrollIntoView).toHaveBeenCalled();
    expect($("assistant-panel").hidden).toBe(false);
  });

  it("the prices and appointments actions fill the selects and run the searches", () => {
    stubMatchMedia({ reduced: true });
    $("assistant-fab").click();
    submit("cuanto cuesta una radiografia");
    $("assistant-log").querySelector(".msg-action").click();
    expect($("service-select").value).toBe("Radiografía");
    expect($("prices-results").querySelectorAll(".card").length).toBe(2);

    submit("cita de cardiologia");
    const actions = $("assistant-log").querySelectorAll(".msg-action");
    actions[actions.length - 1].click();
    expect($("specialty-select").value).toBe("Cardiología");
    expect($("appointments-results").querySelectorAll(".card").length).toBe(2);
  });

  it("the hospitals action calls the existing flow and closes the panel on mobile", () => {
    stubMatchMedia({ reduced: true, mobile: true });
    $("assistant-fab").click();
    submit("hospital cerca");
    $("assistant-log").querySelector(".msg-action").click();
    expect($("hospitals-results").textContent).toMatch(/geolocalización/i);
    expect($("assistant-panel").hidden).toBe(true);
    expect(document.getElementById("hospitals").scrollIntoView).toHaveBeenCalled();
  });

  it("keeps the panel open after an action on desktop widths", () => {
    stubMatchMedia({ reduced: true, mobile: false });
    $("assistant-fab").click();
    submit("hospital cerca");
    $("assistant-log").querySelector(".msg-action").click();
    expect($("assistant-panel").hidden).toBe(false);
  });

  it("makes no network request and writes nothing to storage", () => {
    const original = globalThis.fetch;
    const spy = vi.fn();
    globalThis.fetch = spy;
    try {
      stubMatchMedia({ reduced: true });
      $("assistant-fab").click();
      submit("busco ibuprofeno");
      submit("tengo dolor de pecho");
      expect(spy).not.toHaveBeenCalled();
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
      expect(document.cookie).toBe("");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("initAssistant does not throw when the panel elements are missing", () => {
    document.body.innerHTML = "<p>vacío</p>";
    expect(() => initAssistant()).not.toThrow();
    expect(() => openAssistant()).not.toThrow();
  });

  it("starts with an empty conversation on a fresh page", () => {
    expect($("assistant-log").children.length).toBe(0);
  });
});
