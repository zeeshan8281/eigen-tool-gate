import type { ToolDef } from "../mcp/server.js";

/**
 * A handful of mock tools for the demo. The handlers are deliberately trivial —
 * the point is what the gate does BEFORE they run, not what they do. Each one
 * only ever executes if the policy ALLOWed the call.
 */
export const demoTools: ToolDef[] = [
  {
    name: "web_search",
    description: "Search the web for a query string.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
    handler: (args) => ({
      query: args.query,
      results: [
        { title: "EigenLayer TVL hits new high", url: "https://example.com/eigen-tvl" },
        { title: "Restaking explained", url: "https://example.com/restaking" },
      ],
    }),
  },
  {
    name: "file_read",
    description: "Read a file from disk.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
    handler: (args) => ({
      path: args.path,
      content: `<contents of ${args.path}>`,
    }),
  },
  {
    name: "file_write",
    description: "Write content to a file.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
    handler: (args) => ({ path: args.path, bytesWritten: Buffer.byteLength(String(args.content)) }),
  },
  {
    name: "http_request",
    description: "Make an outbound HTTP request.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        method: { type: "string" },
        body: { type: "string" },
      },
      required: ["url"],
    },
    handler: (args) => ({ url: args.url, status: 200 }),
  },
  {
    name: "shell_exec",
    description: "Execute a shell command (explicitly denied by demo policy).",
    inputSchema: {
      type: "object",
      properties: { command: { type: "string" } },
      required: ["command"],
    },
    handler: (args) => ({ command: args.command, stdout: "" }),
  },
  {
    name: "wallet_transfer",
    description: "Transfer USDC to a recipient.",
    inputSchema: {
      type: "object",
      properties: {
        recipient: { type: "string" },
        amount: { type: "number" },
      },
      required: ["recipient", "amount"],
    },
    handler: (args) => ({
      recipient: args.recipient,
      amount: args.amount,
      txHash: "0xdeadbeef" + "".padEnd(56, "0"),
    }),
  },
];
