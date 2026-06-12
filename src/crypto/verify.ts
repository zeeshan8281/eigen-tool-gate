import { canonicalize, hashJSON, sha256 } from "./canonicalize.js";
import { verifySignature } from "./signer.js";
import type { PolicyDecision } from "../gate/types.js";

export interface ChainVerificationResult {
  valid: boolean;
  totalDecisions: number;
  allowCount: number;
  denyCount: number;
  chainLength: number;
  gaps: number[];
  brokenAt: number | null;
  errors: string[];
}

/**
 * Stateless verification of a decision chain. Safe to run on any client with no
 * trust in the server: re-derives the signed digest, checks the secp256k1
 * signature against the attested TEE key, re-links the hash chain, and looks for
 * sequence/timestamp anomalies.
 */
export function verifyDecisionChain(
  decisions: PolicyDecision[],
  teePubKey: string,
  expectedPolicyHash?: string,
): ChainVerificationResult {
  const errors: string[] = [];
  const gaps: number[] = [];
  let brokenAt: number | null = null;

  for (let i = 0; i < decisions.length; i++) {
    const d = decisions[i]!;

    // 1. Policy hash matches the attested policy.
    if (expectedPolicyHash && d.policyHash !== expectedPolicyHash) {
      errors.push(`seq ${d.sequenceNumber}: policy hash mismatch`);
      brokenAt ??= d.sequenceNumber;
    }

    // 2. Signature is valid for the TEE key.
    const digest = sha256(canonicalize(stripSignature(d)));
    if (!verifySignature(digest, d.signature, teePubKey)) {
      errors.push(`seq ${d.sequenceNumber}: invalid signature`);
      brokenAt ??= d.sequenceNumber;
    }

    if (i > 0) {
      const prev = decisions[i - 1]!;

      // 3. Hash chain is intact (prevDecisionHash == entry hash of prior decision).
      const prevEntryHash = "sha256:" + hashJSON(pickDecision(prev));
      if (d.prevDecisionHash !== prevEntryHash) {
        errors.push(`seq ${d.sequenceNumber}: broken hash chain`);
        brokenAt ??= d.sequenceNumber;
      }

      // 4. Sequence numbers are monotonic and gapless.
      const expectedSeq = prev.sequenceNumber + 1;
      if (d.sequenceNumber !== expectedSeq) {
        for (let s = expectedSeq; s < d.sequenceNumber; s++) gaps.push(s);
        errors.push(
          `seq ${d.sequenceNumber}: sequence gap (expected ${expectedSeq})`,
        );
        brokenAt ??= d.sequenceNumber;
      }

      // 5. Timestamps are monotonically non-decreasing.
      if (d.timestamp < prev.timestamp) {
        errors.push(`seq ${d.sequenceNumber}: timestamp regression`);
        brokenAt ??= d.sequenceNumber;
      }
    }
  }

  return {
    valid: errors.length === 0,
    totalDecisions: decisions.length,
    allowCount: decisions.filter((d) => d.verdict === "ALLOW").length,
    denyCount: decisions.filter((d) => d.verdict === "DENY").length,
    chainLength: decisions.length,
    gaps,
    brokenAt,
    errors,
  };
}

/** Verify a single decision's signature + policy hash (no chain context). */
export function verifyDecision(
  decision: PolicyDecision,
  teePubKey: string,
  expectedPolicyHash?: string,
): { signatureValid: boolean; policyHashMatch: boolean } {
  const digest = sha256(canonicalize(stripSignature(decision)));
  return {
    signatureValid: verifySignature(digest, decision.signature, teePubKey),
    policyHashMatch: !expectedPolicyHash || decision.policyHash === expectedPolicyHash,
  };
}

/**
 * The exact PolicyDecision fields, in case the caller passed a richer object
 * (e.g. a StoredDecision carrying `entryHash`). Hashing must only ever see these
 * canonical fields, or signatures and chain links won't reproduce.
 */
function pickDecision(d: PolicyDecision): PolicyDecision {
  return {
    decisionId: d.decisionId,
    toolName: d.toolName,
    toolArgsHash: d.toolArgsHash,
    policyHash: d.policyHash,
    verdict: d.verdict,
    reasonCode: d.reasonCode,
    constraintDetails: d.constraintDetails,
    timestamp: d.timestamp,
    sessionId: d.sessionId,
    agentId: d.agentId,
    sequenceNumber: d.sequenceNumber,
    prevDecisionHash: d.prevDecisionHash,
    signature: d.signature,
  };
}

function stripSignature(d: PolicyDecision): Omit<PolicyDecision, "signature"> {
  const { signature: _omit, ...rest } = pickDecision(d);
  return rest;
}
