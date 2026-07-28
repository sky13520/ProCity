import { writeFile } from "node:fs/promises";
import PROJECT_CATALOG from "../src/project-data.json" with { type: "json" };
import { parseProjectSource } from "../src/index.js";

const limit = Math.max(1, Number(process.argv[2] || 250));
const concurrency = Math.max(1, Math.min(60, Number(process.argv[3] || 24)));
const output = process.argv[4] || "project-details.sql";
const offset = 100000;
const queue = PROJECT_CATALOG
  .map((project, index) => ({ ...project, databaseId: offset + index }))
  .sort((a, b) => Number(b.featured) - Number(a.featured))
  .slice(0, limit);

function sql(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

async function fetchOne(project) {
  try {
    const response = await fetch(project.sourceUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-CA,en;q=0.9",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/138 Safari/537.36"
      },
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) return null;
    const details = parseProjectSource(await response.text());
    const useful = details.images.length > 1
      || Object.keys(details.propertyDetails).length
      || Object.keys(details.pricingFees).length
      || details.depositStructure
      || details.amenities.length
      || details.currentIncentives;
    if (!useful) return null;
    return {
      id: project.databaseId,
      sourceUrl: project.sourceUrl,
      ...details,
      sql: `UPDATE projects SET
source_url=${sql(project.sourceUrl)},
images_json=${sql(JSON.stringify(details.images))},
property_details_json=${sql(JSON.stringify(details.propertyDetails))},
pricing_fees_json=${sql(JSON.stringify(details.pricingFees))},
deposit_structure=${sql(details.depositStructure)},
amenities_json=${sql(JSON.stringify(details.amenities))},
current_incentives=${sql(details.currentIncentives)},
details_fetched_at=CURRENT_TIMESTAMP
WHERE id=${project.databaseId};`
    };
  } catch {
    return null;
  }
}

const statements = [];
let cursor = 0;
async function worker() {
  while (cursor < queue.length) {
    const index = cursor++;
    const statement = await fetchOne(queue[index]);
    if (statement) statements.push(statement);
    if ((index + 1) % 50 === 0) {
      console.log(`Checked ${index + 1}/${queue.length}; enriched ${statements.length}`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
if (output.endsWith(".json")) {
  await writeFile(output, `${JSON.stringify(statements.map(({ sql: _, ...details }) => details))}\n`, "utf8");
} else {
  await writeFile(output, `${statements.map(({ sql }) => sql).join("\n")}\n`, "utf8");
}
console.log(`Wrote ${statements.length} project updates to ${output}`);
