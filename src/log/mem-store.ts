import type { PolicyDecision } from "../gate/types.js";
import type { DecisionStore, StoredDecision } from "./store.js";

/** In-memory decision store for local dev, tests, and the demo. */
export class MemStore implements DecisionStore {
  private rows: StoredDecision[] = [];
  private byUuid = new Map<string, StoredDecision>();

  async init(): Promise<void> {}

  async append(decision: PolicyDecision, entryHash: string): Promise<void> {
    const dup = this.rows.find(
      (r) => r.sessionId === decision.sessionId && r.sequenceNumber === decision.sequenceNumber,
    );
    if (dup) {
      throw new Error(
        `seq_unique violation: session ${decision.sessionId} seq ${decision.sequenceNumber} already exists`,
      );
    }
    const row: StoredDecision = { ...decision, entryHash };
    this.rows.push(row);
    this.byUuid.set(decision.decisionId, row);
  }

  async bySession(sessionId: string, fromSeq = 1, toSeq = Infinity): Promise<StoredDecision[]> {
    return this.rows
      .filter(
        (r) =>
          r.sessionId === sessionId &&
          r.sequenceNumber >= fromSeq &&
          r.sequenceNumber <= toSeq,
      )
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  async byId(decisionId: string): Promise<StoredDecision | null> {
    return this.byUuid.get(decisionId) ?? null;
  }

  async lastHash(sessionId: string): Promise<string> {
    const rows = await this.bySession(sessionId);
    return rows.length ? rows[rows.length - 1]!.entryHash : "GENESIS";
  }

  async lastSequence(sessionId: string): Promise<number> {
    const rows = await this.bySession(sessionId);
    return rows.length ? rows[rows.length - 1]!.sequenceNumber : 0;
  }

  async close(): Promise<void> {}
}
