import { readFileSync, writeFileSync } from "node:fs";
import { canonicalizePolicyText, policyHash } from "../crypto/canonicalize.js";
import { parsePolicy } from "./parser.js";

/**
 * `eigen-gate seal` — canonicalize + validate + hash a policy.
 *
 *   npm run seal -- --policy policies/demo-policy.yaml [--output policy.sealed]
 *
 * The printed hash is what you pin into the image entrypoint config so it
 * becomes part of the TDX attestation measurement. We validate the policy here
 * too, so a malformed policy fails at build time, not at boot inside the TEE.
 */
function main(): void {
  const args = process.argv.slice(2);
  const policyPath = argValue(args, "--policy") ?? "policies/demo-policy.yaml";
  const output = argValue(args, "--output");

  const raw = readFileSync(policyPath, "utf-8");
  const parsed = parsePolicy(raw); // throws PolicyValidationError if invalid
  const canonical = canonicalizePolicyText(raw);
  const hash = policyHash(raw);

  console.log(`Policy:       ${policyPath}`);
  console.log(`Agent:        ${parsed.agentId}`);
  console.log(`Version:      ${parsed.version}`);
  console.log(`Rules:        ${parsed.rules.length}`);
  console.log(`Default:      ${parsed.defaults.verdict}`);
  console.log(`Policy hash:  ${hash}`);

  if (output) {
    writeFileSync(output, canonical);
    console.log(`Sealed to:    ${output}`);
  }
  console.log("");
  console.log("Pin this into the image entrypoint so it enters the attestation:");
  console.log(`  ENV POLICY_HASH=${hash}`);
}

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

main();
