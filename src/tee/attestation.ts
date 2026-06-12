import { existsSync, readFileSync } from "node:fs";
import { sha256, toHex } from "../crypto/canonicalize.js";
import type { TEESigner } from "../crypto/signer.js";

const KMS_PUBKEY_PATH = "/usr/local/bin/kms-signing-public-key.pem";

export interface GateAttestation {
  mode: "tee" | "dev";
  teePublicKey: string; // hex, 65-byte uncompressed
  teeAddress: string; // Ethereum-style
  /** THE measurement that makes this Part 4: the sealed policy's hash. */
  policyHash: string;
  imageDigest: string | null; // attested code measurement
  attestationToken: string | null;
  onChainTxHash: string | null;
  eigenComputeDeploymentId: string | null;
  kmsKeyFingerprint: string | null;
  platform: string;
  confidentialSpace: string;
  verifyUrl: string;
}

/**
 * The attestation an external verifier fetches before trusting any decision. It
 * binds three measurements: the code (imageDigest), the policy (policyHash), and
 * the signing identity (teePublicKey/teeAddress). Confirming all three proves
 * "this exact code ran with this exact policy and signed with this exact key."
 */
export function getAttestation(
  signer: TEESigner,
  policyHash: string,
  env: NodeJS.ProcessEnv = process.env,
): GateAttestation {
  return {
    mode: signer.mode,
    teePublicKey: signer.publicKeyHex,
    teeAddress: signer.address,
    policyHash,
    imageDigest: env.IMAGE_DIGEST ?? env.ECLOUD_IMAGE_DIGEST ?? null,
    attestationToken: env.TDX_QUOTE ?? env.ATTESTATION_TOKEN ?? null,
    onChainTxHash: env.ECLOUD_ONCHAIN_TX ?? null,
    eigenComputeDeploymentId: env.ECLOUD_APP_ID ?? null,
    kmsKeyFingerprint: kmsKeyFingerprint(),
    platform: "Intel TDX (EigenCompute)",
    confidentialSpace: "Google Cloud",
    verifyUrl: env.EIGEN_VERIFY_URL ?? "https://verify-sepolia.eigencloud.xyz",
  };
}

function kmsKeyFingerprint(): string | null {
  try {
    if (!existsSync(KMS_PUBKEY_PATH)) return null;
    return "sha256:" + toHex(sha256(readFileSync(KMS_PUBKEY_PATH, "utf-8").trim()));
  } catch {
    return null;
  }
}
