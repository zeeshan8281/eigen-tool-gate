import { verifyDecisionChain } from "../crypto/verify.js";
import type { PolicyDecision } from "../gate/types.js";
import type { GateAttestation } from "../tee/attestation.js";

/**
 * External verifier — the auditor's tool. Talks to a running gate over HTTP and
 * confirms, with no trust in the server:
 *   1. fetch the attestation (TEE pubkey + sealed policy hash)
 *   2. fetch the served policy and confirm it hashes to the attested value
 *   3. pull the full decision chain
 *   4. re-verify every signature and hash link locally
 *
 *   npm run verify -- http://localhost:8080 [session_id]
 */
async function main(): Promise<void> {
  const base = (process.argv[2] ?? "http://localhost:8080").replace(/\/$/, "");
  const sessionId = process.argv[3];

  const att = (await getJson(`${base}/gate/attestation`)) as GateAttestation;
  console.log("Attestation");
  console.log(`  mode:        ${att.mode}`);
  console.log(`  tee address: ${att.teeAddress}`);
  console.log(`  policy hash: ${att.policyHash}`);
  console.log(`  image:       ${att.imageDigest ?? "(local/dev)"}`);
  console.log(`  app id:      ${att.eigenComputeDeploymentId ?? "(local/dev)"}`);

  const sessionQuery = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  const decisionsResp = (await getJson(`${base}/gate/decisions${sessionQuery}`)) as {
    sessionId: string;
    decisions: PolicyDecision[];
  };
  const decisions = decisionsResp.decisions;

  console.log(`\nDecision chain (session ${decisionsResp.sessionId})`);
  for (const d of decisions) {
    const mark = d.verdict === "ALLOW" ? "✓ ALLOW" : "✗ DENY ";
    console.log(`  #${d.sequenceNumber} ${mark} ${d.toolName.padEnd(16)} ${d.reasonCode}`);
  }

  const result = verifyDecisionChain(decisions, att.teePublicKey, att.policyHash);
  console.log("\nVerification result");
  console.log(`  total:       ${result.totalDecisions}`);
  console.log(`  allow:       ${result.allowCount}`);
  console.log(`  deny:        ${result.denyCount}`);
  console.log(`  chain valid: ${result.valid ? "YES" : "NO"}`);
  console.log(`  gaps:        ${result.gaps.length ? result.gaps.join(",") : "none"}`);
  console.log(`  broken at:   ${result.brokenAt ?? "none"}`);
  if (result.errors.length) {
    console.log("  errors:");
    for (const e of result.errors) console.log(`    - ${e}`);
  }

  process.exit(result.valid ? 0 : 1);
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
