const fallbackProjects = [
  {
    id: 1,
    title: "Harbourline Residences",
    city: "Toronto",
    area: "East Bayfront",
    address: "25 Queens Quay E, Toronto, ON",
    type: "Condo",
    builder: "A curated ProCity opportunity",
    price: 699000,
    priceLabel: "From $699K",
    occupancy: "2029",
    badge: "FEATURED",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1400&q=85",
    description: "Contemporary waterfront living with quick access to downtown, transit, and the lake.",
    latitude: 43.6437,
    longitude: -79.3717
  },
  {
    id: 2,
    title: "The Junction House",
    city: "Toronto",
    area: "The Junction",
    address: "2853 Dundas St W, Toronto, ON",
    type: "Condo",
    builder: "A curated ProCity opportunity",
    price: 759000,
    priceLabel: "From $759K",
    occupancy: "2028",
    badge: "NEW RELEASE",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=85",
    description: "Boutique urban residences in one of Toronto’s most character-rich neighbourhoods.",
    latitude: 43.6654,
    longitude: -79.4654
  },
  {
    id: 3,
    title: "VMC Parkside",
    city: "Vaughan",
    area: "Vaughan Metropolitan Centre",
    address: "100 New Park Pl, Vaughan, ON",
    type: "Condo",
    builder: "A curated ProCity opportunity",
    price: 629000,
    priceLabel: "From $629K",
    occupancy: "2029",
    badge: "VIP ACCESS",
    image: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1400&q=85",
    description: "A transit-connected high-rise community at the centre of Vaughan’s new downtown.",
    latitude: 43.7936,
    longitude: -79.5267
  },
  {
    id: 4,
    title: "Unionville Garden",
    city: "Markham",
    area: "Unionville",
    address: "16th Ave & Kennedy Rd, Markham, ON",
    type: "Condo",
    builder: "A curated ProCity opportunity",
    price: 719000,
    priceLabel: "From $719K",
    occupancy: "2028",
    badge: "COMING SOON",
    image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=85",
    description: "Modern residences surrounded by green space, retail, schools, and regional transit.",
    latitude: 43.8892,
    longitude: -79.3192
  },
  {
    id: 5,
    title: "Yonge & Major",
    city: "Richmond Hill",
    area: "Yonge Street",
    address: "Yonge St & Major Mackenzie Dr, Richmond Hill, ON",
    type: "Condo",
    builder: "A curated ProCity opportunity",
    price: 689000,
    priceLabel: "From $689K",
    occupancy: "2029",
    badge: "FEATURED",
    image: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1400&q=85",
    description: "Refined high-rise living near shops, parks, schools, and rapid transit connections.",
    latitude: 43.8717,
    longitude: -79.4371
  },
  {
    id: 6,
    title: "Leslieville Lane",
    city: "Toronto",
    area: "Leslieville",
    address: "Queen St E & Leslie St, Toronto, ON",
    type: "Townhome",
    builder: "A curated ProCity opportunity",
    price: 1199000,
    priceLabel: "From $1.19M",
    occupancy: "2028",
    badge: "LIMITED",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85",
    description: "Design-led urban townhomes on a quiet lane, steps from Toronto’s east-end energy.",
    latitude: 43.6628,
    longitude: -79.3312
  },
  {
    id: 7,
    title: "Cornell Modern",
    city: "Markham",
    area: "Cornell",
    address: "Bur Oak Ave & Cornell Centre Blvd, Markham, ON",
    type: "Townhome",
    builder: "A curated ProCity opportunity",
    price: 1099000,
    priceLabel: "From $1.09M",
    occupancy: "2027",
    badge: "MOVE-IN SOONER",
    image: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1400&q=85",
    description: "Spacious family townhomes in a walkable Markham community close to everyday essentials.",
    latitude: 43.8963,
    longitude: -79.2307
  },
  {
    id: 8,
    title: "Central District",
    city: "Vaughan",
    area: "Highway 7",
    address: "Highway 7 & Jane St, Vaughan, ON",
    type: "Condo",
    builder: "A curated ProCity opportunity",
    price: 649000,
    priceLabel: "From $649K",
    occupancy: "2028",
    badge: "INCENTIVES",
    image: "https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&w=1400&q=85",
    description: "A connected mixed-use community with contemporary suites and easy GTA access.",
    latitude: 43.7922,
    longitude: -79.5275
  }
];

const state = {
  city: "all",
  type: "all",
  query: "",
  sort: "featured",
  mapBounds: null
};
let projects = fallbackProjects;
let map;
let infoWindow;
let markers = [];

const grid = document.querySelector("#property-grid");
const count = document.querySelector("#result-count");
const emptyState = document.querySelector("#empty-state");
const dialog = document.querySelector("#project-dialog");
const dialogContent = document.querySelector("#dialog-content");
const toast = document.querySelector("#toast");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function safeImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function money(value) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0
  }).format(value);
}

function projectPosition(project) {
  const lat = Number(project.latitude);
  const lng = Number(project.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function filteredProjects() {
  const query = state.query.trim().toLowerCase();
  const list = projects.filter((project) => {
    const matchesCity = state.city === "all" || project.city === state.city;
    const matchesType = state.type === "all" || project.type === state.type;
    const haystack = `${project.title} ${project.city} ${project.area} ${project.address}`.toLowerCase();
    const position = projectPosition(project);
    const matchesMap = !state.mapBounds || (position && state.mapBounds.contains(position));
    return matchesCity && matchesType && matchesMap && (!query || haystack.includes(query));
  });

  if (state.sort === "price-low") return list.sort((a, b) => a.price - b.price);
  if (state.sort === "occupancy") {
    return list.sort((a, b) => String(a.occupancy).localeCompare(String(b.occupancy)));
  }
  return list.sort((a, b) => Number(b.featured || 0) - Number(a.featured || 0));
}

function heartIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z"/></svg>`;
}

function render() {
  const items = filteredProjects();
  count.textContent = items.length;
  grid.hidden = items.length === 0;
  emptyState.hidden = items.length !== 0;
  grid.innerHTML = items.map((project) => {
    const image = safeImage(project.image);
    return `
      <article class="property-card" tabindex="0" data-id="${Number(project.id)}">
        <div class="property-image">
          ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(project.title)}" loading="lazy">` : '<div class="image-placeholder">PROCITY</div>'}
          <span class="property-badge">${escapeHtml(project.badge || "NEW PROJECT")}</span>
          <button class="save-button" type="button" aria-label="Save ${escapeHtml(project.title)}">
            ${heartIcon()}
          </button>
        </div>
        <div class="property-content">
          <p class="property-location">${escapeHtml(project.area)} · ${escapeHtml(project.city)}</p>
          <h3 class="property-title">${escapeHtml(project.title)}</h3>
          <p class="property-builder">${escapeHtml(project.builder)}</p>
          <div class="property-facts">
            <span>PRICE<strong>${escapeHtml(project.priceLabel || money(project.price))}</strong></span>
            <span>TYPE<strong>${escapeHtml(project.type)}</strong></span>
            <span>OCCUPANCY<strong>${escapeHtml(project.occupancy || "TBD")}</strong></span>
          </div>
        </div>
      </article>`;
  }).join("");
  updateMarkers(items);
}

function setCity(city) {
  state.city = city;
  document.querySelectorAll("[data-city]").forEach((button) => {
    button.classList.toggle("active", button.dataset.city === city);
  });
  render();
}

function resetFilters() {
  state.city = "all";
  state.type = "all";
  state.query = "";
  state.sort = "featured";
  state.mapBounds = null;
  document.querySelector("#hero-query").value = "";
  document.querySelector("#hero-type").value = "all";
  document.querySelector("#sort-projects").value = "featured";
  document.querySelector("#reset-map").hidden = true;
  if (map) {
    map.setCenter({ lat: 43.759, lng: -79.39 });
    map.setZoom(9);
  }
  setCity("all");
}

function openProject(id) {
  const project = projects.find((item) => Number(item.id) === Number(id));
  if (!project) return;
  const image = safeImage(project.image);
  dialogContent.innerHTML = `
    <div class="dialog-layout">
      <div class="dialog-image">
        ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(project.title)}">` : '<div class="image-placeholder">PROCITY</div>'}
      </div>
      <div class="dialog-info">
        <p class="eyebrow">${escapeHtml(project.area.toUpperCase())} · ${escapeHtml(project.city.toUpperCase())}</p>
        <h2>${escapeHtml(project.title)}</h2>
        <p>${escapeHtml(project.description)}</p>
        <p class="project-address">${escapeHtml(project.address)}</p>
        <div class="dialog-facts">
          <div><span>STARTING FROM</span><strong>${escapeHtml(project.priceLabel || money(project.price))}</strong></div>
          <div><span>PROPERTY TYPE</span><strong>${escapeHtml(project.type)}</strong></div>
          <div><span>EXPECTED OCCUPANCY</span><strong>${escapeHtml(project.occupancy || "TBD")}</strong></div>
          <div><span>ACCESS</span><strong>${escapeHtml(project.badge || "CONTACT US")}</strong></div>
        </div>
        <a class="button" href="#contact" data-dialog-contact>Request floor plans & pricing</a>
        <p class="demo-note">Project information should be independently verified before purchase.</p>
      </div>
    </div>`;
  dialog.showModal();
}

async function loadProjects() {
  try {
    const response = await fetch("/api/projects", { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("Database is not connected yet.");
    const data = await response.json();
    if (!Array.isArray(data.projects)) throw new Error("Invalid project response.");
    projects = data.projects;
  } catch (error) {
    console.info(`${error.message} Showing starter project data.`);
  }
  render();
}

function markerContent(project) {
  const element = document.createElement("button");
  element.className = "map-marker";
  element.type = "button";
  element.textContent = project.price ? `$${Math.round(project.price / 1000)}K` : "View";
  element.setAttribute("aria-label", `View ${project.title}`);
  return element;
}

async function updateMarkers(items) {
  if (!map || !window.google?.maps?.marker) return;
  markers.forEach((marker) => { marker.map = null; });
  markers = [];

  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  items.forEach((project) => {
    const position = projectPosition(project);
    if (!position) return;
    const marker = new AdvancedMarkerElement({
      map,
      position,
      title: project.title,
      content: markerContent(project)
    });
    marker.addListener("click", () => {
      infoWindow.setContent(`
        <div class="map-popup">
          <strong>${escapeHtml(project.title)}</strong>
          <span>${escapeHtml(project.area)}, ${escapeHtml(project.city)}</span>
          <button type="button" data-map-project="${Number(project.id)}">View project</button>
        </div>`);
      infoWindow.open({ map, anchor: marker });
    });
    markers.push(marker);
  });
}

async function initializeMap() {
  const { Map, InfoWindow } = await google.maps.importLibrary("maps");
  map = new Map(document.querySelector("#project-map"), {
    center: { lat: 43.759, lng: -79.39 },
    zoom: 9,
    mapId: "DEMO_MAP_ID",
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: true
  });
  infoWindow = new InfoWindow();
  document.querySelector("#map-status").hidden = true;
  document.querySelector("#search-this-area").disabled = false;
  map.addListener("idle", () => {
    document.querySelector("#search-this-area").classList.add("attention");
  });

  const { PlaceAutocompleteElement } = await google.maps.importLibrary("places");
  const placeAutocomplete = new PlaceAutocompleteElement({
    includedRegionCodes: ["ca"],
    locationBias: { center: { lat: 43.75, lng: -79.39 }, radius: 65000 }
  });
  placeAutocomplete.placeholder = "Search an address or neighbourhood";
  const host = document.querySelector("#place-autocomplete");
  host.replaceChildren(placeAutocomplete);
  placeAutocomplete.addEventListener("gmp-select", async ({ placePrediction }) => {
    const place = placePrediction.toPlace();
    await place.fetchFields({ fields: ["displayName", "formattedAddress", "location", "viewport"] });
    if (place.viewport) map.fitBounds(place.viewport);
    else if (place.location) {
      map.setCenter(place.location);
      map.setZoom(14);
    }
    state.mapBounds = null;
    document.querySelector("#reset-map").hidden = false;
  });
  render();
}

async function loadGoogleMaps() {
  try {
    const response = await fetch("/api/config");
    const config = response.ok ? await response.json() : {};
    if (!config.googleMapsApiKey) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.googleMapsApiKey)}&v=weekly&loading=async`;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    await initializeMap();
  } catch (error) {
    document.querySelector("#map-status span").textContent = "The map could not be loaded. List search is still available.";
  }
}

document.querySelector("#city-filters").addEventListener("click", (event) => {
  const chip = event.target.closest("[data-city]");
  if (chip) setCity(chip.dataset.city);
});

document.querySelector("#sort-projects").addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});

document.querySelector("#hero-search").addEventListener("submit", (event) => {
  event.preventDefault();
  state.query = document.querySelector("#hero-query").value;
  state.type = document.querySelector("#hero-type").value;
  render();
  document.querySelector("#properties").scrollIntoView({ behavior: "smooth" });
});

grid.addEventListener("click", (event) => {
  const save = event.target.closest(".save-button");
  if (save) {
    event.stopPropagation();
    save.classList.toggle("saved");
    showToast(save.classList.contains("saved") ? "Project saved" : "Project removed");
    return;
  }
  const card = event.target.closest(".property-card");
  if (card) openProject(card.dataset.id);
});

grid.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const card = event.target.closest(".property-card");
    if (card) openProject(card.dataset.id);
  }
});

document.querySelector("#project-map").addEventListener("click", (event) => {
  const button = event.target.closest("[data-map-project]");
  if (button) openProject(button.dataset.mapProject);
});

document.querySelector("#search-this-area").addEventListener("click", (event) => {
  if (!map) return;
  state.mapBounds = map.getBounds();
  event.currentTarget.classList.remove("attention");
  document.querySelector("#reset-map").hidden = false;
  render();
});

document.querySelector("#use-location").addEventListener("click", () => {
  if (!navigator.geolocation) return showToast("Location is not supported by this browser.");
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      if (!map) return showToast("Connect Google Maps to use location search.");
      map.setCenter({ lat: coords.latitude, lng: coords.longitude });
      map.setZoom(13);
      state.mapBounds = null;
      document.querySelector("#reset-map").hidden = false;
    },
    () => showToast("We could not access your location.")
  );
});

document.querySelector("#reset-map").addEventListener("click", resetFilters);
document.querySelectorAll("[data-city-link]").forEach((card) => {
  card.addEventListener("click", () => {
    setCity(card.dataset.cityLink);
    document.querySelector("#properties").scrollIntoView({ behavior: "smooth" });
  });
});

document.querySelector("#clear-filters").addEventListener("click", resetFilters);
document.querySelector("#empty-reset").addEventListener("click", resetFilters);
document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
  if (event.target.closest("[data-dialog-contact]")) dialog.close();
});

document.querySelector(".menu-button").addEventListener("click", (event) => {
  const nav = document.querySelector(".desktop-nav");
  nav.classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(nav.classList.contains("open")));
});

document.querySelectorAll(".desktop-nav a").forEach((link) => {
  link.addEventListener("click", () => document.querySelector(".desktop-nav").classList.remove("open"));
});

document.querySelector("#lead-form").addEventListener("submit", (event) => {
  event.preventDefault();
  showToast("Thank you — your request has been received.");
  event.target.reset();
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

document.querySelector("#year").textContent = new Date().getFullYear();
loadProjects();
loadGoogleMaps();
