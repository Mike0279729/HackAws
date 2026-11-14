const centers = [
  { name: "Hospital Central", lat: 19.4326, lon: -99.1332 },
  { name: "Clínica Norte", lat: 19.4869, lon: -99.1798 },
  { name: "Centro de Salud Sur", lat: 19.3619, lon: -99.1534 },
];

const medicines = {
  ibuprofeno: [
    { pharmacy: "Farmacia Vida", stock: "Disponible", price: 65 },
    { pharmacy: "Farmacia Bienestar", stock: "Bajo", price: 60 },
  ],
  paracetamol: [
    { pharmacy: "Farmacia Vida", stock: "Disponible", price: 40 },
    { pharmacy: "Farmacia Centro", stock: "Disponible", price: 38 },
  ],
  amoxicilina: [{ pharmacy: "Farmacia Centro", stock: "Disponible", price: 95 }],
};

const servicePricing = {
  "consulta-general": [
    { provider: "Clínica Esperanza", price: 350 },
    { provider: "Hospital Central", price: 420 },
  ],
  "consulta-especialista": [
    { provider: "Clínica Esperanza", price: 650 },
    { provider: "Instituto Médico Norte", price: 790 },
  ],
  "rayos-x": [
    { provider: "Laboratorio Imagen", price: 500 },
    { provider: "Hospital Central", price: 620 },
  ],
  "analisis-sangre": [
    { provider: "Laboratorio Salud+", price: 280 },
    { provider: "Laboratorio Imagen", price: 310 },
  ],
};

const appointments = {
  "medicina-general": [
    "Hoy 17:30 - Clínica Esperanza",
    "Mañana 09:00 - Hospital Central",
  ],
  pediatria: ["Mañana 10:00 - Clínica Infantil Norte"],
  cardiologia: ["Lunes 08:30 - Instituto Médico Norte"],
  dermatologia: ["Martes 14:00 - Centro de Especialidades Sur"],
};

function renderList(target, items) {
  target.innerHTML = "";
  if (items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Sin resultados.";
    target.appendChild(li);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    target.appendChild(li);
  });
}

function distanceKm(aLat, aLon, bLat, bLon) {
  const toRad = (d) => (d * Math.PI) / 180;
  const earth = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

document.getElementById("locate-button").addEventListener("click", () => {
  const status = document.getElementById("location-status");
  const list = document.getElementById("nearby-results");

  if (!navigator.geolocation) {
    status.textContent = "Tu navegador no soporta geolocalización.";
    return;
  }

  status.textContent = "Buscando centros cercanos...";
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const nearby = centers
        .map((center) => ({
          ...center,
          distance: distanceKm(coords.latitude, coords.longitude, center.lat, center.lon),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
        .map((center) => `${center.name} - ${center.distance.toFixed(1)} km`);

      status.textContent = "Centros encontrados:";
      renderList(list, nearby);
    },
    () => {
      status.textContent = "No se pudo obtener tu ubicación.";
    }
  );
});

document.getElementById("medicine-button").addEventListener("click", () => {
  const input = document.getElementById("medicine-input").value.trim().toLowerCase();
  const list = document.getElementById("medicine-results");
  const results = medicines[input] || [];
  renderList(
    list,
    results.map((item) => `${item.pharmacy}: ${item.stock} - $${item.price} MXN`)
  );
});

document.getElementById("pricing-button").addEventListener("click", () => {
  const service = document.getElementById("service-select").value;
  const list = document.getElementById("pricing-results");
  const results = servicePricing[service] || [];
  renderList(list, results.map((item) => `${item.provider}: $${item.price} MXN`));
});

document.getElementById("appointments-button").addEventListener("click", () => {
  const specialty = document.getElementById("specialty-select").value;
  const list = document.getElementById("appointments-results");
  renderList(list, appointments[specialty] || []);
});
