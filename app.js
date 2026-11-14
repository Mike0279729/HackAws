// Health Access Agent - data catalogs and core logic

// ---------------------------------------------------------------------------
// Data catalogs
// ---------------------------------------------------------------------------

const CENTERS = [
  { name: "Hospital General de México", type: "Hospital", address: "Dr. Balmis 148, Doctores, CDMX", phone: "+52 55 2789 2000", lat: 19.4108, lon: -99.1526 },
  { name: "Clínica Roma Norte", type: "Clínica", address: "Av. Álvaro Obregón 120, Roma Norte, CDMX", phone: "+52 55 5264 1100", lat: 19.4194, lon: -99.1627 },
  { name: "Centro de Salud Coyoacán", type: "Centro de Salud", address: "Av. Hidalgo 45, Coyoacán, CDMX", phone: "+52 55 5554 3300", lat: 19.3467, lon: -99.1617 },
  { name: "Hospital Ángeles Pedregal", type: "Hospital", address: "Camino a Santa Teresa 1055, CDMX", phone: "+52 55 5652 1111", lat: 19.3069, lon: -99.2086 },
  { name: "Centro de Salud Tlalpan", type: "Centro de Salud", address: "Calz. de Tlalpan 4800, Tlalpan, CDMX", phone: "+52 55 5573 8800", lat: 19.2917, lon: -99.1678 }
];

const MEDICATIONS = [
  { name: "Ibuprofeno 400mg", pharmacy: "Farmacia del Ahorro", status: "En stock", price: 45.5 },
  { name: "Ibuprofeno 400mg", pharmacy: "Farmacias Guadalajara", status: "Limitado", price: 52 },
  { name: "Paracetamol 500mg", pharmacy: "Farmacia del Ahorro", status: "En stock", price: 28.9 },
  { name: "Paracetamol 500mg", pharmacy: "Farmacias Similares", status: "Agotado", price: 22 },
  { name: "Amoxicilina 500mg", pharmacy: "Farmacias Guadalajara", status: "Limitado", price: 98.75 },
  { name: "Omeprazol 20mg", pharmacy: "Farmacias Similares", status: "En stock", price: 65 },
  { name: "Loratadina 10mg", pharmacy: "Farmacia del Ahorro", status: "Agotado", price: 35.25 }
];

const PRICES = [
  { service: "Consulta General", provider: "Clínica Roma Norte", price: 450, includes: "Consulta de 30 minutos y receta" },
  { service: "Consulta General", provider: "Centro de Salud Coyoacán", price: 150, includes: "Consulta básica" },
  { service: "Consulta General", provider: "Hospital Ángeles Pedregal", price: 900, includes: "Consulta con médico general y expediente" },
  { service: "Radiografía", provider: "Hospital General de México", price: 350, includes: "Una proyección e interpretación" },
  { service: "Radiografía", provider: "Clínica Roma Norte", price: 600, includes: "Dos proyecciones e interpretación" },
  { service: "Análisis de Sangre", provider: "Laboratorio Salud Total", price: 280, includes: "Biometría hemática completa" },
  { service: "Análisis de Sangre", provider: "Hospital Ángeles Pedregal", price: 750, includes: "Biometría, química sanguínea de 6 elementos" }
];

// Returns the date `days` calendar days after baseDate as YYYY-MM-DD (local time).
function addDaysISO(baseDate, days) {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + days);
  const y = String(d.getFullYear()).padStart(4, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

const APPOINTMENT_TEMPLATES = [
  { specialty: "Cardiología", doctor: "Dra. Laura Méndez", offset: 2, time: "09:00", available: true },
  { specialty: "Cardiología", doctor: "Dr. Ricardo Salas", offset: 5, time: "11:30", available: false },
  { specialty: "Cardiología", doctor: "Dr. Ricardo Salas", offset: 9, time: "16:00", available: true },
  { specialty: "Pediatría", doctor: "Dra. Ana Torres", offset: 1, time: "10:00", available: true },
  { specialty: "Pediatría", doctor: "Dr. Miguel Herrera", offset: 14, time: "08:30", available: true },
  { specialty: "Pediatría", doctor: "Dra. Ana Torres", offset: 21, time: "12:00", available: false },
  { specialty: "Dermatología", doctor: "Dra. Sofía Ibarra", offset: 7, time: "13:00", available: false },
  { specialty: "Dermatología", doctor: "Dr. Jorge Paredes", offset: 30, time: "15:30", available: true }
];

// Dates are generated at load so they are always in the future.
const APPOINTMENTS = (() => {
  const today = new Date();
  return APPOINTMENT_TEMPLATES.map((t) => ({
    specialty: t.specialty,
    doctor: t.doctor,
    date: addDaysISO(today, t.offset),
    time: t.time,
    available: t.available
  }));
})();

// ---------------------------------------------------------------------------
// Distance (Haversine)
// ---------------------------------------------------------------------------

function distanceKm(lat1, lon1, lat2, lon2) {
  const args = [
    ["lat1", lat1, 90],
    ["lon1", lon1, 180],
    ["lat2", lat2, 90],
    ["lon2", lon2, 180]
  ];
  for (const [name, value, limit] of args) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("Invalid argument " + name + ": must be a finite number");
    }
    if (value < -limit || value > limit) {
      throw new Error("Invalid argument " + name + ": must be in range [-" + limit + ", " + limit + "]");
    }
  }

  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  let a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  // Guard against floating-point drift outside [0, 1]
  a = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function badgeClass(text) {
  switch (text) {
    case "En stock":
    case "Disponible":
    case "In stock":
    case "Available":
      return "badge-green";
    case "Agotado":
    case "Lleno":
    case "Out of stock":
    case "Full":
      return "badge-red";
    case "Limitado":
    case "Limited":
      return "badge-orange";
    default:
      return "badge-grey";
  }
}

const MESSAGE_ICONS = { info: "ℹ️", error: "⚠️" };

// opts.kind ("info" | "error") adds an icon and a modifier class to the
// .no-results element. Without opts the output is unchanged.
function renderResults(containerId, items, fallbackMessage = "No se encontraron resultados.", opts) {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error("Container not found: " + containerId);
  }

  let html = "";
  if (!Array.isArray(items) || items.length === 0) {
    const kind = opts && (opts.kind === "info" || opts.kind === "error") ? opts.kind : null;
    // The icon lives in data-icon (rendered by CSS ::before) so textContent stays the plain message.
    html = kind
      ? '<p class="no-results ' + kind + '" data-icon="' + escapeHtml(MESSAGE_ICONS[kind]) + '">' +
        escapeHtml(fallbackMessage) + "</p>"
      : '<p class="no-results">' + escapeHtml(fallbackMessage) + "</p>";
  } else {
    for (const item of items) {
      const it = item || {};
      html +=
        '<div class="card">' +
        '<div class="card-header">' +
        (typeof it.icon === "string" && it.icon !== ""
          ? '<span class="card-avatar" aria-hidden="true">' + escapeHtml(it.icon) + "</span>"
          : "") +
        '<span class="card-title">' + escapeHtml(it.title) + "</span>" +
        '<span class="card-badge ' + badgeClass(it.badge) + '">' + escapeHtml(it.badge) + "</span>" +
        "</div>" +
        '<p class="card-subtitle">' + escapeHtml(it.subtitle) + "</p>" +
        '<p class="card-detail">' + escapeHtml(it.detail) + "</p>" +
        (it.link && typeof it.link === "object"
          ? '<a class="card-link" href="' + escapeHtml(it.link.href) +
            '" target="_blank" rel="noopener noreferrer">' + escapeHtml(it.link.text) + "</a>"
          : "") +
        "</div>";
    }
  }
  container.innerHTML = html;
}

// ---------------------------------------------------------------------------
// UX helpers
// ---------------------------------------------------------------------------

// Disables a button and flags it aria-busy while an action is pending.
function setBusy(button, busy) {
  if (!button) return;
  button.disabled = !!busy;
  if (busy) button.setAttribute("aria-busy", "true");
  else button.removeAttribute("aria-busy");
}

// Writes a one-line summary into the "<containerId>-summary" sibling element.
function renderSummary(containerId, text) {
  try {
    const el = document.getElementById(containerId + "-summary");
    if (!el) return;
    el.textContent = text === null || text === undefined ? "" : String(text);
  } catch (_) { /* never throw */ }
}

function countText(n, singular, plural) {
  return n + " " + (n === 1 ? singular : plural);
}

function findButton(handlerName) {
  try {
    return document.querySelector('button[onclick^="' + handlerName + '"]');
  } catch (_) {
    return null;
  }
}

// Marks the nav link of the section in view with .active and aria-current.
function initActiveNav() {
  try {
    if (typeof IntersectionObserver === "undefined" || typeof document === "undefined") return;
    const ids = ["home", "hospitals", "medications", "prices", "appointments"];
    const links = Array.from(document.querySelectorAll(".topnav a, .tabbar a"));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = entry.target.id;
        for (const link of links) {
          const match = link.getAttribute("href") === "#" + id;
          link.classList.toggle("active", match);
          if (match) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        }
      }
    }, { rootMargin: "-40% 0px -50% 0px" });
    for (const id of ids) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
  } catch (_) { /* never throw */ }
}

// ---------------------------------------------------------------------------
// Module 1: Nearby hospitals
// ---------------------------------------------------------------------------

// Shows an error message without wiping previously rendered cards.
function showHospitalsError(message) {
  const container = document.getElementById("hospitals-results");
  if (!container) return;
  const existing = container.querySelectorAll(".no-results");
  existing.forEach((el) => el.remove());
  if (container.querySelector(".card")) {
    const p = document.createElement("p");
    p.className = "no-results";
    p.textContent = message;
    container.insertBefore(p, container.firstChild);
  } else {
    renderResults("hospitals-results", [], message, { kind: "error" });
  }
  renderSummary("hospitals-results", "");
}

// Fills a results container with loading placeholder cards (minimum 3).
function showPlaceholders(containerId, count = 3) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const n = Math.max(3, count);
  let html = "";
  for (let i = 0; i < n; i++) {
    html += '<div class="card placeholder" aria-hidden="true"></div>';
  }
  container.innerHTML = html;
}

function isFileProtocol() {
  return typeof location !== "undefined" && location && location.protocol === "file:";
}

const ADDRESS_HINT = " Puedes escribir una dirección abajo.";

function nearbyHospitals() {
  let previousHtml = null;
  let busyButton = null;
  const release = () => { setBusy(busyButton, false); busyButton = null; };
  const restorePrevious = () => {
    // Drop placeholders and bring back whatever was shown before the query.
    if (previousHtml === null) return;
    const container = document.getElementById("hospitals-results");
    if (container) container.innerHTML = previousHtml;
    previousHtml = null;
  };
  try {
    if (typeof navigator === "undefined" || !navigator.geolocation ||
        typeof navigator.geolocation.getCurrentPosition !== "function") {
      showHospitalsError("La geolocalización no está disponible en este navegador." + ADDRESS_HINT);
      return;
    }

    busyButton = findButton("nearbyHospitals");
    if (busyButton && busyButton.disabled) { busyButton = null; return; }
    setBusy(busyButton, true);

    const resultsEl = document.getElementById("hospitals-results");
    if (resultsEl) {
      previousHtml = resultsEl.innerHTML;
      showPlaceholders("hospitals-results");
    }

    const onSuccess = (position) => {
      previousHtml = null;
      try {
        const { latitude, longitude } = position.coords;
        // findHospitalsFrom never rejects; the catch guards against sync errors.
        Promise.resolve(findHospitalsFrom(latitude, longitude)).then(release, release);
      } catch (e) {
        release();
        showHospitalsError("No se pudieron determinar los hospitales cercanos: " + (e && e.message ? e.message : "error desconocido") + "." + ADDRESS_HINT);
      }
    };

    const onError = (err) => {
      let reason = "Geolocalización denegada o no disponible.";
      if (err && err.code === 1) reason = "Permiso de ubicación denegado.";
      else if (err && err.code === 3) reason = "Se agotó el tiempo de la solicitud de ubicación.";
      else if (err && err.code === 2) reason = "Ubicación no disponible.";
      if (isFileProtocol() && (!err || err.code !== 3)) {
        reason += " Se requiere un servidor HTTP local para usar la ubicación (consulta el README).";
      }
      try {
        restorePrevious();
        showHospitalsError(reason + ADDRESS_HINT);
      } finally {
        release();
      }
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, { timeout: 10000 });
  } catch (e) {
    try {
      release();
      restorePrevious();
      showHospitalsError("Geolocalización denegada o no disponible." + ADDRESS_HINT);
    } catch (_) { /* never throw */ }
  }
}
if (typeof window !== "undefined") {
  window.nearbyHospitals = nearbyHospitals;
  window.searchByAddress = searchByAddress;
}

// ---------------------------------------------------------------------------
// Module 2: Medication availability
// ---------------------------------------------------------------------------

const MAX_QUERY_LENGTH = 200;

function searchMedications() {
  try {
    const input = document.getElementById("medication-input");
    const query = String((input && input.value) || "").trim().toLowerCase();

    if (query === "") {
      renderResults("medications-results", [], "Escribe el nombre de un medicamento.", { kind: "info" });
      renderSummary("medications-results", "");
      return;
    }
    if (query.length > MAX_QUERY_LENGTH) {
      renderResults("medications-results", [], "Consulta demasiado larga: usa 200 caracteres o menos.", { kind: "error" });
      renderSummary("medications-results", "");
      return;
    }

    const items = MEDICATIONS
      .filter((m) => m.name.toLowerCase().includes(query))
      .map((m) => ({
        icon: "💊",
        title: m.name,
        subtitle: m.pharmacy,
        badge: m.status,
        detail: "$" + m.price.toFixed(2)
      }));
    if (items.length === 0) {
      renderResults("medications-results", items, "No se encontraron resultados.", { kind: "info" });
      renderSummary("medications-results", "");
    } else {
      renderResults("medications-results", items);
      renderSummary("medications-results", countText(items.length, "medicamento encontrado", "medicamentos encontrados"));
    }
  } catch (e) {
    try {
      renderResults("medications-results", [], "No se pudieron obtener los datos de medicamentos.", { kind: "error" });
      renderSummary("medications-results", "");
    } catch (_) { /* never throw */ }
  }
}

if (typeof window !== "undefined") {
  window.searchMedications = searchMedications;
}

// ---------------------------------------------------------------------------
// Module 3: Price comparator
// ---------------------------------------------------------------------------

function comparePrices() {
  try {
    const select = document.getElementById("service-select");
    const service = String((select && select.value) || "");

    if (service === "") {
      renderResults("prices-results", [], "Selecciona un tipo de servicio.", { kind: "info" });
      renderSummary("prices-results", "");
      return;
    }

    const items = PRICES
      .filter((p) => p.service === service)
      .map((p) => ({
        icon: "💲",
        title: p.provider,
        subtitle: p.includes,
        badge: "$" + p.price.toFixed(2),
        detail: p.service
      }));
    if (items.length === 0) {
      renderResults("prices-results", items, "No se encontraron resultados.", { kind: "info" });
      renderSummary("prices-results", "");
    } else {
      renderResults("prices-results", items);
      renderSummary("prices-results", countText(items.length, "proveedor encontrado", "proveedores encontrados"));
    }
  } catch (e) {
    try {
      renderResults("prices-results", [], "No se pudieron obtener los datos de precios.", { kind: "error" });
      renderSummary("prices-results", "");
    } catch (_) { /* never throw */ }
  }
}

if (typeof window !== "undefined") {
  window.comparePrices = comparePrices;
}

// ---------------------------------------------------------------------------
// Module 4: Appointments
// ---------------------------------------------------------------------------

function searchAppointments() {
  try {
    const select = document.getElementById("specialty-select");
    const specialty = String((select && select.value) || "");

    if (specialty === "") {
      renderResults("appointments-results", [], "Selecciona una especialidad.", { kind: "info" });
      renderSummary("appointments-results", "");
      return;
    }

    const items = APPOINTMENTS
      .filter((a) => a.specialty === specialty && a.available === true)
      .map((a) => ({
        icon: "🩺",
        title: a.doctor,
        subtitle: a.specialty,
        badge: "Disponible",
        detail: a.date + " a las " + a.time
      }));
    if (items.length === 0) {
      renderResults("appointments-results", items, "No se encontraron resultados.", { kind: "info" });
      renderSummary("appointments-results", "");
    } else {
      renderResults("appointments-results", items);
      renderSummary("appointments-results", countText(items.length, "cita encontrada", "citas encontradas"));
    }
  } catch (e) {
    try {
      renderResults("appointments-results", [], "No se pudieron cargar las citas.", { kind: "error" });
      renderSummary("appointments-results", "");
    } catch (_) { /* never throw */ }
  }
}

if (typeof window !== "undefined") {
  window.searchAppointments = searchAppointments;
}

// ---------------------------------------------------------------------------
// Hospital enhancement helpers (pure)
// ---------------------------------------------------------------------------

const COUNT_OPTIONS = [3, 5, 10];
const RADIUS_OPTIONS = [5, 10, 25, 50];

function readSelectValue(id) {
  try {
    const el = document.getElementById(id);
    return el && el.value !== undefined && el.value !== null ? String(el.value).trim() : "";
  } catch (_) {
    return "";
  }
}

// Returns 3, 5 or 10; any other value falls back to 3.
function readCount() {
  const v = readSelectValue("hospital-count-select");
  const n = Number(v);
  return v !== "" && COUNT_OPTIONS.includes(n) && String(n) === v ? n : 3;
}

// Returns the radius in km (5, 10, 25, 50) or null for "any"/invalid values.
function readRadius() {
  const v = readSelectValue("hospital-radius-select");
  if (v === "any" || v === "") return null;
  const n = Number(v);
  return RADIUS_OPTIONS.includes(n) && String(n) === v ? n : null;
}

function isFiniteNumber(x) {
  return typeof x === "number" && Number.isFinite(x);
}

function directionsUrl(originLat, originLon, destLat, destLon) {
  if (!isFiniteNumber(destLat) || !isFiniteNumber(destLon)) {
    throw new Error("Invalid destination: coordinates must be finite numbers");
  }
  let url = "https://www.google.com/maps/dir/?api=1";
  if (isFiniteNumber(originLat) && isFiniteNumber(originLon)) {
    url += "&origin=" + encodeURIComponent(originLat + "," + originLon);
  }
  url += "&destination=" + encodeURIComponent(destLat + "," + destLon);
  return url;
}

function mapOverpassElements(elements) {
  if (!Array.isArray(elements)) return [];
  const out = [];
  for (const el of elements) {
    if (!el || typeof el !== "object") continue;
    const tags = el.tags && typeof el.tags === "object" ? el.tags : {};
    const name = typeof tags.name === "string" ? tags.name.trim() : "";
    if (name === "") continue;

    const center = el.center && typeof el.center === "object" ? el.center : {};
    const lat = el.lat !== undefined ? el.lat : center.lat;
    const lon = el.lon !== undefined ? el.lon : center.lon;
    if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    const street = [tags["addr:street"], tags["addr:housenumber"]]
      .filter((s) => typeof s === "string" && s.trim() !== "")
      .join(" ");
    const address = [street, tags["addr:city"], tags["addr:postcode"]]
      .filter((s) => typeof s === "string" && s.trim() !== "")
      .join(", ");
    const phone = tags.phone || tags["contact:phone"] || "N/A";

    out.push({
      name,
      type: typeof tags.amenity === "string" ? tags.amenity : "",
      address,
      phone: String(phone),
      lat,
      lon
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Network: Nominatim geocoding
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 10000;
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=";

// Resolves a typed address to coordinates. Never throws.
// Returns { ok: true, lat, lon } or { ok: false, reason } with reason in
// "empty" | "too-long" | "not-found" | "network" | "timeout".
async function geocodeAddress(query) {
  let timer = null;
  try {
    const q = String(query === null || query === undefined ? "" : query).trim();
    if (q === "") return { ok: false, reason: "empty" };
    if (q.length > MAX_QUERY_LENGTH) return { ok: false, reason: "too-long" };
    if (typeof fetch !== "function") return { ok: false, reason: "network" };

    const controller = new AbortController();
    let timedOut = false;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(Object.assign(new Error("timeout"), { name: "AbortError" }));
      }, REQUEST_TIMEOUT_MS);
    });

    const work = (async () => {
      const res = await fetch(NOMINATIM_URL + encodeURIComponent(q), { signal: controller.signal });
      if (!res || !res.ok) return { ok: false, reason: "network" };
      const data = await res.json();
      const first = Array.isArray(data) ? data[0] : undefined;
      if (!first || typeof first !== "object") return { ok: false, reason: "not-found" };
      const rawLat = first.lat;
      const rawLon = first.lon;
      if (rawLat === null || rawLat === undefined || rawLat === "" ||
          rawLon === null || rawLon === undefined || rawLon === "") {
        return { ok: false, reason: "not-found" };
      }
      const lat = Number(rawLat);
      const lon = Number(rawLon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
          lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return { ok: false, reason: "not-found" };
      }
      return { ok: true, lat, lon };
    })();
    // Avoid an unhandled rejection if the timeout wins the race.
    work.catch(() => {});

    try {
      return await Promise.race([work, timeoutPromise]);
    } catch (e) {
      return { ok: false, reason: timedOut || (e && e.name === "AbortError") ? "timeout" : "network" };
    }
  } catch (_) {
    return { ok: false, reason: "network" };
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Fetches nearby hospitals/clinics/doctors from Overpass.
// Rejects on network error, non-OK status or abort (10 s timeout).
async function fetchRemoteCenters(lat, lon, radiusKm) {
  const around = `around:${radiusKm * 1000},${lat},${lon}`;
  const query = `[out:json];(` +
    `node["amenity"~"^(hospital|clinic|doctors)$"](${around});` +
    `way["amenity"~"^(hospital|clinic|doctors)$"](${around});` +
    `);out center;`;
  const controller = new AbortController();
  let timer = null;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(Object.assign(new Error("timeout"), { name: "AbortError" }));
      }, REQUEST_TIMEOUT_MS);
    });
    const work = (async () => {
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        body: query,
        headers: { "Content-Type": "text/plain" },
        signal: controller.signal,
      });
      if (!res || !res.ok) throw new Error("Overpass request failed");
      const json = await res.json();
      return mapOverpassElements(json && json.elements);
    })();
    work.catch(() => {});
    return await Promise.race([work, timeoutPromise]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Shared hospital flow
// ---------------------------------------------------------------------------

const DEFAULT_RADIUS_KM = 10;

// Shows the OSM attribution (remote data) or the fallback notice (CENTERS);
// source is "remote", "local" or null (hide both).
function setHospitalSourceNotice(source) {
  try {
    const attribution = document.getElementById("osm-attribution");
    if (attribution) attribution.hidden = source !== "remote";

    let notice = document.getElementById("fallback-notice");
    if (source === "local") {
      if (!notice) {
        const results = document.getElementById("hospitals-results");
        if (!results || !results.parentNode) return;
        notice = document.createElement("p");
        notice.id = "fallback-notice";
        notice.className = "fallback-notice";
        results.parentNode.insertBefore(notice, results.nextSibling);
      }
      notice.textContent = "Mostrando datos locales sin conexión. No se pudieron cargar los datos en vivo de hospitales.";
      notice.hidden = false;
    } else if (notice) {
      notice.hidden = true;
    }
  } catch (_) { /* never throw */ }
}

// Shared by device location and typed address. Never rejects.
async function findHospitalsFrom(lat, lon) {
  try {
    // Placeholders stay visible while the Overpass request is pending.
    showPlaceholders("hospitals-results");
    const count = readCount();
    const radius = readRadius();

    let centers;
    let source = "remote";
    try {
      centers = await fetchRemoteCenters(lat, lon, radius === null ? DEFAULT_RADIUS_KM : radius);
      if (!Array.isArray(centers) || centers.length === 0) throw new Error("empty");
    } catch (_) {
      centers = Array.isArray(CENTERS) ? CENTERS : [];
      source = "local";
    }

    if (centers.length === 0) {
      renderResults("hospitals-results", [], "No hay centros médicos disponibles.", { kind: "info" });
      renderSummary("hospitals-results", "");
      setHospitalSourceNotice(source);
      return;
    }

    let enriched = centers.map((c) => ({ c, distance: distanceKm(lat, lon, c.lat, c.lon) }));
    if (radius !== null) enriched = enriched.filter((x) => x.distance <= radius);
    enriched.sort((a, b) => a.distance - b.distance);
    const top = enriched.slice(0, count);

    if (top.length === 0) {
      renderResults("hospitals-results", [],
        "No se encontraron hospitales en un radio de " + radius + " km. Intenta aumentar el radio.", { kind: "info" });
      renderSummary("hospitals-results", "");
    } else {
      const items = top.map(({ c, distance }) => ({
        icon: "🏥",
        title: c.name,
        subtitle: c.type + " — " + c.address,
        badge: distance.toFixed(1) + " km",
        detail: c.phone,
        link: { href: directionsUrl(lat, lon, c.lat, c.lon), text: "Cómo llegar" }
      }));
      renderResults("hospitals-results", items);
      renderSummary("hospitals-results", countText(items.length, "hospital encontrado", "hospitales encontrados"));
    }
    setHospitalSourceNotice(source);
  } catch (e) {
    try {
      setHospitalSourceNotice(null);
      renderResults("hospitals-results", [],
        "No se pudieron determinar los hospitales cercanos: " + (e && e.message ? e.message : "error desconocido") + ".", { kind: "error" });
      renderSummary("hospitals-results", "");
    } catch (_) { /* never throw */ }
  }
}

const GEOCODE_MESSAGES = {
  "empty": "Escribe una dirección o ciudad.",
  "too-long": "Dirección demasiado larga: usa 200 caracteres o menos.",
  "not-found": "Dirección no encontrada. Prueba con una dirección o ciudad más específica.",
  "network": "No se pudo contactar el servicio de geocodificación. Revisa tu conexión e inténtalo de nuevo.",
  "timeout": "La búsqueda de dirección tardó demasiado. Inténtalo de nuevo."
};

async function searchByAddress() {
  const button = findButton("searchByAddress");
  if (button && button.disabled) return;
  setBusy(button, true);
  try {
    const input = document.getElementById("location-input");
    showPlaceholders("hospitals-results");
    const r = await geocodeAddress(input ? input.value : "");
    if (!r.ok) {
      setHospitalSourceNotice(null);
      renderResults("hospitals-results", [], GEOCODE_MESSAGES[r.reason] || GEOCODE_MESSAGES.network,
        { kind: r.reason === "empty" || r.reason === "too-long" || r.reason === "not-found" ? "info" : "error" });
      renderSummary("hospitals-results", "");
      return;
    }
    await findHospitalsFrom(r.lat, r.lon);
  } catch (_) {
    try {
      renderResults("hospitals-results", [], GEOCODE_MESSAGES.network, { kind: "error" });
      renderSummary("hospitals-results", "");
    } catch (__) { /* never throw */ }
  } finally {
    setBusy(button, false);
  }
}

if (typeof window !== "undefined") {
  window.searchByAddress = searchByAddress;
}

// Enter in #location-input triggers the address search.
function bindLocationInput() {
  try {
    const input = document.getElementById("location-input");
    if (!input || input.dataset.enterBound === "1") return;
    input.dataset.enterBound = "1";
    input.addEventListener("keydown", (ev) => {
      if (ev && ev.key === "Enter") {
        ev.preventDefault();
        searchByAddress();
      }
    });
  } catch (_) { /* never throw */ }
}
// Enter in #medication-input triggers the medication search.
function bindMedicationInput() {
  try {
    const input = document.getElementById("medication-input");
    if (!input || (input.dataset && input.dataset.enterBound === "1")) return;
    if (input.dataset) input.dataset.enterBound = "1";
    input.addEventListener("keydown", (ev) => {
      if (ev && ev.key === "Enter") {
        ev.preventDefault();
        searchMedications();
      }
    });
  } catch (_) { /* never throw */ }
}

// ---------------------------------------------------------------------------
// Mobile-app look and feel helpers
// ---------------------------------------------------------------------------

// Pure. Earliest available slot by date, then time (ISO strings compare lexically).
function nextAvailableAppointment(slots) {
  if (!Array.isArray(slots)) return null;
  let best = null;
  for (const s of slots) {
    if (!s || typeof s !== "object" || s.available !== true) continue;
    if (best === null) { best = s; continue; }
    const sKey = String(s.date) + "T" + String(s.time);
    const bKey = String(best.date) + "T" + String(best.time);
    if (sKey < bKey) best = s;
  }
  return best;
}

// Pure. Uppercase first letters of up to the first two words, or "?".
function initials(name) {
  if (typeof name !== "string") return "?";
  const words = name.trim().split(/\s+/).filter((w) => w !== "");
  if (words.length === 0) return "?";
  return words.slice(0, 2).map((w) => Array.from(w)[0].toUpperCase()).join("");
}

// Fills #featured-appointment from APPOINTMENTS, or hides it. No network.
function renderFeaturedAppointment() {
  try {
    const el = document.getElementById("featured-appointment");
    if (!el) return;
    let slot = null;
    try { slot = nextAvailableAppointment(APPOINTMENTS); } catch (_) { slot = null; }
    if (slot === null) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.innerHTML =
      '<div class="featured-header">' +
      '<h3 class="featured-title">Próxima cita disponible</h3>' +
      '<a class="featured-link" href="#appointments">Ver todas</a>' +
      "</div>" +
      '<div class="featured-body">' +
      '<span class="featured-avatar" aria-hidden="true">' + escapeHtml(initials(slot.doctor)) + "</span>" +
      '<div class="featured-info">' +
      '<span class="featured-doctor">' + escapeHtml(slot.doctor) + "</span>" +
      '<span class="featured-specialty">' + escapeHtml(slot.specialty) + "</span>" +
      '<span class="featured-detail">' + escapeHtml(slot.date + " a las " + slot.time) + "</span>" +
      "</div>" +
      '<span class="featured-pill">Disponible</span>' +
      "</div>";
    el.hidden = false;
  } catch (_) { /* never throw */ }
}

// Smooth-scrolls to in-page targets; "auto" under prefers-reduced-motion.
function initSmoothScroll() {
  try {
    if (typeof document === "undefined") return;
    const reduced = () => {
      try {
        return typeof window !== "undefined" && typeof window.matchMedia === "function" &&
          !!window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch (_) { return false; }
    };
    const go = (ev, hash) => {
      try {
        if (typeof hash !== "string" || hash.length < 2 || hash.charAt(0) !== "#") return;
        const target = document.getElementById(hash.slice(1));
        if (!target || typeof target.scrollIntoView !== "function") return;
        if (ev && typeof ev.preventDefault === "function") ev.preventDefault();
        target.scrollIntoView({ behavior: reduced() ? "auto" : "smooth" });
      } catch (_) { /* never throw */ }
    };
    const bind = (el, getHash) => {
      if (!el || (el.dataset && el.dataset.scrollBound === "1")) return;
      if (el.dataset) el.dataset.scrollBound = "1";
      el.addEventListener("click", (ev) => go(ev, getHash(el)));
    };
    const hrefOf = (el) => el.getAttribute("href");
    bind(document.getElementById("start-btn"), () => "#home");
    document.querySelectorAll(".quick-tile, .tab, .tab-fab").forEach((el) => bind(el, hrefOf));
    // The "Ver todas" link is created by renderFeaturedAppointment, so delegate.
    const featured = document.getElementById("featured-appointment");
    if (featured && !(featured.dataset && featured.dataset.scrollBound === "1")) {
      if (featured.dataset) featured.dataset.scrollBound = "1";
      featured.addEventListener("click", (ev) => {
        const t = ev && ev.target;
        const link = t && typeof t.closest === "function" ? t.closest("a.featured-link") : null;
        if (link) go(ev, hrefOf(link));
      });
    }
  } catch (_) { /* never throw */ }
}

function initUi() {
  bindLocationInput();
  bindMedicationInput();
  renderFeaturedAppointment();
  initSmoothScroll();
  initActiveNav();
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUi);
  } else {
    initUi();
  }
}
// ---------------------------------------------------------------------------
// Health Assistant: pure rule-based logic (Requirement 18). No DOM, no fetch.
// ---------------------------------------------------------------------------

const ASSISTANT_MAX_LENGTH = 300;
const ASSISTANT_TYPING_MS = 400;

// All keyword lists are stored in normalised form (lowercase, no diacritics).
const EMERGENCY_KEYWORDS = ["dolor de pecho", "no puedo respirar", "infarto", "sangrado fuerte", "desmayo", "convulsion", "emergencia", "urgencia", "accidente"];
const HOSPITAL_KEYWORDS = ["hospital", "clinica", "centro de salud", "cerca", "cercano"];
const MEDICATION_KEYWORDS = ["medicamento", "medicina", "pastilla", "farmacia", "disponible"];
const PRICE_KEYWORDS = ["precio", "costo", "cuanto cuesta", "comparar"];
const APPOINTMENT_KEYWORDS = ["cita", "agendar", "reservar", "doctor", "consulta con"];
const GREETING_KEYWORDS = ["hola", "buenas", "buenos dias"];
const THANKS_KEYWORDS = ["gracias"];
const HELP_KEYWORDS = ["ayuda", "que puedes hacer"];
const SYMPTOM_SPECIALTIES = {
  piel: "Dermatología",
  sarpullido: "Dermatología",
  corazon: "Cardiología",
  palpitaciones: "Cardiología",
  nino: "Pediatría",
  bebe: "Pediatría",
  hijo: "Pediatría"
};
const ASSISTANT_STOP_WORDS = ["busco", "quiero", "un", "una", "el", "la", "de", "medicamento", "medicina", "pastilla", "farmacia", "disponible", "hay", "para"];
const ASSISTANT_DISCLAIMER = "Información general, no es consejo médico ni diagnóstico.";
const HOSPITAL_ACTION = { label: "Buscar hospitales cerca de mí", action: "hospitals" };

function normalizeText(text) {
  if (typeof text !== "string") return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// True when keyword occurs in normalised text n on word boundaries (optional plural "s").
function containsKeyword(n, keyword) {
  const re = new RegExp("(?:^|[^a-z0-9])" + escapeRegExp(keyword) + "s?(?:$|[^a-z0-9])");
  return re.test(n);
}

function containsAny(n, keywords) {
  return keywords.some((k) => containsKeyword(n, k));
}

function distinctValues(items, key) {
  return Array.from(new Set(items.map((i) => i[key])));
}

// Returns the original catalog string whose normalised form is in n (longest first), or null.
function matchCatalogValue(n, values) {
  const sorted = values.slice().sort((a, b) => b.length - a.length);
  for (const v of sorted) {
    if (containsKeyword(n, normalizeText(v))) return v;
  }
  return null;
}

// Medication names also match by their first word ("ibuprofeno" for "Ibuprofeno 400mg").
function matchMedicationName(n) {
  const names = distinctValues(MEDICATIONS, "name");
  const full = matchCatalogValue(n, names);
  if (full !== null) return full;
  for (const name of names) {
    const first = normalizeText(name).split(" ")[0];
    if (first && containsKeyword(n, first)) return name;
  }
  return null;
}

function symptomSpecialty(n) {
  for (const word of Object.keys(SYMPTOM_SPECIALTIES)) {
    if (containsKeyword(n, word)) return SYMPTOM_SPECIALTIES[word];
  }
  return null;
}

// Last word of n that is not a stop word, or "". Always a substring of n.
function extractWord(n) {
  const words = n.split(" ");
  for (let i = words.length - 1; i >= 0; i--) {
    if (words[i] !== "" && !ASSISTANT_STOP_WORDS.includes(words[i])) return words[i];
  }
  return "";
}

function interpretMessage(text) {
  try {
    if (typeof text !== "string") return { intent: "empty", params: {} };
    if (text.trim().length > ASSISTANT_MAX_LENGTH) return { intent: "too_long", params: {} };
    const n = normalizeText(text);
    if (n === "") return { intent: "empty", params: {} };

    if (containsAny(n, EMERGENCY_KEYWORDS)) return { intent: "emergency", params: {} };

    const specialty = matchCatalogValue(n, distinctValues(APPOINTMENTS, "specialty")) || symptomSpecialty(n);
    const service = matchCatalogValue(n, distinctValues(PRICES, "service"));
    const medName = matchMedicationName(n);

    if (containsAny(n, APPOINTMENT_KEYWORDS) || specialty) {
      return { intent: "appointments", params: specialty ? { specialty } : {} };
    }
    if (containsAny(n, PRICE_KEYWORDS) || service) {
      return { intent: "prices", params: service ? { service } : {} };
    }
    if (medName || containsAny(n, MEDICATION_KEYWORDS) || n.startsWith("busco ")) {
      return { intent: "medication", params: { query: medName !== null ? medName : extractWord(n) } };
    }
    if (containsAny(n, HOSPITAL_KEYWORDS)) return { intent: "hospitals", params: {} };
    if (containsAny(n, GREETING_KEYWORDS)) return { intent: "greeting", params: {} };
    if (containsAny(n, THANKS_KEYWORDS)) return { intent: "thanks", params: {} };
    if (containsAny(n, HELP_KEYWORDS)) return { intent: "help", params: {} };
    return { intent: "unknown", params: {} };
  } catch (_) {
    return { intent: "unknown", params: {} };
  }
}

const ASSISTANT_CAPABILITIES = "Puedo ayudarte a buscar hospitales cercanos, ver medicamentos, comparar precios y consultar citas. " + ASSISTANT_DISCLAIMER;
const ASSISTANT_NOTE = " " + ASSISTANT_DISCLAIMER;

function assistantReply(text) {
  try {
    const r = interpretMessage(text);
    const p = r.params || {};
    switch (r.intent) {
      case "emergency":
        return {
          text: "⚠️ Si es una emergencia, llama ahora al número de emergencias de tu localidad. " +
            "Puedo mostrarte los hospitales más cercanos. " + ASSISTANT_DISCLAIMER,
          actions: [{ ...HOSPITAL_ACTION }]
        };
      case "medication": {
        const q = typeof p.query === "string" ? p.query : "";
        if (q === "") return { text: "¿Qué medicamento buscas?", actions: [] };
        const nq = normalizeText(q);
        const matches = MEDICATIONS.filter((m) => normalizeText(m.name).includes(nq)).slice(0, 3);
        if (matches.length === 0) {
          return { text: "No encontré «" + q + "» en el catálogo. Prueba con otro nombre." + ASSISTANT_NOTE, actions: [] };
        }
        const lines = matches.map((m) => m.name + " en " + m.pharmacy + ": " + m.status + ", $" + m.price.toFixed(2));
        return {
          text: lines.join("\n") + "\n" + ASSISTANT_DISCLAIMER,
          actions: [{ label: "Ver en Medicamentos", action: "medication", value: matches[0].name }]
        };
      }
      case "prices": {
        if (!p.service) {
          return {
            text: "¿Qué servicio quieres comparar? Tengo: " + distinctValues(PRICES, "service").join(", ") + "." + ASSISTANT_NOTE,
            actions: []
          };
        }
        const rows = PRICES.filter((x) => x.service === p.service).sort((a, b) => a.price - b.price);
        const lines = rows.map((x, i) => x.provider + ": $" + x.price.toFixed(2) + (i === 0 ? " (más económico)" : ""));
        return {
          text: lines.join("\n") + "\n" + ASSISTANT_DISCLAIMER,
          actions: [{ label: "Ver en Precios", action: "prices", value: p.service }]
        };
      }
      case "appointments": {
        if (!p.specialty) return { text: "¿Qué especialidad necesitas?", actions: [] };
        const slots = APPOINTMENTS.filter((a) => a.specialty === p.specialty && a.available)
          .sort((a, b) => (a.date + " " + a.time < b.date + " " + b.time ? -1 : a.date + " " + a.time > b.date + " " + b.time ? 1 : 0))
          .slice(0, 3);
        if (slots.length === 0) {
          return { text: "No hay citas disponibles para " + p.specialty + "." + ASSISTANT_NOTE, actions: [] };
        }
        return {
          text: slots.map((a) => a.doctor + ": " + a.date + " a las " + a.time).join("\n") + "\n" + ASSISTANT_DISCLAIMER,
          actions: [{ label: "Ver en Citas", action: "appointments", value: p.specialty }]
        };
      }
      case "hospitals":
        return {
          text: "Usaré tu ubicación para buscar los hospitales más cercanos. " +
            "También puedes escribir una dirección en la sección Hospitales." + ASSISTANT_NOTE,
          actions: [{ ...HOSPITAL_ACTION }]
        };
      case "greeting":
        return { text: "¡Hola! " + ASSISTANT_CAPABILITIES, actions: [] };
      case "thanks":
        return { text: "¡De nada! " + ASSISTANT_CAPABILITIES, actions: [] };
      case "too_long":
        return { text: "Tu mensaje es demasiado largo: usa " + ASSISTANT_MAX_LENGTH + " caracteres o menos. " + ASSISTANT_CAPABILITIES, actions: [] };
      default:
        return { text: ASSISTANT_CAPABILITIES, actions: [] };
    }
  } catch (_) {
    return { text: ASSISTANT_CAPABILITIES, actions: [] };
  }
}

// ---------------------------------------------------------------------------
// Health Assistant: UI wiring (Requirement 18). Conversation lives only in the
// DOM: no storage, no network.
// ---------------------------------------------------------------------------

const ASSISTANT_WELCOME = "¡Hola! Soy el asistente de salud. Puedo ayudarte a buscar hospitales cercanos, medicamentos, precios y citas. " + ASSISTANT_DISCLAIMER;
const ASSISTANT_SPECIALTY_CHIP_ATTR = "data-specialty-chip";
let assistantPending = [];

function assistantReducedMotion() {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" &&
      !!window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (_) { return false; }
}

function assistantIsMobile() {
  try {
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia === "function") {
      const mq = window.matchMedia("(max-width: 767px)");
      if (mq && typeof mq.matches === "boolean") return mq.matches;
    }
    return typeof window.innerWidth === "number" && window.innerWidth < 768;
  } catch (_) { return false; }
}

// Adds one bubble (.msg.msg-user | .msg.msg-assistant) to #assistant-log using
// textContent and createElement only. Returns the bubble, or null.
function appendMessage(role, text, actions) {
  try {
    const log = document.getElementById("assistant-log");
    if (!log) return null;
    const bubble = document.createElement("div");
    bubble.className = "msg " + (role === "user" ? "msg-user" : "msg-assistant");
    const p = document.createElement("p");
    p.className = "msg-text";
    p.textContent = text === null || text === undefined ? "" : String(text);
    bubble.appendChild(p);
    if (Array.isArray(actions)) {
      for (const a of actions) {
        if (!a || typeof a !== "object") continue;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "msg-action";
        b.textContent = String(a.label);
        b.addEventListener("click", () => runAssistantAction(a.action, a.value));
        bubble.appendChild(b);
      }
    }
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  } catch (_) { return null; }
}

function openAssistant() {
  try {
    const panel = document.getElementById("assistant-panel");
    const fab = document.getElementById("assistant-fab");
    const log = document.getElementById("assistant-log");
    const input = document.getElementById("assistant-input");
    if (!panel) return;
    panel.hidden = false;
    panel.classList.add("open");
    if (fab) {
      fab.setAttribute("aria-expanded", "true");
      fab.classList.add("open");
    }
    if (log && log.children.length === 0) appendMessage("assistant", ASSISTANT_WELCOME);
    if (input && typeof input.focus === "function") input.focus();
  } catch (_) { /* never throw */ }
}

function closeAssistant() {
  try {
    const panel = document.getElementById("assistant-panel");
    const fab = document.getElementById("assistant-fab");
    if (panel) {
      panel.hidden = true;
      panel.classList.remove("open");
    }
    if (fab) {
      fab.setAttribute("aria-expanded", "false");
      fab.classList.remove("open");
      if (typeof fab.focus === "function") fab.focus();
    }
  } catch (_) { /* never throw */ }
}

function removeSpecialtyChips() {
  try {
    document.querySelectorAll("[" + ASSISTANT_SPECIALTY_CHIP_ATTR + "]").forEach((el) => el.remove());
  } catch (_) { /* never throw */ }
}

function showSpecialtyChips() {
  try {
    const box = document.getElementById("assistant-suggestions");
    if (!box) return;
    removeSpecialtyChips();
    for (const specialty of distinctValues(APPOINTMENTS, "specialty")) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip chip-specialty";
      b.setAttribute(ASSISTANT_SPECIALTY_CHIP_ATTR, "1");
      b.textContent = specialty;
      box.appendChild(b);
    }
  } catch (_) { /* never throw */ }
}

function showTypingIndicator() {
  const log = document.getElementById("assistant-log");
  if (!log) return null;
  const el = document.createElement("div");
  el.className = "msg msg-assistant typing-indicator";
  const label = document.createElement("span");
  label.className = "sr-only";
  label.textContent = "escribiendo";
  el.appendChild(label);
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("span");
    dot.className = "typing-dot";
    dot.setAttribute("aria-hidden", "true");
    el.appendChild(dot);
  }
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

function handleAssistantSubmit(rawText) {
  try {
    if (typeof rawText !== "string" || rawText.trim() === "") return;
    const text = rawText.trim();
    removeSpecialtyChips();
    appendMessage("user", text);
    const input = document.getElementById("assistant-input");
    if (input) input.value = "";

    const reply = assistantReply(text);
    const needsSpecialty = (() => {
      const r = interpretMessage(text);
      return r.intent === "appointments" && !(r.params && r.params.specialty);
    })();
    const deliver = () => {
      appendMessage("assistant", reply.text, reply.actions);
      if (needsSpecialty) showSpecialtyChips();
    };

    if (assistantReducedMotion()) {
      deliver();
      return;
    }
    const typing = showTypingIndicator();
    const entry = { typing, timer: null };
    entry.timer = setTimeout(() => {
      assistantPending = assistantPending.filter((e) => e !== entry);
      if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
      deliver();
    }, ASSISTANT_TYPING_MS);
    assistantPending.push(entry);
  } catch (_) { /* never throw */ }
}

function assistantScrollTo(id) {
  try {
    const target = document.getElementById(id);
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: assistantReducedMotion() ? "auto" : "smooth" });
    }
  } catch (_) { /* never throw */ }
}

function runAssistantAction(action, value) {
  try {
    let target = null;
    switch (action) {
      case "hospitals":
        target = "hospitals";
        nearbyHospitals();
        break;
      case "medication": {
        target = "medications";
        const el = document.getElementById("medication-input");
        if (el) el.value = typeof value === "string" ? value : "";
        searchMedications();
        break;
      }
      case "prices": {
        target = "prices";
        const el = document.getElementById("service-select");
        if (el) el.value = typeof value === "string" ? value : "";
        comparePrices();
        break;
      }
      case "appointments": {
        target = "appointments";
        const el = document.getElementById("specialty-select");
        if (el) el.value = typeof value === "string" ? value : "";
        searchAppointments();
        break;
      }
      default:
        return;
    }
    if (assistantIsMobile()) closeAssistant();
    assistantScrollTo(target);
  } catch (_) { /* never throw */ }
}

function clearAssistant() {
  try {
    for (const e of assistantPending) clearTimeout(e.timer);
    assistantPending = [];
    removeSpecialtyChips();
    const log = document.getElementById("assistant-log");
    if (log) {
      while (log.firstChild) log.removeChild(log.firstChild);
    }
    appendMessage("assistant", ASSISTANT_WELCOME);
  } catch (_) { /* never throw */ }
}

// Registers all assistant listeners once. No network, no storage.
function initAssistant() {
  try {
    if (typeof document === "undefined") return;
    const fab = document.getElementById("assistant-fab");
    const panel = document.getElementById("assistant-panel");
    if (!fab || !panel || (fab.dataset && fab.dataset.assistantBound === "1")) return;
    if (fab.dataset) fab.dataset.assistantBound = "1";

    fab.addEventListener("click", () => {
      if (panel.hidden) openAssistant();
      else closeAssistant();
    });

    const close = document.getElementById("assistant-close");
    if (close) close.addEventListener("click", closeAssistant);

    const form = document.getElementById("assistant-form");
    if (form) {
      form.addEventListener("submit", (ev) => {
        if (ev && typeof ev.preventDefault === "function") ev.preventDefault();
        const input = document.getElementById("assistant-input");
        handleAssistantSubmit(input ? input.value : "");
      });
    }

    const chips = document.getElementById("assistant-suggestions");
    if (chips) {
      chips.addEventListener("click", (ev) => {
        const t = ev && ev.target;
        const chip = t && typeof t.closest === "function" ? t.closest(".chip") : null;
        if (chip) handleAssistantSubmit(chip.textContent);
      });
    }

    const clear = document.getElementById("assistant-clear");
    if (clear) clear.addEventListener("click", clearAssistant);

    document.addEventListener("keydown", (ev) => {
      if (ev && ev.key === "Escape" && !panel.hidden) closeAssistant();
    });
  } catch (_) { /* never throw */ }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAssistant);
  } else {
    initAssistant();
  }
}

// ---------------------------------------------------------------------------
// Exports for tests (no effect in the browser)
// ---------------------------------------------------------------------------

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CENTERS, MEDICATIONS, PRICES, APPOINTMENTS, addDaysISO, distanceKm, renderResults, badgeClass, escapeHtml, showPlaceholders, nearbyHospitals, searchMedications, comparePrices, searchAppointments, readCount, readRadius, directionsUrl, mapOverpassElements, geocodeAddress, fetchRemoteCenters, findHospitalsFrom, searchByAddress, setBusy, renderSummary, initActiveNav, nextAvailableAppointment, initials, renderFeaturedAppointment, initSmoothScroll, ASSISTANT_MAX_LENGTH, ASSISTANT_TYPING_MS, EMERGENCY_KEYWORDS, HOSPITAL_KEYWORDS, MEDICATION_KEYWORDS, PRICE_KEYWORDS, APPOINTMENT_KEYWORDS, SYMPTOM_SPECIALTIES, ASSISTANT_DISCLAIMER, normalizeText, interpretMessage, assistantReply, appendMessage, openAssistant, closeAssistant, handleAssistantSubmit, runAssistantAction, clearAssistant, initAssistant };
}
