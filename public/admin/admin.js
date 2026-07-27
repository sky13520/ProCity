let token = sessionStorage.getItem("procity_admin_token") || "";
let projects = [];
let editingId = null;

const table = document.querySelector("#project-table");
const editor = document.querySelector("#editor-dialog");
const tokenDialog = document.querySelector("#token-dialog");
const form = document.querySelector("#project-form");
const notice = document.querySelector("#admin-notice");

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

function authHeaders(includeJson = false) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...(includeJson ? { "Content-Type": "application/json" } : {})
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...authHeaders(Boolean(options.body)), ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function projectImage(project) {
  const image = safeImage(project.image);
  return image
    ? `<img class="project-thumb" src="${escapeHtml(image)}" alt="">`
    : '<div class="project-thumb"></div>';
}

function render() {
  const query = document.querySelector("#admin-search").value.trim().toLowerCase();
  const filtered = projects.filter((project) =>
    `${project.title} ${project.city} ${project.area} ${project.builder}`.toLowerCase().includes(query)
  );
  document.querySelector("#total-projects").textContent = projects.length;
  document.querySelector("#live-projects").textContent = projects.filter((project) => project.published).length;

  if (!filtered.length) {
    table.innerHTML = '<div class="empty-admin">No projects match this search.</div>';
    return;
  }

  table.innerHTML = filtered.map((project) => `
    <article class="project-row" data-id="${Number(project.id)}">
      ${projectImage(project)}
      <div class="project-name">
        <strong>${escapeHtml(project.title)}</strong>
        <span>${escapeHtml(project.type)} · ${escapeHtml(project.builder || "Builder not added")}</span>
      </div>
      <div class="project-location">
        <strong>${escapeHtml(project.city)}</strong>
        <span>${escapeHtml(project.area)}</span>
      </div>
      <span class="status-pill ${project.published ? "" : "draft"}">${project.published ? "PUBLISHED" : "DRAFT"}</span>
      <div class="row-actions">
        <button type="button" data-edit>Edit</button>
        <button class="delete" type="button" data-delete>Delete</button>
      </div>
    </article>
  `).join("");
}

async function loadProjects() {
  notice.hidden = true;
  table.innerHTML = '<div class="loading-state">Loading projects…</div>';
  try {
    const data = await api("/api/admin/projects");
    projects = data.projects;
    render();
  } catch (error) {
    if (error.status === 401) {
      sessionStorage.removeItem("procity_admin_token");
      token = "";
      tokenDialog.showModal();
      table.innerHTML = '<div class="loading-state">Administrator access is required.</div>';
      return;
    }
    notice.textContent = error.message;
    notice.hidden = false;
    table.innerHTML = '<div class="loading-state">The database could not be loaded.</div>';
  }
}

function openEditor(project = null) {
  editingId = project?.id || null;
  form.reset();
  form.elements.published.checked = true;
  document.querySelector("#editor-title").textContent = project ? "Edit project" : "Add project";

  if (project) {
    const fields = {
      id: project.id,
      title: project.title,
      city: project.city,
      area: project.area,
      address: project.address,
      type: project.type,
      builder: project.builder,
      price: project.price,
      occupancy: project.occupancy,
      badge: project.badge,
      image_url: project.image,
      latitude: project.latitude,
      longitude: project.longitude,
      description: project.description
    };
    Object.entries(fields).forEach(([name, value]) => {
      if (form.elements[name]) form.elements[name].value = value ?? "";
    });
    form.elements.featured.checked = Boolean(project.featured);
    form.elements.published.checked = Boolean(project.published);
  }
  editor.showModal();
}

function formPayload() {
  const data = new FormData(form);
  return {
    title: data.get("title"),
    city: data.get("city"),
    area: data.get("area"),
    address: data.get("address"),
    type: data.get("type"),
    builder: data.get("builder"),
    price: Number(data.get("price") || 0),
    occupancy: data.get("occupancy"),
    badge: data.get("badge"),
    image_url: data.get("image_url"),
    latitude: Number(data.get("latitude")),
    longitude: Number(data.get("longitude")),
    description: data.get("description"),
    featured: form.elements.featured.checked,
    published: form.elements.published.checked
  };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  submit.textContent = "Saving…";
  try {
    const path = editingId ? `/api/admin/projects/${editingId}` : "/api/admin/projects";
    await api(path, {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify(formPayload())
    });
    editor.close();
    showToast(editingId ? "Project updated." : "Project added.");
    await loadProjects();
  } catch (error) {
    showToast(error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = "Save project";
  }
});

table.addEventListener("click", async (event) => {
  const row = event.target.closest("[data-id]");
  if (!row) return;
  const project = projects.find((item) => Number(item.id) === Number(row.dataset.id));
  if (event.target.closest("[data-edit]")) openEditor(project);
  if (event.target.closest("[data-delete]")) {
    if (!window.confirm(`Delete “${project.title}”? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/projects/${project.id}`, { method: "DELETE" });
      showToast("Project deleted.");
      await loadProjects();
    } catch (error) {
      showToast(error.message);
    }
  }
});

document.querySelector("#new-project").addEventListener("click", () => openEditor());
document.querySelector("#admin-search").addEventListener("input", render);
document.querySelectorAll(".close-editor").forEach((button) => {
  button.addEventListener("click", () => editor.close());
});
document.querySelector("#change-token").addEventListener("click", () => tokenDialog.showModal());
document.querySelector("#token-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  token = document.querySelector("#admin-token").value.trim();
  sessionStorage.setItem("procity_admin_token", token);
  tokenDialog.close();
  await loadProjects();
});

function showToast(message) {
  const toast = document.querySelector("#admin-toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2700);
}

if (token) loadProjects();
else tokenDialog.showModal();
