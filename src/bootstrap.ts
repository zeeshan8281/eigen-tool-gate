import { readFileSync } from "node:fs";
import { TEESigner } from "./crypto/signer.js";
import { PolicyGate } from "./gate/engine.js";
import { loadPolicyFromText } from "./gate/parser.js";
import { AppendOnlyDecisionLog } from "./log/append-only.js";

export interface Gateway {
  signer: TEESigner;
  log: AppendOnlyDecisionLog;
  gate: PolicyGate;
}

/**
 * Wire up the full gate from the environment. Shared by the HTTP entrypoint and
 * the demo so both exercise the identical boot path:
 *   1. derive/seal the TEE signing key on the encrypted volume
 *   2. load + hash the policy (the hash that belongs in the attestation)
 *   3. open the decision log (PostgreSQL in the TEE, in-memory locally)
 */
export async function bootstrapGate(opts: { policyPath?: string } = {}): Promise<Gateway> {
  const dataDir = process.env.DATA_DIR ?? "./data";
  const policyPath = opts.policyPath ?? process.env.POLICY_PATH ?? "policies/demo-policy.yaml";

  const signer = new TEESigner(dataDir);
  const loaded = loadPolicyFromText(readFileSync(policyPath, "utf-8"));
  const log = await AppendOnlyDecisionLog.fromEnv();
  const gate = new PolicyGate({ signer, log, loaded });

  return { signer, log, gate };
}
