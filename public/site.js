const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);
const safeImage = (value) => {
  const image = String(value || "").trim();
  if (/^\/project-images\/[a-z0-9][a-z0-9._-]*\.webp$/i.test(image)) return image;
  try {
    const url = new URL(image);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};
const projectUrl = (project) => `/project/${encodeURIComponent(project.slug)}/`;

function projectCard(project) {
  const image = safeImage(project.image) || "/procity-logo.png";
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

document.querySelectorAll(".menu-button").forEach((button) => {
  button.addEventListener("click", () => {
    const navigation = button.closest(".site-header")?.querySelector(".desktop-nav");
    const isOpen = navigation?.classList.toggle("open") || false;
    button.setAttribute("aria-expanded", String(isOpen));
    button.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  });
});



function initProjectLightbox() {
  const lightbox = document.querySelector("[data-lightbox]");
  if (!lightbox) return;
  const triggers = [...document.querySelectorAll("[data-lightbox-index]")];
  const image = lightbox.querySelector("[data-lightbox-image]");
  const counter = lightbox.querySelector("[data-lightbox-counter]");
  const closeButton = lightbox.querySelector("[data-lightbox-close]");
  const images = triggers.map((trigger) => ({
    src: trigger.dataset.lightboxSrc,
    alt: trigger.dataset.lightboxAlt || "Project image"
  }));
  let currentIndex = 0;
  let touchStartX = 0;

  const showImage = (index) => {
    currentIndex = (index + images.length) % images.length;
    image.src = images[currentIndex].src;
    image.alt = images[currentIndex].alt;
    counter.textContent = `${currentIndex + 1} / ${images.length}`;
  };
  const open = (index) => {
    showImage(index);
    lightbox.hidden = false;
    document.body.classList.add("lightbox-open");
    closeButton.focus();
  };
  const close = () => {
    lightbox.hidden = true;
    document.body.classList.remove("lightbox-open");
    triggers[currentIndex]?.focus();
  };
  const move = (step) => showImage(currentIndex + step);

  triggers.forEach((trigger, index) => trigger.addEventListener("click", () => open(index)));
  closeButton.addEventListener("click", close);
  lightbox.querySelector("[data-lightbox-prev]").addEventListener("click", () => move(-1));
  lightbox.querySelector("[data-lightbox-next]").addEventListener("click", () => move(1));
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) close();
  });
  lightbox.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });
  lightbox.addEventListener("touchend", (event) => {
    const distance = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1);
  }, { passive: true });
  document.addEventListener("keydown", (event) => {
    if (lightbox.hidden) return;
    if (event.key === "Escape") close();
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
  });
}

initProjectLightbox();

loadFeatured();
