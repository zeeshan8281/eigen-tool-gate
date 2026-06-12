import { realTools } from "../tools/real-tools.js";
import type { ToolDef } from "../mcp/server.js";

/**
 * Demo/MCP tool definitions, derived from the REAL implementations in
 * src/tools/real-tools.ts. The canned scenarios and the MCP server both dispatch
 * through these, so even the scripted demo does real work (real web search, real
 * file writes, real HTTP) once the gate ALLOWs the call.
 */
export const demoTools: ToolDef[] = Object.entries(realTools).map(([name, impl]) => ({
  name,
  description: impl.description,
  inputSchema: {
    type: "object",
    properties: Object.fromEntries(
      Object.entries(impl.params).map(([k, v]) => [k, { type: v.type, description: v.description }]),
    ),
    required: Object.entries(impl.params)
      .filter(([, v]) => !v.optional)
      .map(([k]) => k),
  },
  handler: (args) => impl.run(args),
}));
