import assert from "node:assert/strict";
import test from "node:test";

import { validateDiscoveryAssets } from "../scripts/validate-discovery.mjs";

test("discovery pages pass metadata, link, schema, caption, and placeholder checks", async () => {
  assert.deepEqual(await validateDiscoveryAssets(), []);
});
