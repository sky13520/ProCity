const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);
const safeImage = (value) => /^https:\/\//i.test(value || "") ? value : "";
const projectUrl = (project) => `/project/${encodeURIComponent(project.slug)}/`;

function projectCard(project) {
  const image = safeImage(project.image);
  return `<article class="property-card">
    <a href="${projectUrl(project)}" aria-label="View ${escapeHtml(project.title)}">
      <div class="property-image">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(project.title)}" loading="lazy">` : '<div class="image-placeholder">PROCITY</div>'}<span class="property-badge">${escapeHtml(project.badge || "NOW REGISTERING")}</span></div>
      <div class="property-content"><p class="property-location">${escapeHtml(project.area)} · ${escapeHtml(project.city)}</p><h3 class="property-title">${escapeHtml(project.title)}</h3>
      <p class="property-builder">${escapeHtml(project.builder || "Developer information available")}</p><div class="property-facts"><span>STARTING FROM<strong>${escapeHtml(project.priceLabel)}</strong></span><span>OCCUPANCY<strong>${escapeHtml(project.occupancy || "TBD")}</strong></span></div></div>
    </a></article>`;
}

async function loadFeatured() {
  const target = document.querySelector("#featured-projects");
  if (!target) return;
  try {
    const response = await fetch("/api/projects?featured=1&limit=8");
    const data = await response.json();
    target.innerHTML = data.projects.length ? data.projects.map(projectCard).join("") : "<p>Featured opportunities are being updated.</p>";
  } catch {
    target.innerHTML = "<p>Featured opportunities are being updated.</p>";
  }
}

document.querySelectorAll(".lead-form").forEach((form) => form.addEventListener("submit", (event) => {
  event.preventDefault(); alert("Thank you. ProCity will contact you shortly."); form.reset();
}));
loadFeatured();
