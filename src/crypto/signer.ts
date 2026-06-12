import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { sha256, toHex } from "./canonicalize.js";

/**
 * TEE-sealed signing identity for the policy gate.
 *
 * On EigenCompute the app runs in an Intel TDX enclave with a per-deployment
 * identity. We persist a secp256k1 key to the encrypted volume (`/data`), which
 * is readable only by this attested image — so the key is sealed to the code.
 * On first boot it is generated; on resume it is reloaded (this is what lets
 * rate-limit and spending counters survive a restart — see SpendingTracker).
 *
 * Outside a TEE we mark the signer "dev" so verifiers never mistake a local key
 * for an attested deployment. Same curve + compact-sig + eth-address conventions
 * as Part 3 (verifiable memory), so a single verifier toolchain covers both.
 */
export class TEESigner {
  readonly privateKey: Buffer;
  readonly publicKey: Buffer; // 65-byte uncompressed (0x04…)
  readonly address: string; // Ethereum-style, lowercased
  readonly mode: "tee" | "dev";

  constructor(dataDir: string) {
    const keyPath = join(dataDir, "gate-signer.key");
    let priv: Buffer;
    try {
      if (existsSync(keyPath)) {
        priv = Buffer.from(readFileSync(keyPath, "utf-8").trim(), "hex");
      } else {
        mkdirSync(dataDir, { recursive: true });
        priv = Buffer.from(secp256k1.utils.randomPrivateKey());
        writeFileSync(keyPath, priv.toString("hex"), { mode: 0o600 });
      }
    } catch {
      // read-only / ephemeral FS (local sandbox) — fall back to an in-memory key
      priv = Buffer.from(secp256k1.utils.randomPrivateKey());
    }
    this.privateKey = priv;
    this.publicKey = Buffer.from(secp256k1.getPublicKey(priv, false));
    this.address = ethAddress(this.publicKey);
    this.mode = insideTee() ? "tee" : "dev";
  }

  /**
   * Sign a 32-byte digest. Returns a compact 64-byte r‖s signature, hex-encoded.
   * The caller is responsible for producing `digest` (typically the SHA-256 of
   * the canonical JSON of the unsigned envelope).
   */
  sign(digest: Buffer): string {
    return toHex(secp256k1.sign(digest, this.privateKey).toCompactRawBytes());
  }

  get publicKeyHex(): string {
    return toHex(this.publicKey);
  }
}

/** Stateless signature check — usable by any external verifier. */
export function verifySignature(
  digest: Buffer,
  signatureHex: string,
  publicKeyHex: string,
): boolean {
  try {
    return secp256k1.verify(
      Buffer.from(signatureHex, "hex"),
      digest,
      Buffer.from(publicKeyHex, "hex"),
    );
  } catch {
    return false;
  }
}

/** Ethereum-style address from an uncompressed secp256k1 public key. */
export function ethAddress(publicKey: Buffer): string {
  const hashed = keccak_256(publicKey.subarray(1)); // drop the 0x04 prefix
  return "0x" + toHex(Buffer.from(hashed).subarray(-20));
}

function insideTee(): boolean {
  return (
    Boolean(process.env.ECLOUD_APP_ID) ||
    existsSync("/usr/local/bin/kms-signing-public-key.pem")
  );
}

export { sha256 };
