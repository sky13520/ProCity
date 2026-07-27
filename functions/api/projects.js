import { apiError, json, requireDatabase, toProject } from "../_lib/http.js";

export async function onRequestGet(context) {
  const missingDatabase = requireDatabase(context.env);
  if (missingDatabase) return missingDatabase;

  try {
    const result = await context.env.DB.prepare(
      `SELECT * FROM projects WHERE published = 1
       ORDER BY featured DESC, updated_at DESC, id DESC`
    ).all();
    return json(
      { projects: result.results.map(toProject) },
      200,
      { "cache-control": "public, max-age=60, stale-while-revalidate=300" }
    );
  } catch (error) {
    return apiError("Unable to load projects.", 500, error.message);
  }
}
