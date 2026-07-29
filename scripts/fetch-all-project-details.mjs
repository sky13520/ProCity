import { appendFile, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const detailsPath = new URL("../src/project-details.json", import.meta.url);
const cachePath = new URL("../src/project-image-sources.json", import.meta.url);
const sourceApi = "https://mycondopro.ca/wp-json/wp/v2";
const projectBatchLimit = Math.max(20, Number(process.env.PROJECT_BATCH_LIMIT || 200));
const parentBatchSize = 10;
const requestConcurrency = 1;

const catalog = JSON.parse(execFileSync(
  "git",
  ["show", "deedd96:src/project-data.json"],
  { encoding: "utf8", maxBuffer: 25_000_000 }
));
const existing = JSON.parse(execFileSync(
  "git",
  ["show", "HEAD:src/project-details.json"],
  { encoding: "utf8", maxBuffer: 100_000_000 }
));
const detailsById = new Map(existing.map((detail) => [detail.id, detail]));

let cache;
try {
  cache = JSON.parse(await readFile(cachePath, "utf8"));
} catch {
  cache = { version: 1, sourcePosts: {}, images: {} };
}
cache.sourcePosts ||= {};
cache.images ||= {};

async function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function fetchJson(url) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "accept-language": "en-CA,en;q=0.9",
          "user-agent": "Mozilla/5.0 ProCity Asset Importer"
        },
        signal: AbortSignal.timeout(60_000)
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.retryAfter = Number(response.headers.get("retry-after") || 0);
        throw error;
      }
      return {
        data: await response.json(),
        pages: Math.max(1, Number(response.headers.get("x-wp-totalpages") || 1))
      };
    } catch (error) {
      lastError = error;
      const retryDelay = Math.max(Number(lastError?.retryAfter || 0) * 1000, attempt * 5000);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
  throw lastError;
}

async function parallelMap(values, operation, concurrency = requestConcurrency) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await operation(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

function apiUrl(endpoint, parameters) {
  const url = new URL(`${sourceApi}/${endpoint}`);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url;
}

async function fetchAllProjects() {
  const parameters = { per_page: "100", page: "1", _fields: "id,slug" };
  const first = await fetchJson(apiUrl("project", parameters));
  const pages = Array.from({ length: Math.max(0, first.pages - 1) }, (_, index) => index + 2);
  const remaining = await parallelMap(pages, async (page) => (
    await fetchJson(apiUrl("project", { ...parameters, page: String(page) }))
  ).data);
  return [first.data, ...remaining].flat();
}

async function fetchMediaBatch(projects) {
  const parameters = {
    parent: projects.map((project) => project.postId).join(","),
    per_page: "100",
    page: "1",
    order: "asc",
    orderby: "id",
    _fields: "id,post,source_url"
  };
  const first = await fetchJson(apiUrl("media", parameters));
  const pages = Array.from({ length: Math.max(0, first.pages - 1) }, (_, index) => index + 2);
  const remaining = [];
  for (const page of pages) {
    remaining.push((await fetchJson(apiUrl("media", { ...parameters, page: String(page) }))).data);
  }
  return [first.data, ...remaining].flat();
}

if (Object.keys(cache.sourcePosts).length < catalog.length) {
  const sourceProjects = await fetchAllProjects();
  cache.sourcePosts = Object.fromEntries(sourceProjects.map((project) => [project.slug, project.id]));
  await writeFile(cachePath, `${JSON.stringify(cache)}\n`);
}

const matched = catalog.map((project, index) => ({
  catalogIndex: index,
  sourceId: project.sourceId,
  postId: cache.sourcePosts[project.sourceId]
})).filter((project) => project.postId);
const pending = matched.filter((project) => !cache.images[project.sourceId]?.complete);
const selected = pending.slice(0, projectBatchLimit);
const batches = [];
for (let index = 0; index < selected.length; index += parentBatchSize) {
  batches.push(selected.slice(index, index + parentBatchSize));
}

let completedThisRun = 0;
let failedBatches = 0;
await parallelMap(batches, async (batch) => {
  try {
    const media = await fetchMediaBatch(batch);
    const imagesByPost = new Map();
    for (const item of media) {
      if (!item.post || !item.source_url) continue;
      if (!imagesByPost.has(item.post)) imagesByPost.set(item.post, []);
      imagesByPost.get(item.post).push(item.source_url);
    }
    for (const project of batch) {
      cache.images[project.sourceId] = {
        complete: true,
        urls: [...new Set(imagesByPost.get(project.postId) || [])]
      };
      completedThisRun += 1;
    }
    await writeFile(cachePath, `${JSON.stringify(cache)}\n`);
    await new Promise((resolve) => setTimeout(resolve, 750));
  } catch (error) {
    failedBatches += 1;
    console.error({ batch: batch.map((project) => project.sourceId), error: String(error?.message || error) });
  }
}, 1);

const remainingProjects = matched.filter((project) => !cache.images[project.sourceId]?.complete).length;
const unmatchedSlugs = catalog.filter((project) => !cache.sourcePosts[project.sourceId]).map((project) => project.sourceId);
const summary = {
  catalogProjects: catalog.length,
  sourceProjects: Object.keys(cache.sourcePosts).length,
  matchedProjects: matched.length,
  completedProjects: matched.length - remainingProjects,
  completedThisRun,
  remainingProjects,
  failedBatches,
  unmatchedProjects: unmatchedSlugs.length
};

await writeFile(
  new URL("../project-detail-failures.json", import.meta.url),
  `${JSON.stringify({ ...summary, unmatchedSlugs }, null, 2)}\n`
);
await setOutput("complete", remainingProjects === 0 ? "true" : "false");
await setOutput("remaining", remainingProjects);
console.log(summary);

if (remainingProjects > 0) process.exit(0);

let projectsWithMedia = 0;
let imageReferences = 0;
for (const project of matched) {
  const id = 100000 + project.catalogIndex;
  const detail = detailsById.get(id) || { id };
  const images = cache.images[project.sourceId]?.urls || [];
  detail.images = images;
  if (images.length) {
    projectsWithMedia += 1;
    imageReferences += images.length;
  }
  detailsById.set(id, detail);
}

const details = [...detailsById.values()].sort((left, right) => left.id - right.id);
await writeFile(detailsPath, `${JSON.stringify(details)}\n`);
console.log({ projectsWithMedia, imageReferences });
