import { apiError, json, requireDatabase, toProject } from "../_lib/http.js";

const ALLOWED_SORTS = {
  featured: "featured DESC, updated_at DESC, id DESC",
  price: "CASE WHEN price = 0 THEN 1 ELSE 0 END, price ASC, id DESC",
  occupancy: "CASE WHEN occupancy = '' THEN 1 ELSE 0 END, occupancy ASC, id DESC",
  newest: "updated_at DESC, id DESC"
};

function positiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function addFilter(conditions, bindings, sql, value) {
  conditions.push(sql);
  bindings.push(value);
}

export async function onRequestGet(context) {
  const missingDatabase = requireDatabase(context.env);
  if (missingDatabase) return missingDatabase;

  return json(
    {
      projects: [],
      pagination: { page: 1, limit: 24, total: 0, totalPages: 0 },
      paused: true
    },
    200,
    {
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow, noarchive"
    }
  );

  /* Project listings are intentionally paused while replacement content is prepared.
  try {
    const url = new URL(context.request.url);
    const id = Number.parseInt(url.searchParams.get("id"), 10);
    if (Number.isFinite(id)) {
      const row = await context.env.DB.prepare(
        "SELECT * FROM projects WHERE published = 1 AND id = ?"
      ).bind(id).first();
      return row
        ? json({ project: toProject(row) }, 200, { "cache-control": "public, max-age=300" })
        : apiError("Project not found.", 404);
    }

    const conditions = ["published = 1"];
    const bindings = [];
    const query = String(url.searchParams.get("q") || "").trim().slice(0, 120);
    const city = String(url.searchParams.get("city") || "").trim().slice(0, 80);
    const type = String(url.searchParams.get("type") || "").trim().slice(0, 40);
    const featured = url.searchParams.get("featured");

    if (query) {
      const like = `%${query}%`;
      conditions.push("(title LIKE ? OR city LIKE ? OR area LIKE ? OR address LIKE ? OR builder LIKE ?)");
      bindings.push(like, like, like, like, like);
    }
    if (city && city !== "all") addFilter(conditions, bindings, "city = ?", city);
    if (type && type !== "all") addFilter(conditions, bindings, "type = ?", type);
    if (featured === "1") conditions.push("featured = 1");

    const boundKeys = ["north", "south", "east", "west"];
    const bounds = boundKeys.map((key) => Number(url.searchParams.get(key)));
    if (boundKeys.every((key) => url.searchParams.has(key)) && bounds.every(Number.isFinite)) {
      const [north, south, east, west] = bounds;
      conditions.push("latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?");
      bindings.push(south, north, west, east);
    }

    const page = positiveInteger(url.searchParams.get("page"), 1, 10000);
    const limit = positiveInteger(url.searchParams.get("limit"), 24, 60);
    const offset = (page - 1) * limit;
    const where = `WHERE ${conditions.join(" AND ")}`;
    const order = ALLOWED_SORTS[url.searchParams.get("sort")] || ALLOWED_SORTS.featured;

    const [countResult, projectsResult] = await context.env.DB.batch([
      context.env.DB.prepare(`SELECT COUNT(*) AS total FROM projects ${where}`).bind(...bindings),
      context.env.DB.prepare(
        `SELECT * FROM projects ${where} ORDER BY ${order} LIMIT ? OFFSET ?`
      ).bind(...bindings, limit, offset)
    ]);
    const total = Number(countResult.results?.[0]?.total || 0);

    return json(
      {
        projects: projectsResult.results.map(toProject),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      },
      200,
      { "cache-control": "public, max-age=60, stale-while-revalidate=300" }
    );
  } catch (error) {
    return apiError("Unable to load projects.", 500, error.message);
  }
  */
}
