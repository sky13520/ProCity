import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { parseProjectSource } from "../src/index.js";

const detailsPath = new URL("../src/project-details.json", import.meta.url);
const concurrency = Math.max(1, Math.min(12, Number(process.env.DETAIL_CONCURRENCY || 6)));
const catalog = JSON.parse(execFileSync(
  "git",
  ["show", "deedd96:src/project-data.json"],
  { encoding: "utf8", maxBuffer: 25_000_000 }
));
const existing = JSON.parse(execFileSync(
  "git",
  ["show", "HEAD:src/project-details.json"],
  { encoding: "utf8", maxBuffer: 25_000_000 }
));
const detailsById = new Map(existing.map((detail) => [detail.id, detail]));
const failures = [];
let cursor = 0;
let fetched = 0;

const useful = (details) =>
  details.images.length > 0
  || Object.keys(details.propertyDetails).length > 0
  || Object.keys(details.pricingFees).length > 0
  || Boolean(details.depositStructure)
  || details.amenities.length > 0
  || Boolean(details.currentIncentives);

async function fetchHtml(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-CA,en;q=0.9",
          "cache-control": "no-cache",
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/138 Safari/537.36"
        },
        signal: AbortSignal.timeout(45_000)
      });
      if (response.ok) return response.text();
      lastError = new Error(`HTTP ${response.status}`);
      if (![429, 500, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
  throw lastError;
}

async function fetchProject(project, index) {
  const id = 100000 + index;
  if (!project.sourceUrl) return;
  try {
    const parsed = parseProjectSource(await fetchHtml(project.sourceUrl));
    if (useful(parsed)) {
      detailsById.set(id, { id, ...parsed });
      fetched += 1;
    }
  } catch (error) {
    failures.push({ id, sourceId: project.sourceId, error: String(error?.message || error) });
  }
}

async function checkpoint() {
  const details = [...detailsById.values()].sort((left, right) => left.id - right.id);
  await writeFile(detailsPath, `${JSON.stringify(details)}\n`);
}

async function worker() {
  while (cursor < catalog.length) {
    const index = cursor++;
    await fetchProject(catalog[index], index);
    if ((index + 1) % 100 === 0) {
      console.log({ checked: index + 1, total: catalog.length, fetched, retained: detailsById.size, failures: failures.length });
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
await checkpoint();
await writeFile(
  new URL("../project-detail-failures.json", import.meta.url),
  `${JSON.stringify(failures, null, 2)}\n`
);
console.log({ checked: catalog.length, fetched, retained: detailsById.size, failures: failures.length });
