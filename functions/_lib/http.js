const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff"
};

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers }
  });
}

export function apiError(message, status = 400, details) {
  return json({ error: message, ...(details ? { details } : {}) }, status);
}

async function timingSafeEqual(left, right) {
  if (!left || !right) return false;
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right))
  ]);
  if (typeof crypto.subtle.timingSafeEqual === "function") {
    return crypto.subtle.timingSafeEqual(leftHash, rightHash);
  }

  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let mismatch = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    mismatch |= leftBytes[index] ^ rightBytes[index];
  }
  return mismatch === 0;
}

export async function isAdmin(request, env) {
  const accessEmail = request.headers.get("Cf-Access-Authenticated-User-Email");
  const allowedEmails = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (accessEmail && allowedEmails.includes(accessEmail.toLowerCase())) return true;

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return timingSafeEqual(token, String(env.ADMIN_API_TOKEN || ""));
}

export async function requireAdmin(context) {
  if (await isAdmin(context.request, context.env)) return null;
  return apiError("Administrator authorization required.", 401);
}

export function requireDatabase(env) {
  if (env.DB) return null;
  return apiError(
    "Database binding is not configured. Add a D1 binding named DB to the Cloudflare Worker.",
    503
  );
}

export async function readJson(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Content-Type must be application/json.");
  }
  return request.json();
}

export function projectPayload(input) {
  const text = (key, fallback = "") => String(input[key] ?? fallback).trim();
  const number = (key, fallback = 0) => {
    const value = Number(input[key] ?? fallback);
    return Number.isFinite(value) ? value : fallback;
  };

  const payload = {
    title: text("title"),
    city: text("city"),
    area: text("area"),
    address: text("address"),
    type: text("type", "Condo"),
    builder: text("builder"),
    price: Math.max(0, Math.round(number("price"))),
    occupancy: text("occupancy"),
    badge: text("badge"),
    image_url: text("image_url"),
    description: text("description"),
    latitude: number("latitude", NaN),
    longitude: number("longitude", NaN),
    featured: input.featured ? 1 : 0,
    published: input.published === false ? 0 : 1
  };

  if (!payload.title || !payload.city || !payload.area || !payload.address) {
    throw new Error("Project name, city, neighbourhood, and address are required.");
  }
  if (!["Condo", "Townhome", "Detached", "Semi-Detached"].includes(payload.type)) {
    throw new Error("Property type is invalid.");
  }
  if (!Number.isFinite(payload.latitude) || payload.latitude < -90 || payload.latitude > 90) {
    throw new Error("Latitude must be between -90 and 90.");
  }
  if (!Number.isFinite(payload.longitude) || payload.longitude < -180 || payload.longitude > 180) {
    throw new Error("Longitude must be between -180 and 180.");
  }
  if (payload.image_url && !/^https:\/\//i.test(payload.image_url)) {
    throw new Error("Image URL must use HTTPS.");
  }
  return payload;
}

export const PROJECT_COLUMNS = `
  title, city, area, address, type, builder, price, occupancy, badge,
  image_url, description, latitude, longitude, featured, published
`;

export function toProject(row) {
  const localProjectImage = (value) => {
    const image = String(value || "");
    return /^\/project-images\/[a-z0-9/_-]+\.webp$/i.test(image) ? image : "";
  };
  const storedImages = parseStoredJson(row.images_json, [])
    .map(localProjectImage)
    .filter(Boolean);
  const slug = String(row.title || "project")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72) || "project";
  return {
    id: row.id,
    title: row.title,
    city: row.city,
    area: row.area,
    address: row.address,
    type: row.type,
    builder: row.builder,
    price: row.price,
    priceLabel: row.price ? `From $${Math.round(row.price / 1000)}K` : "Contact for pricing",
    occupancy: row.occupancy,
    badge: row.badge,
    image: localProjectImage(row.image_url) || storedImages[0] || "",
    images: storedImages,
    description: row.description,
    propertyDetails: parseStoredJson(row.property_details_json, {}),
    pricingFees: parseStoredJson(row.pricing_fees_json, {}),
    depositStructure: row.deposit_structure || "",
    amenities: parseStoredJson(row.amenities_json, []),
    currentIncentives: row.current_incentives || "",
    latitude: row.latitude,
    longitude: row.longitude,
    featured: Boolean(row.featured),
    published: Boolean(row.published),
    slug: `${slug}-${row.id}`
  };
}

function parseStoredJson(value, fallback) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}
