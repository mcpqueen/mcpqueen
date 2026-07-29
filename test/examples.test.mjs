import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("developer examples pass deterministic validation", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/validate-examples.mjs"],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /PASS: developer examples/);
});
