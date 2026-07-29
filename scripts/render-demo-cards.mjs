#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const demoDir = resolve(root, "submission-assets/demo");

const candidates =
  process.platform === "darwin"
    ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
    : ["google-chrome", "chromium", "chromium-browser"];

let chrome;
for (const candidate of candidates) {
  try {
    if (candidate.startsWith("/")) await access(candidate);
    else execFileSync("which", [candidate], { stdio: "ignore" });
    chrome = candidate;
    break;
  } catch {
    // Try the next known Chrome/Chromium path.
  }
}

if (!chrome) {
  console.error("Chrome or Chromium is required to render the demo cards.");
  process.exit(1);
}

await mkdir(demoDir, { recursive: true });

const renders = [
  {
    source: "title-card.html",
    output: "mcpqueen-openai-demo-title.png",
    size: "1920,1080",
  },
  {
    source: "end-card.html",
    output: "mcpqueen-openai-demo-end.png",
    size: "1920,1080",
  },
  {
    source: "title-card.html",
    output: "mcpqueen-openai-demo-thumbnail.png",
    size: "1280,720",
  },
];

for (const render of renders) {
  const source = resolve(demoDir, render.source);
  const output = resolve(demoDir, render.output);
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--hide-scrollbars",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--window-size=${render.size}`,
      `--screenshot=${output}`,
      pathToFileURL(source).href,
    ],
    { stdio: "inherit" },
  );
  console.log(`Rendered ${render.output}`);
}
