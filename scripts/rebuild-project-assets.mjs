import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const repositoryRoot = new URL("../", import.meta.url);
const catalogPath = new URL("../src/project-data.json", import.meta.url);
const detailsPath = new URL("../src/project-details.json", import.meta.url);
const outputDirectory = new URL("../public/project-images/", import.meta.url);
const concurrency = 24;

function historical(pathname) {
  return execFileSync("git", ["show", `deedd96:${pathname}`], {
    encoding: "utf8",
    maxBuffer: 25_000_000
  });
}

function repairJson(raw) {
  let inString = false;
  let escaped = false;
  let repaired = "";
  for (const character of raw) {
    if (inString && character.charCodeAt(0) < 0x20) {
      repaired += " ";
      continue;
    }
    repaired += character;
    if (escaped) escaped = false;
    else if (character === "\\") escaped = true;
    else if (character === "\"") inString = !inString;
  }
  return JSON.parse(repaired);
}

function cleanText(value = "") {
  return String(value).split(/\.beta-base\s+\./i)[0].replace(/\s+/g, " ").trim();
}

function sourceImage(value = "") {
  if (!/^https:\/\/mycondopro\.ca\/wp-content\/uploads\//i.test(value)) return "";
  const url = new URL(value);
  url.search = "";
  url.pathname = url.pathname.replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, "");
  return /cropped-android-chrome|favicon|logo|placeholder/i.test(url.href) ? "" : url.href;
}

function hash(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
}

const catalog = JSON.parse(historical("src/project-data.json"));
const details = repairJson(await readFile(detailsPath, "utf8"));
await mkdir(outputDirectory, { recursive: true });

const jobs = new Map();
function register(value, slug, role) {
  if (/^\/project-images\/[a-z0-9][a-z0-9._-]*\.webp$/i.test(value || "")) return value;
  const source = sourceImage(value);
  if (!source) return "";
  if (!jobs.has(source)) {
    const filename = `${slug}-${role}-${hash(source)}.webp`;
    jobs.set(source, { source, filename, local: `/project-images/${filename}` });
  }
  return jobs.get(source).local;
}

for (const project of catalog) {
  project.image = register(project.imageUrl, project.sourceId, "cover");
  delete project.imageUrl;
  delete project.sourceUrl;
}
const catalogById = new Map(catalog.map((project, index) => [100000 + index, project]));
for (const detail of details) {
  const slug = catalogById.get(detail.id)?.sourceId || `project-${detail.id}`;
  detail.images = [...new Set((detail.images || []).map((url, index) =>
    register(url, slug, `gallery-${index + 1}`)
  ).filter(Boolean))];
  detail.depositStructure = cleanText(detail.depositStructure).slice(0, 4000);
  detail.currentIncentives = cleanText(detail.currentIncentives).slice(0, 4000);
  detail.amenities = (detail.amenities || []).map(cleanText).filter(Boolean).slice(0, 80);
  delete detail.sourceUrl;
}

const queue = [...jobs.values()];
let cursor = 0;
let saved = 0;
let failed = 0;
let reused = 0;

async function download(job) {
  const proxy = new URL("https://wsrv.nl/");
  proxy.searchParams.set("url", job.source.replace(/^https?:\/\//, ""));
  proxy.searchParams.set("w", "1000");
  proxy.searchParams.set("output", "webp");
  proxy.searchParams.set("q", "68");
  try {
    await access(path.join(outputDirectory.pathname, job.filename));
    reused += 1;
    return;
  } catch {}
  try {
    const response = await fetch(proxy, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await writeFile(path.join(outputDirectory.pathname, job.filename), Buffer.from(await response.arrayBuffer()));
    saved += 1;
  } catch {
    try {
      const response = await fetch(job.source, {
        headers: { "user-agent": "Mozilla/5.0 ProCity Asset Importer" },
        signal: AbortSignal.timeout(60000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const converted = await sharp(Buffer.from(await response.arrayBuffer()))
        .resize({ width: 1000, withoutEnlargement: true })
        .webp({ quality: 68 })
        .toBuffer();
      await writeFile(path.join(outputDirectory.pathname, job.filename), converted);
      saved += 1;
    } catch {
      job.local = "";
      failed += 1;
    }
  }
  if ((saved + failed + reused) % 250 === 0) console.log({ processed: saved + failed + reused, total: queue.length, saved, reused, failed });
}

async function worker() {
  while (cursor < queue.length) await download(queue[cursor++]);
}
await Promise.all(Array.from({ length: concurrency }, worker));

const resultByLocal = new Map(queue.map((job) => [`/project-images/${job.filename}`, job.local]));
for (const project of catalog) project.image = resultByLocal.get(project.image) || "";
for (const detail of details) detail.images = detail.images.map((image) =>
  resultByLocal.has(image) ? resultByLocal.get(image) || "" : image
).filter(Boolean);
await writeFile(catalogPath, `${JSON.stringify(catalog)}\n`);
await writeFile(detailsPath, `${JSON.stringify(details)}\n`);
console.log({ projects: catalog.length, details: details.length, requested: queue.length, saved, reused, failed });
