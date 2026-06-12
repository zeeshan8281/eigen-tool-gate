import { trace } from "@opentelemetry/api";
import type { PolicyDecision } from "../gate/types.js";

const tracer = trace.getTracer("eigen-tool-gate", "0.1.0");

/**
 * Emit a signed OTel span for a policy decision (Part 1 / Trace Mirror).
 *
 * The Trace Mirror collector running in the same TEE picks these up, signs them
 * into the telemetry chain, and exposes them on the dashboard — so authorization
 * decisions and execution telemetry converge into one verifiable event stream.
 * Attributes use the shared `eigen.*` namespace.
 */
export function emitPolicySpan(decision: PolicyDecision): void {
  const sig = decision.signature;
  const span = tracer.startSpan("policy.gate.evaluate", {
    attributes: {
      "eigen.policy.tool": decision.toolName,
      "eigen.policy.verdict": decision.verdict,
      "eigen.policy.reason": decision.reasonCode,
      "eigen.policy.hash": decision.policyHash,
      "eigen.policy.decision_id": decision.decisionId,
      "eigen.policy.sequence": decision.sequenceNumber,
      "eigen.policy.session_id": decision.sessionId,
      "eigen.policy.agent_id": decision.agentId,
      "eigen.policy.args_hash": decision.toolArgsHash,
      // r‖s split mirrors Part 1's tracemirror.* signature layout
      "eigen.sig.r": sig.slice(0, 64),
      "eigen.sig.s": sig.slice(64, 128),
    },
  });
  if (decision.verdict === "DENY") {
    span.addEvent("policy.denied", { detail: decision.constraintDetails });
  }
  span.end();
}
