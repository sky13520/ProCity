import {
  PROJECT_COLUMNS,
  apiError,
  json,
  projectPayload,
  readJson,
  requireAdmin,
  requireDatabase,
  toProject
} from "../../../_lib/http.js";

function projectId(context) {
  const id = Number(context.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function onRequestPut(context) {
  const unauthorized = await requireAdmin(context);
  if (unauthorized) return unauthorized;
  const missingDatabase = requireDatabase(context.env);
  if (missingDatabase) return missingDatabase;
  const id = projectId(context);
  if (!id) return apiError("Invalid project ID.", 400);

  try {
    const payload = projectPayload(await readJson(context.request));
    const assignments = PROJECT_COLUMNS.split(",").map((column) => `${column.trim()} = ?`).join(", ");
    const result = await context.env.DB.prepare(
      `UPDATE projects SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(...Object.values(payload), id).run();
    if (!result.meta.changes) return apiError("Project not found.", 404);
    const project = await context.env.DB.prepare(
      "SELECT * FROM projects WHERE id = ?"
    ).bind(id).first();
    return json({ project: toProject(project) });
  } catch (error) {
    return apiError(error.message || "Unable to update project.", 400);
  }
}

export async function onRequestDelete(context) {
  const unauthorized = await requireAdmin(context);
  if (unauthorized) return unauthorized;
  const missingDatabase = requireDatabase(context.env);
  if (missingDatabase) return missingDatabase;
  const id = projectId(context);
  if (!id) return apiError("Invalid project ID.", 400);

  try {
    const result = await context.env.DB.prepare(
      "DELETE FROM projects WHERE id = ?"
    ).bind(id).run();
    if (!result.meta.changes) return apiError("Project not found.", 404);
    return json({ deleted: true });
  } catch (error) {
    return apiError("Unable to delete project.", 500, error.message);
  }
}
