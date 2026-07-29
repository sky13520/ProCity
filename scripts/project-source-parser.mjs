function decodeSourceText(value = "") {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#8220;|&#8221;/gi, '"')
    .replace(/&#039;|&apos;|&#8217;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function sectionHtml(html, heading) {
  const expression = new RegExp(
    `<h[1-4][^>]*>[\\s\\S]*?${heading}[\\s\\S]*?<\\/h[1-4]>([\\s\\S]*?)(?=<h[1-4][^>]*>|$)`,
    "i"
  );
  return html.match(expression)?.[1] || "";
}

function parseDetailPairs(html) {
  const pairs = {};
  for (const match of html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text = decodeSourceText(match[1]);
    const separator = text.indexOf(":");
    if (separator > 0) {
      const key = text.slice(0, separator).trim();
      const value = text.slice(separator + 1).trim();
      if (key && value && key.length < 80) pairs[key] = value;
    }
  }
  return pairs;
}

function parseDetailItems(html) {
  const items = [];
  for (const match of html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text = decodeSourceText(match[1]);
    if (text && text.length < 240) items.push(text);
  }
  return [...new Set(items)];
}

function normalizeProjectImage(url, baseUrl = "https://mycondopro.ca") {
  let normalized = decodeSourceText(String(url || ""))
    .replace(/\\\//g, "/")
    .replace(/^['"]|['"]$/g, "");
  if (normalized.startsWith("//")) normalized = `https:${normalized}`;
  if (normalized.startsWith("/")) normalized = `${baseUrl}${normalized}`;
  return normalized
    .replace(/-\d+x\d+(?=\.[a-z]{3,4}(?:\?|$))/i, "")
    .replace(/&amp;/g, "&");
}

export function parseProjectSource(html) {
  const projectHtml = html.split(/More Projects in this area/i)[0];
  const imageCandidates = [];
  for (const match of projectHtml.matchAll(/(?:src|data-src|data-lazy-src|data-bg|href)\s*=\s*["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi)) {
    imageCandidates.push(normalizeProjectImage(match[1]));
  }
  for (const match of projectHtml.matchAll(/(?:srcset|data-srcset)\s*=\s*["']([^"']+)["']/gi)) {
    for (const candidate of match[1].split(",")) {
      imageCandidates.push(normalizeProjectImage(candidate.trim().split(/\s+/)[0]));
    }
  }
  for (const match of projectHtml.matchAll(/url\(\s*["']?([^"')]+\.(?:jpe?g|png|webp)(?:\?[^"')]*)?)/gi)) {
    imageCandidates.push(normalizeProjectImage(match[1]));
  }
  const images = [...new Set(imageCandidates)]
    .filter((url) => /^https:\/\/mycondopro\.ca\/wp-content\/uploads\//i.test(url))
    .filter((url) => !/logo|icon|avatar|agent|placeholder|loading/i.test(url))
    .slice(0, 40);
  return {
    images,
    propertyDetails: parseDetailPairs(sectionHtml(projectHtml, "Property Details")),
    pricingFees: parseDetailPairs(sectionHtml(projectHtml, "Pricing (?:&amp;|&) Fees")),
    depositStructure: decodeSourceText(sectionHtml(projectHtml, "Deposit Structure")).slice(0, 4000),
    amenities: parseDetailItems(sectionHtml(projectHtml, "(?:Building )?Amenities")).slice(0, 80),
    currentIncentives: decodeSourceText(sectionHtml(projectHtml, "Current Incentives")).slice(0, 4000)
  };
}

function stripMarkdown(value = "") {
  return value
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[*_`#>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function markdownSection(markdown, heading) {
  const expression = new RegExp(
    `^#{1,4}\\s+${heading}\\s*$([\\s\\S]*?)(?=^#{1,4}\\s+|(?![\\s\\S]))`,
    "im"
  );
  return markdown.match(expression)?.[1] || "";
}

function parseMarkdownPairs(markdown) {
  const pairs = {};
  for (const line of markdown.split("\n")) {
    const text = stripMarkdown(line.replace(/^\s*[-*+]\s+/, ""));
    const separator = text.indexOf(":");
    if (separator > 0) {
      const key = text.slice(0, separator).trim();
      const value = text.slice(separator + 1).trim();
      if (key && value && key.length < 80) pairs[key] = value;
    }
  }
  return pairs;
}

function parseMarkdownItems(markdown) {
  return [...new Set(markdown.split("\n")
    .map((line) => stripMarkdown(line.replace(/^\s*[-*+]\s+/, "")))
    .filter((line) => line && line.length < 240))];
}

export function parseProjectMarkdown(markdown) {
  const images = [...new Set(
    [...markdown.matchAll(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/g)]
      .map((match) => normalizeProjectImage(match[1]))
      .filter((url) => /mycondopro\.ca\/wp-content\/uploads/i.test(url))
      .filter((url) => !/logo|icon|avatar|agent|placeholder|loading/i.test(url))
  )].slice(0, 40);
  return {
    images,
    propertyDetails: parseMarkdownPairs(markdownSection(markdown, "Property Details")),
    pricingFees: parseMarkdownPairs(markdownSection(markdown, "Pricing (?:&|&amp;) Fees")),
    depositStructure: stripMarkdown(markdownSection(markdown, "Deposit Structure")).slice(0, 4000),
    amenities: parseMarkdownItems(markdownSection(markdown, "(?:Building )?Amenities")).slice(0, 80),
    currentIncentives: stripMarkdown(markdownSection(markdown, "Current Incentives")).slice(0, 4000)
  };
}
