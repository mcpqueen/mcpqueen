import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);

function text(relativePath) {
  return readFileSync(new URL(relativePath, root), "utf8");
}

test("package scripts reference only files shipped in the public surface", () => {
  const pkg = JSON.parse(text("package.json"));
  assert.deepEqual(Object.keys(pkg.scripts).sort(), ["demo:openai", "start", "test"]);
  assert.equal(existsSync(new URL("server.mjs", root)), true);
  assert.equal(existsSync(new URL("examples/openai-responses.mjs", root)), true);
  assert.equal(existsSync(new URL("test/server.test.mjs", root)), true);
});

test("README relative links resolve inside the public surface", () => {
  const readme = text("README.md");
  const links = [...readme.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)]+)\)/g)].map(
    (match) => match[1],
  );
  assert.ok(links.length >= 7);
  for (const link of links) {
    assert.equal(existsSync(new URL(link, root)), true, `missing README target: ${link}`);
  }
});

test("public README preserves the product and repository boundaries", () => {
  const readme = text("README.md");
  assert.match(readme, /not a security, privacy, data-quality, or\s+compliance certification/i);
  assert.match(readme, /Missing evidence is unaudited, not safe/i);
  assert.match(readme, /not a production\s+deployment source/i);
  assert.doesNotMatch(readme, /(?:src\/worker|schema\.sql|wrangler|docs\/openai-submission)/i);
});
