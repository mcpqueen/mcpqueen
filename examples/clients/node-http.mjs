#!/usr/bin/env node

const MCP_URL = "https://mcpqueen.com/mcp";
const query = process.argv.slice(2).join(" ").trim() || "GitHub issue triage";
let protocolVersion;

async function post(message) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      ...(protocolVersion ? { "MCP-Protocol-Version": protocolVersion } : {}),
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    throw new Error(`MCP request failed: HTTP ${response.status}`);
  }
  if (response.status === 202) return null;

  const body = await response.json();
  if (body.error) {
    throw new Error(`MCP error ${body.error.code}: ${body.error.message}`);
  }
  return body.result;
}

const initialize = await post({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "mcpqueen-node-example", version: "1.0.0" },
  },
});
protocolVersion = initialize.protocolVersion;
await post({ jsonrpc: "2.0", method: "notifications/initialized" });

const catalog = await post({
  jsonrpc: "2.0",
  id: 2,
  method: "tools/list",
  params: {},
});
if (!catalog.tools.some((tool) => tool.name === "search_servers")) {
  throw new Error("MCP Queen did not advertise search_servers");
}

const result = await post({
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: {
    name: "search_servers",
    arguments: { query, auth: "open", limit: 5 },
  },
});

console.log(JSON.stringify(result.structuredContent ?? result, null, 2));
