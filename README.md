# Verified Tool Gating

**Part 4 of the EigenCloud Agent Observability series — verifiable pre-action policy enforcement inside an EigenCompute TEE.**

AI agents execute whatever tool calls the model emits. If the model is prompt-injected, socially engineered, or simply hallucinates a dangerous call, the runtime obeys. Existing frameworks offer `before_tool_call` hooks — but those run in userspace on untrusted infrastructure. The operator can disable them, the framework can be patched to skip them, and there is **no cryptographic proof** that the policy ran or that a denied call was actually blocked.

Verified Tool Gating closes that gap. The policy engine runs **inside an Intel TDX enclave on EigenCompute**. The policy's hash is sealed into the attestation measurement, so swapping the policy changes the attestation and every verifier notices. Every `ALLOW` and `DENY` is a signed, hash-chained envelope persisted **before** the tool runs (or before the error is raised). The operator cannot bypass the gate, and the agent cannot suppress a denial.

> Where it fits: Parts 1–3 are *observational* (they prove what happened). Part 4 is the series' first *enforcement* primitive — it proves what the agent **could not** do.

---

## How it works

```
┌──────────────────────── EigenCompute TEE (Intel TDX) ─────────────────────────┐
│                                                                               │
│   agent ──tools/call──▶  Policy Gate  ──ALLOW──▶  tool dispatcher             │
│                          (in-process)                                          │
│                              │ every call                                      │
│                              ▼                                                 │
│                     signed PolicyDecision                                      │
│                              │                                                 │
│                              ▼                                                 │
│                  append-only, hash-chained                                     │
│                  decision log (PostgreSQL)                                     │
│                                                                               │
│   policy.yaml ──sha256──▶ TDX attestation measurement                          │
│   secp256k1 signing key (sealed to /data)                                       │
└───────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼  external verifier
                   checks attestation + every signature + the hash chain
```

The gate is an **in-process interceptor**, not a sidecar: the agent runtime physically cannot dispatch a tool without passing through `gate.evaluate()`. For each call the gate:

1. matches the tool against the policy (first match wins, else **deny-by-default**),
2. evaluates the rule's constraints (paths, domains, methods, amounts, recipients, sizes, HITL),
3. checks rate limits and spending caps,
4. builds a `PolicyDecision`, signs it (secp256k1 over the canonical envelope), and **persists it to the hash-chained log before acting on the verdict.**

### The decision envelope

```ts
interface PolicyDecision {
  decisionId: string;        // UUIDv4
  toolName: string;
  toolArgsHash: string;      // sha256(canonical JSON args)
  policyHash: string;        // "sha256:..." of the sealed policy
  verdict: "ALLOW" | "DENY";
  reasonCode: string;        // PATH_VIOLATION, RATE_LIMIT, HITL_REQUIRED, ...
  constraintDetails: string; // human-readable
  timestamp: number;
  sessionId: string;
  agentId: string;
  sequenceNumber: number;    // monotonic per session — gaps are detectable
  prevDecisionHash: string;  // hash chain to the previous decision
  signature: string;         // compact secp256k1 r‖s, hex
}
```

Crypto matches the rest of the series (Parts 1 & 3): **secp256k1**, compact 64-byte signatures, Ethereum-style key address, **RFC 8785** canonicalization so any independent implementation hashes identical bytes.

---

## Policy format

Declarative YAML, loaded and hashed at boot. A non-cryptographer can read it.

```yaml
version: "1.0"
agent_id: "research-agent-prod"
defaults:
  verdict: DENY                       # deny-by-default
rules:
  - tool: "file_read"
    verdict: ALLOW
    constraints:
      allowed_paths: ["/workspace/**"]
      blocked_paths: ["/etc/**", "/usr/**", "/bin/**"]
  - tool: "shell_exec"
    verdict: DENY                      # explicitly blocked
  - tool: "wallet_transfer"
    verdict: ALLOW
    constraints:
      max_amount_per_tx: 100           # USDC
      allowed_recipients: ["0xABC...", "0xDEF..."]
      require_hitl_above: 50           # human-in-the-loop above $50
spending_limits: { currency: "USDC", per_session: 1000, per_day: 5000 }
rate_limits:     { global_max_calls_per_minute: 100 }
```

See [`policies/demo-policy.yaml`](policies/demo-policy.yaml) and [`policies/strict-policy.yaml`](policies/strict-policy.yaml).

---

## Quickstart

```bash
npm install
npm test            # 15 unit tests: constraints, chain integrity, tamper + gap detection
npm run demo        # three scenarios end-to-end (below)
```

The demo runs entirely in-memory (no Postgres needed) and prints:

- **Scenario A** — legitimate `web_search` + `file_write` → **ALLOW**
- **Scenario B** — prompt injection (`file_read /etc/passwd`, shell exec, exfil POST, …) → **DENY**, each persisted before the error
- **Scenario C** — a 75 USDC transfer denied for `HITL_REQUIRED`, then **ALLOW**ed after human approval
- **Verification** — re-verifies every signature + hash link, then flips a `DENY`→`ALLOW` and shows the chain break

### Run the HTTP gate + external verifier

```bash
# terminal 1 — boot the gate (in-memory log locally; PostgreSQL inside the TEE)
PORT=8080 npm run dev

# terminal 2 — independent audit over HTTP
npm run verify -- http://localhost:8080
```

---

## Verification API

| Endpoint | Returns |
|---|---|
| `GET /gate/attestation` | TDX attestation incl. `policyHash`, `teePublicKey`, `teeAddress`, `imageDigest` |
| `GET /gate/policy` | the exact policy bytes whose hash is in the attestation |
| `GET /gate/decisions?session_id=…&from_seq=…&to_seq=…` | decision envelopes |
| `GET /gate/decisions/:decisionId` | a single envelope |
| `GET /gate/verify-chain?session_id=…` | `{ valid, chainLength, allowCount, denyCount, gaps, brokenAt, errors }` |
| `POST /gate/verify-decision` | `{ signatureValid, policyHashMatch, hashChainValid }` |

Verification is **stateless and client-side** ([`src/crypto/verify.ts`](src/crypto/verify.ts)) — an auditor recomputes the signed digest, checks the secp256k1 signature against the attested key, re-links the hash chain, and looks for sequence/timestamp anomalies. No trust in this server required.

---

## Sealing the policy into the attestation

```bash
# canonicalize + validate + hash a policy
npm run seal -- --policy policies/demo-policy.yaml
# → Policy hash: sha256:5ae79d9a...   (pin this as POLICY_HASH)
```

At build time the hash is baked into the image (`--build-arg POLICY_HASH=…`). The entrypoint **fails closed** if the policy on disk no longer matches the sealed hash, and the running gate serves both the policy bytes and the hash so a verifier can confirm `sha256(GET /gate/policy) == attestation.policyHash`.

---

## Deploy on EigenCompute

PostgreSQL is co-located in the image so the decision log lives on the enclave's encrypted `/data` volume and never leaves the TEE.

```bash
export REGISTRY=docker.io/youruser
./scripts/deploy.sh           # seals policy → builds linux/amd64 → pushes → ecloud deploy
```

`scripts/deploy.sh` runs:

```bash
ecloud compute app deploy \
  --name eigen-tool-gate \
  --image-ref "$REGISTRY/eigen-tool-gate:latest" \
  --env-file .env \
  --instance-type g1-standard-4t \
  --log-visibility public \
  --resource-usage-monitoring enable --force
```

Then confirm the live attestation:

```bash
curl https://<app-domain>/gate/attestation   # policyHash must equal the sealed hash
```

Locally you can run the full TEE-shaped image (gate + Postgres) with `docker compose up --build`.

---

## Series integration

- **Part 1 (Trace Mirror)** — every decision emits a signed OTel span (`eigen.policy.*`, `eigen.sig.*`) that the in-TEE collector signs into the telemetry chain. See [`src/telemetry/spans.ts`](src/telemetry/spans.ts).
- **Part 2 (Multi-Agent Orchestration)** — a step's `PolicyDecision[]` can be attached to its `StepEnvelope`, so a receiving agent verifies the prior agent operated under a known policy.
- **Part 3 (Verifiable Memory)** — rate-limit and spending counters are serializable (`gate.stateSnapshot()` / `restoreSpend()`) for commitment to verifiable memory, defeating the "restart the TEE to reset the spending counter" attack.

---

## Threat model (summary)

| Threat | Mitigation |
|---|---|
| Prompt injection triggers an unauthorized call | Gate intercepts at the transport layer; model output never reaches the dispatcher without passing it |
| Operator disables the gate | Gate is compiled into the TEE image; removing it changes the image digest → attestation |
| Operator swaps in a permissive policy | Policy hash is sealed to the attestation measurement |
| Agent suppresses a DENY record | DENY envelope is persisted **before** the error is raised, synchronously inside the gate |
| Drop/reorder/replay log entries | Monotonic `sequenceNumber` + `prevDecisionHash` chain; gaps and breaks are detectable |
| Restart to reset rate/spend counters | Counters restored from verifiable memory on boot (Part 3) |

**Not** protected against: a malicious goal achieved through individually-permitted calls (policy is per-call, not intent-aware), side-channel exfiltration via permitted calls, or a misconfigured (overly permissive) policy faithfully enforced. Part 5 (Attested Inference) addresses model-level trust.

---

## Project layout

```
src/
  gate/        engine, parser, constraints, rate-limiter, spending, seal CLI, types
  log/         append-only hash-chained log, Mem + Pg stores, schema.sql
  mcp/         transport interceptor + gated MCP server
  crypto/      secp256k1 signer (sealed key), RFC 8785 canonicalize, client verifier
  tee/         attestation (binds code + policy + key)
  api/         Express verification API
  telemetry/   signed OTel spans (Part 1)
  demo/        agent (3 scenarios), adversarial cases, external verifier
policies/      demo + strict policies
```

## Tech stack

Node 20 · TypeScript · `@noble/curves` (secp256k1) · `@noble/hashes` · `canonicalize` (RFC 8785) · `js-yaml` · `minimatch` · `@modelcontextprotocol/sdk` · `express` · PostgreSQL 16 · `@opentelemetry/api` · Intel TDX via EigenCompute.
