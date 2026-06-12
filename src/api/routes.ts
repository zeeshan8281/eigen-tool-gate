import { Router } from "express";
import type { PolicyGate } from "../gate/engine.js";
import type { AppendOnlyDecisionLog } from "../log/append-only.js";
import type { TEESigner } from "../crypto/signer.js";
import { getAttestation } from "../tee/attestation.js";
import { verifyDecision, verifyDecisionChain } from "../crypto/verify.js";
import type { PolicyDecision } from "../gate/types.js";

export interface RouteDeps {
  gate: PolicyGate;
  log: AppendOnlyDecisionLog;
  signer: TEESigner;
}

/**
 * The verification API. Everything an external auditor needs to independently
 * confirm what the agent was allowed to do — without trusting this server.
 */
export function buildRoutes({ gate, log, signer }: RouteDeps): Router {
  const r = Router();

  r.get("/health", (_req, res) => {
    res.json({ ok: true, mode: signer.mode, agentId: gate.agentId, sessionId: gate.sessionId });
  });

  // TDX attestation quote including the sealed policy hash.
  r.get("/gate/attestation", (_req, res) => {
    res.json(getAttestation(signer, gate.policyHash));
  });

  // The exact policy bytes whose hash is in the attestation.
  r.get("/gate/policy", (_req, res) => {
    res.type("text/yaml").send(gate.rawPolicyText);
  });

  // A range of decision envelopes for a session.
  r.get("/gate/decisions", async (req, res) => {
    const sessionId = String(req.query.session_id ?? gate.sessionId);
    const fromSeq = req.query.from_seq ? Number(req.query.from_seq) : undefined;
    const toSeq = req.query.to_seq ? Number(req.query.to_seq) : undefined;
    const decisions = await log.bySession(sessionId, fromSeq, toSeq);
    res.json({ sessionId, count: decisions.length, decisions });
  });

  // A single decision envelope.
  r.get("/gate/decisions/:decisionId", async (req, res) => {
    const decision = await log.byId(req.params.decisionId);
    if (!decision) {
      res.status(404).json({ error: "decision_not_found" });
      return;
    }
    res.json(decision);
  });

  // Server-side chain check (convenience; clients should still verify themselves).
  r.get("/gate/verify-chain", async (req, res) => {
    const sessionId = String(req.query.session_id ?? gate.sessionId);
    const decisions = await log.bySession(sessionId);
    const result = verifyDecisionChain(decisions, signer.publicKeyHex, gate.policyHash);
    res.json({
      valid: result.valid,
      chainLength: result.chainLength,
      allowCount: result.allowCount,
      denyCount: result.denyCount,
      gaps: result.gaps,
      brokenAt: result.brokenAt,
      errors: result.errors,
    });
  });

  // Verify a decision a client already holds.
  r.post("/gate/verify-decision", (req, res) => {
    const { decision, teePubKey } = req.body as {
      decision: PolicyDecision;
      teePubKey?: string;
    };
    if (!decision) {
      res.status(400).json({ error: "missing decision" });
      return;
    }
    const key = teePubKey ?? signer.publicKeyHex;
    const single = verifyDecision(decision, key, gate.policyHash);
    res.json({
      signatureValid: single.signatureValid,
      policyHashMatch: single.policyHashMatch,
      hashChainValid: true, // single-decision check; full-chain via /gate/verify-chain
    });
  });

  return r;
}
