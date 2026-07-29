#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const demoDir = resolve(root, "submission-assets/demo");
const publicDemoDir = resolve(root, "public/demo");
const plan = JSON.parse(
  await readFile(resolve(demoDir, "demo-plan.json"), "utf8"),
);

function timestamp(totalSeconds, separator = ".") {
  const milliseconds = Math.round(totalSeconds * 1000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  const ms = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${separator}${String(ms).padStart(3, "0")}`;
}

function chapterTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

await mkdir(demoDir, { recursive: true });
await mkdir(publicDemoDir, { recursive: true });

const shotList = [
  "# MCP Queen OpenAI demo shot list",
  "",
  `Target duration: ${plan.target_duration_seconds} seconds`,
  "",
  ...plan.segments.flatMap((segment, index) => [
    `## ${index + 1}. ${segment.title} — ${segment.platform}`,
    "",
    `- Time: ${chapterTime(segment.start_seconds)}–${chapterTime(segment.start_seconds + segment.duration_seconds)}`,
    `- Tools: ${segment.tools.length ? segment.tools.map((tool) => `\`${tool}\``).join(", ") : "none"}`,
    `- On screen: ${segment.on_screen}`,
    ...(segment.prompt ? [`- Prompt: ${segment.prompt}`] : []),
    `- Narration: ${segment.narration}`,
    "",
  ]),
].join("\n");

const narration = [
  "# MCP Queen OpenAI demo narration",
  "",
  ...plan.segments.flatMap((segment) => [
    `## ${chapterTime(segment.start_seconds)} — ${segment.title}`,
    "",
    segment.narration,
    "",
  ]),
].join("\n");

const captions = [
  "WEBVTT",
  "",
  "NOTE Prepared narration track. Final cue timing requires genuine footage.",
  "",
  ...plan.segments.flatMap((segment, index) => [
    String(index + 1),
    `${timestamp(segment.start_seconds)} --> ${timestamp(segment.start_seconds + segment.duration_seconds)}`,
    segment.narration,
    "",
  ]),
].join("\n");

const chapters = plan.segments
  .map((segment) => `${chapterTime(segment.start_seconds)} ${segment.title}`)
  .join("\n");

const upload = {
  title: "MCP Queen: Find, Verify, and Connect to MCP Servers",
  description:
    "MCP Queen helps developers find MCP servers and tools, inspect live operational grades, review dated Trust Receipts and human-reviewed field evidence, and understand what remains unaudited before connecting an AI agent.",
  website: "https://mcpqueen.com",
  mcp_url: "https://mcpqueen.com/mcp",
  integrations: "https://mcpqueen.com/integrations",
  field_reports: "https://mcpqueen.com/field-reports",
  keywords: [
    "MCP",
    "Model Context Protocol",
    "MCP server",
    "AI agents",
    "MCP security",
    "developer tools",
    "ChatGPT plugins",
  ],
  chapters,
  structured_data_status:
    "withheld_until_genuine_public_footage_is_verified",
  structured_data_requirements: [
    "public watch-page URL",
    "public video or embed URL",
    "public thumbnail URL",
    "verified upload date",
    "verified final duration",
    "final captions, transcript, and chapters",
  ],
};

await Promise.all([
  writeFile(
    resolve(demoDir, "openai-demo-shot-list.md"),
    `${shotList.trimEnd()}\n`,
  ),
  writeFile(
    resolve(demoDir, "openai-demo-narration.md"),
    `${narration.trimEnd()}\n`,
  ),
  writeFile(
    resolve(demoDir, "openai-demo-captions.vtt"),
    `${captions.trimEnd()}\n`,
  ),
  writeFile(
    resolve(publicDemoDir, "openai-demo-captions.vtt"),
    `${captions.trimEnd()}\n`,
  ),
  writeFile(
    resolve(demoDir, "openai-demo-chapters.txt"),
    `${chapters.trimEnd()}\n`,
  ),
  writeFile(
    resolve(demoDir, "openai-demo-upload.json"),
    `${JSON.stringify(upload, null, 2)}\n`,
  ),
]);

console.log(`Generated demo production assets in ${demoDir}`);
