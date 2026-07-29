#!/usr/bin/env node

import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(
  root,
  process.argv.find((arg) => arg.startsWith("--manifest="))?.slice(11) ||
    "distribution/mcpqueen.json",
);
const live = process.argv.includes("--live");
const failures = [];

function pass(message) {
  console.log(`PASS  ${message}`);
}

function fail(message) {
  failures.push(message);
  console.error(`FAIL  ${message}`);
}

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function rpc(url, method, params = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${raw.slice(0, 200)}`);
  const payload = raw
    .split("\n")
    .find((line) => line.startsWith("data:"))
    ?.slice(5)
    .trim();
  return JSON.parse(payload || raw);
}

function pngDimensions(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) {
    throw new Error("not a PNG");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

const manifest = await loadJson(manifestPath);
pass(`loaded ${manifest.product} manifest`);

const badgeCampaign = manifest.badge_campaign;
const badgeCounts = badgeCampaign?.verified_counts || {};
const classifiedBadgeTargets = [
  "accepted",
  "open",
  "closed",
  "conflicted",
  "dead_repository",
  "unknown",
].reduce((total, state) => total + (badgeCounts[state] || 0), 0);
if (
  badgeCampaign?.status === "approved_batch_public_state_audited" &&
  badgeCampaign.scope === 20 &&
  classifiedBadgeTargets === badgeCampaign.scope &&
  badgeCampaign.new_messages_sent === false &&
  badgeCounts.dead_repository === badgeCampaign.dead_repositories?.length &&
  badgeCampaign.evidence_policy.includes("missing public evidence remains unknown")
) {
  pass("approved badge batch has a complete public-evidence classification");
} else {
  fail("badge campaign classification is missing, incomplete, or implies new outreach");
}

for (const relative of manifest.required_files) {
  try {
    await access(resolve(root, relative));
    pass(`artifact exists: ${relative}`);
  } catch {
    fail(`missing artifact: ${relative}`);
  }
}

const anthropic = await loadJson(
  resolve(root, manifest.anthropic_submission?.package || "anthropic-directory-submission.json"),
);
const workerSource = await readFile(resolve(root, "src/worker.ts"), "utf8");
const anthropicRunbook = await readFile(
  resolve(root, "docs/anthropic-submission.md"),
  "utf8",
);

if (
  anthropic.schema_version === 1 &&
  anthropic.channel === "anthropic_connectors_directory" &&
  anthropic.status === manifest.anthropic_submission?.status &&
  anthropic.status.startsWith("prepared_")
) {
  pass("Anthropic package has a prepared-only status matching the canonical manifest");
} else {
  fail("Anthropic package status or schema does not match the canonical manifest");
}

const requiredAnthropicSources = [
  "https://claude.com/docs/connectors/building/submission",
  "https://claude.com/docs/connectors/building/review-criteria",
  "https://claude.com/docs/connectors/building/testing",
  "https://claude.com/docs/connectors/building",
  "https://claude.com/docs/connectors/building/authentication",
  "https://support.claude.com/en/articles/13145338-anthropic-software-directory-terms",
  "https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy",
  "https://modelcontextprotocol.io/specification/2025-11-25/basic/transports",
  "https://modelcontextprotocol.io/specification/2025-06-18/basic/transports",
];
if (
  requiredAnthropicSources.every((url) => anthropic.official_sources?.includes(url)) &&
  JSON.stringify(anthropic.official_sources) ===
    JSON.stringify(manifest.anthropic_submission?.requirements_sources) &&
  anthropic.official_sources.every((url) => {
    try {
      return new URL(url).protocol === "https:";
    } catch {
      return false;
    }
  })
) {
  pass("Anthropic package and manifest record the required official sources");
} else {
  fail("Anthropic package and manifest need the required official sources");
}

const anthropicListingUrls = [
  "documentation_url",
  "privacy_policy_url",
  "terms_url",
  "support_url",
  "repository_url",
  "company_website",
];
if (
  typeof anthropic.listing?.name === "string" &&
  anthropic.listing.name.length > 0 &&
  anthropic.listing.name.length <= 100 &&
  typeof anthropic.listing?.tagline === "string" &&
  anthropic.listing.tagline.length > 0 &&
  anthropic.listing.tagline.length <= 55 &&
  typeof anthropic.listing?.description === "string" &&
  anthropic.listing.description.length > 0 &&
  anthropic.listing.description.length <= 2000 &&
  Array.isArray(anthropic.listing?.suggested_categories) &&
  anthropic.listing.suggested_categories.length >= 1 &&
  anthropic.listing.suggested_categories.length <= 5 &&
  anthropicListingUrls.every((key) => {
    try {
      return new URL(anthropic.listing[key]).protocol === "https:";
    } catch {
      return false;
    }
  })
) {
  pass("Anthropic listing text, conservative package limits, category count, and URLs pass");
} else {
  fail("Anthropic listing violates a package length, category, or HTTPS constraint");
}

if (
  anthropic.connection?.server_url === manifest.mcp_url &&
  anthropic.connection?.transport === "streamable_http" &&
  anthropic.connection?.authentication === "none" &&
  anthropic.connection?.same_url_for_every_user === true &&
  anthropic.connection?.reads_data === true &&
  anthropic.connection?.writes_data === true &&
  Array.isArray(anthropic.connection?.resources) &&
  anthropic.connection.resources.length === 0 &&
  Array.isArray(anthropic.connection?.prompts) &&
  anthropic.connection.prompts.length === 0 &&
  anthropic.connection?.ui_open_link === false &&
  Array.isArray(anthropic.connection?.allowed_link_uris) &&
  anthropic.connection.allowed_link_uris.length === 0
) {
  pass("Anthropic connection, capability, auth, and link declarations match the server");
} else {
  fail("Anthropic connection or capability declarations do not match the server");
}

const credentialsBlocker = anthropic.blockers?.find(
  (blocker) => blocker.id === "authless_test_credentials_clarification",
);
if (
  anthropic.reviewer_access?.documented_test_credentials_requirement ===
    "required_by_current_public_submission_and_testing_guidance" &&
  anthropic.reviewer_access?.test_account_required_by_service === false &&
  anthropic.reviewer_access?.test_credentials === null &&
  anthropic.reviewer_access?.credentials_applicability ===
    "not_applicable_to_authless_service_pending_portal_or_reviewer_confirmation" &&
  credentialsBlocker?.status === "open"
) {
  pass("Anthropic reviewer access records the authless credential clarification honestly");
} else {
  fail("Anthropic reviewer access must record the authless credential clarification");
}

if (
  Array.isArray(anthropic.use_cases) &&
  anthropic.use_cases.length >= 3 &&
  anthropic.use_cases.every(
    (useCase) =>
      typeof useCase.title === "string" &&
      useCase.title.trim() &&
      typeof useCase.description === "string" &&
      useCase.description.trim() &&
      typeof useCase.prompt === "string" &&
      useCase.prompt.trim(),
  )
) {
  pass("Anthropic package includes at least three complete use cases");
} else {
  fail("Anthropic package needs at least three complete use cases");
}

const anthropicToolNames = anthropic.tools?.map((tool) => tool.name) || [];
if (
  new Set(anthropicToolNames).size === anthropicToolNames.length &&
  JSON.stringify(anthropicToolNames) === JSON.stringify(manifest.expected_tools)
) {
  pass("Anthropic tool inventory exactly matches the canonical tool order");
} else {
  fail("Anthropic tool inventory does not exactly match expected tools");
}

const prohibitedDescriptionPattern =
  /ignore (?:all|any|previous)|system (?:prompt|instruction)|do not call .*tool|always call|never call|hidden instruction|obfuscated|base64/i;
for (const tool of anthropic.tools || []) {
  const start = workerSource.indexOf(`name: "${tool.name}"`);
  const end = workerSource.indexOf("outputSchema:", start);
  const definition = start >= 0 && end > start ? workerSource.slice(start, end) : "";
  const sourceDescriptionLiteral = definition.match(
    /description:\s*("(?:\\.|[^"\\])*")/,
  )?.[1];
  let sourceDescription;
  try {
    sourceDescription = sourceDescriptionLiteral
      ? JSON.parse(sourceDescriptionLiteral)
      : undefined;
  } catch {
    sourceDescription = undefined;
  }
  const complete =
    typeof tool.name === "string" &&
    tool.name.length > 0 &&
    tool.name.length <= 64 &&
    typeof tool.title === "string" &&
    tool.title.trim() &&
    typeof tool.description === "string" &&
    tool.description.trim() &&
    typeof tool.readOnlyHint === "boolean" &&
    typeof tool.destructiveHint === "boolean" &&
    typeof tool.openWorldHint === "boolean" &&
    ["read_only", "additive_write"].includes(tool.behavior);
  const sourceAligned =
    definition.includes(`title: "${tool.title}"`) &&
    sourceDescription === tool.description &&
    definition.includes(`readOnlyHint: ${tool.readOnlyHint}`) &&
    definition.includes(`destructiveHint: ${tool.destructiveHint}`) &&
    definition.includes(`openWorldHint: ${tool.openWorldHint}`);
  const behaviorAligned =
    tool.name === "submit_feedback"
      ? tool.behavior === "additive_write" &&
        tool.readOnlyHint === false &&
        tool.destructiveHint === false
      : tool.behavior === "read_only" && tool.readOnlyHint === true;
  if (
    complete &&
    sourceAligned &&
    behaviorAligned &&
    !prohibitedDescriptionPattern.test(tool.description)
  ) {
    pass(`${tool.name} Anthropic metadata matches source and safety behavior`);
  } else {
    fail(`${tool.name} Anthropic metadata, source, or safety behavior is inconsistent`);
  }
}

const workerValidatesOrigin =
  /headers\.get\(\s*["']origin["']\s*\)/i.test(workerSource);
const originBlocker = anthropic.blockers?.find(
  (blocker) => blocker.id === "origin_header_validation",
);
if (
  (!workerValidatesOrigin &&
    anthropic.readiness?.origin_header_validation ===
      "blocked_not_implemented_in_current_endpoint" &&
    originBlocker?.status === "open") ||
  (workerValidatesOrigin &&
    anthropic.readiness?.origin_header_validation === "passed" &&
    originBlocker === undefined)
) {
  pass("Anthropic Origin-validation readiness matches the current handler");
} else {
  fail("Anthropic Origin-validation readiness does not match the current handler");
}

try {
  const logoAssets = anthropic.branding?.prepared_logo_assets || [];
  const svg = logoAssets.find((asset) => asset.format === "SVG");
  const png = logoAssets.find((asset) => asset.format === "PNG");
  const svgContents = await readFile(resolve(root, svg.path));
  const pngContents = await readFile(resolve(root, png.path));
  const dimensions = pngDimensions(pngContents);
  const svgSha256 = createHash("sha256").update(svgContents).digest("hex");
  const pngSha256 = createHash("sha256").update(pngContents).digest("hex");
  if (
    anthropic.branding.portal_selected_logo === null &&
    anthropic.branding.portal_logo_acceptance === "not_verified" &&
    svg.path === "public/favicon.svg" &&
    new URL(svg.public_url).protocol === "https:" &&
    svgSha256 === svg.sha256 &&
    dimensions.width === png.width &&
    dimensions.height === png.height &&
    pngSha256 === png.sha256 &&
    anthropic.branding.mcp_app === false &&
    Array.isArray(anthropic.branding.carousel_screenshots) &&
    anthropic.branding.carousel_screenshots.length === 0
  ) {
    pass("Anthropic SVG/PNG logo inventory and non-App media declaration match");
  } else {
    fail("Anthropic logo inventory or non-App media declaration does not match");
  }
} catch (error) {
  fail(`Anthropic prepared logo assets: ${error.message}`);
}

for (const asset of anthropic.branding?.favicon_inventory || []) {
  try {
    const contents = await readFile(resolve(root, asset.path));
    const sha256 = createHash("sha256").update(contents).digest("hex");
    const dimensionsMatch =
      asset.format !== "PNG" ||
      (pngDimensions(contents).width === asset.width &&
        pngDimensions(contents).height === asset.height);
    if (sha256 === asset.sha256 && dimensionsMatch) {
      pass(`Anthropic favicon inventory matches: ${asset.path}`);
    } else {
      fail(`Anthropic favicon inventory mismatch: ${asset.path}`);
    }
  } catch (error) {
    fail(`Anthropic favicon inventory ${asset.path}: ${error.message}`);
  }
}

if (
  anthropic.readiness?.portal_draft === "not_started" &&
  anthropic.readiness?.submission_receipt === null &&
  anthropic.readiness?.directory_listing_url === null &&
  anthropic.listing?.slug === null &&
  Array.isArray(anthropic.blockers) &&
  anthropic.blockers.length > 0
) {
  pass("Anthropic package records blockers without claiming a portal outcome");
} else {
  fail("Anthropic package must not claim an unverified portal outcome");
}

const unsupportedAccountPrerequisite =
  /Team or Enterprise|Directory management|Libraries permission/i;
if (
  !unsupportedAccountPrerequisite.test(JSON.stringify(anthropic)) &&
  !unsupportedAccountPrerequisite.test(
    JSON.stringify(manifest.anthropic_submission),
  ) &&
  !unsupportedAccountPrerequisite.test(anthropicRunbook)
) {
  pass("Anthropic artifacts do not assert an unsupported account-tier or role prerequisite");
} else {
  fail("Anthropic artifacts still assert an unsupported account-tier or role prerequisite");
}

const requiredAnthropicBlockers = [
  "origin_header_validation",
  "all_tools_in_anthropic_clients",
  "authless_test_credentials_clarification",
  "submission_identity_and_authority",
  "policy_and_terms",
  "public_url_and_branding_recheck",
  "final_submission",
];
if (
  requiredAnthropicBlockers.every((id) =>
    anthropic.blockers?.some(
      (blocker) => blocker.id === id && blocker.status === "open",
    ),
  ) &&
  anthropic.blockers.length === requiredAnthropicBlockers.length
) {
  pass("Anthropic package records the complete open-blocker inventory");
} else {
  fail("Anthropic package blocker inventory is incomplete or contains stale entries");
}

const submission = await loadJson(resolve(root, "chatgpt-app-submission.json"));
if (submission.schema_version === 1 && submission.app_info?.display_name) {
  pass("OpenAI submission JSON has schema version and app metadata");
} else {
  fail("OpenAI submission JSON is missing required top-level metadata");
}
if (
  typeof submission.app_info?.display_name === "string" &&
  submission.app_info.display_name.length <= 30 &&
  !submission.app_info.display_name.includes("\n") &&
  typeof submission.app_info?.subtitle === "string" &&
  submission.app_info.subtitle.length <= 30 &&
  !submission.app_info.subtitle.includes("\n") &&
  typeof submission.app_info?.description === "string" &&
  submission.app_info.description.length <= 4000
) {
  pass("OpenAI listing text satisfies final submission length limits");
} else {
  fail("OpenAI listing text violates final submission length limits");
}
if (
  submission.test_cases?.length === 5 &&
  submission.negative_test_cases?.length === 3
) {
  pass("OpenAI submission JSON includes exactly five positive and three negative tests");
} else {
  fail("OpenAI submission JSON needs exactly five positive and three negative tests");
}

for (const expected of manifest.expected_tools) {
  const review = submission.tools?.[expected];
  const annotations = review?.annotations;
  const justifications = review?.justifications;
  if (
    annotations &&
    typeof annotations.readOnlyHint === "boolean" &&
    typeof annotations.openWorldHint === "boolean" &&
    typeof annotations.destructiveHint === "boolean" &&
    typeof justifications?.read_only_justification === "string" &&
    justifications.read_only_justification.trim() &&
    typeof justifications?.open_world_justification === "string" &&
    justifications.open_world_justification.trim() &&
    typeof justifications?.destructive_justification === "string" &&
    justifications.destructive_justification.trim()
  ) {
    pass(`${expected} has explicit annotations and justifications`);
  } else {
    fail(`${expected} lacks explicit annotations or justifications`);
  }
}

for (const relative of [
  "submission-assets/mcpqueen-directory-icon.png",
  "submission-assets/mcpqueen-composer-icon.png",
]) {
  try {
    const dimensions = pngDimensions(await readFile(resolve(root, relative)));
    if (dimensions.width === 512 && dimensions.height === 512) {
      pass(`${relative} is a 512×512 PNG`);
    } else {
      fail(`${relative} is ${dimensions.width}×${dimensions.height}, expected 512×512`);
    }
  } catch (error) {
    fail(`${relative}: ${error.message}`);
  }
}

const demoPlan = await loadJson(
  resolve(root, "submission-assets/demo/demo-plan.json"),
);
if (
  Array.isArray(demoPlan.starter_prompts) &&
  demoPlan.starter_prompts.length > 0 &&
  demoPlan.starter_prompts.length <= 3 &&
  demoPlan.starter_prompts.every(
    (prompt) =>
      typeof prompt === "string" &&
      prompt.length <= 128 &&
      !prompt.includes("\n") &&
      !prompt.includes("@"),
  )
) {
  pass("OpenAI starter prompts satisfy count, length, line, and mention limits");
} else {
  fail("OpenAI starter prompts violate portal constraints");
}

const demoTools = new Set(
  (demoPlan.segments || []).flatMap((segment) => segment.tools || []),
);
for (const expected of manifest.expected_tools) {
  if (demoTools.has(expected)) pass(`demo covers MCP tool: ${expected}`);
  else fail(`demo does not cover MCP tool: ${expected}`);
}

const finalSegment = demoPlan.segments?.at(-1);
if (
  finalSegment &&
  finalSegment.start_seconds + finalSegment.duration_seconds ===
    demoPlan.target_duration_seconds
) {
  pass("demo timeline matches its target duration");
} else {
  fail("demo timeline does not match its target duration");
}

for (const [relative, expected] of [
  [
    "submission-assets/demo/mcpqueen-openai-demo-title.png",
    { width: 1920, height: 1080 },
  ],
  [
    "submission-assets/demo/mcpqueen-openai-demo-end.png",
    { width: 1920, height: 1080 },
  ],
  [
    "submission-assets/demo/mcpqueen-openai-demo-thumbnail.png",
    { width: 1280, height: 720 },
  ],
]) {
  try {
    const dimensions = pngDimensions(await readFile(resolve(root, relative)));
    if (
      dimensions.width === expected.width &&
      dimensions.height === expected.height
    ) {
      pass(`${relative} is ${expected.width}×${expected.height}`);
    } else {
      fail(
        `${relative} is ${dimensions.width}×${dimensions.height}, expected ${expected.width}×${expected.height}`,
      );
    }
  } catch (error) {
    fail(`${relative}: ${error.message}`);
  }
}

if (live) {
  for (const url of manifest.public_urls) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (response.ok) pass(`public URL responds: ${url}`);
      else fail(`public URL ${url} returned ${response.status}`);
    } catch (error) {
      fail(`public URL ${url}: ${error.message}`);
    }
  }

  try {
    const initialized = await rpc(manifest.mcp_url, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "distribution-validator", version: "1.0.0" },
    });
    if (initialized.result?.serverInfo?.name) pass("MCP initialize succeeds");
    else fail("MCP initialize response lacks serverInfo");

    const listed = await rpc(manifest.mcp_url, "tools/list");
    const tools = listed.result?.tools || [];
    const names = new Set(tools.map((tool) => tool.name));
    for (const expected of manifest.expected_tools) {
      if (names.has(expected)) pass(`MCP tool published: ${expected}`);
      else fail(`MCP tool missing: ${expected}`);
    }
    for (const tool of tools) {
      if (
        typeof tool.title === "string" &&
        tool.title.trim() &&
        tool.outputSchema &&
        tool.annotations &&
        typeof tool.annotations.readOnlyHint === "boolean" &&
        typeof tool.annotations.openWorldHint === "boolean" &&
        typeof tool.annotations.destructiveHint === "boolean"
      ) {
        pass(`${tool.name} has a title, output schema, and safety annotations`);
      } else {
        fail(`${tool.name} lacks a title, output schema, or safety annotations`);
      }
    }

    const representativeCalls = [
      {
        name: "search_servers",
        arguments: { query: "GitHub issue triage", auth: "open", limit: 3 },
        validate: (value) =>
          Array.isArray(value?.results) &&
          typeof value?.feedback_reminder === "string",
      },
      {
        name: "search_tools",
        arguments: { query: "FDA 510(k)", limit: 3 },
        validate: (value) =>
          Array.isArray(value?.results) &&
          typeof value?.feedback_reminder === "string",
      },
      {
        name: "list_grades",
        arguments: { limit: 3 },
        validate: (value) =>
          Array.isArray(value?.results) && typeof value?.returned === "number",
      },
      {
        name: "get_server_grade",
        arguments: { name: "com.healthai/radar" },
        validate: (value) =>
          value?.server_name === "com.healthai/radar" &&
          Array.isArray(value?.evidence),
      },
      {
        name: "get_trust_receipt",
        arguments: { name: "com.healthai/radar" },
        validate: (value) =>
          value?.server?.name === "com.healthai/radar" ||
          value?.server_name === "com.healthai/radar",
      },
      {
        name: "search_trust_evidence",
        arguments: {
          query: "citation",
          dimension: "citation_quality",
          limit: 3,
        },
        validate: (value) =>
          Array.isArray(value?.results) && typeof value?.returned === "number",
      },
    ];

    for (const check of representativeCalls) {
      const called = await rpc(manifest.mcp_url, "tools/call", {
        name: check.name,
        arguments: check.arguments,
      });
      const structured = called.result?.structuredContent;
      if (called.result?.isError !== true && check.validate(structured)) {
        pass(`read-only ${check.name} smoke call returns structured results`);
      } else {
        fail(`${check.name} smoke call lacks valid structured results`);
      }
    }

    pass("submit_feedback is not called by validation because it writes to the quarantined review queue");
  } catch (error) {
    fail(`live MCP validation: ${error.message}`);
  }
}

console.log("\nManual gates (intentionally not automated):");
for (const gate of manifest.manual_gates) console.log(`- ${gate}`);

if (failures.length) {
  console.error(`\n${failures.length} distribution check(s) failed.`);
  process.exit(1);
}
console.log(`\nDistribution checks passed${live ? " (including live surfaces)" : ""}.`);
