# Health Access Agent

A zero-dependency static web app with four health-service tools:

- Find nearby hospitals using your browser's location or a typed address
- Check medication availability and price
- Compare service prices
- Browse appointment slots by specialty

Medications, prices and appointments are built into `app.js` and work fully offline. Only the hospital search contacts the network (see below). There is no backend and no build step.

Files: `index.html` (structure), `styles.css` (layout), `app.js` (data and logic).

## Hospital search

Four enhancements to the hospital tool:

1. **Result count**: choose 3, 5 or 10 results (default 3) with `#hospital-count-select`.
2. **Radius filter**: limit results to 5, 10, 25 or 50 km, or "any" (default). If nothing is within the radius, the app suggests increasing it.
3. **Search by address**: type an address in `#location-input` and press Enter or click "Search by address", instead of using geolocation.
4. **Directions links**: every hospital card has a link that opens directions in a new tab.

### OpenStreetMap endpoints

Hospital search uses two public OpenStreetMap services and no API key:

- **Nominatim** (`https://nominatim.openstreetmap.org/search`) converts a typed address to coordinates.
- **Overpass API** (`https://overpass-api.de/api/interpreter`) returns hospitals, clinics and doctors near those coordinates.

Requests have a 10-second timeout and run only when you use the hospital buttons. Medication, price and appointment tools make no network requests.

### Privacy notice

When you use hospital search, your coordinates or the address you type are sent to these OpenStreetMap services. The page shows a privacy notice next to the search buttons. Nothing is stored.

### Offline fallback

If a request fails, times out or returns nothing usable, the app shows the built-in `CENTERS` list from `app.js` and displays a notice that local data is being shown.

### Attribution

When results come from OpenStreetMap, the page shows "Data © OpenStreetMap contributors". It is hidden when the offline fallback is used. The data is available under the [ODbL](https://www.openstreetmap.org/copyright).
## Running the app

Open `index.html` directly in a browser (double-click it, or use File > Open).

### Geolocation on `file://`

Chromium-based browsers (Chrome, Edge, Brave) may block the Geolocation API on pages opened from `file://`. If "Find Nearby Hospitals" fails to get your location, serve the folder over localhost instead:

```
python -m http.server 8000
```

Then open <http://localhost:8000/>. `localhost` is treated as a secure context, so the location prompt works.

## Tests (optional)

Tests are optional and dev-only. The app does not need them to run, and they may not exist in this repository if the optional test tasks were skipped.

If test files are present, run them with Vitest:

```
npx vitest --run
```
