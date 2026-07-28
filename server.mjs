#!/usr/bin/env node
// MCP Queen — stdio bridge to the hosted server at https://mcpqueen.com/mcp
// Zero-dependency JSON-RPC pass-through: every request on stdin is forwarded to
// the hosted Streamable HTTP endpoint and the response is written to stdout.
// The grades/trust corpus lives server-side; this bridge exists so stdio
// MCP clients (and registry introspection) can run the server locally.

const ENDPOINT = process.env.MCPQUEEN_MCP_URL ?? "https://mcpqueen.com/mcp";

let sessionId = null;
let buffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (line) handle(line);
  }
});
process.stdin.on("end", () => process.exit(0));

async function handle(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return; // not JSON-RPC; ignore
  }
  try {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (sessionId) headers["mcp-session-id"] = sessionId;
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(msg),
    });
    const sid = res.headers.get("mcp-session-id");
    if (sid) sessionId = sid;
    if (msg.id === undefined) return; // notification: no response expected
    const payload = parseBody(await res.text(), res.headers.get("content-type") ?? "");
    if (payload) {
      process.stdout.write(JSON.stringify(payload) + "\n");
    } else {
      writeError(msg.id, -32000, `upstream HTTP ${res.status}`);
    }
  } catch (err) {
    writeError(msg.id, -32001, String(err?.message ?? err));
  }
}

function parseBody(text, contentType) {
  if (contentType.includes("text/event-stream")) {
    // Streamable HTTP may answer as SSE; the JSON-RPC response rides a data: line.
    let out = null;
    for (const line of text.split("\n")) {
      if (line.startsWith("data:")) {
        try {
          const obj = JSON.parse(line.slice(5).trim());
          if (obj.jsonrpc) out = obj;
        } catch {}
      }
    }
    return out;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function writeError(id, code, message) {
  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n"
  );
}
