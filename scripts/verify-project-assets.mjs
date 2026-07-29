import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = new URL("../", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("../src/project-data.json", import.meta.url), "utf8"));
const details = JSON.parse(await readFile(new URL("../src/project-details.json", import.meta.url), "utf8"));
const references = [
  ...catalog.map((project) => project.image),
  ...details.flatMap((detail) => detail.images || [])
].filter(Boolean);
const missing = [];
const nonLocal = [];

for (const reference of new Set(references)) {
  if (!/^\/project-images\/[a-z0-9][a-z0-9._-]*\.webp$/i.test(reference)) {
    nonLocal.push(reference);
    continue;
  }
  try {
    await access(path.join(root.pathname, "public", reference));
  } catch {
    missing.push(reference);
  }
}

const summary = {
  projects: catalog.length,
  details: details.length,
  projectsWithMultipleImages: details.filter((detail) => detail.images?.length > 1).length,
  imageReferences: references.length,
  uniqueImageReferences: new Set(references).size,
  missing: missing.length,
  nonLocal: nonLocal.length
};
console.log(summary);
if (missing.length || nonLocal.length) {
  console.error({ missing: missing.slice(0, 20), nonLocal: nonLocal.slice(0, 20) });
  process.exit(1);
}
