#!/usr/bin/env node

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Set OPENAI_API_KEY before running this demo.");
  process.exit(1);
}

const prompt =
  process.argv.slice(2).join(" ").trim() ||
  "Find a well-maintained, no-auth MCP server for GitHub issue triage. Explain the evidence and any caveats.";

const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: process.env.OPENAI_MODEL || "gpt-5.6",
    input: prompt,
    tools: [
      {
        type: "mcp",
        server_label: "mcpqueen",
        server_description:
          "Searches live MCP registry evidence, operational grades, tool catalogs, and trust receipts.",
        server_url: "https://mcpqueen.com/mcp",
        allowed_tools: [
          "search_servers",
          "search_tools",
          "list_grades",
          "get_server_grade",
          "get_trust_receipt",
          "search_trust_evidence",
        ],
        require_approval: "never",
      },
    ],
  }),
});

const body = await response.json();
if (!response.ok) {
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

const text =
  body.output_text ||
  body.output
    ?.flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text)
    .join("\n");

console.log(text || JSON.stringify(body, null, 2));
