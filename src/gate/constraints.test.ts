import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateConstraints, matchDomain } from "./constraints.js";

test("blocked path is denied", () => {
  const r = evaluateConstraints(
    { path: "/etc/passwd" },
    { allowed_paths: ["/workspace/**"], blocked_paths: ["/etc/**"] },
  );
  assert.equal(r.pass, false);
  assert.equal(r.reasonCode, "PATH_VIOLATION");
});

test("allowed path passes", () => {
  const r = evaluateConstraints(
    { path: "/workspace/output/report.md" },
    { allowed_paths: ["/workspace/**"], blocked_paths: ["/etc/**"] },
  );
  assert.equal(r.pass, true);
});

test("path not in allowlist is denied", () => {
  const r = evaluateConstraints({ path: "/tmp/x" }, { allowed_paths: ["/workspace/**"] });
  assert.equal(r.pass, false);
});

test("domain allowlist enforced", () => {
  const ok = evaluateConstraints(
    { url: "https://api.github.com/repos" },
    { allowed_domains: ["api.github.com"] },
  );
  assert.equal(ok.pass, true);
  const bad = evaluateConstraints(
    { url: "https://evil.example.com" },
    { allowed_domains: ["api.github.com"] },
  );
  assert.equal(bad.pass, false);
  assert.equal(bad.reasonCode, "DOMAIN_VIOLATION");
});

test("blocked domain glob (*.onion)", () => {
  assert.equal(matchDomain("secrets.onion", "*.onion"), true);
  assert.equal(matchDomain("example.com", "*.onion"), false);
});

test("amount over per-tx cap denied", () => {
  const r = evaluateConstraints({ amount: 250 }, { max_amount_per_tx: 100 });
  assert.equal(r.pass, false);
  assert.equal(r.reasonCode, "AMOUNT_EXCEEDED");
});

test("HITL threshold denies without approval, allows with", () => {
  const denied = evaluateConstraints({ amount: 75 }, { require_hitl_above: 50 });
  assert.equal(denied.pass, false);
  assert.equal(denied.reasonCode, "HITL_REQUIRED");
  const approved = evaluateConstraints({ amount: 75 }, { require_hitl_above: 50 }, { hitlApproved: true });
  assert.equal(approved.pass, true);
});

test("recipient allowlist enforced", () => {
  const r = evaluateConstraints(
    { recipient: "0x9999", amount: 1 },
    { allowed_recipients: ["0xABC"] },
  );
  assert.equal(r.pass, false);
  assert.equal(r.reasonCode, "RECIPIENT_VIOLATION");
});

test("file size cap enforced", () => {
  const r = evaluateConstraints(
    { path: "/workspace/x", content: "x".repeat(100) },
    { allowed_paths: ["/workspace/**"], max_file_size_bytes: 10 },
  );
  assert.equal(r.pass, false);
  assert.equal(r.reasonCode, "SIZE_EXCEEDED");
});
