#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { accessSync } from "node:fs";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const demoDir = resolve(root, "submission-assets/demo");
const privateDemoDir = resolve(
  process.env.MCPQUEEN_DEMO_WORKDIR ?? resolve(root, ".private/openai-demo"),
);
const defaultClipsDir = resolve(privateDemoDir, "clips");
const defaultOutput = resolve(privateDemoDir, "output/mcpqueen-openai-demo.mp4");

function parseArgs(argv) {
  const options = {
    clipsDir: defaultClipsDir,
    output: defaultOutput,
    burnCaptions: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--clips-dir") options.clipsDir = resolve(argv[++index]);
    else if (arg === "--output") options.output = resolve(argv[++index]);
    else if (arg === "--no-burn-captions") options.burnCaptions = false;
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return options;
}

function commandExists(command) {
  try {
    if (command.includes("/")) accessSync(command);
    else execFileSync("which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function run(command, args) {
  execFileSync(command, args, { stdio: "inherit" });
}

async function requireFiles(files) {
  const missing = [];
  for (const file of files) {
    try {
      await access(file);
    } catch {
      missing.push(file);
    }
  }
  if (missing.length) {
    console.error("Demo assembly stopped: genuine recording clips are missing.");
    for (const file of missing) console.error(`- ${file}`);
    console.error(
      "Record the missing ChatGPT Developer Mode segments; do not replace them with simulated footage.",
    );
    process.exit(1);
  }
}

function escapeSubtitlePath(path) {
  return path
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'");
}

function resolveRecordedClip(clipsDir, id) {
  const candidates = [".mp4", ".mov", ".m4v"].map((extension) =>
    resolve(clipsDir, `${id}${extension}`),
  );
  for (const candidate of candidates) {
    try {
      accessSync(candidate);
      return candidate;
    } catch {
      // Try the next supported video container.
    }
  }
  return candidates[0];
}

const options = parseArgs(process.argv.slice(2));
const ffmpeg = process.env.FFMPEG_BIN ?? "ffmpeg";

if (!commandExists(ffmpeg)) {
  console.error(
    "ffmpeg is required. Install it or set FFMPEG_BIN to an existing executable.",
  );
  process.exit(1);
}

const segments = [
  {
    id: "title",
    kind: "card",
    input: resolve(demoDir, "mcpqueen-openai-demo-title.png"),
    duration: 10,
  },
  { id: "web-intro", kind: "clip", duration: 20 },
  { id: "server-search", kind: "clip", duration: 40 },
  { id: "grade", kind: "clip", duration: 32 },
  { id: "tool-search", kind: "clip", duration: 38 },
  { id: "trust-receipt", kind: "clip", duration: 42 },
  { id: "field-reports", kind: "clip", duration: 36 },
  { id: "leaderboard", kind: "clip", duration: 30 },
  { id: "feedback-guardrail", kind: "clip", duration: 27 },
  { id: "ios", kind: "clip", duration: 25 },
  { id: "android", kind: "clip", duration: 25 },
  {
    id: "closing",
    kind: "card",
    input: resolve(demoDir, "mcpqueen-openai-demo-end.png"),
    duration: 10,
  },
].map((segment) => ({
  ...segment,
  input:
    segment.input ?? resolveRecordedClip(options.clipsDir, segment.id),
}));

await requireFiles([
  ...segments.map((segment) => segment.input),
  resolve(demoDir, "openai-demo-captions.vtt"),
]);

await mkdir(dirname(options.output), { recursive: true });
const tempDir = await mkdtemp(resolve(tmpdir(), "mcpqueen-demo-"));

try {
  const normalized = [];
  for (const [index, segment] of segments.entries()) {
    const output = resolve(
      tempDir,
      `${String(index).padStart(2, "0")}-${segment.id}.mp4`,
    );
    normalized.push(output);

    const videoFilter = [
      "scale=1920:1080:force_original_aspect_ratio=decrease",
      "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black",
      "fps=30",
      `tpad=stop_mode=clone:stop_duration=${segment.duration}`,
      `trim=duration=${segment.duration}`,
      "setpts=PTS-STARTPTS",
    ].join(",");

    const inputArgs =
      segment.kind === "card"
        ? ["-loop", "1", "-framerate", "30", "-i", segment.input]
        : ["-i", segment.input];

    run(ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "warning",
      "-y",
      ...inputArgs,
      "-f",
      "lavfi",
      "-t",
      String(segment.duration),
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=48000",
      "-vf",
      videoFilter,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-t",
      String(segment.duration),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      output,
    ]);
  }

  const concatFile = resolve(tempDir, "concat.txt");
  await writeFile(
    concatFile,
    normalized.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"),
    "utf8",
  );

  const joined = resolve(tempDir, "joined.mp4");
  run(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatFile,
    "-c",
    "copy",
    joined,
  ]);

  if (options.burnCaptions) {
    const captions = escapeSubtitlePath(
      resolve(demoDir, "openai-demo-captions.vtt"),
    );
    run(ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "warning",
      "-y",
      "-i",
      joined,
      "-vf",
      `subtitles='${captions}':force_style='FontName=Arial,FontSize=28,PrimaryColour=&H00FFFFFF,OutlineColour=&H00121212,BorderStyle=1,Outline=2,Shadow=0,MarginV=46'`,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      options.output,
    ]);
  } else {
    run(ffmpeg, ["-hide_banner", "-loglevel", "warning", "-y", "-i", joined, "-c", "copy", options.output]);
  }

  const probe = spawnSync(ffmpeg, ["-hide_banner", "-i", options.output], {
    encoding: "utf8",
  });
  const durationMatch = probe.stderr.match(
    /Duration:\s+(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/,
  );
  const duration = durationMatch
    ? Number(durationMatch[1]) * 3600 +
      Number(durationMatch[2]) * 60 +
      Number(durationMatch[3])
    : Number.NaN;

  if (!Number.isFinite(duration) || Math.abs(duration - 335) > 1) {
    console.error(
      `Demo duration check failed: expected approximately 335 seconds, received ${duration.toFixed(3)}.`,
    );
    process.exit(1);
  }

  console.log(`Created ${options.output}`);
  console.log(`Duration: ${duration.toFixed(3)} seconds`);
  console.log(`Captions burned in: ${options.burnCaptions ? "yes" : "no"}`);
  console.log(`Source clips: ${options.clipsDir}`);
  console.log(`File: ${basename(options.output)}`);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
