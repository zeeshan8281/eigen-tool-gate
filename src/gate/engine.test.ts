import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEESigner } from "../crypto/signer.js";
import { AppendOnlyDecisionLog, MemStore } from "../log/append-only.js";
import { verifyDecisionChain } from "../crypto/verify.js";
import { PolicyGate } from "./engine.js";
import { loadPolicyFromText } from "./parser.js";

const POLICY = readFileSync(new URL("../../policies/demo-policy.yaml", import.meta.url), "utf-8");

async function newGate(sessionId: string): Promise<{ gate: PolicyGate; log: AppendOnlyDecisionLog; signer: TEESigner }> {
  const signer = new TEESigner("./.test-data");
  const log = await AppendOnlyDecisionLog.create(new MemStore());
  const gate = new PolicyGate({
    signer,
    log,
    loaded: loadPolicyFromText(POLICY),
    sessionId,
    agentId: "test-agent",
  });
  return { gate, log, signer };
}

test("allow then deny produces a verifiable chain", async () => {
  const { gate, log, signer } = await newGate("s-chain");

  const a = await gate.evaluate("web_search", { query: "hello" });
  assert.equal(a.verdict, "ALLOW");
  assert.equal(a.sequenceNumber, 1);
  assert.equal(a.prevDecisionHash, "GENESIS");

  const b = await gate.evaluate("shell_exec", { command: "rm -rf /" });
  assert.equal(b.verdict, "DENY");
  assert.equal(b.reasonCode, "EXPLICITLY_DENIED");
  assert.equal(b.sequenceNumber, 2);

  const c = await gate.evaluate("file_read", { path: "/etc/passwd" });
  assert.equal(c.verdict, "DENY");
  assert.equal(c.reasonCode, "PATH_VIOLATION");

  const decisions = await log.bySession("s-chain");
  const result = verifyDecisionChain(decisions, signer.publicKeyHex, gate.policyHash);
  assert.equal(result.valid, true);
  assert.equal(result.allowCount, 1);
  assert.equal(result.denyCount, 2);
  assert.equal(result.gaps.length, 0);
});

test("deny-by-default for unknown tools", async () => {
  const { gate } = await newGate("s-default");
  const d = await gate.evaluate("send_email", { to: "x@y.com" });
  assert.equal(d.verdict, "DENY");
  assert.equal(d.reasonCode, "POLICY_DEFAULT_DENY");
});

test("HITL flow: 75 USDC denied, then allowed with approval", async () => {
  const { gate } = await newGate("s-hitl");
  const recipient = "0xABC0000000000000000000000000000000000001";
  const denied = await gate.evaluate("wallet_transfer", { recipient, amount: 75 });
  assert.equal(denied.verdict, "DENY");
  assert.equal(denied.reasonCode, "HITL_REQUIRED");
  const allowed = await gate.evaluate("wallet_transfer", { recipient, amount: 75 }, { hitlApproved: true });
  assert.equal(allowed.verdict, "ALLOW");
});

test("tampering with a verdict breaks verification", async () => {
  const { gate, log, signer } = await newGate("s-tamper");
  await gate.evaluate("web_search", { query: "a" });
  await gate.evaluate("shell_exec", { command: "x" });
  const decisions = await log.bySession("s-tamper");
  decisions[1]!.verdict = "ALLOW"; // flip the DENY
  const result = verifyDecisionChain(decisions, signer.publicKeyHex, gate.policyHash);
  assert.equal(result.valid, false);
  assert.ok(result.brokenAt !== null);
});

test("dropping an entry creates a detectable gap", async () => {
  const { gate, log, signer } = await newGate("s-gap");
  await gate.evaluate("web_search", { query: "a" });
  await gate.evaluate("web_search", { query: "b" });
  await gate.evaluate("web_search", { query: "c" });
  const decisions = await log.bySession("s-gap");
  const without = [decisions[0]!, decisions[2]!]; // drop seq 2
  const result = verifyDecisionChain(without, signer.publicKeyHex, gate.policyHash);
  assert.equal(result.valid, false);
  assert.ok(result.gaps.includes(2));
});

test("spending per-session cap enforced across calls", async () => {
  const { gate } = await newGate("s-spend");
  const recipient = "0xABC0000000000000000000000000000000000001";
  // per_session cap is 1000; each within per-tx (100) and HITL-approved.
  let denied = 0;
  for (let i = 0; i < 12; i++) {
    const d = await gate.evaluate(
      "wallet_transfer",
      { recipient, amount: 100 },
      { hitlApproved: true },
    );
    if (d.verdict === "DENY" && d.reasonCode === "SPENDING_LIMIT") denied++;
  }
  // 10 * 100 = 1000 allowed, the 11th and 12th exceed the session cap.
  assert.ok(denied >= 1);
});
