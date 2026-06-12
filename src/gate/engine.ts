import { v4 as uuidv4 } from "uuid";
import { canonicalize, sha256 } from "../crypto/canonicalize.js";
import type { TEESigner } from "../crypto/signer.js";
import { AppendOnlyDecisionLog } from "../log/append-only.js";
import { evaluateConstraints, matchDomain } from "./constraints.js";
import { loadPolicyFromText, type LoadedPolicy } from "./parser.js";
import { RateLimiter } from "./rate-limiter.js";
import { SpendingTracker } from "./spending.js";
import type {
  EvaluationContext,
  ParsedPolicy,
  PolicyDecision,
  PolicyRule,
  Verdict,
} from "./types.js";

export interface GateOptions {
  signer: TEESigner;
  log: AppendOnlyDecisionLog;
  loaded: LoadedPolicy;
  /** Defaults to env AGENT_ID / SESSION_ID. */
  agentId?: string;
  sessionId?: string;
}

/**
 * The policy gate. Runs in-process inside the TEE — not a sidecar — so the agent
 * runtime cannot dispatch a tool without passing through `evaluate()`. Every
 * call yields a signed, hash-chained PolicyDecision that is persisted BEFORE the
 * verdict is acted on.
 */
export class PolicyGate {
  readonly policy: ParsedPolicy;
  readonly policyHash: string;
  readonly rawPolicyText: string;
  readonly agentId: string;
  readonly sessionId: string;

  private signer: TEESigner;
  private log: AppendOnlyDecisionLog;
  private rateLimiter: RateLimiter;
  private spending: SpendingTracker;
  private seq = 0;
  private seqReady = false;
  /** Serializes decision creation so parallel tool calls can't fork the chain. */
  private tail: Promise<void> = Promise.resolve();

  constructor(opts: GateOptions) {
    this.policy = opts.loaded.policy;
    this.policyHash = opts.loaded.policyHash;
    this.rawPolicyText = opts.loaded.rawText;
    this.signer = opts.signer;
    this.log = opts.log;
    this.agentId = opts.agentId ?? process.env.AGENT_ID ?? this.policy.agentId;
    this.sessionId = opts.sessionId ?? process.env.SESSION_ID ?? "default-session";

    this.rateLimiter = new RateLimiter(this.policy.rateLimits);
    for (const r of this.policy.rules) {
      if (r.constraints?.max_calls_per_minute != null) {
        this.rateLimiter.registerToolLimit(r.tool, r.constraints.max_calls_per_minute);
      }
    }
    this.spending = new SpendingTracker(this.policy.spendingLimits);
  }

  /** Convenience: build a gate straight from policy text. */
  static async fromPolicyText(
    raw: string,
    signer: TEESigner,
    log: AppendOnlyDecisionLog,
    opts: { agentId?: string; sessionId?: string } = {},
  ): Promise<PolicyGate> {
    return new PolicyGate({ signer, log, loaded: loadPolicyFromText(raw), ...opts });
  }

  /**
   * Evaluate a tool call against the policy, sign the decision, and persist it.
   * Resolves with the decision once it is durably logged. The caller MUST treat
   * the returned verdict as authoritative: DENY → do not run the tool.
   */
  async evaluate(
    toolName: string,
    toolArgs: Record<string, unknown>,
    ctx: EvaluationContext = {},
  ): Promise<PolicyDecision> {
    // Serialize the read-prevHash → assign-seq → sign → append critical section.
    // An agent runtime can dispatch several tool calls from one model step in
    // PARALLEL; without this lock two evaluations would read the same prevHash
    // and fork the hash chain. The work is sub-millisecond, so queuing is cheap.
    const run = this.tail.then(() => this.evaluateLocked(toolName, toolArgs, ctx));
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async evaluateLocked(
    toolName: string,
    toolArgs: Record<string, unknown>,
    ctx: EvaluationContext,
  ): Promise<PolicyDecision> {
    const now = Date.now();
    const argsHash = sha256(canonicalize(toolArgs)).toString("hex");

    const { verdict, reasonCode, constraintDetails } = this.decide(toolName, toolArgs, now, ctx);

    // --- Build and sign the envelope ---
    if (!this.seqReady) {
      this.seq = await this.log.getLastSequence(this.sessionId);
      this.seqReady = true;
    }
    const prevHash = await this.log.getLastHash(this.sessionId);
    const sequenceNumber = ++this.seq;

    const unsigned: Omit<PolicyDecision, "signature"> = {
      decisionId: uuidv4(),
      toolName,
      toolArgsHash: argsHash,
      policyHash: this.policyHash,
      verdict,
      reasonCode,
      constraintDetails,
      timestamp: now,
      sessionId: this.sessionId,
      agentId: this.agentId,
      sequenceNumber,
      prevDecisionHash: prevHash,
    };

    const digest = sha256(canonicalize(unsigned));
    const signature = this.signer.sign(digest);
    const decision: PolicyDecision = { ...unsigned, signature };

    // CRITICAL: persist BEFORE returning.
    //   DENY  → the denial record exists before PolicyViolationError is raised.
    //   ALLOW → the authorization record exists before the tool executes.
    await this.log.append(decision);

    // Commit consumption only for ALLOWed calls, after the record is durable.
    if (verdict === "ALLOW") {
      this.rateLimiter.record(toolName, now);
      if (this.isFinancial(toolName)) this.spending.record(toolArgs, now);
    }

    return decision;
  }

  /** Pure decision logic (no signing, no persistence) — easy to unit test. */
  private decide(
    toolName: string,
    args: Record<string, unknown>,
    now: number,
    ctx: EvaluationContext,
  ): { verdict: Verdict; reasonCode: string; constraintDetails: string } {
    const rule = this.matchRule(toolName);

    // No matching rule → deny-by-default.
    if (!rule) {
      return {
        verdict: this.policy.defaults.verdict,
        reasonCode:
          this.policy.defaults.verdict === "DENY" ? "POLICY_DEFAULT_DENY" : "POLICY_DEFAULT_ALLOW",
        constraintDetails:
          this.policy.defaults.verdict === "DENY"
            ? `no rule matches "${toolName}"; deny-by-default`
            : "",
      };
    }

    // Rule explicitly denies.
    if (rule.verdict === "DENY") {
      return {
        verdict: "DENY",
        reasonCode: "EXPLICITLY_DENIED",
        constraintDetails: `tool "${toolName}" is explicitly denied by policy`,
      };
    }

    // Rule allows → check its constraints.
    if (rule.constraints) {
      const check = evaluateConstraints(args, rule.constraints, ctx);
      if (!check.pass) {
        return { verdict: "DENY", reasonCode: check.reasonCode, constraintDetails: check.details };
      }
    }

    // Global rate limits.
    const rate = this.rateLimiter.check(toolName, now);
    if (!rate.pass) {
      return { verdict: "DENY", reasonCode: rate.reasonCode, constraintDetails: rate.details };
    }

    // Spending limits for financial tools.
    if (this.isFinancial(toolName)) {
      const spend = this.spending.check(args, now);
      if (!spend.pass) {
        return { verdict: "DENY", reasonCode: spend.reasonCode, constraintDetails: spend.details };
      }
    }

    return { verdict: "ALLOW", reasonCode: "POLICY_ALLOW", constraintDetails: "" };
  }

  /** First matching rule wins (exact name, then glob). */
  private matchRule(toolName: string): PolicyRule | undefined {
    return this.policy.rules.find(
      (r) => r.tool === toolName || matchDomain(toolName, r.tool),
    );
  }

  private isFinancial(toolName: string): boolean {
    return this.policy.financialTools.includes(toolName);
  }

  /** Snapshot of rate/spend state, for committing to verifiable memory (Part 3). */
  stateSnapshot(): { rates: Record<string, number>; spend: ReturnType<SpendingTracker["exportState"]> } {
    return {
      rates: this.rateLimiter.snapshot(Date.now()),
      spend: this.spending.exportState(),
    };
  }

  /** Restore spend state on TEE restart (anti rate-limit-reset). */
  restoreSpend(state: ReturnType<SpendingTracker["exportState"]>): void {
    this.spending.importState(state);
  }
}

/** Thrown after a DENY decision has already been persisted. */
export class PolicyViolationError extends Error {
  readonly decisionId: string;
  readonly reasonCode: string;
  constructor(message: string, decisionId: string, reasonCode: string) {
    super(message);
    this.name = "PolicyViolationError";
    this.decisionId = decisionId;
    this.reasonCode = reasonCode;
  }
}
