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

When results come from OpenStreetMap, the page shows "Data � OpenStreetMap contributors". It is hidden when the offline fallback is used. The data is available under the [ODbL](https://www.openstreetmap.org/copyright).

## Health Assistant (chat)

A floating button at the bottom-right (`#assistant-fab`, "Abrir asistente de salud") opens a chat panel where you can ask in plain Spanish for hospitals, medications, prices or appointments. On screens below 768px it is a bottom sheet above the tab bar. On wider screens it is a floating card. Press Escape or the close button to dismiss it.

### What it can do

- **Hospitals**: explains that the app will use your location (or an address typed in the hospitals section) and offers a "Buscar hospitales cerca de mí" action.
- **Medications**: lists up to 3 matching medications with pharmacy, status and price.
- **Prices**: lists every provider for a service, cheapest first, and marks the cheapest as "más económico". If no service is detected, it asks which one you want.
- **Appointments**: lists up to 3 earliest available slots for a specialty. If no specialty is detected, it asks and offers one chip per specialty. Symptom words map to a specialty (for example "piel" to Dermatología, "corazón" to Cardiología, "bebé" to Pediatría).
- **Shortcuts**: reply buttons such as "Ver en Medicamentos", "Ver en Precios" and "Ver en Citas" fill the matching form, run the search and scroll to that section.

### Example phrases

- "Hospitales cerca de mí"
- "Buscar ibuprofeno"
- "¿Cuánto cuesta una consulta general?" or "Comparar precios"
- "Citas de cardiología" or "Quiero agendar una cita para mi hijo"
- "Ayuda" or "¿Qué puedes hacer?"

The panel also shows four suggestion chips with the first four examples. Messages are limited to 300 characters. Unrecognised messages get a friendly reply that lists what the assistant can do.

### Local, rule-based, private

The assistant is a set of keyword rules in `app.js` (`normalizeText`, `interpretMessage`, `assistantReply`). It uses no LLM, no backend and no API key. It makes no network requests and answers only from the built-in medication, price and appointment data, so it works offline. Messages are processed in the browser, are never sent anywhere, and are not saved in `localStorage`, `sessionStorage`, cookies or anywhere else. Reloading the page or pressing "Borrar conversación" starts a fresh conversation.

### Disclaimer

The assistant gives general information only. It is not medical advice or a diagnosis, and it never recommends medication doses. The welcome message, the panel footer and replies with health-related guidance say so. Consult a health professional for medical decisions.

### Emergencies

If a message contains an emergency term (such as "dolor de pecho", "no puedo respirar", "infarto", "sangrado fuerte", "desmayo", "convulsión", "emergencia", "urgencia" or "accidente"), the assistant takes priority over any other topic in the message. It starts its reply with a warning to call the local emergency number now, and it offers the "Buscar hospitales cerca de mí" action. The assistant is not a substitute for emergency services.

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
