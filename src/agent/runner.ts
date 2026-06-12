import { anthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs, tool, type ToolSet } from "ai";
import { z } from "zod";
import { PolicyViolationError } from "../gate/engine.js";
import { gateToolCall } from "../mcp/interceptor.js";
import { realTools, type ToolImpl } from "../tools/real-tools.js";
import type { PolicyGate } from "../gate/engine.js";

export interface AgentStepRecord {
  tool: string;
  args: Record<string, unknown>;
  verdict: "ALLOW" | "DENY";
  decisionId?: string;
  reasonCode?: string;
  result?: unknown;
}

export interface AgentRunResult {
  prompt: string;
  finalText: string;
  toolCalls: AgentStepRecord[];
  model: string;
  stepCount: number;
}

const MODEL = process.env.AGENT_MODEL ?? "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a research agent operating inside a secured runtime.
Every tool call you make is evaluated by a policy gate BEFORE it runs. Some calls
will be DENIED — when a tool result says policyDenied, do not retry the same thing;
adapt, explain the constraint, or use an allowed approach instead. Prefer web_search
for current facts and file_write to save outputs under /workspace/output. Be concise.`;

/**
 * Run a REAL Claude agent. The model decides which tools to call; we wrap every
 * tool's execute() so the policy gate evaluates it FIRST. On ALLOW the real tool
 * runs; on DENY the gate has already persisted a signed decision and we hand the
 * model a structured denial so it can recover. This is the genuine
 * agent → tool-call → gate → execute path, not a scripted sequence.
 */
export async function runAgent(
  gate: PolicyGate,
  prompt: string,
  opts: { maxSteps?: number } = {},
): Promise<AgentRunResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set — cannot run the live agent");
  }
  const toolCalls: AgentStepRecord[] = [];
  const tools = buildGatedTools(gate, toolCalls);

  const result = await generateText({
    model: anthropic(MODEL),
    system: SYSTEM_PROMPT,
    prompt,
    tools,
    stopWhen: stepCountIs(opts.maxSteps ?? 8),
    experimental_telemetry: { isEnabled: true, functionId: "agent.run" },
  });

  return {
    prompt,
    finalText: result.text,
    toolCalls,
    model: MODEL,
    stepCount: result.steps.length,
  };
}

/** Wrap each real tool's execute() with the policy gate. */
function buildGatedTools(gate: PolicyGate, record: AgentStepRecord[]): ToolSet {
  const set: ToolSet = {};
  for (const [name, impl] of Object.entries(realTools)) {
    set[name] = tool({
      description: impl.description,
      inputSchema: zodSchema(impl),
      execute: async (args: Record<string, unknown>) => {
        try {
          const result = await gateToolCall(gate, name, args, impl.run);
          record.push({ tool: name, args, verdict: "ALLOW", result });
          return result;
        } catch (err) {
          if (err instanceof PolicyViolationError) {
            // The signed DENY decision is already persisted inside gateToolCall.
            record.push({
              tool: name,
              args,
              verdict: "DENY",
              decisionId: err.decisionId,
              reasonCode: err.reasonCode,
            });
            return {
              policyDenied: true,
              reasonCode: err.reasonCode,
              decisionId: err.decisionId,
              message: err.message,
            };
          }
          throw err;
        }
      },
    });
  }
  return set;
}

function zodSchema(impl: ToolImpl): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, spec] of Object.entries(impl.params)) {
    let base: z.ZodTypeAny = spec.type === "number" ? z.number() : z.string();
    if (spec.description) base = base.describe(spec.description);
    shape[key] = spec.optional ? base.optional() : base;
  }
  return z.object(shape);
}

export { realTools };
