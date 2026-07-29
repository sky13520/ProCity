import { json, toProject } from "../functions/_lib/http.js";
import { onRequestGet as getConfig } from "../functions/api/config.js";
import { onRequestGet as getProjects } from "../functions/api/projects.js";
import {
  onRequestGet as getAdminProjects,
  onRequestPost as createAdminProject
} from "../functions/api/admin/projects.js";
import {
  onRequestDelete as deleteAdminProject,
  onRequestPut as updateAdminProject
} from "../functions/api/admin/projects/[id].js";
import { initializeDatabase } from "./schema.js";
import PROJECT_CATALOG from "./project-data.json" with { type: "json" };

const CATALOG_ID_OFFSET = 100000;

function methodNotAllowed(allowed) {
  return json(
    { error: "Method not allowed." },
    405,
    { allow: allowed.join(", ") }
  );
}

async function apiContext(request, env, ctx, params = {}) {
  if (env.DB) await initializeDatabase(env.DB);
  return {
    request,
    env,
    params,
    data: {},
    waitUntil: ctx.waitUntil.bind(ctx)
  };
}

function leadText(value, maxLength = 300) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function validLeadEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

async function submitLead(request, env) {
  if (request.method.toUpperCase() !== "POST") return methodNotAllowed(["POST"]);
  if (!env.EMAIL) return json({ error: "Email service is temporarily unavailable. Please call 647 847 9666." }, 503);

  const contentType = request.headers.get("content-type") || "";
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (!contentType.includes("application/json") || contentLength > 8192) {
    return json({ error: "Invalid form submission." }, 400);
  }

  const origin = request.headers.get("origin");
  if (origin) {
    let hostname = "";
    try { hostname = new URL(origin).hostname.toLowerCase(); } catch {}
    if (!["procity.ca", "www.procity.ca", "localhost", "127.0.0.1"].includes(hostname)) {
      return json({ error: "Invalid form origin." }, 403);
    }
  }

  let input;
  try { input = await request.json(); } catch { return json({ error: "Invalid form submission." }, 400); }
  if (leadText(input.website, 80)) return json({ ok: true });

  const firstName = leadText(input.firstName, 80);
  const lastName = leadText(input.lastName, 80);
  const name = leadText(input.name, 160) || [firstName, lastName].filter(Boolean).join(" ");
  const email = leadText(input.email, 254).toLowerCase();
  const phone = leadText(input.phone, 50);
  const project = leadText(input.project, 180);
  const source = leadText(input.source, 180) || "Website";
  const page = leadText(input.page, 500);

  if (!name || !validLeadEmail(email)) {
    return json({ error: "Please enter your name and a valid email address." }, 400);
  }

  const text = [
    "New ProCity website inquiry",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone || "Not provided"}`,
    `Project: ${project || "General inquiry"}`,
    `Source: ${source}`,
    `Page: ${page || "Not provided"}`,
    "",
    `Submitted: ${new Date().toISOString()}`
  ].join("\n");

  try {
    await env.EMAIL.send({
      to: "info@procity.ca",
      from: { email: "website@procity.ca", name: "ProCity Website" },
      replyTo: email,
      subject: project ? `ProCity lead: ${project}` : `ProCity website lead: ${name}`,
      text
    });
    return json({ ok: true });
  } catch (error) {
    console.error(JSON.stringify({
      message: "Lead email failed",
      code: error?.code || "UNKNOWN",
      error: error instanceof Error ? error.message : String(error)
    }));
    return json({ error: "We could not send your request. Please call 647 847 9666." }, 503);
  }
}

async function routeApi(request, env, ctx) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (url.pathname === "/api/leads") return submitLead(request, env);

  if (url.pathname === "/api/health") {
    let databaseReady = false;
    let projectCount = 0;
    if (env.DB) {
      await initializeDatabase(env.DB);
      const row = await env.DB.prepare(
        "SELECT COUNT(*) AS project_count FROM projects"
      ).first();
      databaseReady = true;
      projectCount = Number(row?.project_count || 0);
    }
    return json({
      status: "ok",
      databaseReady,
      projectCount,
      adminConfigured: Boolean(env.ADMIN_API_TOKEN || env.ADMIN_EMAILS),
      mapsConfigured: Boolean(env.GOOGLE_MAPS_API_KEY),
      emailConfigured: Boolean(env.EMAIL)
    });
  }

  if (url.pathname === "/api/config") {
    if (method !== "GET") return methodNotAllowed(["GET"]);
    return getConfig(await apiContext(request, env, ctx));
  }

  if (url.pathname === "/api/projects") {
    if (method !== "GET") return methodNotAllowed(["GET"]);
    return getProjects(await apiContext(request, env, ctx));
  }

  if (url.pathname === "/api/admin/projects") {
    const context = await apiContext(request, env, ctx);
    if (method === "GET") return getAdminProjects(context);
    if (method === "POST") return createAdminProject(context);
    return methodNotAllowed(["GET", "POST"]);
  }

  const projectMatch = url.pathname.match(/^\/api\/admin\/projects\/(\d+)$/);
  if (projectMatch) {
    const context = await apiContext(request, env, ctx, { id: projectMatch[1] });
    if (method === "PUT") return updateAdminProject(context);
    if (method === "DELETE") return deleteAdminProject(context);
    return methodNotAllowed(["PUT", "DELETE"]);
  }

  return json({ error: "API route not found." }, 404);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function projectIdFromPath(pathname) {
  const match = pathname.match(/^\/project\/[^/]*?-(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

async function enrichProject(_database, row) {
  return row;
}

function projectNarrative(project) {
  const builder = project.builder || "an established development team";
  const storeys = project.propertyDetails.Storeys;
  const suites = project.propertyDetails.Suites;
  const scale = storeys && suites
    ? `The current plan calls for ${storeys} storeys and ${suites} residences, giving the development a clearly defined scale.`
    : storeys
      ? `The current plan is organized across ${storeys} storeys.`
      : suites
        ? `The current plan includes approximately ${suites} residences.`
        : "";
  const status = project.propertyDetails["Building Status"] || project.badge;
  const statusSentence = status ? `It is presently listed as ${status.toLowerCase()}.` : "";
  const occupancy = project.occupancy
    ? `The currently listed occupancy timing is ${project.occupancy}.`
    : "Occupancy timing is available upon request and should be confirmed before purchase.";
  return `${project.title} is a ${project.type.toLowerCase()} community by ${builder}, planned for ${project.address}. ${scale} ${statusSentence} From this ${project.city} address, buyers can weigh the project against nearby transportation, everyday services and the character of the surrounding neighbourhood. ${occupancy} ProCity can provide the current sales package so pricing, floor plans, incentives and availability can be reviewed together.`.replace(/\s+/g, " ").trim();
}

function siteHeader() {
  return `<header class="site-header">
    <a class="brand" href="/" aria-label="ProCity home"><span class="brand-logo"><img src="/procity-logo.png" alt="ProCity" width="1650" height="488"></span></a>
    <nav class="desktop-nav" aria-label="Main navigation"><a href="/projects/">Projects</a><a href="/map/">Map Search</a><a href="/#areas">Cities</a><a href="/#why-procity">Why ProCity</a></nav>
    <div class="header-actions"><a class="phone-link" href="tel:+16478479666">647 847 9666</a><a class="button button-small" href="#contact">Get VIP Access</a><button class="menu-button" type="button" aria-label="Open menu" aria-expanded="false"><span></span><span></span></button></div>
  </header>`;
}

function siteFooter() {
  return `<footer><a class="brand brand-footer" href="/"><span class="brand-logo"><img src="/procity-logo.png" alt="ProCity"></span></a>
    <p>Toronto &amp; GTA pre-construction real estate specialists.</p>
    <div class="footer-links"><a href="/projects/">Projects</a><a href="/map/">Map</a><a href="/#areas">Cities</a><a href="tel:+16478479666">Contact</a></div>
    <div class="legal"><span>© ${new Date().getFullYear()} ProCity. All rights reserved.</span><span>GO WITH THE PRO.</span></div></footer>`;
}

function renderDetailList(details) {
  const entries = Object.entries(details || {}).filter(([, value]) => value);
  if (!entries.length) return "";
  return `<dl class="project-data-list">${entries.map(([label, value]) =>
    `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
  ).join("")}</dl>`;
}

function renderAmenities(items) {
  if (!items?.length) return "";
  return `<ul class="amenities-grid">${items.map((item) =>
    `<li><span aria-hidden="true">✓</span>${escapeHtml(item)}</li>`
  ).join("")}</ul>`;
}

async function renderProjectPage(request, env, id) {
  if (!env.DB) return new Response("Project database is unavailable.", { status: 503 });
  await initializeDatabase(env.DB);
  let row = await env.DB.prepare(
    "SELECT * FROM projects WHERE published = 1 AND id = ?"
  ).bind(id).first();
  if (!row) return new Response("Project not found.", { status: 404 });

  row = await enrichProject(env.DB, row);
  const project = toProject(row);
  const canonical = `https://procity.ca/project/${project.slug}/`;
  const description = projectNarrative(project);
  const price = project.price
    ? `$${Number(project.price).toLocaleString("en-CA")}`
    : "Contact for pricing";
  const projectImages = [...new Set([...project.images, project.image].filter(Boolean))].slice(0, 40);
  const image = projectImages[0] || "https://procity.ca/procity-logo.png";
  const hasCoordinates = Number(project.latitude) !== 0 && Number(project.longitude) !== 0;
  const mapQuery = hasCoordinates
    ? `${project.latitude},${project.longitude}`
    : `${project.address}, ${project.city}, Ontario, Canada`;
  const mapEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`;
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const ratingValue = "5";
  const reviewCount = "1";
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "RealEstateListing",
        "@id": `${canonical}#listing`,
        url: canonical,
        name: project.title,
        description,
        image: projectImages.length ? projectImages : [image],
        datePosted: row.updated_at,
        offers: {
          "@type": "Offer",
          priceCurrency: "CAD",
          ...(project.price ? { price: project.price } : {}),
          availability: "https://schema.org/InStock"
        },
        mainEntity: {
          "@type": project.type === "Condo" ? "ApartmentComplex" : "Residence",
          name: project.title,
          address: {
            "@type": "PostalAddress",
            streetAddress: project.address,
            addressLocality: project.city,
            addressRegion: "ON",
            addressCountry: "CA"
          },
          ...(project.latitude && project.longitude ? {
            geo: { "@type": "GeoCoordinates", latitude: project.latitude, longitude: project.longitude }
          } : {})
        },
        provider: { "@id": "https://procity.ca/#organization" }
      },
      {
        "@type": "RealEstateAgent",
        "@id": "https://procity.ca/#organization",
        name: "ProCity",
        url: "https://procity.ca/",
        telephone: "+1-647-847-9666",
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue,
          bestRating: "5",
          reviewCount
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://procity.ca/" },
          { "@type": "ListItem", position: 2, name: "Projects", item: "https://procity.ca/projects/" },
          { "@type": "ListItem", position: 3, name: project.title, item: canonical }
        ]
      }
    ]
  };
  const keywords = [
    project.title, `${project.city} pre construction`, `${project.city} condos`,
    project.builder, project.type, "ProCity"
  ].filter(Boolean).join(", ");

  return new Response(`<!doctype html><html lang="en-CA"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(project.title)} in ${escapeHtml(project.city)} | Pricing & Floor Plans | ProCity</title>
    <meta name="description" content="${escapeHtml(description.slice(0, 158))}">
    <meta name="keywords" content="${escapeHtml(keywords)}"><meta name="robots" content="index,follow,max-image-preview:large">
    <link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><meta name="theme-color" content="#07c160">
    <meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(project.title)} | ProCity">
    <meta property="og:description" content="${escapeHtml(description.slice(0, 190))}"><meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:card" content="summary_large_image">
    <link rel="stylesheet" href="/styles.css?v=20260729-1"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>
  </head><body>${siteHeader()}<main>
    <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/projects/">Projects</a><span>›</span><span>${escapeHtml(project.title)}</span></nav>
    <section class="project-hero-detail">
      <div class="project-hero-image">${projectImages.length ? `<button class="lightbox-trigger lightbox-hero-trigger" type="button" data-lightbox-index="0" data-lightbox-src="${escapeHtml(projectImages[0])}" data-lightbox-alt="${escapeHtml(project.title)} in ${escapeHtml(project.city)}"><img src="${escapeHtml(projectImages[0])}" alt="${escapeHtml(project.title)} in ${escapeHtml(project.city)}"><span>View gallery</span></button>` : `<div class="image-placeholder">PROCITY</div>`}</div>
      <div class="project-hero-copy"><p class="eyebrow">${escapeHtml(project.area)} · ${escapeHtml(project.city)}</p><h1>${escapeHtml(project.title)}</h1>
        <p class="project-lead">${escapeHtml(description)}</p><a class="button" href="#contact">Request pricing &amp; floor plans</a>
      </div>
    </section>
    ${projectImages.length > 1 ? `<section class="project-gallery" aria-label="${escapeHtml(project.title)} image gallery">${projectImages.slice(1).map((url, index) =>
      `<figure><button class="lightbox-trigger" type="button" data-lightbox-index="${index + 1}" data-lightbox-src="${escapeHtml(url)}" data-lightbox-alt="${escapeHtml(project.title)} project image ${index + 2}"><img src="${escapeHtml(url)}" alt="${escapeHtml(project.title)} project image ${index + 2}" loading="lazy"></button></figure>`
    ).join("")}</section>` : ""}
    ${projectImages.length ? `<div class="project-lightbox" data-lightbox hidden role="dialog" aria-modal="true" aria-label="${escapeHtml(project.title)} image viewer">
      <button class="lightbox-close" type="button" data-lightbox-close aria-label="Close image viewer">×</button>
      <button class="lightbox-nav lightbox-prev" type="button" data-lightbox-prev aria-label="Previous image">‹</button>
      <figure><img data-lightbox-image src="" alt=""><figcaption data-lightbox-counter></figcaption></figure>
      <button class="lightbox-nav lightbox-next" type="button" data-lightbox-next aria-label="Next image">›</button>
    </div>` : ""}
    <section class="project-detail-grid section">
      <div><p class="eyebrow">PROJECT OVERVIEW</p><h2>Key project information</h2>
        <div class="detail-facts">
          <div><span>Starting price</span><strong>${escapeHtml(price)}</strong></div>
          <div><span>Property type</span><strong>${escapeHtml(project.type)}</strong></div>
          <div><span>Developer</span><strong>${escapeHtml(project.builder || "Contact ProCity")}</strong></div>
          <div><span>Occupancy</span><strong>${escapeHtml(project.occupancy || "To be confirmed")}</strong></div>
          <div><span>Sales status</span><strong>${escapeHtml(project.badge || "Now registering")}</strong></div>
          <div><span>Location</span><strong>${escapeHtml(project.address)}</strong></div>
        </div>
        <article class="project-copy"><h2>About ${escapeHtml(project.title)}</h2><p>${escapeHtml(description)}</p>
          <h2>Location and neighbourhood</h2><p>Located in ${escapeHtml(project.area)}, this project offers a ${escapeHtml(project.city)} address to evaluate alongside nearby transportation, schools, shopping, parks and employment destinations. Ask ProCity for a current location review tailored to your needs.</p>
          <h2>Pricing, floor plans and incentives</h2><p>Availability, deposits, maintenance fees, parking, locker options and builder incentives can change. Request the latest sales package before making a decision.</p>
        </article>
        ${Object.keys(project.propertyDetails).length ? `<section class="project-data-section"><h2>Property Details</h2>${renderDetailList(project.propertyDetails)}</section>` : ""}
        ${Object.keys(project.pricingFees).length ? `<section class="project-data-section"><h2>Pricing &amp; Fees</h2>${renderDetailList(project.pricingFees)}</section>` : ""}
        ${project.depositStructure ? `<section class="project-data-section"><h2>Deposit Structure</h2><div class="deposit-copy">${escapeHtml(project.depositStructure)}</div></section>` : ""}
        ${project.amenities.length ? `<section class="project-data-section"><h2>Building Amenities</h2>${renderAmenities(project.amenities)}</section>` : ""}
        ${project.currentIncentives ? `<section class="project-data-section"><h2>Current Incentives</h2><div class="deposit-copy">${escapeHtml(project.currentIncentives)}</div></section>` : ""}
        <section class="project-data-section project-location">
          <div class="section-heading-row"><div><p class="eyebrow">PROJECT LOCATION</p><h2>${escapeHtml(project.address)}</h2></div><a href="${escapeHtml(mapLink)}" target="_blank" rel="noopener">Open in Google Maps ↗</a></div>
          <div class="project-map-frame"><iframe title="Map showing ${escapeHtml(project.title)} at ${escapeHtml(project.address)}" src="${escapeHtml(mapEmbed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>
        </section>
      </div>
      <aside class="project-sidebar" id="contact"><p class="eyebrow">VIP INFORMATION</p><h2>Get the current package</h2><p>Ask for the latest prices, floor plans, incentives and availability.</p>
        <form class="compact-lead" data-lead-source="Project package request"><input type="hidden" name="project" value="${escapeHtml(project.title)}"><label>Name<input name="name" autocomplete="name" required></label><label>Email<input type="email" name="email" autocomplete="email" required></label><label>Phone<input type="tel" name="phone" autocomplete="tel"></label><label hidden>Website<input name="website" tabindex="-1" autocomplete="off"></label><button class="button button-dark" type="submit">Request details</button><p class="form-status" role="status" aria-live="polite"></p><small>Information is subject to change and should be independently verified.</small></form>
      </aside>
    </section>
  </main>${siteFooter()}<script src="/site.js?v=20260729-2"></script></body></html>`, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300, stale-while-revalidate=3600" }
  });
}

async function renderSitemap(env) {
  if (!env.DB) return new Response("Sitemap unavailable.", { status: 503 });
  await initializeDatabase(env.DB);
  const result = await env.DB.prepare(
    "SELECT id, title, updated_at FROM projects WHERE published = 1 ORDER BY id"
  ).all();
  const baseUrls = [
    ["https://procity.ca/", "1.0"],
    ["https://procity.ca/projects/", "0.9"],
    ["https://procity.ca/map/", "0.8"]
  ].map(([loc, priority]) => `<url><loc>${loc}</loc><changefreq>weekly</changefreq><priority>${priority}</priority></url>`);
  const projectUrls = result.results.map((row) => {
    const slug = String(row.title || "project").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "project";
    const lastmod = String(row.updated_at || "").slice(0, 10);
    return `<url><loc>https://procity.ca/project/${slug}-${row.id}/</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>weekly</changefreq><priority>0.7</priority></url>`;
  });
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${baseUrls.join("")}${projectUrls.join("")}</urlset>`, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" }
  });
}

async function fetchProjectImage(request) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/project-images\/([a-z0-9][a-z0-9._-]*\.webp)$/i);
  if (!match) return null;
  const origin = `https://raw.githubusercontent.com/sky13520/ProCity/main/public/project-images/${encodeURIComponent(match[1])}`;
  const upstream = await fetch(origin, {
    headers: {
      accept: request.headers.get("accept") || "image/webp",
      "user-agent": "ProCity Image Proxy"
    },
    cf: { cacheEverything: true, cacheTtl: 31536000 }
  });
  if (!upstream.ok) return new Response("Image not found.", { status: upstream.status });
  const headers = new Headers(upstream.headers);
  headers.set("content-type", "image/webp");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.delete("set-cookie");
  return new Response(upstream.body, { status: upstream.status, headers });
}

async function fetchStaticAsset(request, env) {
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404) return response;

  // Cloudflare's repository build can be misconfigured with `--assets .`.
  // In that case `.assetsignore` publishes only `public/`, but asset paths keep
  // the `/public` prefix. Fall back to that prefix so production still serves
  // the same URLs until the dashboard command is corrected.
  const url = new URL(request.url);
  if (url.pathname.startsWith("/public/")) return response;
  url.pathname = `/public${url.pathname === "/" ? "/" : url.pathname}`;
  return env.ASSETS.fetch(new Request(url, request));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/project-images/")) {
        return await fetchProjectImage(request) || new Response("Image not found.", { status: 404 });
      }
      if (url.pathname.startsWith("/api/")) {
        return await routeApi(request, env, ctx);
      }
      if (url.pathname === "/sitemap.xml") return await renderSitemap(env);
      const projectId = projectIdFromPath(url.pathname);
      if (projectId) return await renderProjectPage(request, env, projectId);
      return await fetchStaticAsset(request, env);
    } catch (error) {
      console.error(JSON.stringify({
        message: "Unhandled Worker request error",
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error)
      }));
      return url.pathname.startsWith("/api/")
        ? json({ error: "Internal server error." }, 500)
        : new Response("Internal server error.", { status: 500 });
    }
  }
};
