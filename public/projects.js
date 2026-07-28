const params = new URLSearchParams(location.search);
const state = { page: Math.max(1, Number(params.get("page")) || 1), q: params.get("q") || "", city: params.get("city") || "all", type: params.get("type") || "all", sort: params.get("sort") || "featured" };
const cities = ["Toronto","North York","Etobicoke","Scarborough","Vaughan","Markham","Richmond Hill","Mississauga","Brampton","Oakville","Burlington","Hamilton","Pickering","Whitby","Oshawa","Kitchener","Waterloo","Guelph","Barrie","London","Montreal"];
const fields = { q: document.querySelector("#query"), city: document.querySelector("#city"), type: document.querySelector("#type"), sort: document.querySelector("#sort") };
cities.forEach(city => fields.city.insertAdjacentHTML("beforeend", `<option>${city}</option>`));
Object.entries(fields).forEach(([key, field]) => { field.value = state[key]; });

async function load() {
  const query = new URLSearchParams({ page: state.page, limit: 24, sort: state.sort });
  if (state.q) query.set("q", state.q); if (state.city !== "all") query.set("city", state.city); if (state.type !== "all") query.set("type", state.type);
  document.querySelector("#project-grid").innerHTML = "<p>Loading projects…</p>";
  try {
    const response = await fetch(`/api/projects?${query}`); const data = await response.json();
    document.querySelector("#result-count").textContent = Number(data.pagination.total).toLocaleString();
    document.querySelector("#project-grid").innerHTML = data.projects.length ? data.projects.map(projectCard).join("") : '<div class="empty-state"><strong>No matching projects.</strong><p>Try a broader city, type or keyword.</p></div>';
    renderPages(data.pagination);
  } catch { document.querySelector("#project-grid").innerHTML = "<p>Projects could not be loaded. Please try again.</p>"; }
}
function renderPages(p) {
  const nav = document.querySelector("#pagination"); if (p.totalPages <= 1) { nav.innerHTML = ""; return; }
  nav.innerHTML = `<button ${p.page <= 1 ? "disabled" : ""} data-page="${p.page - 1}">Previous</button><span>Page ${p.page.toLocaleString()} of ${p.totalPages.toLocaleString()}</span><button ${p.page >= p.totalPages ? "disabled" : ""} data-page="${p.page + 1}">Next</button>`;
}
function updateUrl() {
  const next = new URLSearchParams(); if (state.q) next.set("q", state.q); if (state.city !== "all") next.set("city", state.city); if (state.type !== "all") next.set("type", state.type); if (state.sort !== "featured") next.set("sort", state.sort); if (state.page > 1) next.set("page", state.page);
  history.replaceState(null, "", `${location.pathname}${next.size ? `?${next}` : ""}`);
}
document.querySelector("#project-filters").addEventListener("submit", event => { event.preventDefault(); Object.keys(fields).forEach(key => state[key] = fields[key].value.trim()); state.page = 1; updateUrl(); load(); });
document.querySelector("#pagination").addEventListener("click", event => { const button = event.target.closest("[data-page]"); if (!button || button.disabled) return; state.page = Number(button.dataset.page); updateUrl(); load(); scrollTo({ top: 120, behavior: "smooth" }); });
load();
