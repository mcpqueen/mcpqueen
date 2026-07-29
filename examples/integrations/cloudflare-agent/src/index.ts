import { Agent, routeAgentRequest } from "agents";
import { generateText, stepCountIs } from "ai";
import { createWorkersAI } from "workers-ai-provider";

type Env = {
  AI: Ai;
  McpQueenAgent: DurableObjectNamespace<McpQueenAgent>;
};

const MCP_URL = "https://mcpqueen.com/mcp";
const READ_ONLY_TOOLS = new Set([
  "search_servers",
  "search_tools",
  "list_grades",
  "get_server_grade",
  "get_trust_receipt",
  "search_trust_evidence",
]);

export class McpQueenAgent extends Agent<Env> {
  async onStart() {
    await this.addMcpServer("mcpqueen", MCP_URL);
  }

  async onRequest(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return Response.json(
        {
          usage: "POST JSON with a prompt string",
          example: {
            prompt:
              "Find a no-auth MCP server for GitHub issue triage and explain the evidence.",
          },
        },
        { status: 405 },
      );
    }

    const body = (await request.json()) as { prompt?: unknown };
    if (typeof body.prompt !== "string" || !body.prompt.trim()) {
      return Response.json({ error: "prompt must be a non-empty string" }, { status: 400 });
    }

    const allTools = this.mcp.getAITools();
    const tools = Object.fromEntries(
      Object.entries(allTools).filter(([name]) => READ_ONLY_TOOLS.has(name)),
    );
    const workersai = createWorkersAI({ binding: this.env.AI });
    const response = await generateText({
      model: workersai("@cf/zai-org/glm-4.7-flash"),
      system:
        "Use MCP Queen to find and compare MCP servers. An operational grade is not a security certification. State when trust dimensions are unaudited.",
      prompt: body.prompt.trim(),
      tools,
      stopWhen: stepCountIs(5),
    });

    return Response.json({ answer: response.text });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routeAgentRequest(request, env, { cors: true })) ||
      Response.json(
        {
          endpoint: "/agents/mcp-queen-agent/default",
          method: "POST",
        },
        { status: 404 },
      )
    );
  },
};
