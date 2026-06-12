import { PolicyGate, PolicyViolationError } from "../gate/engine.js";
import type { EvaluationContext } from "../gate/types.js";
import { emitPolicySpan } from "../telemetry/spans.js";

export type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<unknown> | unknown;

export interface GatedCallResult {
  ok: boolean;
  decisionId: string;
  result?: unknown;
  error?: PolicyViolationError;
}

/**
 * The choke point. Every tool call — whatever the framework — flows through
 * here before the real handler runs. Evaluate first, emit a signed span, and
 * only dispatch on ALLOW. On DENY the decision is already persisted (inside
 * gate.evaluate) before we raise, so the agent process cannot suppress it.
 */
export async function gateToolCall(
  gate: PolicyGate,
  name: string,
  args: Record<string, unknown>,
  dispatch: ToolHandler,
  ctx: EvaluationContext = {},
): Promise<unknown> {
  const decision = await gate.evaluate(name, args, ctx);

  // Part 1 integration: signed OTel span for both ALLOW and DENY.
  emitPolicySpan(decision);

  if (decision.verdict === "DENY") {
    throw new PolicyViolationError(
      `Tool call "${name}" denied: ${decision.reasonCode} — ${decision.constraintDetails}`,
      decision.decisionId,
      decision.reasonCode,
    );
  }

  return dispatch(args);
}

/**
 * A small in-TEE tool registry whose `call` enforces the gate. The demo and the
 * MCP server wrapper both dispatch through this, so the enforcement path is
 * identical regardless of transport.
 */
export class GatedToolRegistry {
  private handlers = new Map<string, ToolHandler>();

  constructor(private gate: PolicyGate) {}

  register(name: string, handler: ToolHandler): this {
    this.handlers.set(name, handler);
    return this;
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  list(): string[] {
    return [...this.handlers.keys()];
  }

  async call(
    name: string,
    args: Record<string, unknown>,
    ctx: EvaluationContext = {},
  ): Promise<unknown> {
    const handler = this.handlers.get(name);
    if (!handler) {
      // Unknown tools still pass the gate (deny-by-default will catch them),
      // but if the gate ALLOWs an unregistered tool we surface a clear error.
      return gateToolCall(
        this.gate,
        name,
        args,
        () => {
          throw new Error(`no handler registered for tool "${name}"`);
        },
        ctx,
      );
    }
    return gateToolCall(this.gate, name, args, handler, ctx);
  }
}
