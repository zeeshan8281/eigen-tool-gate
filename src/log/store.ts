import type { PolicyDecision } from "../gate/types.js";

/**
 * Persistence strategy for the decision log. Two implementations:
 *   - MemStore: in-process, zero-dependency (local dev, tests, demo)
 *   - PgStore:  PostgreSQL co-located in the TEE (production)
 *
 * The hash chain itself lives in AppendOnlyDecisionLog; a Store only has to
 * durably append rows and read them back in order.
 */
export interface DecisionStore {
  init(): Promise<void>;
  append(decision: PolicyDecision, entryHash: string): Promise<void>;
  /** All decisions for a session, ordered by sequence_number ascending. */
  bySession(sessionId: string, fromSeq?: number, toSeq?: number): Promise<StoredDecision[]>;
  byId(decisionId: string): Promise<StoredDecision | null>;
  /** The entry_hash of the highest sequence_number for a session, or "GENESIS". */
  lastHash(sessionId: string): Promise<string>;
  lastSequence(sessionId: string): Promise<number>;
  close(): Promise<void>;
}

export interface StoredDecision extends PolicyDecision {
  entryHash: string;
}
