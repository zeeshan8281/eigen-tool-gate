import canonicalizeDefault from "canonicalize";
import { sha256 as nobleSha256 } from "@noble/hashes/sha256";

// `canonicalize` is a CJS module whose `module.exports` is the function itself.
// Under NodeNext ESM interop the default import resolves to that function at
// runtime, but its types surface as a namespace — cast to the real signature.
const canonicalizeRaw = canonicalizeDefault as unknown as (
  input: unknown,
) => string | undefined;

/**
 * RFC 8785 (JSON Canonicalization Scheme) serialization.
 *
 * The whole point of Verified Tool Gating is that an *external* verifier can
 * recompute the exact bytes we signed. RFC 8785 is the only canonicalization
 * with an interoperable spec, so both the gate (signer) and any independent
 * verifier hash identical bytes. `undefined`-valued keys are dropped, which is
 * how we exclude the `signature` field from the signed payload.
 */
export function canonicalize(value: unknown): string {
  const out = canonicalizeRaw(value);
  if (out === undefined) throw new Error("canonicalize returned undefined");
  return out;
}

/** SHA-256 over arbitrary bytes or a UTF-8 string. Returns a 32-byte buffer. */
export function sha256(data: string | Uint8Array): Buffer {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return Buffer.from(nobleSha256(bytes));
}

export const toHex = (b: Uint8Array): string => Buffer.from(b).toString("hex");
export const fromHex = (h: string): Buffer =>
  Buffer.from(h.startsWith("0x") ? h.slice(2) : h, "hex");

/** Hex-encoded SHA-256 of the canonical JSON form of `value`. */
export function hashJSON(value: unknown): string {
  return toHex(sha256(canonicalize(value)));
}

/** SHA-256 digest (raw bytes) of the canonical JSON form of `value`. */
export function digestJSON(value: unknown): Buffer {
  return sha256(canonicalize(value));
}

/**
 * Canonical form of a *policy document*. The policy is text (YAML), not JSON,
 * so RFC 8785 does not apply. We normalize line endings and strip a trailing
 * newline so the same logical policy hashes identically across editors/OSes.
 * This hash is what gets sealed into the TDX attestation measurement.
 */
export function canonicalizePolicyText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\s+$/, "") + "\n";
}

export function policyHash(raw: string): string {
  return "sha256:" + toHex(sha256(canonicalizePolicyText(raw)));
}
