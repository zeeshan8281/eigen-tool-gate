import { minimatch } from "minimatch";
import type { ConstraintCheckResult, EvaluationContext, RuleConstraints } from "./types.js";

const PASS: ConstraintCheckResult = {
  pass: true,
  reasonCode: "CONSTRAINTS_MET",
  details: "",
};

/**
 * Evaluate a rule's constraints against a tool call's arguments.
 *
 * Deny-on-first-violation. Each check is independent and only fires when both
 * the constraint and the corresponding argument are present, so a policy author
 * pays only for the constraints they declare. Pure and synchronous — this is
 * the sub-millisecond hot path.
 */
export function evaluateConstraints(
  args: Record<string, unknown>,
  constraints: RuleConstraints,
  ctx: EvaluationContext = {},
): ConstraintCheckResult {
  // --- Path constraints ---
  if ((constraints.allowed_paths || constraints.blocked_paths) && args.path != null) {
    const path = String(args.path);
    const blocked =
      constraints.blocked_paths?.some((p) => minimatch(path, p)) ?? false;
    if (blocked) {
      return deny("PATH_VIOLATION", `path "${path}" matches a blocked_paths pattern`);
    }
    const allowed =
      !constraints.allowed_paths ||
      constraints.allowed_paths.some((p) => minimatch(path, p));
    if (!allowed) {
      return deny("PATH_VIOLATION", `path "${path}" is not in allowed_paths`);
    }
  }

  // --- File size constraints ---
  if (constraints.max_file_size_bytes != null && args.content != null) {
    const size = Buffer.byteLength(String(args.content));
    if (size > constraints.max_file_size_bytes) {
      return deny(
        "SIZE_EXCEEDED",
        `content size ${size} bytes exceeds max ${constraints.max_file_size_bytes}`,
      );
    }
  }

  // --- Domain / HTTP constraints ---
  if ((constraints.allowed_domains || constraints.blocked_domains) && args.url != null) {
    let domain: string;
    try {
      domain = new URL(String(args.url)).hostname;
    } catch {
      return deny("DOMAIN_VIOLATION", `url "${String(args.url)}" is not a valid URL`);
    }
    const blocked =
      constraints.blocked_domains?.some((d) => matchDomain(domain, d)) ?? false;
    if (blocked) {
      return deny("DOMAIN_VIOLATION", `domain "${domain}" matches a blocked_domains pattern`);
    }
    const allowed =
      !constraints.allowed_domains ||
      constraints.allowed_domains.some((d) => matchDomain(domain, d));
    if (!allowed) {
      return deny("DOMAIN_VIOLATION", `domain "${domain}" is not in allowed_domains`);
    }
  }

  if (constraints.allowed_methods && args.method != null) {
    const method = String(args.method).toUpperCase();
    if (!constraints.allowed_methods.map((m) => m.toUpperCase()).includes(method)) {
      return deny("METHOD_VIOLATION", `method "${method}" is not in allowed_methods`);
    }
  }

  if (constraints.max_body_size_bytes != null && args.body != null) {
    const size = Buffer.byteLength(
      typeof args.body === "string" ? args.body : JSON.stringify(args.body),
    );
    if (size > constraints.max_body_size_bytes) {
      return deny(
        "SIZE_EXCEEDED",
        `body size ${size} bytes exceeds max ${constraints.max_body_size_bytes}`,
      );
    }
  }

  // --- Financial constraints ---
  if (constraints.allowed_recipients && args.recipient != null) {
    const recipient = String(args.recipient);
    if (!constraints.allowed_recipients.includes(recipient)) {
      return deny(
        "RECIPIENT_VIOLATION",
        `recipient "${recipient}" is not in allowed_recipients`,
      );
    }
  }

  if (constraints.max_amount_per_tx != null && args.amount != null) {
    const amount = Number(args.amount);
    if (amount > constraints.max_amount_per_tx) {
      return deny(
        "AMOUNT_EXCEEDED",
        `amount ${amount} exceeds max_amount_per_tx ${constraints.max_amount_per_tx}`,
      );
    }
  }

  // HITL threshold — denied unless a human approval flag is present in context.
  if (constraints.require_hitl_above != null && args.amount != null) {
    const amount = Number(args.amount);
    if (amount > constraints.require_hitl_above && !ctx.hitlApproved) {
      return deny(
        "HITL_REQUIRED",
        `amount ${amount} exceeds HITL threshold ${constraints.require_hitl_above}; human approval required`,
      );
    }
  }

  return PASS;
}

function deny(reasonCode: string, details: string): ConstraintCheckResult {
  return { pass: false, reasonCode, details };
}

/**
 * Glob-ish domain matcher. Supports a leading "*." wildcard (subdomain match)
 * and bare "*.tld" style patterns like "*.onion".
 */
export function matchDomain(domain: string, pattern: string): boolean {
  const d = domain.toLowerCase();
  const p = pattern.toLowerCase();
  if (p === d) return true;
  if (p.startsWith("*.")) {
    const suffix = p.slice(1); // ".onion" / ".example.com"
    return d.endsWith(suffix);
  }
  return minimatch(d, p);
}
