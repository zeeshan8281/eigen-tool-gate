import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { PolicyDecision } from "../gate/types.js";
import type { DecisionStore, StoredDecision } from "./store.js";

const { Pool } = pg;
const SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), "schema.sql");

/** PostgreSQL-backed decision store (production, inside the TEE). */
export class PgStore implements DecisionStore {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 5 });
  }

  async init(): Promise<void> {
    const schema = readFileSync(SCHEMA_PATH, "utf-8");
    await this.pool.query(schema);
  }

  async append(decision: PolicyDecision, entryHash: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO policy_decisions (
        decision_id, tool_name, tool_args_hash, policy_hash,
        verdict, reason_code, constraint_details, timestamp_ms,
        session_id, agent_id, sequence_number, prev_decision_hash,
        entry_hash, signature
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        decision.decisionId,
        decision.toolName,
        decision.toolArgsHash,
        decision.policyHash,
        decision.verdict,
        decision.reasonCode,
        decision.constraintDetails,
        decision.timestamp,
        decision.sessionId,
        decision.agentId,
        decision.sequenceNumber,
        decision.prevDecisionHash,
        entryHash,
        decision.signature,
      ],
    );
  }

  async bySession(sessionId: string, fromSeq = 1, toSeq?: number): Promise<StoredDecision[]> {
    const res = await this.pool.query(
      `SELECT * FROM policy_decisions
       WHERE session_id = $1 AND sequence_number >= $2 AND sequence_number <= $3
       ORDER BY sequence_number ASC`,
      [sessionId, fromSeq, toSeq ?? Number.MAX_SAFE_INTEGER],
    );
    return res.rows.map(rowToDecision);
  }

  async byId(decisionId: string): Promise<StoredDecision | null> {
    const res = await this.pool.query(
      `SELECT * FROM policy_decisions WHERE decision_id = $1`,
      [decisionId],
    );
    return res.rows[0] ? rowToDecision(res.rows[0]) : null;
  }

  async lastHash(sessionId: string): Promise<string> {
    const res = await this.pool.query(
      `SELECT entry_hash FROM policy_decisions
       WHERE session_id = $1 ORDER BY sequence_number DESC LIMIT 1`,
      [sessionId],
    );
    return res.rows[0]?.entry_hash ?? "GENESIS";
  }

  async lastSequence(sessionId: string): Promise<number> {
    const res = await this.pool.query(
      `SELECT sequence_number FROM policy_decisions
       WHERE session_id = $1 ORDER BY sequence_number DESC LIMIT 1`,
      [sessionId],
    );
    return res.rows[0] ? Number(res.rows[0].sequence_number) : 0;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function rowToDecision(r: Record<string, unknown>): StoredDecision {
  return {
    decisionId: String(r.decision_id),
    toolName: String(r.tool_name),
    toolArgsHash: String(r.tool_args_hash),
    policyHash: String(r.policy_hash),
    verdict: r.verdict as "ALLOW" | "DENY",
    reasonCode: String(r.reason_code),
    constraintDetails: String(r.constraint_details),
    timestamp: Number(r.timestamp_ms),
    sessionId: String(r.session_id),
    agentId: String(r.agent_id),
    sequenceNumber: Number(r.sequence_number),
    prevDecisionHash: String(r.prev_decision_hash),
    signature: String(r.signature),
    entryHash: String(r.entry_hash),
  };
}
