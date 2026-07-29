// MCP Streamable HTTP requires Origin validation to prevent DNS rebinding.
// Non-browser clients normally omit Origin. Browser-originated requests are
// accepted only when they are same-origin with the requested MCP endpoint.
export function rejectUntrustedMcpOrigin(request: Request): Response | null {
  const suppliedOrigin = request.headers.get("origin");
  if (!suppliedOrigin) return null;

  try {
    const requestOrigin = new URL(request.url).origin;
    const parsedOrigin = new URL(suppliedOrigin);
    if (
      parsedOrigin.origin === suppliedOrigin &&
      parsedOrigin.origin === requestOrigin
    ) {
      return null;
    }
  } catch {
    // Reject malformed and opaque origins, including "null".
  }

  return Response.json(
    {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32000,
        message: "Origin is not allowed for this MCP endpoint.",
      },
    },
    {
      status: 403,
      headers: { Vary: "Origin" },
    },
  );
}
