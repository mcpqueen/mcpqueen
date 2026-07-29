#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  DISCOVERY_PAGES,
  STATIC_SITEMAP_PATHS,
  discoverySchema,
  getDiscoveryPage,
} from "../src/discovery-pages.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://mcpqueen.com";
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function schemaTypes(value, found = []) {
  if (Array.isArray(value)) {
    for (const item of value) schemaTypes(item, found);
  } else if (value && typeof value === "object") {
    const type = value["@type"];
    if (Array.isArray(type)) found.push(...type);
    else if (typeof type === "string") found.push(type);
    for (const child of Object.values(value)) schemaTypes(child, found);
  }
  return found;
}

function hrefs(html) {
  return [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)].map(
    (match) => match[1],
  );
}

function ids(html) {
  return new Set(
    [...html.matchAll(/\bid="([^"]+)"/gi)].map((match) => match[1]),
  );
}

function isKnownInternalTarget(target) {
  const pathname = target.split("#")[0].replace(/\/$/, "") || "/";
  const exact = new Set([
    ...STATIC_SITEMAP_PATHS,
    "/api",
    "/demo/openai-demo-captions.vtt",
  ]);
  return (
    exact.has(pathname) ||
    ["/s/", "/topics/", "/reports/"].some((prefix) =>
      pathname.startsWith(prefix),
    )
  );
}

function validateLinks(html, label) {
  const pageIds = ids(html);
  for (const href of hrefs(html)) {
    if (/^(?:https?:|mailto:)/.test(href)) {
      try {
        const url = new URL(href);
        check(url.protocol === "https:", `${label}: external link is not HTTPS: ${href}`);
      } catch {
        check(false, `${label}: invalid external link: ${href}`);
      }
      continue;
    }
    if (href.startsWith("#")) {
      check(pageIds.has(href.slice(1)), `${label}: missing fragment target: ${href}`);
      continue;
    }
    check(href.startsWith("/"), `${label}: non-root-relative internal link: ${href}`);
    check(isKnownInternalTarget(href), `${label}: unknown internal target: ${href}`);
  }
}

export async function validateDiscoveryAssets() {
  const worker = await readFile(resolve(root, "src/worker.ts"), "utf8");
  const homepage = await readFile(resolve(root, "public/index.html"), "utf8");
  const captions = await readFile(
    resolve(root, "public/demo/openai-demo-captions.vtt"),
    "utf8",
  );
  const productionCaptions = await readFile(
    resolve(root, "submission-assets/demo/openai-demo-captions.vtt"),
    "utf8",
  );
  const upload = JSON.parse(
    await readFile(
      resolve(root, "submission-assets/demo/openai-demo-upload.json"),
      "utf8",
    ),
  );

  const titles = new Set();
  const descriptions = new Set();
  for (const [path, metadata] of Object.entries(DISCOVERY_PAGES)) {
    check(path.startsWith("/"), `${path}: discovery path must be root-relative`);
    check(
      metadata.title.length >= 25 && metadata.title.length <= 65,
      `${path}: title length is outside 25-65 characters`,
    );
    check(
      metadata.description.length >= 100 &&
        metadata.description.length <= 180,
      `${path}: description length is outside 100-180 characters`,
    );
    check(!titles.has(metadata.title), `${path}: duplicate discovery title`);
    check(
      !descriptions.has(metadata.description),
      `${path}: duplicate discovery description`,
    );
    titles.add(metadata.title);
    descriptions.add(metadata.description);
  }

  for (const path of ["/architecture", "/integrations", "/demo"]) {
    const page = getDiscoveryPage(path);
    check(page, `${path}: renderer is missing`);
    if (!page) continue;
    check(page.title === DISCOVERY_PAGES[path].title, `${path}: title drift`);
    check(
      page.description === DISCOVERY_PAGES[path].description,
      `${path}: description drift`,
    );
    const serialized = JSON.stringify(page.jsonld);
    check(
      JSON.parse(serialized)["@context"] === "https://schema.org",
      `${path}: schema context is missing`,
    );
    check(
      serialized.includes(`${SITE}${path}`),
      `${path}: schema lacks its canonical URL`,
    );
    check(
      !schemaTypes(page.jsonld).includes("VideoObject"),
      `${path}: VideoObject must wait for genuine public footage`,
    );
    validateLinks(page.body, path);
  }

  const architecture = getDiscoveryPage("/architecture");
  check(
    schemaTypes(architecture.jsonld).includes("TechArticle"),
    "/architecture: TechArticle schema is missing",
  );
  for (const phrase of [
    "not a security, privacy, compliance, or data-quality certification",
    "MCP Queen is not a proxy",
    "Missing evidence remains unaudited",
    "quarantined review queue",
  ]) {
    check(
      architecture.body.includes(phrase),
      `/architecture: missing trust-boundary phrase: ${phrase}`,
    );
  }

  const integrations = getDiscoveryPage("/integrations");
  for (const anchor of [
    "openai",
    "claude",
    "langchain",
    "llamaindex",
    "cloudflare",
    "huggingface",
  ]) {
    check(
      integrations.body.includes(`id="${anchor}"`),
      `/integrations: missing distinct ${anchor} section`,
    );
  }
  check(
    schemaTypes(integrations.jsonld).includes("SoftwareApplication"),
    "/integrations: SoftwareApplication schema is missing",
  );
  check(
    schemaTypes(integrations.jsonld).includes("ItemList"),
    "/integrations: ItemList schema is missing",
  );

  const mcpInfoSchema = discoverySchema("/mcp-info");
  check(
    schemaTypes(mcpInfoSchema).includes("WebPage") &&
      schemaTypes(mcpInfoSchema).includes("ItemList"),
    "/mcp-info: WebPage or tool ItemList schema is missing",
  );
  check(
    JSON.stringify(mcpInfoSchema).includes(`${SITE}/mcp-info`),
    "/mcp-info: schema lacks its canonical URL",
  );

  const demo = getDiscoveryPage("/demo");
  const videoTag = demo.body.match(/<video\b[^>]*>/i)?.[0] ?? "";
  check(videoTag.length > 0, "/demo: prepared video element is missing");
  check(
    !/\bsrc=/.test(videoTag) && !/<source\b/i.test(demo.body),
    "/demo: a media source must not be published before genuine footage",
  );
  check(
    /<track\b[^>]*kind="captions"[^>]*src="\/demo\/openai-demo-captions\.vtt"/i.test(
      demo.body,
    ),
    "/demo: captions are not wired to the prepared player",
  );
  check(
    demo.body.includes('id="chapters"') &&
      demo.body.includes('id="transcript"'),
    "/demo: chapter or transcript slots are missing",
  );
  check(
    captions.startsWith("WEBVTT\n") &&
      captions.includes("00:05:25.000 --> 00:05:35.000"),
    "public demo captions are incomplete",
  );
  check(
    captions === productionCaptions,
    "public demo captions have drifted from the generated production captions",
  );
  await access(resolve(root, "public/demo/openai-demo-captions.vtt"));

  check(
    upload.structured_data_status ===
      "withheld_until_genuine_public_footage_is_verified",
    "demo upload metadata must withhold structured video data",
  );
  check(
    !JSON.stringify(upload).includes("VideoObject"),
    "demo upload metadata must not contain VideoObject before footage exists",
  );

  const homepageTitle = homepage.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "";
  const homepageDescription =
    homepage.match(/<meta name="description" content="([^"]+)"/i)?.[1] ?? "";
  const homepageCanonical =
    homepage.match(/<link rel="canonical" href="([^"]+)"/i)?.[1] ?? "";
  const homepageSchemas = [
    ...homepage.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
    ),
  ].map((match) => JSON.parse(match[1]));
  check(homepageTitle.length >= 25, "homepage: title is missing or thin");
  check(
    homepageDescription.length >= 100,
    "homepage: description is missing or thin",
  );
  check(
    homepageCanonical === `${SITE}/`,
    "homepage: canonical URL is incorrect",
  );
  check(
    homepageSchemas.some((schema) => schemaTypes(schema).includes("WebSite")),
    "homepage: WebSite schema is missing",
  );
  check(
    homepageSchemas.some((schema) =>
      schemaTypes(schema).includes("SoftwareApplication"),
    ),
    "homepage: SoftwareApplication schema is missing",
  );
  check(
    !homepage.includes("The Trust Layer for the MCP Ecosystem"),
    "homepage: superseded trust-layer positioning remains",
  );
  validateLinks(homepage, "homepage");

  for (const path of ["/architecture", "/integrations", "/demo"]) {
    check(
      worker.includes(`discoveryPage("${path}")`),
      `${path}: Worker route is missing`,
    );
    check(
      STATIC_SITEMAP_PATHS.includes(path),
      `${path}: static sitemap reference is missing`,
    );
    check(
      worker.includes(`https://mcpqueen.com${path}`),
      `${path}: llms.txt reference is missing`,
    );
  }
  check(
    worker.includes('discoverySchema("/mcp-info")'),
    "/mcp-info: Worker schema wiring is missing",
  );
  check(
    worker.includes('<link rel="canonical" href="${esc(canonical)}">'),
    "page renderer: self-referential canonical wiring is missing",
  );
  check(
    worker.includes('<meta name="description" content="${esc(desc)}">'),
    "page renderer: description wiring is missing",
  );
  check(
    worker.includes("<script type=\"application/ld+json\">"),
    "page renderer: JSON-LD wiring is missing",
  );

  const discoveryText = [
    homepage,
    ...["/architecture", "/integrations", "/demo"].map(
      (path) =>
        `${JSON.stringify(getDiscoveryPage(path).jsonld)}\n${getDiscoveryPage(path).body}`,
    ),
  ].join("\n");
  for (const pattern of [
    /\bTODO\b/i,
    /\bTBD\b/i,
    /REPLACE[_ -]?ME/i,
    /example\.com/i,
    /PUBLIC_VIDEO_URL/i,
    /https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)\//i,
  ]) {
    check(
      !pattern.test(discoveryText),
      `discovery surfaces contain a publication placeholder: ${pattern}`,
    );
  }

  return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await validateDiscoveryAssets();
  if (result.length) {
    for (const failure of result) console.error(`FAIL: ${failure}`);
    console.error(`\n${result.length} discovery check(s) failed.`);
    process.exit(1);
  }
  console.log("Discovery metadata, links, schemas, captions, and placeholder checks passed.");
}
