const projects = [
  {
    id: 1,
    title: "Harbourline Residences",
    city: "Toronto",
    area: "East Bayfront",
    type: "Condo",
    builder: "A curated ProCity opportunity",
    price: 699000,
    priceLabel: "From $699K",
    occupancy: "2029",
    badge: "FEATURED",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1400&q=85",
    description: "Contemporary waterfront living with quick access to downtown, transit, and the lake."
  },
  {
    id: 2,
    title: "The Junction House",
    city: "Toronto",
    area: "The Junction",
    type: "Condo",
    builder: "A curated ProCity opportunity",
    price: 759000,
    priceLabel: "From $759K",
    occupancy: "2028",
    badge: "NEW RELEASE",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=85",
    description: "Boutique urban residences in one of Toronto’s most character-rich neighbourhoods."
  },
  {
    id: 3,
    title: "VMC Parkside",
    city: "Vaughan",
    area: "Vaughan Metropolitan Centre",
    type: "Condo",
    builder: "A curated ProCity opportunity",
    price: 629000,
    priceLabel: "From $629K",
    occupancy: "2029",
    badge: "VIP ACCESS",
    image: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1400&q=85",
    description: "A transit-connected high-rise community at the centre of Vaughan’s new downtown."
  },
  {
    id: 4,
    title: "Unionville Garden",
    city: "Markham",
    area: "Unionville",
    type: "Condo",
    builder: "A curated ProCity opportunity",
    price: 719000,
    priceLabel: "From $719K",
    occupancy: "2028",
    badge: "COMING SOON",
    image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=85",
    description: "Modern residences surrounded by green space, retail, schools, and regional transit."
  },
  {
    id: 5,
    title: "Yonge & Major",
    city: "Richmond Hill",
    area: "Yonge Street",
    type: "Condo",
    builder: "A curated ProCity opportunity",
    price: 689000,
    priceLabel: "From $689K",
    occupancy: "2029",
    badge: "FEATURED",
    image: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1400&q=85",
    description: "Refined high-rise living near shops, parks, schools, and rapid transit connections."
  },
  {
    id: 6,
    title: "Leslieville Lane",
    city: "Toronto",
    area: "Leslieville",
    type: "Townhome",
    builder: "A curated ProCity opportunity",
    price: 1199000,
    priceLabel: "From $1.19M",
    occupancy: "2028",
    badge: "LIMITED",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85",
    description: "Design-led urban townhomes on a quiet lane, steps from Toronto’s east-end energy."
  },
  {
    id: 7,
    title: "Cornell Modern",
    city: "Markham",
    area: "Cornell",
    type: "Townhome",
    builder: "A curated ProCity opportunity",
    price: 1099000,
    priceLabel: "From $1.09M",
    occupancy: "2027",
    badge: "MOVE-IN SOONER",
    image: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1400&q=85",
    description: "Spacious family townhomes in a walkable Markham community close to everyday essentials."
  },
  {
    id: 8,
    title: "Central District",
    city: "Vaughan",
    area: "Highway 7",
    type: "Condo",
    builder: "A curated ProCity opportunity",
    price: 649000,
    priceLabel: "From $649K",
    occupancy: "2028",
    badge: "INCENTIVES",
    image: "https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&w=1400&q=85",
    description: "A connected mixed-use community with contemporary suites and easy GTA access."
  }
];

const state = { city: "all", type: "all", query: "", sort: "featured" };
const grid = document.querySelector("#property-grid");
const count = document.querySelector("#result-count");
const emptyState = document.querySelector("#empty-state");
const dialog = document.querySelector("#project-dialog");
const dialogContent = document.querySelector("#dialog-content");
const toast = document.querySelector("#toast");

function money(value) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0
  }).format(value);
}

function filteredProjects() {
  const query = state.query.trim().toLowerCase();
  const list = projects.filter((project) => {
    const matchesCity = state.city === "all" || project.city === state.city;
    const matchesType = state.type === "all" || project.type === state.type;
    const haystack = `${project.title} ${project.city} ${project.area}`.toLowerCase();
    return matchesCity && matchesType && (!query || haystack.includes(query));
  });

  if (state.sort === "price-low") return list.sort((a, b) => a.price - b.price);
  if (state.sort === "occupancy") return list.sort((a, b) => a.occupancy.localeCompare(b.occupancy));
  return list;
}

function heartIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z"/></svg>`;
}

function render() {
  const items = filteredProjects();
  count.textContent = items.length;
  grid.hidden = items.length === 0;
  emptyState.hidden = items.length !== 0;
  grid.innerHTML = items
    .map(
      (project) => `
        <article class="property-card" tabindex="0" data-id="${project.id}">
          <div class="property-image">
            <img src="${project.image}" alt="${project.title}" loading="lazy" />
            <span class="property-badge">${project.badge}</span>
            <button class="save-button" type="button" aria-label="Save ${project.title}">
              ${heartIcon()}
            </button>
          </div>
          <div class="property-content">
            <p class="property-location">${project.area} · ${project.city}</p>
            <h3 class="property-title">${project.title}</h3>
            <p class="property-builder">${project.builder}</p>
            <div class="property-facts">
              <span>PRICE<strong>${project.priceLabel}</strong></span>
              <span>TYPE<strong>${project.type}</strong></span>
              <span>OCCUPANCY<strong>${project.occupancy}</strong></span>
            </div>
          </div>
        </article>`
    )
    .join("");
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
  document.querySelector("#hero-query").value = "";
  document.querySelector("#hero-type").value = "all";
  document.querySelector("#sort-projects").value = "featured";
  setCity("all");
}

function openProject(id) {
  const project = projects.find((item) => item.id === Number(id));
  if (!project) return;
  dialogContent.innerHTML = `
    <div class="dialog-layout">
      <div class="dialog-image"><img src="${project.image}" alt="${project.title}" /></div>
      <div class="dialog-info">
        <p class="eyebrow">${project.area.toUpperCase()} · ${project.city.toUpperCase()}</p>
        <h2>${project.title}</h2>
        <p>${project.description}</p>
        <div class="dialog-facts">
          <div><span>STARTING FROM</span><strong>${money(project.price)}</strong></div>
          <div><span>PROPERTY TYPE</span><strong>${project.type}</strong></div>
          <div><span>EXPECTED OCCUPANCY</span><strong>${project.occupancy}</strong></div>
          <div><span>ACCESS</span><strong>${project.badge}</strong></div>
        </div>
        <a class="button" href="#contact" data-dialog-contact>Request floor plans & pricing</a>
        <p class="demo-note">Prototype listing — details are for design demonstration only.</p>
      </div>
    </div>`;
  dialog.showModal();
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
render();

