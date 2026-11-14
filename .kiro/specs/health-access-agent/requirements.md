# Requirements Document

## Introduction

Health Access Agent is a zero-dependency static single-page application that provides users with immediate access to four health-service functions: finding nearby hospitals and medical centers, checking medication availability and pricing, comparing service prices across providers, and browsing available appointment slots by specialty. The application runs by opening `index.html` directly in a browser with no build step, no backend, no npm runtime packages, no API keys, and no CDN imports, and it is delivered as three files.

The medication, price, and appointment modules are served entirely from in-memory JavaScript catalogs defined in `app.js` and remain fully offline. The Nearby Hospitals module can additionally use two OpenStreetMap services, and only in response to a user action in the hospitals section: Nominatim to convert a typed address into coordinates, and the Overpass API to fetch real nearby hospitals. The local `CENTERS` catalog remains available as an offline fallback. The user can choose how many hospitals to show and a maximum search radius, and each hospital Card offers a Google Maps directions link that opens in a new tab as a plain navigation link.

## Glossary

- **App**: The Health Access Agent single-page application composed of `index.html`, `styles.css`, and `app.js`.
- **CENTERS**: The in-memory array of `MedicalCenter` objects declared in `app.js`.
- **MEDICATIONS**: The in-memory array of `Medication` objects declared in `app.js`.
- **PRICES**: The in-memory array of `ServicePrice` objects declared in `app.js`.
- **APPOINTMENTS**: The in-memory array of `AppointmentSlot` objects declared in `app.js`.
- **Geolocation_API**: The browser's `navigator.geolocation` interface.
- **Haversine**: The spherical-Earth distance formula implemented as `distanceKm(lat1, lon1, lat2, lon2)`.
- **Renderer**: The `renderResults(containerId, items, fallbackMessage?)` function in `app.js`.
- **Card**: A `<div class="card">` element rendered by the Renderer containing title, subtitle, badge, and detail fields.
- **MedicalCenter**: A JavaScript object with fields `name`, `type`, `address`, `phone`, `lat`, and `lon`.
- **Medication**: A JavaScript object with fields `name`, `pharmacy`, `status`, and `price`.
- **ServicePrice**: A JavaScript object with fields `service`, `provider`, `price`, and `includes`.
- **AppointmentSlot**: A JavaScript object with fields `specialty`, `doctor`, `date`, `time`, and `available`.
- **Result_Count**: The number of hospitals to display, chosen in `#hospital-count-select` from 3, 5, or 10, with a default of 3.
- **Search_Radius**: The optional maximum distance in kilometres chosen in `#hospital-radius-select` from "any", 5, 10, 25, or 50, with a default of "any".
- **Effective_Radius**: The Search_Radius in kilometres used for the Overpass query, equal to the selected Search_Radius or 10 when "any" is selected.
- **Hospital_Flow**: The shared function `findHospitalsFrom(lat, lon)` that obtains centers, computes distances, applies the Search_Radius and Result_Count, and renders Cards. Both the Geolocation_API path and the Manual_Location path call it.
- **Directions_Link**: An anchor on each hospital Card whose `href` is a Google Maps directions URL built by `directionsUrl(originLat, originLon, destLat, destLon)`.
- **Manual_Location**: A user-typed address or city entered in `#location-input` and submitted with the "Search by address" button.
- **Nominatim**: The OpenStreetMap geocoding service at `https://nominatim.openstreetmap.org/search`.
- **Geocoder**: The function `geocodeAddress(query)` that resolves a Manual_Location to coordinates using Nominatim.
- **Overpass_API**: The OpenStreetMap query service at `https://overpass-api.de/api/interpreter`.
- **Remote_Fetcher**: The function `fetchRemoteCenters(lat, lon, radiusKm)` that queries the Overpass_API and returns MedicalCenter objects.
- **OSM_Element**: A node or way object in an Overpass_API response, carrying `tags` and either `lat`/`lon` (nodes) or `center` (ways).
- **Remote_Data**: MedicalCenter objects produced by the Remote_Fetcher from OSM_Elements.
- **Fallback_Notice**: The message shown in `#hospitals-results` area stating that offline or local data is being shown.
- **Attribution_Text**: The text "Data © OpenStreetMap contributors".
- **Privacy_Notice**: A short message near the hospital search buttons stating that coordinates or the typed address are sent to OpenStreetMap services.
- **addDaysISO**: The pure helper `addDaysISO(baseDate, days)` in `app.js` that returns the local-time date `days` days after `baseDate` as `YYYY-MM-DD`.
- **OSM_Endpoints**: The only two network origins the App may contact: `https://nominatim.openstreetmap.org` and `https://overpass-api.de`.

---

## Requirements

### Requirement 1: Distance Calculation

**User Story:** As a developer, I want an accurate Haversine distance function, so that nearby hospitals can be ranked by real geographic distance.

#### Acceptance Criteria

1. THE Haversine SHALL accept exactly four numeric arguments representing two coordinate pairs (lat1, lon1, lat2, lon2) in decimal degrees and return a single numeric value representing the distance in kilometres, rounded to no fewer than 3 decimal places of precision.
2. WHEN both coordinate pairs are identical, THE Haversine SHALL return exactly 0.
3. THE Haversine SHALL return a value greater than or equal to 0 for all valid input coordinate pairs.
4. WHEN two coordinate pairs are provided in opposite order, THE Haversine SHALL return the same distance value such that the absolute difference between distanceKm(lat1, lon1, lat2, lon2) and distanceKm(lat2, lon2, lat1, lon1) is less than 0.001 km.
5. IF any argument to the Haversine is not a finite number within valid coordinate ranges (lat ∈ [-90, 90], lon ∈ [-180, 180]), THEN THE Haversine SHALL throw an error with a message indicating which argument is invalid and the violated constraint.
6. WHEN the two coordinate pairs represent points on opposite sides of the Earth (antipodal points), THE Haversine SHALL return a distance value no greater than 20,037 km (half of Earth's circumference).
7. WHEN the Haversine is called with two coordinate pairs representing a known reference distance, THE Haversine SHALL return a value within ±0.5% of the accepted geodetic distance for that pair.

---

### Requirement 2: Nearby Hospitals Module

**User Story:** As a user, I want to find the nearest medical centers to my current location, so that I can quickly reach medical help.

#### Acceptance Criteria

1. WHEN the user clicks the "Find Nearest" button, THE App SHALL request the user's current position via the Geolocation_API.
2. WHEN the Geolocation_API returns valid coordinates, THE App SHALL run the Hospital_Flow, which computes the distance from the user's position to every available center using the Haversine formula and renders the closest entries, up to the Result_Count (default 3), as Cards in `#hospitals-results`, sorted by ascending distance.
3. WHEN fewer centers than the Result_Count are available, THE App SHALL render all available entries rather than exactly the Result_Count.
4. IF the Geolocation_API returns an error or permission is denied, THEN THE App SHALL render an error message indicating the failure reason in `#hospitals-results` and preserve any previously rendered content, without throwing an unhandled exception.
5. WHEN hospital Cards are rendered, THE App SHALL display each center's name, type, address, distance in kilometres rounded to one decimal place, and phone number.
6. IF the Geolocation_API does not return a response within 10 seconds of the request being made, THEN THE App SHALL cancel the request and render an error message indicating a timeout in `#hospitals-results`.
7. IF no centers are available from Remote_Data or CENTERS, THEN THE App SHALL render a message in `#hospitals-results` indicating that no medical centers are available.
8. IF the Geolocation_API returns an error, times out, or is unavailable, THEN THE App SHALL keep the Manual_Location controls usable and the error message SHALL mention that an address can be typed instead.

---

### Requirement 3: Medication Availability Module

**User Story:** As a user, I want to search for a medication by name and see its availability and price, so that I can find where to obtain it.

#### Acceptance Criteria

1. WHEN the user enters a non-empty search query and clicks the search button, THE App SHALL filter MEDICATIONS using a case-insensitive substring match on the `name` field and render all matching entries as Cards in `#medications-results`.
2. WHEN the user submits an empty or whitespace-only search query, THE App SHALL render a prompt message in `#medications-results` and SHALL NOT render any medication Cards.
3. WHEN no MEDICATIONS entry matches the query, THE App SHALL render a "No results found." message in `#medications-results`.
4. WHEN medication Cards are rendered, THE App SHALL display each entry's name, pharmacy, availability status, and price formatted as a currency string with 2 decimal places and a currency symbol (e.g., "$10.00").
5. IF the MEDICATIONS data source is unavailable or returns an error when the user submits a search query, THEN THE App SHALL render an error message in `#medications-results` indicating the data could not be retrieved and SHALL NOT render any medication Cards.
6. IF the search query exceeds 200 characters, THEN THE App SHALL NOT submit the search and SHALL render an error message in `#medications-results` indicating the query is too long.

---

### Requirement 4: Price Comparator Module

**User Story:** As a user, I want to compare prices for a selected service type across different providers, so that I can choose the most affordable option.

#### Acceptance Criteria

1. WHEN the user clicks the compare button with a service type selected, THE App SHALL filter PRICES by exact match on the `service` field and render all matching entries as Cards in `#prices-results`.
2. IF the user clicks the compare button with no service type selected, THEN THE App SHALL render a message in `#prices-results` prompting the user to select a service type, and SHALL NOT render any price Cards.
3. IF no PRICES entry matches the selected service, THEN THE App SHALL render a "No results found." message in `#prices-results`.
4. WHILE price Cards are rendered in `#prices-results`, THE App SHALL display each Card with the provider name, service description, included items, and price formatted as a decimal number preceded by a currency symbol (e.g., $99.00).
5. WHEN the user clicks the compare button, THE App SHALL clear all previously rendered content in `#prices-results` before rendering new results.

---

### Requirement 5: Appointments Module

**User Story:** As a user, I want to browse available appointment slots by medical specialty, so that I can schedule a consultation.

#### Acceptance Criteria

1. WHEN the user selects a specialty from the specialty dropdown and clicks the search button, THE App SHALL filter appointments by exact, case-sensitive match on the `specialty` field and render only entries where `available` is `true` as Cards in `#appointments-results`.
2. IF the user clicks the search button without selecting a specialty, THEN THE App SHALL render a prompt message indicating a specialty selection is required in `#appointments-results` and SHALL NOT render any appointment Cards.
3. WHEN the user submits a valid specialty selection that matches no available appointment entry, THE App SHALL render a "No results found." message in `#appointments-results`.
4. WHEN appointment Cards are rendered, THE App SHALL display each entry's doctor name, specialty, date in ISO 8601 format (YYYY-MM-DD), and scheduled time in 24-hour format (HH:MM).
5. THE App SHALL never render an appointment Card for a slot where `available` is `false`.
6. IF the appointments data source is unavailable when the user submits the search, THEN THE App SHALL render an error message indicating the appointments could not be loaded in `#appointments-results` and SHALL NOT render any appointment Cards.

---

### Requirement 6: Generic Renderer

**User Story:** As a developer, I want a single generic rendering function, so that all four modules produce consistent Card output with a uniform fallback for empty results.

#### Acceptance Criteria

1. WHEN the Renderer is called with a non-empty `items` array, THE Renderer SHALL replace the target container's `innerHTML` with exactly one Card element per item, each containing the item's `title`, `subtitle`, `badge`, and `detail` values, where any field value that is `null` or `undefined` SHALL be rendered as an empty string.
2. WHEN the Renderer is called with an empty `items` array, THE Renderer SHALL replace the target container's `innerHTML` with exactly one element carrying the class `no-results` and SHALL NOT render any Card elements.
3. WHEN the Renderer is called twice with identical arguments, THE Renderer SHALL produce identical DOM output on both calls (idempotence).
4. WHEN the Renderer is called with N items and then called again with M items for the same container, THE Renderer SHALL replace all previous content so that the container holds exactly M Cards.
5. IF the target container element does not exist in the DOM when the Renderer is called, THEN THE Renderer SHALL throw an error indicating the container was not found and SHALL NOT modify the DOM.
6. IF any item in the `items` array is missing the `title` field, THEN THE Renderer SHALL render that Card with an empty string for `title` and SHALL continue rendering the remaining items without throwing an error.

---

### Requirement 7: Page Structure and Navigation

**User Story:** As a user, I want a clear page layout with four distinct sections, so that I can navigate directly to the health service I need.

#### Acceptance Criteria

1. THE App SHALL render four `<section>` elements with IDs `hospitals`, `medications`, `prices`, and `appointments`.
2. EACH section SHALL contain a dedicated results container with IDs `hospitals-results`, `medications-results`, `prices-results`, and `appointments-results` respectively.
3. THE App SHALL load `styles.css` and `app.js` without a module bundler, using standard `<link>` and `<script>` tags in `index.html`.
4. THE App SHALL be fully functional when opened as a local `file://` URL in a supported browser with JavaScript enabled.
5. WHEN a user activates a navigation link targeting a section ID, THE App SHALL scroll that section into the visible viewport without a full page reload.
6. IF the `app.js` script fails to load, THEN THE App SHALL render all four section headings and their results containers in a visible but empty state, without displaying a blank page or JavaScript error overlay.

---

### Requirement 8: Visual Presentation

**User Story:** As a user, I want a responsive card-based layout, so that I can read results comfortably on any screen size.

#### Acceptance Criteria

1. THE App SHALL display result Cards in a CSS Grid layout using `auto-fill` and `minmax(280px, 1fr)` column sizing.
2. WHILE the viewport width is below 600 px, THE App SHALL collapse the grid to a single column.
3. THE App SHALL apply distinct badge colours: green for "In stock" and "Available" statuses, red for "Out of stock" and "Full" statuses, and orange for "Limited" status.
4. IF a result card contains a status value that is not "In stock", "Available", "Out of stock", "Full", or "Limited", THEN THE App SHALL render the badge in a neutral colour (grey) without throwing a rendering error.
5. WHEN results are loading, THE App SHALL display placeholder Cards in the same grid layout, with a minimum of 3 placeholder Cards visible, until real data replaces them.

---

### Requirement 9: Static Delivery and Zero Dependencies

**User Story:** As a user, I want the application to work offline and without installing anything, so that I can access health information in low-connectivity environments.

#### Acceptance Criteria

1. THE App SHALL send network requests only to the OSM_Endpoints and only as specified in Requirements 12 and 13, and SHALL make no other network requests after the initial file load.
2. THE App SHALL require no npm runtime packages, no API keys, no build tools, and no CDN imports.
3. THE App SHALL be delivered as exactly three files: `index.html`, `styles.css`, and `app.js`.
4. WHEN the user interacts with the medication, price, or appointment modules, THE App SHALL make zero outbound HTTP or HTTPS requests, and WHEN the user has not acted in the `hospitals` section, THE App SHALL make zero outbound requests to any origin.
5. WHERE a README is provided, THE App SHALL include instructions for serving via a local HTTP server as a workaround for browsers that block Geolocation on `file://` URLs.
6. IF the App is opened directly via a `file://` URL and Geolocation access is denied by the browser, THEN THE App SHALL display a message indicating that a local HTTP server is required to enable location features.
7. WHILE the browser is offline or the OSM_Endpoints are unreachable, THE App SHALL keep all four modules usable with the local catalogs.

---

### Requirement 10: Hospital Search Options

**User Story:** As a user, I want to choose how many hospitals are shown and how far away they can be, so that I can tailor results to my situation.

#### Acceptance Criteria

1. THE App SHALL provide a `#hospital-count-select` control in the `hospitals` section with the options 3, 5, and 10, with 3 selected by default.
2. THE App SHALL provide a `#hospital-radius-select` control in the `hospitals` section with the options "any", 5, 10, 25, and 50 kilometres, with "any" selected by default.
3. WHEN the Hospital_Flow runs, THE App SHALL render at most the selected Result_Count of Cards, sorted by ascending distance.
4. WHEN a Search_Radius other than "any" is selected, THE App SHALL render only centers whose distance from the origin is less than or equal to the Search_Radius.
5. IF no center lies within the selected Search_Radius, THEN THE App SHALL render a message in `#hospitals-results` that no hospitals were found within that radius and suggests increasing the radius.
6. IF the value read from `#hospital-count-select` or `#hospital-radius-select` is not one of the listed options, THEN THE App SHALL use the default value for that control.

---

### Requirement 11: Directions Link

**User Story:** As a user, I want a "how to get there" link on each hospital, so that I can open turn-by-turn directions.

#### Acceptance Criteria

1. WHEN a hospital Card is rendered, THE App SHALL include a Directions_Link in that Card.
2. THE Directions_Link SHALL have an `href` of the form `https://www.google.com/maps/dir/?api=1&origin=LAT,LON&destination=LAT,LON`, where each coordinate is a finite number formatted via `encodeURIComponent`.
3. WHERE the origin coordinates are known, THE Directions_Link SHALL include the `origin` parameter.
4. IF the origin coordinates are not known, THEN THE Directions_Link SHALL omit the `origin` parameter and include the `destination` parameter.
5. THE Directions_Link SHALL have `target="_blank"` and `rel="noopener noreferrer"`.
6. THE App SHALL treat the Directions_Link as a plain navigation link and SHALL NOT perform any `fetch` request for it.
7. THE App SHALL build the Directions_Link from numeric coordinates only and SHALL NOT include any center name or address text in the URL.

---

### Requirement 12: Manual Location Search

**User Story:** As a user whose device location is unavailable, I want to type an address or city, so that I can still find nearby hospitals.

#### Acceptance Criteria

1. THE App SHALL provide a `#location-input` text field and a "Search by address" button in the `hospitals` section.
2. WHEN the user clicks "Search by address" with a non-empty query of at most 200 characters after trimming, THE Geocoder SHALL request `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=` followed by the `encodeURIComponent`-encoded query.
3. WHEN the Geocoder returns a result with finite latitude and longitude, THE App SHALL run the Hospital_Flow with those coordinates.
4. IF the trimmed query is empty, THEN THE App SHALL render a prompt in `#hospitals-results` asking for an address or city and SHALL NOT send a request.
5. IF the trimmed query exceeds 200 characters, THEN THE App SHALL render a "query too long" message in `#hospitals-results` and SHALL NOT send a request.
6. IF Nominatim returns no result, THEN THE App SHALL render a message in `#hospitals-results` that the address was not found.
7. IF the geocoding request fails because of a network error or a non-successful HTTP status, THEN THE App SHALL render a message that the address could not be looked up, without throwing an unhandled exception.
8. IF the geocoding request does not complete within 10 seconds, THEN THE App SHALL abort the request using an AbortController and render a timeout message in `#hospitals-results`.
9. WHILE a geocoding request is pending, THE App SHALL display placeholder Cards in `#hospitals-results`.

---

### Requirement 13: Remote Hospital Data with Offline Fallback

**User Story:** As a user, I want real nearby hospitals from OpenStreetMap, and a local list when I am offline, so that I always get a useful result.

#### Acceptance Criteria

1. WHEN the Hospital_Flow runs, THE Remote_Fetcher SHALL send one request to the Overpass_API querying nodes and ways with `amenity` equal to `hospital`, `clinic`, or `doctors` around the origin within the Effective_Radius, using `out center`.
2. THE Remote_Fetcher SHALL map each OSM_Element to a MedicalCenter with `name` from the `name` tag, `type` from the `amenity` tag, `address` composed from `addr:*` tags, `phone` from the `phone` tag or the `contact:phone` tag with a fallback of "N/A", and `lat` and `lon` from the element, using `center` for ways.
3. THE Remote_Fetcher SHALL discard every OSM_Element that has no non-empty `name` tag.
4. THE Remote_Fetcher SHALL discard every OSM_Element whose resolved `lat` or `lon` is not a finite number within valid coordinate ranges.
5. IF the Overpass_API request fails because of a network error or non-successful HTTP status, THEN THE App SHALL use CENTERS as the source and render the Fallback_Notice.
6. IF the Overpass_API request does not complete within 10 seconds, THEN THE App SHALL abort it using an AbortController, use CENTERS as the source, and render the Fallback_Notice.
7. IF the Overpass_API response yields zero valid MedicalCenter objects, THEN THE App SHALL use CENTERS as the source and render the Fallback_Notice.
8. WHEN Remote_Data is shown, THE App SHALL display the Attribution_Text in the `hospitals` section.
9. WHEN CENTERS is the source, THE App SHALL apply the same Result_Count, Search_Radius, sorting, and Directions_Link behavior as for Remote_Data.
10. THE App SHALL display the Privacy_Notice near the "Find Nearest" and "Search by address" buttons, stating that coordinates or the typed address are sent to OpenStreetMap services.
11. THE App SHALL send Overpass_API and Nominatim requests only in response to a user action in the `hospitals` section.
12. THE App SHALL HTML-escape every Remote_Data field (name, type, address, phone) before inserting it into the DOM.

---

### Requirement 14: Visual Design and Usability

**User Story:** As a user, I want an attractive, intuitive, and easy-to-use interface, so that I can find health information quickly on any device.

#### Acceptance Criteria

1. THE App SHALL display a hero header containing the application name in an `<h1>` and a one-line tagline, followed by a sticky top navigation with links to the four sections, each link showing an icon (inline SVG or emoji) and a text label.
2. WHEN the user scrolls so that a section crosses the viewport reading line, THE App SHALL mark the matching navigation link with an `active` class and `aria-current="true"` and remove both from the other links.
3. IF `IntersectionObserver` is not available, THEN THE App SHALL skip the active-section highlight and continue to work without throwing an error.
4. THE App SHALL present each of the four sections as a titled panel containing an icon, the section heading, and a one-line description of what the section does.
5. THE App SHALL give every input and select a visible `<label>` associated by `for` and `id`, and SHALL show a placeholder example in text inputs, including "Ibuprofeno" in `#medication-input`.
6. THE App SHALL style primary actions and secondary actions with distinct button classes, and SHALL show hover, focus, and disabled states for buttons.
7. WHEN the user presses Enter in `#medication-input`, THE App SHALL run the medication search, and THE App SHALL run no search when the value of a select changes.
8. WHILE a hospital search is pending, THE App SHALL set the "Find Nearest" and "Search by address" buttons to `disabled` with `aria-busy="true"`, and SHALL restore them when the search ends in success, failure, or timeout.
9. WHILE a hospital search button is disabled, THE App SHALL send no additional geocoding or Overpass request from that button.
10. WHEN results are rendered, THE App SHALL display a summary line above the results stating the count with a unit, for example "3 hospitals found", using the singular form for a count of 1.
11. WHEN a module renders an empty or error state, THE App SHALL leave the summary line empty.
12. THE App SHALL render each Card with a visual hierarchy in which the title is emphasised, the badge is a coloured pill, the subtitle is de-emphasised, and the detail follows, with the price displayed in a larger, bold style on medication and price Cards.
13. THE App SHALL style each `.card-link` as a button with a minimum height of 44px.
14. WHILE results are loading, THE App SHALL display placeholder Cards with a shimmer animation.
15. WHEN a module renders an empty or informational prompt, THE App SHALL show an icon and the message with an info style, and WHEN a module renders an error, THE App SHALL show an icon and the message with a red-tinted error style.
16. THE App SHALL define colours, radii, shadows, spacing, and the system font stack as CSS custom properties, and SHALL use rounded cards with soft shadows.
17. THE App SHALL use text and interface colour pairs with a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text and interface boundaries (WCAG 2.1 AA).
18. THE App SHALL show a visible focus outline of at least 3px on every link, button, input, and select when focused with the keyboard.
19. WHERE the user agent reports `prefers-reduced-motion: reduce`, THE App SHALL disable the shimmer animation, hover transforms, spinner rotation, and smooth scrolling.
20. THE App SHALL use a mobile-first layout, give every button, select, text input, and navigation link a minimum height of 44px, and cause no horizontal scrolling at a viewport width of 320px.
21. THE App SHALL give each results container `aria-live="polite"`, and SHALL use the landmarks `<header>`, `<nav>`, `<main>`, and `<footer>`, a skip link that targets `<main>`, and a `lang` attribute on `<html>`.
22. THE App SHALL make every control operable with the keyboard alone, in a logical tab order.
23. THE App SHALL display a footer containing the text "Demo data. Not medical advice. In an emergency call your local emergency number." and a note that map data comes from OpenStreetMap.
24. THE App SHALL keep the existing element IDs `hospitals-results`, `medications-results`, `prices-results`, `appointments-results`, `hospital-count-select`, `hospital-radius-select`, `location-input`, `medication-input`, `service-select`, `specialty-select`, `osm-attribution`, and `privacy-notice`, and the classes `card`, `card-title`, `card-badge`, `card-subtitle`, `card-detail`, `no-results`, `placeholder`, and `card-link`.
25. THE App SHALL keep the behaviour specified in Requirements 1 to 13 unchanged, and SHALL remain delivered as three files with no CDN, no external fonts, no external images, and no framework.

---

### Requirement 15: Spanish Localization

**User Story:** As a Spanish-speaking user, I want the whole interface in Spanish, so that I can use the application without translating anything.

#### Acceptance Criteria

1. THE App SHALL set the `lang` attribute of `<html>` to `es`.
2. THE App SHALL display the page title, hero text, navigation labels, section titles, section descriptions, field labels, placeholders, and button texts in Spanish.
3. THE App SHALL display the Privacy_Notice, the Fallback_Notice, the footer disclaimer, and the attribution wording in Spanish, keeping the phrase "© colaboradores de OpenStreetMap" in the attribution text.
4. THE App SHALL display every loading, prompt, error, and empty-result message in Spanish.
5. WHEN results are rendered, THE App SHALL display the summary line in Spanish with the singular form for a count of 1 and the plural form for any other count (for example "1 hospital encontrado" and "3 hospitales encontrados").
6. THE App SHALL use select option values for services and specialties that exactly equal the corresponding `PRICES` service values and `APPOINTMENTS` specialty values.
7. THE App SHALL display the status values "En stock", "Agotado", "Limitado", "Disponible", and "Lleno" in badges.
8. THE App SHALL apply the badge colours green for "En stock" and "Disponible", red for "Agotado" and "Lleno", and orange for "Limitado", and SHALL continue to apply the same colours for "In stock", "Available", "Out of stock", "Full", and "Limited", and a neutral grey for any other value.
9. WHEN an appointment Card is rendered, THE App SHALL display its detail as the ISO 8601 date (YYYY-MM-DD), the connector " a las ", and the time in 24-hour format (HH:MM), for example "2026-01-15 a las 09:30".
10. THE App SHALL keep the currency format as "$" followed by the price with 2 decimal places.
11. THE App SHALL keep every existing element ID and class name listed in Requirement 14.24 unchanged.

---

### Requirement 16: Dynamic Appointment Dates

**User Story:** As a user, I want appointment slots with upcoming dates, so that the schedule never shows dates that have already passed.

#### Acceptance Criteria

1. WHEN `app.js` loads, THE App SHALL generate the `date` of every `APPOINTMENTS` entry relative to the current local date so that each date is strictly after today.
2. THE App SHALL provide a pure helper `addDaysISO(baseDate, days)` that returns the date `days` calendar days after `baseDate` as a `YYYY-MM-DD` string.
3. FOR ALL valid base dates and integer offsets of 1 or more, THE `addDaysISO` helper SHALL return a valid calendar date in `YYYY-MM-DD` format that is strictly after the base date.
4. THE App SHALL compute the date components in local time and SHALL NOT hardcode any past year in the `APPOINTMENTS` dates.
5. THE App SHALL assign each `APPOINTMENTS` entry an offset between 1 and 30 days after today, spread across the entries.
6. THE App SHALL keep both available and unavailable entries in `APPOINTMENTS`, covering at least two specialties.

---

### Requirement 17: Mobile-App Look and Feel

**User Story:** As a user, I want the application to look and feel like a modern mobile health app, so that it is familiar, inviting, and easy to use with one hand on a phone.

#### Acceptance Criteria

1. THE App SHALL define the primary colour as a royal blue between `#1d4ed8` and `#2347d0`, light-blue page backgrounds, white card surfaces, corner radii between 16px and 24px on cards, tiles, and panels, and soft shadows, all as CSS custom properties on `:root` in `styles.css`.
2. THE App SHALL use text and interface colour pairs with a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text and interface boundaries, including white text on the royal-blue primary colour.
3. THE App SHALL display a Welcome_Hero at the top of the page with a pale-blue gradient background, the tagline "Atención de calidad, donde estés" in which the phrase "donde estés" is rendered in bold blue, and a one-line Spanish subtitle.
4. THE Welcome_Hero SHALL contain a Feature_Strip on a solid royal-blue rounded panel with exactly three items, each with an icon and a label: "Hospitales cercanos", "Medicamentos", and "Citas".
5. THE Welcome_Hero SHALL contain a white pill-shaped button labelled "Comenzar".
6. WHEN the user activates the "Comenzar" button, THE App SHALL scroll the Home_Area into view.
7. THE App SHALL display a Home_Area containing a top App_Bar with the brand name and an info icon, a small greeting "Hola", and the heading "¿Cómo podemos ayudarte hoy?".
8. THE Home_Area SHALL contain exactly four Quick_Action_Tiles labelled "Hospitales cercanos", "Medicamentos", "Comparar precios", and "Reservar cita", each with a coloured icon above the label.
9. WHEN the user activates a Quick_Action_Tile, THE App SHALL scroll to the matching section (`hospitals`, `medications`, `prices`, or `appointments` respectively).
10. WHILE the viewport width is 768px or more, THE App SHALL lay out the four Quick_Action_Tiles in a single row of four columns.
11. THE App SHALL provide a pure function `nextAvailableAppointment(slots)` that returns the slot with `available === true` that has the earliest `date`, using `time` to break ties, and returns `null` when the array is empty, is not an array, or has no available slot.
12. THE App SHALL provide a pure function `initials(name)` that returns the uppercase first letter of up to the first two whitespace-separated words of the trimmed name, and returns a single question mark "?" for a name that is empty, blank, or not a string.
13. WHEN `nextAvailableAppointment(APPOINTMENTS)` returns a slot, THE App SHALL render a Featured_Appointment card titled "Próxima cita disponible" in the Home_Area on a royal-blue rounded background, showing an avatar with the doctor's initials, the doctor name, the specialty, the detail `date + " a las " + time`, and a pill labelled "Disponible".
14. IF `nextAvailableAppointment(APPOINTMENTS)` returns `null`, THEN THE App SHALL hide the Featured_Appointment card.
15. THE Featured_Appointment area SHALL contain a "Ver todas" link that scrolls to the `appointments` section.
16. THE App SHALL build the Featured_Appointment only from `APPOINTMENTS` data, and SHALL NOT display any fabricated medical data such as blood pressure, heart rate, or consultation history.
17. THE App SHALL present each of the four sections as an app-screen card with its existing controls, results, summary line, and behaviour unchanged.
18. WHERE an item passed to the Renderer has a non-empty `icon` field, THE Renderer SHALL render a leading `<span class="card-avatar" aria-hidden="true">` element with the HTML-escaped icon inside that Card, and WHERE the `icon` field is missing or empty, THE Renderer SHALL produce the same output as before this requirement.
19. THE App SHALL set the `icon` of hospital Cards to "🏥", medication Cards to "💊", price Cards to "💲", and appointment Cards to "🩺".
20. THE App SHALL provide a Tab_Bar with a `<nav aria-label="Navegación principal">` containing four tab links labelled "Inicio", "Hospitales", "Medicamentos", and "Citas", plus a centred floating circular blue link labelled "Precios" with a distinct icon that targets the `prices` section.
21. WHILE the viewport width is below 768px, THE App SHALL display the Tab_Bar fixed to the bottom of the viewport and SHALL hide the sticky top navigation.
22. WHILE the viewport width is 768px or more, THE App SHALL display the sticky top navigation and SHALL hide the Tab_Bar.
23. WHEN a section crosses the viewport reading line, THE App SHALL mark the matching link in both the top navigation and the Tab_Bar with the `active` class and `aria-current="true"`, and SHALL remove both from the other links, reusing the `initActiveNav` behaviour; the "Inicio" tab SHALL be marked while the Home_Area is the current area.
24. WHILE the Tab_Bar is displayed, THE App SHALL add bottom padding to the page content at least equal to the Tab_Bar height plus the bottom safe-area inset, so that the Tab_Bar does not cover content.
25. THE App SHALL give every Tab_Bar item and Quick_Action_Tile a tap target of at least 44px by 44px, and SHALL pad the Tab_Bar with `env(safe-area-inset-bottom)`.
26. THE App SHALL centre the page content in a container with a maximum width of 1100px and stack the sections vertically, using a mobile-first layout.
27. THE App SHALL keep every element ID, class name, `onclick` handler, and behaviour listed in Requirements 1 to 16, and SHALL remain delivered as three files with no CDN, no external fonts, no external images, no framework, and no new network request.
28. WHERE the user agent reports `prefers-reduced-motion: reduce`, THE App SHALL disable smooth scrolling and hover transforms for the new components.

Glossary additions for Requirement 17:

- **Welcome_Hero**: The `<header class="welcome-hero">` block at the top of the page with tagline, subtitle, Feature_Strip, and "Comenzar" button.
- **Feature_Strip**: The royal-blue rounded panel inside the Welcome_Hero listing three feature items.
- **Home_Area**: The `<div id="home">` block with the App_Bar, greeting, heading, Quick_Action_Tiles, and Featured_Appointment.
- **App_Bar**: The top bar of the Home_Area with the brand name and an info icon.
- **Quick_Action_Tile**: A rounded white tile with a coloured icon and a label that scrolls to a section.
- **Featured_Appointment**: The royal-blue card in the Home_Area showing the earliest available slot.
- **Tab_Bar**: The fixed bottom navigation shown below 768px, with four tabs and a centred floating button.
