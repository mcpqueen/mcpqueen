#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { access, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const demoDir = resolve(root, "submission-assets/demo");

async function playwrightHeadlessShells() {
  const cacheRoot =
    process.platform === "darwin"
      ? resolve(homedir(), "Library/Caches/ms-playwright")
      : resolve(homedir(), ".cache/ms-playwright");
  try {
    const versions = (await readdir(cacheRoot))
      .filter((name) => name.startsWith("chromium_headless_shell-"))
      .sort()
      .reverse();
    return versions.map((version) =>
      process.platform === "darwin"
        ? resolve(
            cacheRoot,
            version,
            "chrome-headless-shell-mac-x64/chrome-headless-shell",
          )
        : resolve(cacheRoot, version, "chrome-headless-shell-linux/chrome-headless-shell"),
    );
  } catch {
    return [];
  }
}

const candidates = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  ...(await playwrightHeadlessShells()),
  ...(process.platform === "darwin"
    ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
    : ["google-chrome", "chromium", "chromium-browser"]),
].filter(Boolean);

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

const profileDir = await mkdtemp(join(tmpdir(), "mcpqueen-demo-cards-"));
try {
  for (const render of renders) {
    const source = resolve(demoDir, render.source);
    const output = resolve(demoDir, render.output);
    execFileSync(
      chrome,
      [
        "--headless=new",
        "--hide-scrollbars",
        "--disable-gpu",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-crash-reporter",
        "--disable-sync",
        "--no-pings",
        "--no-first-run",
        "--no-default-browser-check",
        `--user-data-dir=${profileDir}`,
        `--window-size=${render.size}`,
        `--screenshot=${output}`,
        pathToFileURL(source).href,
      ],
      { stdio: "inherit" },
    );
    console.log(`Rendered ${render.output}`);
  }
} finally {
  await rm(profileDir, { recursive: true, force: true });
}
