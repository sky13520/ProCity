import { json } from "../functions/_lib/http.js";
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

async function routeApi(request, env, ctx) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

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
      mapsConfigured: Boolean(env.GOOGLE_MAPS_API_KEY)
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
      if (url.pathname.startsWith("/api/")) {
        return await routeApi(request, env, ctx);
      }
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
