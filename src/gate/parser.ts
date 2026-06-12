import yaml from "js-yaml";
import { policyHash as computePolicyHash } from "../crypto/canonicalize.js";
import type {
  ParsedPolicy,
  PolicyRule,
  RuleConstraints,
  Verdict,
} from "./types.js";

export interface LoadedPolicy {
  policy: ParsedPolicy;
  /** "sha256:..." over the canonical policy text — sealed into the attestation. */
  policyHash: string;
  /** The canonical raw text, so the gate can serve the exact bytes it hashed. */
  rawText: string;
}

const VALID_VERDICTS: Verdict[] = ["ALLOW", "DENY"];

function isVerdict(v: unknown): v is Verdict {
  return typeof v === "string" && VALID_VERDICTS.includes(v as Verdict);
}

/**
 * Tools whose arguments carry money. Used to decide when spending limits run.
 * Kept declarative: any rule that defines amount/recipient constraints, plus a
 * couple of well-known names, is treated as financial.
 */
function detectFinancialTools(rules: PolicyRule[]): string[] {
  const known = new Set(["wallet_transfer", "payment", "transfer", "x402_pay"]);
  for (const r of rules) {
    const c = r.constraints ?? {};
    if (
      c.max_amount_per_tx !== undefined ||
      c.max_amount_per_hour !== undefined ||
      c.allowed_recipients !== undefined ||
      c.require_hitl_above !== undefined
    ) {
      known.add(r.tool);
    }
  }
  return [...known];
}

export function parsePolicy(raw: string): ParsedPolicy {
  const doc = yaml.load(raw) as Record<string, unknown> | undefined;
  if (!doc || typeof doc !== "object") {
    throw new PolicyValidationError("policy is empty or not a YAML mapping");
  }

  const version = String(doc.version ?? "");
  if (!version) throw new PolicyValidationError("missing `version`");

  const agentId = String(doc.agent_id ?? "");
  if (!agentId) throw new PolicyValidationError("missing `agent_id`");

  const defaultsRaw = (doc.defaults ?? {}) as Record<string, unknown>;
  const defaultVerdict = defaultsRaw.verdict ?? "DENY";
  if (!isVerdict(defaultVerdict)) {
    throw new PolicyValidationError(
      `defaults.verdict must be ALLOW or DENY, got "${String(defaultVerdict)}"`,
    );
  }

  const rulesRaw = doc.rules;
  if (rulesRaw !== undefined && !Array.isArray(rulesRaw)) {
    throw new PolicyValidationError("`rules` must be a list");
  }
  const rules: PolicyRule[] = ((rulesRaw as unknown[]) ?? []).map((r, i) => {
    const rule = r as Record<string, unknown>;
    if (!rule || typeof rule.tool !== "string") {
      throw new PolicyValidationError(`rules[${i}] missing string \`tool\``);
    }
    if (!isVerdict(rule.verdict)) {
      throw new PolicyValidationError(
        `rules[${i}] (${rule.tool}) verdict must be ALLOW or DENY`,
      );
    }
    return {
      tool: rule.tool,
      verdict: rule.verdict,
      constraints: validateConstraints(rule.constraints, rule.tool, i),
    };
  });

  const spendingRaw = doc.spending_limits as Record<string, unknown> | undefined;
  const rateRaw = doc.rate_limits as Record<string, unknown> | undefined;

  const policy: ParsedPolicy = {
    version,
    agentId,
    description: doc.description ? String(doc.description) : undefined,
    defaults: { verdict: defaultVerdict },
    rules,
    spendingLimits: spendingRaw
      ? {
          currency: String(spendingRaw.currency ?? "USD"),
          per_session: numOrUndef(spendingRaw.per_session),
          per_day: numOrUndef(spendingRaw.per_day),
        }
      : undefined,
    rateLimits: rateRaw
      ? {
          global_max_calls_per_minute: numOrUndef(
            rateRaw.global_max_calls_per_minute,
          ),
          global_max_calls_per_hour: numOrUndef(rateRaw.global_max_calls_per_hour),
        }
      : undefined,
    financialTools: detectFinancialTools(rules),
  };

  return policy;
}

function validateConstraints(
  raw: unknown,
  tool: string,
  i: number,
): RuleConstraints | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object") {
    throw new PolicyValidationError(`rules[${i}] (${tool}) constraints must be a mapping`);
  }
  const c = raw as Record<string, unknown>;
  const arrOrUndef = (k: string): string[] | undefined =>
    c[k] === undefined ? undefined : (c[k] as unknown[]).map(String);

  return {
    max_calls_per_minute: numOrUndef(c.max_calls_per_minute),
    blocked_domains: arrOrUndef("blocked_domains"),
    allowed_domains: arrOrUndef("allowed_domains"),
    allowed_methods: arrOrUndef("allowed_methods"),
    max_body_size_bytes: numOrUndef(c.max_body_size_bytes),
    allowed_paths: arrOrUndef("allowed_paths"),
    blocked_paths: arrOrUndef("blocked_paths"),
    max_file_size_bytes: numOrUndef(c.max_file_size_bytes),
    max_amount_per_tx: numOrUndef(c.max_amount_per_tx),
    max_amount_per_hour: numOrUndef(c.max_amount_per_hour),
    allowed_recipients: arrOrUndef("allowed_recipients"),
    require_hitl_above: numOrUndef(c.require_hitl_above),
  };
}

function numOrUndef(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  if (Number.isNaN(n)) throw new PolicyValidationError(`expected a number, got "${String(v)}"`);
  return n;
}

/** Parse + hash a policy from its raw YAML text in one shot. */
export function loadPolicyFromText(raw: string): LoadedPolicy {
  const policy = parsePolicy(raw);
  return { policy, policyHash: computePolicyHash(raw), rawText: raw };
}

export class PolicyValidationError extends Error {
  constructor(message: string) {
    super(`invalid policy: ${message}`);
    this.name = "PolicyValidationError";
  }
}
