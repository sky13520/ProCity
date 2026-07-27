import {
  PROJECT_COLUMNS,
  apiError,
  json,
  projectPayload,
  readJson,
  requireAdmin,
  requireDatabase,
  toProject
} from "../../_lib/http.js";

export async function onRequestGet(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;
  const missingDatabase = requireDatabase(context.env);
  if (missingDatabase) return missingDatabase;

  try {
    const result = await context.env.DB.prepare(
      "SELECT * FROM projects ORDER BY updated_at DESC, id DESC"
    ).all();
    return json({ projects: result.results.map(toProject) });
  } catch (error) {
    return apiError("Unable to load admin projects.", 500, error.message);
  }
}

export async function onRequestPost(context) {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;
  const missingDatabase = requireDatabase(context.env);
  if (missingDatabase) return missingDatabase;

  try {
    const payload = projectPayload(await readJson(context.request));
    const values = Object.values(payload);
    const placeholders = values.map(() => "?").join(", ");
    const result = await context.env.DB.prepare(
      `INSERT INTO projects (${PROJECT_COLUMNS}) VALUES (${placeholders})`
    ).bind(...values).run();
    const project = await context.env.DB.prepare(
      "SELECT * FROM projects WHERE id = ?"
    ).bind(result.meta.last_row_id).first();
    return json({ project: toProject(project) }, 201);
  } catch (error) {
    return apiError(error.message || "Unable to create project.", 400);
  }
}
