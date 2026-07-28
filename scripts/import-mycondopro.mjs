import { mkdir, readFile, writeFile } from "node:fs/promises";

const pagesDirectory = new URL("../.import-pages/", import.meta.url);
const outputFile = new URL("../src/project-data.json", import.meta.url);

function decode(value = "") {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#8220;|&#8221;/gi, '"')
    .replace(/&#039;|&apos;|&#8217;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&rsquo;/gi, "’")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function capture(block, className) {
  const expression = new RegExp(`class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`);
  return decode(block.match(expression)?.[1]);
}

function numericPrice(label) {
  const normalized = label.replace(/,/g, "");
  const values = [...normalized.matchAll(/\$?\s*(\d+(?:\.\d+)?)\s*([kKmM])?/g)]
    .map((match) => {
      let value = Number(match[1]);
      if (match[2]?.toLowerCase() === "k") value *= 1_000;
      if (match[2]?.toLowerCase() === "m") value *= 1_000_000;
      return value >= 100_000 ? Math.round(value) : 0;
    })
    .filter(Boolean);
  return values.length ? Math.min(...values) : 0;
}

function propertyType(title, address, description = "") {
  const text = `${title} ${address} ${description}`.toLowerCase();
  if (/town|townhome/.test(text)) return "Townhome";
  if (/semi[- ]detached/.test(text)) return "Semi-Detached";
  if (/detached|single/.test(text)) return "Detached";
  return "Condo";
}

function hashPosition(input) {
  let hash = 2166136261;
  for (const character of input) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const cityCentres = {
  Toronto: [43.6532, -79.3832], "North York": [43.7615, -79.4111], Scarborough: [43.7764, -79.2318],
  Etobicoke: [43.6205, -79.5132], Markham: [43.8561, -79.337], Vaughan: [43.8372, -79.5083],
  "Richmond Hill": [43.8828, -79.4403], Mississauga: [43.589, -79.6441], Brampton: [43.7315, -79.7624],
  Oakville: [43.4675, -79.6877], Burlington: [43.3255, -79.799], Hamilton: [43.2557, -79.8711],
  Pickering: [43.8384, -79.0868], Ajax: [43.8509, -79.0204], Whitby: [43.8975, -78.9429],
  Oshawa: [43.8971, -78.8658], Aurora: [44.0065, -79.4504], Newmarket: [44.0592, -79.4613],
  Milton: [43.5183, -79.8774], Waterloo: [43.4643, -80.5204], Calgary: [51.0447, -114.0719],
  Edmonton: [53.5461, -113.4938], Vancouver: [49.2827, -123.1207], Ottawa: [45.4215, -75.6972],
  London: [42.9849, -81.2453]
};

function approximatePosition(city, seed) {
  const centre = cityCentres[city];
  if (!centre) return null;
  const hash = hashPosition(seed);
  const latitude = centre[0] + (((hash & 0xffff) / 0xffff) - 0.5) * 0.06;
  const longitude = centre[1] + ((((hash >>> 16) & 0xffff) / 0xffff) - 0.5) * 0.08;
  return [Number(latitude.toFixed(6)), Number(longitude.toFixed(6))];
}

function parsePage(html) {
  const starts = [...html.matchAll(/<div[^>]+class="[^"]*project-block__card[^>]*>/g)].map((match) => match.index);
  return starts.map((start, index) => html.slice(start, starts[index + 1] ?? html.indexOf("wpgb-pagination-facet", start)))
    .map((block) => {
      const linkMatch = block.match(/<a href="(https:\/\/mycondopro\.ca\/project\/[^"/]+\/)">([\s\S]*?)<\/a>/);
      if (!linkMatch) return null;
      const image = block.match(/<img[^>]+src="(https:\/\/mycondopro\.ca\/wp-content\/uploads\/[^"]+)"/)?.[1] || "";
      const title = decode(linkMatch[2]);
      const builder = capture(block, "condos-card__developer");
      const address = capture(block, "condos-card__address");
      const priceLabel = capture(block, "condos-card__price");
      const occupancy = capture(block, "condos-card__occupancy").match(/20\d{2}/)?.[0] || "";
      const badge = capture(block, "project-card__tag__block_text") || "PROJECT";
      const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
      const city = parts.at(-1)?.replace(/\b(?:ON|Ontario|Canada)\b/gi, "").trim() || "Ontario";
      const area = city;
      const position = approximatePosition(city, `${title}|${address}`);
      return {
        sourceId: linkMatch[1].split("/").filter(Boolean).at(-1), sourceUrl: linkMatch[1], title, city, area,
        address, type: propertyType(title, address), builder, price: numericPrice(priceLabel), priceLabel,
        occupancy, badge, imageUrl: image, description: `${title} by ${builder || "developer"}, located at ${address}.`,
        latitude: position?.[0] ?? null, longitude: position?.[1] ?? null, coordinateQuality: position ? "city-centre-estimate" : "missing",
        featured: /platinum|new release|promotional/i.test(badge), published: true
      };
    }).filter((project) => project?.title && project.address);
}

await mkdir(pagesDirectory, { recursive: true });
const projects = [];
for (let page = 1; page <= 74; page += 1) {
  const html = await readFile(new URL(`page-${page}.html`, pagesDirectory), "utf8");
  projects.push(...parsePage(html));
}

const unique = [...new Map(projects.map((project) => [project.sourceId, project])).values()]
  .sort((left, right) => left.title.localeCompare(right.title));
await writeFile(outputFile, `${JSON.stringify(unique)}\n`);
console.log(JSON.stringify({ raw: projects.length, unique: unique.length, withCoordinates: unique.filter((p) => p.latitude).length }));
