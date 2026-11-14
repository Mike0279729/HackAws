# Implementation Plan: health-access-agent

## Overview

Build the static Health Access Agent in vanilla JavaScript, delivered as `index.html`, `styles.css` and `app.js` (plus a `README.md`). The design already uses JavaScript, so no language selection is needed. Work proceeds from page skeleton and styles, to core logic in `app.js` (data catalogs, `distanceKm`, `renderResults`), to the four modules, and ends with wiring and the README.

Test files are dev-only and live under `tests/`, outside the three delivered app files. They use Vitest with jsdom and fast-check. `app.js` ends with a guarded `module.exports` so tests can import it without affecting browser use.

## Tasks

- [x] 1. Create the page skeleton and styles
  - [x] 1.1 Create `index.html`
    - Add four `<section>` elements with IDs `hospitals`, `medications`, `prices`, `appointments`, each with a heading and a results container (`#hospitals-results`, `#medications-results`, `#prices-results`, `#appointments-results`)
    - Add controls: "Find Nearest" button, `#medication-input` with search button, `#service-select` with compare button, `#specialty-select` with search button
    - Populate select options to match the catalog values in `app.js`
    - Add a nav with anchor links to the four section IDs
    - Link `styles.css` and `app.js` with plain `<link>` and `<script>` tags (no bundler, no CDN)
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 9.2, 9.3_

  - [x] 1.2 Create `styles.css`
    - Card grid with `repeat(auto-fill, minmax(280px, 1fr))` and a single column below 600px
    - Card styling, `.no-results` style, placeholder (loading) card style
    - Badge colours: green for "In stock"/"Available", red for "Out of stock"/"Full", orange for "Limited", grey for any other value
    - Smooth scrolling for nav anchors
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 7.5_

- [x] 2. Implement core logic in `app.js`
  - [x] 2.1 Add data catalogs and `distanceKm`
    - Declare `CENTERS` (at least 3 entries with valid lat/lon), `MEDICATIONS`, `PRICES` and `APPOINTMENTS` as `const` arrays, with multiple specialties and services, and both available and unavailable slots
    - Implement `distanceKm(lat1, lon1, lat2, lon2)` with the Haversine formula, validating that each argument is a finite number in range and throwing an error that names the invalid argument and the violated constraint
    - Add a guarded `module.exports` at the end of the file for tests
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 2.2 Set up the test harness and write property tests for `distanceKm`
    - Create `package.json` (dev dependencies only: vitest, jsdom, fast-check) and a Vitest config using the jsdom environment
    - Create `tests/distance.test.js`
    - **Property 1: Distance non-negativity**
    - **Property 2: Distance identity**
    - **Property 3: Distance symmetry**
    - Include unit tests for a known reference distance (within ±0.5%), antipodal points (at most 20,037 km) and invalid arguments throwing
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**

  - [x] 2.3 Implement `renderResults(containerId, items, fallbackMessage = "No results found.")`
    - Throw an error if the container is not found, before touching the DOM
    - Render one `.card` per item with title, badge, subtitle and detail; render `null`/`undefined`/missing fields as empty strings
    - Render a single `.no-results` element with the fallback message for an empty array
    - Replace the container `innerHTML` fully on each call, using one assignment
    - HTML-escape field values before insertion, as the design recommends
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 2.4 Write property tests for `renderResults`
    - Create `tests/renderer.test.js`
    - **Property 13: Renderer card count**
    - **Property 14: Renderer idempotence**
    - Unit tests: empty array gives one `.no-results` and no cards; N items then M items leaves M cards; missing container throws and leaves the DOM unchanged; missing `title` renders an empty title
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement the Nearby Hospitals module
  - [x] 4.1 Implement `nearbyHospitals()` in `app.js`
    - Call `navigator.geolocation.getCurrentPosition` with a 10-second timeout
    - On success, compute the distance to each center, sort ascending, take at most 3 (all entries if fewer than 3), and render cards with name, type, address, distance (`toFixed(1)` km) and phone
    - If `CENTERS` is empty, render a "no medical centers available" message
    - On error, permission denial, timeout or missing `navigator.geolocation`, render a message with the failure reason and keep previously rendered content; never throw an unhandled exception
    - Expose the function globally for the `onclick` handler and export it for tests
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 4.2 Write property tests for `nearbyHospitals`
    - Create `tests/hospitals.test.js` with a mocked `navigator.geolocation`
    - **Property 4: Top-3 bound and sort order**
    - **Property 5: Hospital card completeness**
    - Unit tests for the error, timeout and empty-catalog paths
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

- [x] 5. Implement the Medication Availability module
  - [x] 5.1 Implement `searchMedications()` in `app.js`
    - Read and trim `#medication-input`
    - For an empty or whitespace-only query, render a prompt and no cards
    - For a query over 200 characters, render a "query too long" error and do not search
    - Filter `MEDICATIONS` by case-insensitive substring match on `name`; render cards with name, pharmacy, status and price as `"$" + toFixed(2)`
    - Render "No results found." when nothing matches
    - Wrap data access in try/catch and render a "data could not be retrieved" error with no cards on failure
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 5.2 Write property tests for `searchMedications`
    - Create `tests/medications.test.js`
    - **Property 6: Case-insensitive medication search**
    - **Property 7: Whitespace query guard**
    - **Property 8: Medication card completeness**
    - Unit tests for no match, an over-200-character query and the data-failure path
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

- [x] 6. Implement the Price Comparator module
  - [x] 6.1 Implement `comparePrices()` in `app.js`
    - For an empty selection, render a prompt and no cards
    - Filter `PRICES` by exact match on `service`; render cards with provider, includes, `service` and price as `"$" + toFixed(2)`
    - Render "No results found." when nothing matches
    - Clear the previous content of `#prices-results` before rendering new results
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 6.2 Write property tests for `comparePrices`
    - Create `tests/prices.test.js`
    - **Property 9: Price filter exactness**
    - **Property 10: Price card completeness**
    - Unit tests for the empty selection, no match, and replacement of previous results
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

- [x] 7. Implement the Appointments module
  - [x] 7.1 Implement `searchAppointments()` in `app.js`
    - For an empty selection, render a prompt and no cards
    - Filter `APPOINTMENTS` by exact, case-sensitive `specialty` match and `available === true`; render cards with doctor, specialty, date (YYYY-MM-DD) and time (HH:MM)
    - Render "No results found." when no available slot matches
    - Wrap data access in try/catch and render an "appointments could not be loaded" error with no cards on failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 7.2 Write property tests for `searchAppointments`
    - Create `tests/appointments.test.js`
    - **Property 11: Available-only appointment filter**
    - **Property 12: Appointment card completeness**
    - Unit tests for the empty selection, a specialty whose slots are all taken, and the data-failure path
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Final wiring, README and verification
  - [x] 9.1 Wire up `index.html` and `app.js`
    - Connect every button's `onclick` to `nearbyHospitals`, `searchMedications`, `comparePrices` and `searchAppointments`
    - Show at least 3 placeholder cards in each results container while a query is pending (for example during geolocation)
    - When running on `file://` and geolocation is denied, show a message that a local HTTP server is required for location features
    - Ensure the page shows all four headings and empty results containers when `app.js` fails to load
    - Confirm no external requests, no npm runtime dependencies and no CDN imports in the three delivered files
    - _Requirements: 2.4, 7.3, 7.4, 7.5, 7.6, 8.5, 9.1, 9.2, 9.3, 9.4, 9.6_

  - [x] 9.2 Create `README.md`
    - Describe the app and how to open `index.html` directly
    - Explain that Chromium browsers may block geolocation on `file://`, and give `python -m http.server` as the workaround
    - Describe how to run the optional tests (`npx vitest --run`)
    - _Requirements: 9.5_

  - [x] 9.3 Write DOM-level unit tests for page structure
    - Create `tests/structure.test.js` that loads `index.html` in jsdom
    - Assert the four section IDs, the four results container IDs, the `<link>` and `<script>` tags, and the nav anchors
    - Assert the badge-class mapping for known and unknown statuses, if that mapping is implemented in `app.js`
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 8.3, 8.4_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Add pure helpers for the hospital enhancements in `app.js`
  - [x] 11.1 Implement `readCount()`, `readRadius()`, `directionsUrl()` and `mapOverpassElements()`
    - `readCount`: read `#hospital-count-select`, accept only 3, 5, 10, default 3
    - `readRadius`: read `#hospital-radius-select`, accept "any", 5, 10, 25, 50, return a number or `null` for "any", default `null`
    - `directionsUrl(originLat, originLon, destLat, destLon)`: build `https://www.google.com/maps/dir/?api=1[&origin=...]&destination=...` using `encodeURIComponent` on numeric coordinates only; omit `origin` when it is not finite; throw on a non-finite destination
    - `mapOverpassElements(elements)`: map OSM_Elements to MedicalCenter (name, type from `amenity`, address from `addr:*`, phone from `phone` or `contact:phone` or "N/A", `center` for ways); drop unnamed elements and elements without finite in-range coordinates; return `[]` for non-arrays
    - Export all four from the guarded `module.exports`
    - _Requirements: 10.1, 10.2, 10.6, 11.2, 11.3, 11.4, 11.7, 13.2, 13.3, 13.4_

  - [ ]* 11.2 Write property test for option reading
    - Create `tests/hospital-options.test.js`
    - **Property 16: Invalid option values fall back to defaults**
    - **Validates: Requirements 10.1, 10.2, 10.6**

  - [ ]* 11.3 Write property test for `directionsUrl`
    - Create `tests/directions.test.js`
    - **Property 17: Directions URL well-formedness and encoding**
    - Unit tests: origin omitted when unknown; throws for a non-finite destination
    - **Validates: Requirements 11.2, 11.3, 11.4, 11.7**

  - [ ]* 11.4 Write property test for `mapOverpassElements`
    - Create `tests/overpass-mapping.test.js`
    - **Property 19: Overpass mapping drops unnamed elements and never yields invalid coordinates**
    - Unit tests: way with `center`, `contact:phone` fallback, "N/A" fallback, non-array input
    - **Validates: Requirements 13.2, 13.3, 13.4**

- [x] 12. Add the two network functions in `app.js`
  - [x] 12.1 Implement `geocodeAddress(query)`
    - Trim the query; return `empty` for blank input and `too-long` for more than 200 characters, without calling `fetch`
    - Call `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=` plus `encodeURIComponent(query)` with an `AbortController` and a 10 000 ms timeout; clear the timer in `finally`
    - Return `{ ok: true, lat, lon }` only for finite in-range coordinates; otherwise `not-found`, `network` or `timeout`; never throw
    - Export for tests
    - _Requirements: 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 9.1_

  - [x] 12.2 Write property tests for `geocodeAddress` (mocking `fetch`)
    - Create `tests/geocode.test.js`
    - **Property 22: Geocoder input guard**
    - **Property 23: Geocoder request encoding**
    - **Property 24: Geocoder never throws and classifies outcomes**
    - Unit test: a never-resolving `fetch` with fake timers returns `timeout` after 10 000 ms
    - **Validates: Requirements 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8**

  - [x] 12.3 Implement `fetchRemoteCenters(lat, lon, radiusKm)`
    - POST an Overpass QL query to `https://overpass-api.de/api/interpreter` selecting nodes and ways with `amenity` of `hospital`, `clinic` or `doctors` within `around:<radiusKm * 1000>` of the coordinates, ending with `out center`
    - Use an `AbortController` with a 10 000 ms timeout; reject on network error, non-OK status or abort; return `mapOverpassElements(json.elements)`
    - Export for tests
    - _Requirements: 13.1, 13.2, 13.6, 9.1_

  - [ ]* 12.4 Write unit tests for `fetchRemoteCenters` (mocking `fetch`)
    - Create `tests/overpass-fetch.test.js`
    - Assert the endpoint, `around:10000` for 10 km and `around:5000` for 5 km, `out center` in the body, rejection on non-OK status, and abort after 10 000 ms with fake timers
    - _Requirements: 13.1, 13.5, 13.6_

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement the shared hospital flow and rendering changes
  - [x] 14.1 Extend `renderResults` with an optional `link` field
    - Render `<a class="card-link" href="..." target="_blank" rel="noopener noreferrer">text</a>` for items with `link: { href, text }`, escaping both the `href` value and the text
    - Items without `link` render exactly as before
    - _Requirements: 11.1, 11.5, 13.12, 6.1_

  - [x] 14.2 Implement `findHospitalsFrom`, `searchByAddress`, and refactor `nearbyHospitals`
    - `findHospitalsFrom(lat, lon)`: read count and radius; try `fetchRemoteCenters(lat, lon, radius ?? 10)`; on rejection or zero centers use `CENTERS` and show the Fallback_Notice; compute distances, filter by radius when set, sort ascending, slice to the count; build items with a `link` from `directionsUrl(lat, lon, c.lat, c.lon)`
    - Render "No hospitals found within R km. Try increasing the radius." when the radius filter empties the list, and a "no medical centers" message when no centers exist
    - Show "Data © OpenStreetMap contributors" only when remote data is shown; show the fallback notice only when `CENTERS` is used
    - `searchByAddress()`: show placeholder cards, call `geocodeAddress(#location-input.value)`, render a clear message per failure reason, otherwise call `findHospitalsFrom`
    - `nearbyHospitals()`: keep the 10-second geolocation timeout and error messages, add the hint to type an address, and call `findHospitalsFrom` on success
    - Expose `searchByAddress` globally and export all new functions for tests
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 10.3, 10.4, 10.5, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 13.5, 13.6, 13.7, 13.8, 13.9, 13.11_

  - [ ]* 14.3 Write property tests for count and radius behaviour
    - Create `tests/hospital-flow.test.js` with `fetch` mocked to return generated Overpass responses
    - **Property 4: Top-N bound and sort order**
    - **Property 15: Radius filter**
    - Unit test: the empty-radius message suggests increasing the radius
    - **Validates: Requirements 2.2, 2.3, 10.3, 10.4, 10.5**

  - [ ]* 14.4 Write property tests for directions links and escaping
    - Create `tests/hospital-cards.test.js`
    - **Property 18: Every hospital Card has a safe directions link**
    - **Property 25: Remote data is HTML-escaped**
    - **Validates: Requirements 11.1, 11.5, 11.6, 13.12**

  - [ ]* 14.5 Write property tests for fallback and attribution
    - Create `tests/hospital-fallback.test.js`
    - **Property 20: Remote failure falls back to CENTERS**
    - **Property 21: Attribution and fallback notice are mutually exclusive**
    - **Validates: Requirements 13.5, 13.6, 13.7, 13.8, 13.9**

- [x] 15. Update the page, styles, tests and README
  - [x] 15.1 Update `index.html`
    - Add `#hospital-count-select` (3, 5, 10; 3 selected) and `#hospital-radius-select` (any, 5, 10, 25, 50; "any" selected)
    - Add `#location-input` and a "Search by address" button with `onclick="searchByAddress()"`
    - Add the Privacy_Notice near the "Find Nearest" and "Search by address" buttons, and an attribution element that is hidden until remote data is shown
    - Keep the three-file delivery and no CDN
    - _Requirements: 10.1, 10.2, 12.1, 13.8, 13.10, 9.2, 9.3_

  - [x] 15.2 Update `styles.css`
    - Style the new controls, the `.card-link` anchor, the privacy notice, the fallback notice and the attribution text, keeping the responsive grid unchanged
    - _Requirements: 8.1, 8.2, 11.1, 13.8, 13.10_

  - [x] 15.3 Wire the new controls in `app.js`
    - Make Enter in `#location-input` trigger `searchByAddress`
    - Show at least 3 placeholder cards in `#hospitals-results` while geolocation, geocoding or the Overpass request is pending
    - Confirm that only `findHospitalsFrom` and `geocodeAddress` call `fetch`, and that they run only from the hospital handlers
    - _Requirements: 8.5, 9.1, 9.4, 12.9, 13.11_

  - [x] 15.4 Update the existing hospital tests
    - Update `tests/hospitals.test.js` so `fetch` is mocked to reject (exercising the `CENTERS` fallback) and the earlier top-3, card completeness, error, timeout and empty-catalog tests still pass
    - Keep the earlier Property 5 test
    - _Requirements: 2.2, 2.4, 2.5, 2.6, 2.7, 13.9_

  - [ ]* 15.5 Write structure and offline-module tests
    - Extend `tests/structure.test.js` to assert the new element IDs, default option values, the privacy notice and the absence of CDN or external `<script>`/`<link>` URLs
    - Add `tests/offline-modules.test.js` asserting that `searchMedications`, `comparePrices` and `searchAppointments` make zero `fetch` calls and that loading `app.js` makes none
    - **Validates: Requirements 9.1, 9.2, 9.4, 10.1, 10.2, 12.1, 13.10, 13.11**

  - [x] 15.6 Update `README.md`
    - Document the four hospital enhancements, the two OpenStreetMap endpoints, the privacy notice, the offline fallback and the attribution
    - _Requirements: 9.5, 13.10_

- [x] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Redesign the `index.html` markup
  - [x] 17.1 Rebuild the page structure in `index.html`
    - Add a skip link to `#main`, a hero `<header>` with the `<h1>` app name and a one-line tagline, and a sticky `<nav aria-label="Sections">` with four links, each with an inline SVG or emoji icon and a text label
    - Make each section a panel with an icon, heading, and a one-line description, and add `<main id="main">` and a `<footer>` with the disclaimer "Demo data. Not medical advice. In an emergency call your local emergency number." and an OpenStreetMap note
    - Give every input and select a visible `<label for>`, add placeholders ("Ibuprofeno" in `#medication-input`, an address example in `#location-input`), and use `btn btn-primary` and `btn btn-secondary` classes on buttons
    - Add `aria-live="polite"` to the four results containers and a summary element `<id>-summary` (class `results-summary`, `aria-live="polite"`) before each results container
    - Keep `<html lang="en">`, the three-file delivery, no CDN, no external fonts or images, and every existing ID and class (`hospitals-results`, `hospital-count-select`, `hospital-radius-select`, `location-input`, `medication-input`, `service-select`, `specialty-select`, `osm-attribution`, `privacy-notice`)
    - _Requirements: 14.1, 14.4, 14.5, 14.6, 14.10, 14.21, 14.22, 14.23, 14.24, 14.25_

- [x] 18. Rewrite `styles.css` with the design system
  - [x] 18.1 Implement the design system in `styles.css`
    - Define the CSS custom properties for colours (AA contrast), status colours, radii, shadows, spacing, and the system font stack
    - Style the hero, sticky nav with an `.active` state, panels, labelled controls in a mobile-first layout, primary and secondary buttons with hover, focus, disabled, and `aria-busy` spinner states, and the footer
    - Style cards (title, coloured badge pill, muted subtitle, prominent detail and price), `.card-link` as a button, and keep the `auto-fill` / `minmax(280px, 1fr)` grid with one column below 600px and the existing badge colour mapping
    - Add `.placeholder` skeleton cards with a `@keyframes shimmer` animation, `.no-results` info and `.error` styles with an icon, and `.results-summary`
    - Add a `:focus-visible` outline of at least 3px, 44px minimum heights for buttons, selects, inputs, and nav links, rules that prevent horizontal scroll at 320px, and `prefers-reduced-motion` overrides
    - _Requirements: 14.2, 14.6, 14.12, 14.13, 14.14, 14.15, 14.16, 14.17, 14.18, 14.19, 14.20, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 19. Add the UX enhancements to `app.js`
  - [x] 19.1 Implement the helpers and wire them in `app.js`
    - Add `setBusy(button, busy)`, `renderSummary(containerId, text)`, and `initActiveNav()` (guarded when `IntersectionObserver` is missing), and export them from the guarded `module.exports`
    - Call `setBusy` around `nearbyHospitals()` and `searchByAddress()` with a `finally` block so buttons are restored after success, failure, and timeout, and so a pending search cannot be submitted twice
    - Make Enter in `#medication-input` call `searchMedications()`, and do not trigger searches from select `change` events
    - Call `renderSummary` after each module renders, with a singular or plural count text such as "3 hospitals found", and an empty string for empty and error states
    - Add icons and the `info` or `error` modifier to `.no-results` through an optional parameter of `renderResults` that keeps the existing output for existing calls, and escape every inserted string
    - Register the Enter handler and `initActiveNav` on `DOMContentLoaded`, with no network request at load
    - _Requirements: 14.2, 14.3, 14.7, 14.8, 14.9, 14.10, 14.11, 14.15, 14.25, 6.1, 6.2, 6.3_

- [x] 20. Update the tests and run the full suite
  - [x] 20.1 Update `tests/structure.test.js` for the new markup and run all tests
    - Assert landmarks, skip link, `lang`, four nav links with icons, `<label for>` for each input and select, `aria-live="polite"` on the four results containers, summary elements, the footer disclaimer, the "Ibuprofeno" placeholder, and every preserved ID and class
    - Read `styles.css` as text and assert the custom properties, `:focus-visible`, `prefers-reduced-motion`, `min-height: 44px`, `@keyframes shimmer`, and the grid `minmax(280px, 1fr)`
    - Add example tests for `setBusy`, `renderSummary` (including a missing element), the Enter key on `#medication-input`, and `initActiveNav` with and without `IntersectionObserver`
    - Run the full suite with `npx vitest --run` and fix any failure caused by the redesign without weakening existing tests
    - _Requirements: 14.1, 14.3, 14.5, 14.7, 14.8, 14.10, 14.21, 14.23, 14.24, 14.25_

- [x] 21. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 22. Localize to Spanish and generate dynamic appointment dates
  - [x] 22.1 Translate `index.html` to Spanish
    - Set `<html lang="es">` and translate the page title, hero, nav labels, section titles and descriptions, field labels, placeholders, button texts, Privacy_Notice, attribution wording (keep "© colaboradores de OpenStreetMap"), and footer disclaimer
    - Keep `<option value>` strings of `#service-select` and `#specialty-select` equal to the `PRICES` service and `APPOINTMENTS` specialty values
    - Keep every existing ID, class name, and the three-file delivery unchanged
    - _Requirements: 15.1, 15.2, 15.3, 15.6, 15.11_

  - [x] 22.2 Add Spanish strings, badge mapping, and dynamic dates in `app.js`
    - Translate every loading, prompt, error, empty, and notice message (including the Fallback_Notice and attribution text) and the summary lines with singular and plural forms ("1 hospital encontrado", "3 hospitales encontrados")
    - Use the status values "En stock", "Agotado", "Limitado", "Disponible", "Lleno" in `MEDICATIONS` and the appointment cards; make the badge class mapping accept these and the previous English values, with grey for any other value
    - Render appointment detail as `date + " a las " + time`; keep `"$" + toFixed(2)` for prices; translate remaining English catalog text consistently with the select options
    - Implement `addDaysISO(baseDate, days)` using local-time components, generate `APPOINTMENTS` dates at load with offsets between 1 and 30 spread across entries, keep available and unavailable slots and at least two specialties, and export `addDaysISO` from the guarded `module.exports`
    - _Requirements: 15.3, 15.4, 15.5, 15.7, 15.8, 15.9, 15.10, 15.11, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [x] 22.3 Update the affected tests and add tests for dates
    - Update `tests/structure.test.js`, `tests/medications.test.js`, `tests/prices.test.js`, `tests/appointments.test.js`, `tests/hospitals.test.js`, `tests/renderer.test.js`, `tests/geocode.test.js`, and any other test asserting English strings to the Spanish copy, without weakening the assertions; remove any hardcoded 2025 date expectations
    - Add tests for `addDaysISO` and the dynamic dates, tagged `Feature: health-access-agent`
    - **Property 29: addDaysISO yields a valid later ISO date**
    - **Property 30: Every appointment date is after today**
    - **Property 31: Badge colour mapping covers both vocabularies**
    - Run the full suite with `npx vitest --run` and fix failures
    - **Validates: Requirements 15.1, 15.5, 15.7, 15.8, 15.9, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6**

- [x] 23. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 24. Adapt the app to a mobile-app look and feel
  - [x] 24.1 Restructure `index.html`
    - Add `viewport-fit=cover` to the viewport meta, and replace the hero with the `<header class="welcome-hero">` containing the tagline "Atención de calidad, <strong class="hero-accent">donde estés</strong>" in the `<h1>`, a Spanish subtitle, a `.feature-strip` with three items (Hospitales cercanos, Medicamentos, Citas), and `<button id="start-btn" class="btn-pill">Comenzar</button>`
    - Add `<div id="home" class="home-area">` at the start of `<main id="main">` with the App_Bar (brand and info icon), "Hola", the heading "¿Cómo podemos ayudarte hoy?", `.quick-actions` with four `a.quick-tile` anchors (`#hospitals`, `#medications`, `#prices`, `#appointments`) each with a coloured icon and label, and `<div id="featured-appointment" class="featured-card" hidden>`
    - Keep the sticky `.topnav` (hidden on phones by CSS) and add the `<nav class="tabbar" aria-label="Navegación principal">` with `a.tab` links for `#home` (Inicio), `#hospitals`, `#medications`, `#appointments`, and the centred `a.tab-fab` for `#prices` (Precios) with a distinct inline SVG icon
    - Keep every existing ID, class, `onclick` handler, label, `aria-live` attribute, the footer, `lang="es"`, the three-file delivery, and no CDN, external font, or external image
    - _Requirements: 17.3, 17.4, 17.5, 17.7, 17.8, 17.9, 17.13, 17.15, 17.17, 17.20, 17.25, 17.26, 17.27_

  - [x] 24.2 Restyle `styles.css`
    - Update the design tokens on `:root` (royal blue primary, light-blue backgrounds, white surfaces, 16-24px radii, soft shadows, tile accent colours, `--container-max: 1100px`, `--tabbar-height`), keeping AA contrast and the existing badge colours
    - Style the Welcome_Hero gradient, `.hero-accent`, `.feature-strip`, `.btn-pill`, App_Bar, greeting and heading, `.quick-actions` (2 columns on phones, 4 columns from 768px), `.quick-tile` with coloured icon circles, `.featured-card` with avatar, detail and pill, panels as app-screen cards, and `.card-avatar` inside cards
    - Style `.tabbar` and `.tab-fab`: fixed bottom, `env(safe-area-inset-bottom)` padding, 44px minimum targets, `.active` state; show it and hide `.topnav` below 768px, and do the reverse from 768px; add bottom padding to `main` and `footer` below 768px so the bar does not cover content
    - Centre content in a container of at most 1100px, keep the `minmax(280px, 1fr)` grid, keep no horizontal scroll at 320px, and disable smooth scroll and hover transforms under `prefers-reduced-motion: reduce`
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.10, 17.13, 17.17, 17.21, 17.22, 17.24, 17.25, 17.26, 17.28_

  - [x] 24.3 Add the helpers and wiring in `app.js`
    - Implement the pure `nextAvailableAppointment(slots)` and `initials(name)` and the DOM function `renderFeaturedAppointment()` (hides the card when there is no available slot, escapes every inserted string, makes no network request)
    - Extend `renderResults` with the optional item field `icon` that renders a leading `<span class="card-avatar" aria-hidden="true">` with the escaped icon, and keep the output unchanged for items without `icon`
    - Set `icon` to 🏥, 💊, 💲, and 🩺 on the hospital, medication, price, and appointment items
    - Extend `initActiveNav()` to observe `home` and the four sections and mark matching links in both `.topnav` and `.tabbar`
    - Implement `initSmoothScroll()` for `#start-btn`, `.quick-tile`, `.tab`, `.tab-fab`, and the "Ver todas" link, using `scrollIntoView` with `"auto"` behaviour under `prefers-reduced-motion: reduce`
    - Register `renderFeaturedAppointment` and `initSmoothScroll` on `DOMContentLoaded`, and add all new functions to the guarded `module.exports`
    - _Requirements: 17.6, 17.9, 17.11, 17.12, 17.13, 17.14, 17.15, 17.16, 17.18, 17.19, 17.23, 17.27, 17.28_

  - [x] 24.4 Update and add tests, then run the full suite
    - Update `tests/structure.test.js` for the new markup (hero, tagline accent, feature strip, "Comenzar", App_Bar, greeting, heading, four tiles with `href`s, `#featured-appointment`, Tab_Bar with four tabs and the "Precios" floating link, viewport meta) and for the new CSS tokens, media queries, and `env(safe-area-inset-bottom)`, without weakening existing assertions
    - Add tests for `nextAvailableAppointment`, `initials`, `renderFeaturedAppointment` (shown and hidden), `initActiveNav` marking a top-nav link and a tab, `initSmoothScroll`, the card icons per module, and `renderResults` with and without `icon`, tagged `Feature: health-access-agent`
    - **Property 32: nextAvailableAppointment returns the earliest available slot**
    - **Property 33: initials is a non-empty uppercase string**
    - **Property 34: Renderer output is unchanged when no icon is given, and shows the icon when given**
    - Run the full suite with `npx vitest --run` and fix every failure caused by the redesign
    - **Validates: Requirements 17.3 to 17.20, 17.23, 17.25, 17.27**

- [x] 25. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties; unit tests cover specific examples and edge cases
- Test tooling is dev-only and is not part of the three delivered app files

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1"] },
    { "id": 1, "tasks": ["2.2", "2.3"] },
    { "id": 2, "tasks": ["2.4", "4.1"] },
    { "id": 3, "tasks": ["4.2", "5.1"] },
    { "id": 4, "tasks": ["5.2", "6.1"] },
    { "id": 5, "tasks": ["6.2", "7.1"] },
    { "id": 6, "tasks": ["7.2", "9.1"] },
    { "id": 7, "tasks": ["9.2", "9.3"] },
    { "id": 8, "tasks": ["11.1", "15.1", "15.2"] },
    { "id": 9, "tasks": ["11.2", "11.3", "11.4", "12.1"] },
    { "id": 10, "tasks": ["12.2", "12.3"] },
    { "id": 11, "tasks": ["12.4", "14.1"] },
    { "id": 12, "tasks": ["14.2"] },
    { "id": 13, "tasks": ["14.3", "14.4", "14.5", "15.3"] },
    { "id": 14, "tasks": ["15.4", "15.5", "15.6"] },
    { "id": 15, "tasks": ["17.1"] },
    { "id": 16, "tasks": ["18.1", "19.1"] },
    { "id": 17, "tasks": ["20.1"] },
    { "id": 18, "tasks": ["22.1"] },
    { "id": 19, "tasks": ["22.2"] },
    { "id": 20, "tasks": ["22.3"] },
    { "id": 21, "tasks": ["24.1"] },
    { "id": 22, "tasks": ["24.2", "24.3"] },
    { "id": 23, "tasks": ["24.4"] }
  ]
}
```
