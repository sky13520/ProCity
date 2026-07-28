const map = L.map("project-map", { zoomControl: true, preferCanvas: true }).setView([43.759, -79.39], 10);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
let markers = L.layerGroup().addTo(map); let requestId = 0; let timer;
async function loadVisible() {
  const current = ++requestId; const b = map.getBounds(); const query = new URLSearchParams({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest(), limit: 48, sort: "featured" });
  const q = document.querySelector("#map-query").value.trim(), type = document.querySelector("#map-type").value; if (q) query.set("q", q); if (type !== "all") query.set("type", type);
  document.querySelector("#map-loading").hidden = false;
  try {
    const response = await fetch(`/api/projects?${query}`), data = await response.json(); if (current !== requestId) return;
    markers.clearLayers(); data.projects.forEach(project => {
      if (!project.latitude || !project.longitude) return;
      const price = project.price ? `$${Math.round(project.price / 1000)}K` : "View";
      L.marker([project.latitude, project.longitude], { icon: L.divIcon({ className: "map-marker-host", html: `<a class="map-marker" href="${projectUrl(project)}">${escapeHtml(price)}</a>`, iconSize: [64, 34], iconAnchor: [32,17] }) }).addTo(markers).bindPopup(`<div class="map-popup"><strong>${escapeHtml(project.title)}</strong><span>${escapeHtml(project.address)}</span><a href="${projectUrl(project)}">View project →</a></div>`);
    });
    document.querySelector("#map-count").textContent = data.projects.length; document.querySelector("#map-cards").innerHTML = data.projects.slice(0, 12).map(projectCard).join("") || "<p>No projects in this map area.</p>";
  } finally { if (current === requestId) document.querySelector("#map-loading").hidden = true; }
}
map.on("moveend", () => { clearTimeout(timer); timer = setTimeout(loadVisible, 250); });
document.querySelector("#map-filters").addEventListener("submit", event => { event.preventDefault(); loadVisible(); });
document.querySelector("#map-city-links").addEventListener("click", event => { const button = event.target.closest("[data-lat]"); if (button) map.setView([Number(button.dataset.lat), Number(button.dataset.lng)], 12); });
loadVisible();
