export type Verdict = "ALLOW" | "DENY";

/**
 * The signed, hash-chained record produced for EVERY tool call — allowed or
 * denied — before the tool runs (ALLOW) or before the error is raised (DENY).
 * This is the verifiable unit of authorization.
 */
export interface PolicyDecision {
  decisionId: string; // UUIDv4
  toolName: string;
  toolArgsHash: string; // hex SHA-256 of canonical JSON args
  policyHash: string; // "sha256:..." of the sealed policy
  verdict: Verdict;
  reasonCode: string; // e.g. "PATH_VIOLATION", "RATE_LIMIT", "SPENDING_LIMIT"
  constraintDetails: string; // human-readable explanation
  timestamp: number; // unix ms
  sessionId: string;
  agentId: string;
  sequenceNumber: number; // monotonic per session, gap-detectable (1-based)
  prevDecisionHash: string; // entry hash of the previous decision, or "GENESIS"
  signature: string; // hex compact secp256k1 r‖s over the unsigned envelope
}

/** Result of evaluating one rule's constraints against a tool's arguments. */
export interface ConstraintCheckResult {
  pass: boolean;
  reasonCode: string;
  details: string;
}

export interface RuleConstraints {
  // rate
  max_calls_per_minute?: number;
  // domains
  blocked_domains?: string[];
  allowed_domains?: string[];
  allowed_methods?: string[];
  max_body_size_bytes?: number;
  // paths
  allowed_paths?: string[];
  blocked_paths?: string[];
  max_file_size_bytes?: number;
  // money
  max_amount_per_tx?: number;
  max_amount_per_hour?: number;
  allowed_recipients?: string[];
  require_hitl_above?: number;
}

export interface PolicyRule {
  tool: string; // exact name or glob ("file_*")
  verdict: Verdict;
  constraints?: RuleConstraints;
}

export interface SpendingLimits {
  currency: string;
  per_session?: number;
  per_day?: number;
}

export interface RateLimits {
  global_max_calls_per_minute?: number;
  global_max_calls_per_hour?: number;
}

export interface ParsedPolicy {
  version: string;
  agentId: string;
  description?: string;
  defaults: { verdict: Verdict };
  rules: PolicyRule[];
  spendingLimits?: SpendingLimits;
  rateLimits?: RateLimits;
  /** Tool names treated as financial (spending limits apply). */
  financialTools: string[];
}

/** Optional per-call context — e.g. a human-in-the-loop approval flag. */
export interface EvaluationContext {
  hitlApproved?: boolean;
}
