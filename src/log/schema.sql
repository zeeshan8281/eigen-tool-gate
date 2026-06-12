-- Append-only, hash-chained log of every policy decision.
-- Runs on the PostgreSQL instance co-located inside the TEE's encrypted volume.

CREATE TABLE IF NOT EXISTS policy_decisions (
  decision_id        UUID PRIMARY KEY,
  tool_name          TEXT NOT NULL,
  tool_args_hash     TEXT NOT NULL,
  policy_hash        TEXT NOT NULL,
  verdict            TEXT NOT NULL CHECK (verdict IN ('ALLOW', 'DENY')),
  reason_code        TEXT NOT NULL,
  constraint_details TEXT NOT NULL DEFAULT '',
  timestamp_ms       BIGINT NOT NULL,
  session_id         TEXT NOT NULL,
  agent_id           TEXT NOT NULL,
  sequence_number    BIGINT NOT NULL,
  prev_decision_hash TEXT NOT NULL,
  entry_hash         TEXT NOT NULL,
  signature          TEXT NOT NULL,

  CONSTRAINT seq_unique UNIQUE (session_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_decisions_session ON policy_decisions(session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_decisions_verdict ON policy_decisions(verdict);
CREATE INDEX IF NOT EXISTS idx_decisions_tool    ON policy_decisions(tool_name);
