import assert from "node:assert/strict";
import test from "node:test";

import { rejectUntrustedMcpOrigin } from "../src/mcp-origin.ts";

const request = (url, origin) =>
  new Request(url, {
    method: "POST",
    headers: origin ? { Origin: origin } : {},
  });

test("MCP Origin validation accepts non-browser and same-origin clients", () => {
  assert.equal(
    rejectUntrustedMcpOrigin(request("https://mcpqueen.com/mcp")),
    null,
  );
  assert.equal(
    rejectUntrustedMcpOrigin(
      request("https://mcpqueen.com/mcp", "https://mcpqueen.com"),
    ),
    null,
  );
  assert.equal(
    rejectUntrustedMcpOrigin(
      request("http://localhost:8787/mcp", "http://localhost:8787"),
    ),
    null,
  );
});

test("MCP Origin validation rejects cross-origin, opaque, and malformed values", async () => {
  for (const origin of [
    "https://example.com",
    "null",
    "not-a-url",
    "https://mcpqueen.com/path",
  ]) {
    const response = rejectUntrustedMcpOrigin(
      request("https://mcpqueen.com/mcp", origin),
    );
    assert.equal(response?.status, 403);
    assert.equal(response?.headers.get("vary"), "Origin");
    assert.deepEqual(await response?.json(), {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32000,
        message: "Origin is not allowed for this MCP endpoint.",
      },
    });
  }
});
