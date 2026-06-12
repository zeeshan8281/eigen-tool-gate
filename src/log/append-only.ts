import { hashJSON } from "../crypto/canonicalize.js";
import type { PolicyDecision } from "../gate/types.js";
import { MemStore } from "./mem-store.js";
import { PgStore } from "./pg-store.js";
import type { DecisionStore, StoredDecision } from "./store.js";

/**
 * The append-only, hash-chained decision log.
 *
 * Each entry's `entry_hash` is the canonical SHA-256 of the full decision
 * (including its signature). The next decision pins this value as its
 * `prevDecisionHash`, so deleting or reordering any entry breaks verification at
 * the following entry. Combined with the monotonic per-session
 * `sequenceNumber`, gaps and tampering are detectable by any external verifier.
 */
export class AppendOnlyDecisionLog {
  private cachedLastHash = new Map<string, string>();

  private constructor(private store: DecisionStore) {}

  static async create(store: DecisionStore): Promise<AppendOnlyDecisionLog> {
    await store.init();
    return new AppendOnlyDecisionLog(store);
  }

  /** Build the store from the environment: PgStore if DATABASE_URL, else MemStore. */
  static async fromEnv(): Promise<AppendOnlyDecisionLog> {
    const url = process.env.DATABASE_URL;
    const store: DecisionStore = url ? new PgStore(url) : new MemStore();
    return AppendOnlyDecisionLog.create(store);
  }

  /** Entry hash a new decision should chain from, for a session. */
  async getLastHash(sessionId: string): Promise<string> {
    if (this.cachedLastHash.has(sessionId)) return this.cachedLastHash.get(sessionId)!;
    const h = await this.store.lastHash(sessionId);
    this.cachedLastHash.set(sessionId, h);
    return h;
  }

  async getLastSequence(sessionId: string): Promise<number> {
    return this.store.lastSequence(sessionId);
  }

  /**
   * Compute the entry hash and durably append. Returns the entry hash so the
   * caller can advance its chain pointer. This MUST complete before a DENY's
   * error is raised or an ALLOW's tool executes — that ordering is the whole
   * guarantee.
   */
  async append(decision: PolicyDecision): Promise<string> {
    const entryHash = "sha256:" + hashJSON(decision);
    await this.store.append(decision, entryHash);
    this.cachedLastHash.set(decision.sessionId, entryHash);
    return entryHash;
  }

  bySession(sessionId: string, fromSeq?: number, toSeq?: number): Promise<StoredDecision[]> {
    return this.store.bySession(sessionId, fromSeq, toSeq);
  }

  byId(decisionId: string): Promise<StoredDecision | null> {
    return this.store.byId(decisionId);
  }

  close(): Promise<void> {
    return this.store.close();
  }
}

export { MemStore, PgStore };
export type { DecisionStore, StoredDecision };
