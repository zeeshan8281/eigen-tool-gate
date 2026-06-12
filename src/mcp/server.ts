import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { PolicyViolationError } from "../gate/engine.js";
import { emitPolicySpan } from "../telemetry/spans.js";
import type { PolicyGate } from "../gate/engine.js";
import { GatedToolRegistry, type ToolHandler } from "./interceptor.js";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler;
}

/**
 * Build a real MCP `Server` whose `tools/call` is gated at the transport layer.
 * This is the "MCP-native interception" claim: any MCP-compatible framework that
 * connects to this server has every tool call routed through the policy gate
 * inside the TEE — no SDK rewrite, no opt-in hook the operator can remove.
 */
export function createGatedMcpServer(gate: PolicyGate, tools: ToolDef[]): Server {
  const registry = new GatedToolRegistry(gate);
  for (const t of tools) registry.register(t.name, t.handler);

  const server = new Server(
    { name: "eigen-tool-gate", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = await registry.call(name, (args ?? {}) as Record<string, unknown>);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (err) {
      if (err instanceof PolicyViolationError) {
        // The DENY envelope is already persisted; report it to the caller as a
        // tool error (isError) rather than crashing the transport.
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `POLICY_DENIED [${err.reasonCode}] decision=${err.decisionId}: ${err.message}`,
            },
          ],
        };
      }
      throw err;
    }
  });

  return server;
}

export { emitPolicySpan };
