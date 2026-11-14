import { describe, it, expect, beforeAll } from "vitest";
import fc from "fast-check";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve } from "path";

const require = createRequire(import.meta.url);
const { badgeClass } = require("../app.js");

// Validates: Requirements 7.1, 7.2, 7.3, 7.5, 8.3, 8.4
describe("index.html structure", () => {
  beforeAll(() => {
    const html = readFileSync(resolve(__dirname, "../index.html"), "utf8");
    document.documentElement.innerHTML = html;
  });

  it("has the four section IDs", () => {
    for (const id of ["hospitals", "medications", "prices", "appointments"]) {
      const el = document.getElementById(id);
      expect(el, id).not.toBeNull();
      expect(el.tagName).toBe("SECTION");
    }
  });

  it("has the four results containers", () => {
    for (const id of ["hospitals-results", "medications-results", "prices-results", "appointments-results"]) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it("links styles.css and loads app.js", () => {
    expect(document.querySelector('link[rel="stylesheet"][href="styles.css"]')).not.toBeNull();
    expect(document.querySelector('script[src="app.js"]')).not.toBeNull();
  });

  it("has nav anchors to each section", () => {
    const hrefs = [...document.querySelectorAll(".topnav a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["#hospitals", "#medications", "#prices", "#appointments"]);
  });
});

// Validates: Requirement 14
describe("index.html accessibility and visual markup", () => {
  beforeAll(() => {
    const html = readFileSync(resolve(__dirname, "../index.html"), "utf8");
    document.documentElement.innerHTML = html;
  });

  it("has lang, landmarks and skip link", () => {
    const raw = readFileSync(resolve(__dirname, "../index.html"), "utf8");
    expect(raw).toMatch(/<html[^>]*lang="es"/);
    expect(document.querySelector("header")).not.toBeNull();
    expect(document.querySelector("nav")).not.toBeNull();
    expect(document.querySelector("main#main")).not.toBeNull();
    expect(document.querySelector("footer")).not.toBeNull();
    expect(document.querySelector('a.skip-link[href="#main"]')).not.toBeNull();
    expect(document.querySelector("h1")).not.toBeNull();
  });

  it("has four nav links with icons", () => {
    const links = document.querySelectorAll(".topnav a");
    expect(links.length).toBe(4);
    links.forEach((a) => expect(a.querySelector(".nav-icon")).not.toBeNull());
  });

  it("labels every input and select via label[for]", () => {
    const fields = document.querySelectorAll("input, select");
    expect(fields.length).toBeGreaterThan(0);
    fields.forEach((f) => {
      expect(f.id, "field id").toBeTruthy();
      expect(document.querySelector(`label[for="${f.id}"]`), f.id).not.toBeNull();
    });
  });

  it("has aria-live polite results containers and summary elements", () => {
    for (const id of ["hospitals", "medications", "prices", "appointments"]) {
      const results = document.getElementById(`${id}-results`);
      expect(results.getAttribute("aria-live")).toBe("polite");
      const summary = document.getElementById(`${id}-results-summary`);
      expect(summary, id).not.toBeNull();
      expect(summary.classList.contains("results-summary")).toBe(true);
    }
  });

  it("keeps footer disclaimer, placeholder and preserved IDs", () => {
    expect(document.querySelector("footer").textContent).toMatch(/No es consejo m\u00e9dico/);
    expect(document.getElementById("medication-input").getAttribute("placeholder")).toBe("Ibuprofeno");
    for (const id of [
      "hospital-count-select", "hospital-radius-select", "location-input", "privacy-notice",
      "osm-attribution", "medication-input", "service-select", "specialty-select",
    ]) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });
});

describe("styles.css", () => {
  const css = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

  it("defines custom properties and accessibility rules", () => {
    for (const p of ["--color-primary", "--color-text", "--space-4", "--radius-md", "--shadow-sm", "--focus-ring"]) {
      expect(css).toContain(p + ":");
    }
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("@keyframes shimmer");
    expect(css).toContain("minmax(280px, 1fr)");
  });

  it("renders data-icon on no-results states", () => {
    expect(css).toMatch(/\.no-results\[data-icon\]::before\s*{[^}]*content:\s*attr\(data-icon\)/);
  });
});

describe("badgeClass", () => {
  // Feature: health-access-agent, Property 31: Badge colour mapping covers both vocabularies
  // **Validates: Requirements 15.7, 15.8**
  it("maps Spanish and legacy English statuses", () => {
    for (const s of ["En stock", "Disponible", "In stock", "Available"]) expect(badgeClass(s)).toBe("badge-green");
    for (const s of ["Agotado", "Lleno", "Out of stock", "Full"]) expect(badgeClass(s)).toBe("badge-red");
    for (const s of ["Limitado", "Limited"]) expect(badgeClass(s)).toBe("badge-orange");
  });
  it("Property 31: any other string maps to grey", () => {
    const known = ["En stock", "Disponible", "In stock", "Available", "Agotado", "Lleno", "Out of stock", "Full", "Limitado", "Limited"];
    fc.assert(
      fc.property(fc.string(), (s) => {
        fc.pre(!known.includes(s));
        expect(badgeClass(s)).toBe("badge-grey");
      }),
      { numRuns: 100 }
    );
  });
  it("maps unknown statuses to grey", () => {
    expect(badgeClass("Whatever")).toBe("badge-grey");
    expect(badgeClass("")).toBe("badge-grey");
  });
});

// Feature: health-access-agent, Requirement 17: mobile-app markup
describe("index.html mobile-app markup", () => {
  beforeAll(() => {
    const html = readFileSync(resolve(__dirname, "../index.html"), "utf8");
    document.documentElement.innerHTML = html;
  });

  it("has the welcome hero with accent, feature strip and Comenzar button", () => {
    const hero = document.querySelector("header.welcome-hero");
    expect(hero).not.toBeNull();
    expect(hero.querySelector("h1 .hero-accent").textContent).toBe("donde estés");
    expect(hero.querySelectorAll(".feature-strip li").length).toBe(3);
    expect(hero.querySelector("#start-btn.btn-pill").textContent).toBe("Comenzar");
  });

  it("has the home area with greeting, heading, four quick tiles and featured container", () => {
    const home = document.querySelector("#main #home.home-area");
    expect(home).not.toBeNull();
    expect(home.querySelector(".greeting").textContent).toBe("Hola");
    expect(home.querySelector(".home-heading").textContent).toBe("¿Cómo podemos ayudarte hoy?");
    const hrefs = [...home.querySelectorAll(".quick-actions a.quick-tile")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["#hospitals", "#medications", "#prices", "#appointments"]);
    const featured = document.getElementById("featured-appointment");
    expect(featured.classList.contains("featured-card")).toBe(true);
    expect(featured.hidden).toBe(true);
  });

  it("has a tab bar with four tabs and the floating Precios link", () => {
    const bar = document.querySelector("nav.tabbar");
    expect(bar).not.toBeNull();
    const tabs = [...bar.querySelectorAll("a.tab")].map((a) => a.getAttribute("href"));
    expect(tabs).toEqual(["#home", "#hospitals", "#medications", "#appointments"]);
    const fab = bar.querySelector("a.tab-fab");
    expect(fab.getAttribute("href")).toBe("#prices");
    expect(fab.textContent).toMatch(/Precios/);
  });

  it("has the viewport meta with viewport-fit=cover", () => {
    const raw = readFileSync(resolve(__dirname, "../index.html"), "utf8");
    expect(raw).toMatch(/<meta[^>]*name="viewport"[^>]*viewport-fit=cover/);
  });

  it("styles.css has new tokens, media query and safe-area padding", () => {
    const css = readFileSync(resolve(__dirname, "../styles.css"), "utf8");
    expect(css).toContain("--container-max:");
    expect(css).toContain("--tabbar-height:");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toMatch(/@media\s*\(min-width:\s*768px\)/);
  });
});
