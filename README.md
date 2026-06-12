# Verified Tool Gating

**Verifiable, tamper-proof authorization for AI agents — a policy gate that runs inside an EigenCompute TEE and cryptographically proves what an agent was, and wasn't, allowed to do.**

AI agents execute whatever tool calls their model emits. If the model is prompt-injected, socially engineered, or simply hallucinates a dangerous call, the runtime obeys. Frameworks offer `before_tool_call` hooks — but those run in userspace on untrusted infrastructure. The operator can disable them, the framework can be patched to skip them, and there is **no cryptographic proof** that the policy ran or that a denied call was actually blocked.

Verified Tool Gating closes that gap. The policy engine runs **inside an Intel TDX enclave on EigenCompute**. The policy's hash is sealed into the attestation, so swapping the policy changes the attestation and every verifier notices. Every `ALLOW` and `DENY` is a signed, hash-chained envelope persisted **before** the tool runs (or before the error is raised). The operator cannot bypass the gate, the agent cannot suppress a denial, and anyone can independently re-verify the whole decision history without trusting the server.

---

## 🔴 Try it live

| | |
|---|---|
| **Dashboard** | **https://eigen-tool-gate.vercel.app** |
| **TEE attestation** | https://verify-sepolia.eigencloud.xyz/app/0x6f6FF0B640CD262d3120B91cEB146E97620272f9 |
| **Source** | https://github.com/zeeshan8281/eigen-tool-gate |

On the dashboard you can:
- **Run a real Claude agent** — type a prompt; the model decides which tools to call and you watch every call get ALLOWed or DENIED by the gate in real time.
- **Run canned scenarios** — legitimate work, a prompt injection, and a destructive-op-with-human-approval flow.
- **Verify the chain** — the dashboard (and the external verifier below) re-checks every signature and hash link against the attested TEE key.
- **Tamper test** — flip a past decision and watch verification fail.

It runs in a genuine enclave: the attestation reports `mode: tee` with a real KMS key fingerprint. The agent really searches the web (Tavily), really reads/writes files, and really queries the audit database — but can only do what the policy permits.

---

## The EigenCloud Agent Observability series

This is **Part 4 of a five-part series** on making AI-agent behavior verifiable on [EigenCompute](https://www.eigencloud.xyz/) (Intel TDX TEEs). Each part is **standalone** — they share a common verifiable-TEE design (secp256k1 signatures, hash-chained logs, attestation that binds code to data) rather than being one integrated system. Together they cover the layers at which you'd want to *prove*, not just *trust*, what an agent did.

| Part | Layer | What it proves |
|------|-------|----------------|
| 1 · Trace Mirror | Telemetry | **what the agent did** — signed OpenTelemetry spans |
| 2 · Multi-Agent Orchestration | Communication | **what agents said to each other** — signed step handoffs |
| 3 · Verifiable Memory | State | **what the agent remembers** — committed, Merkle-proven memory |
| **4 · Verified Tool Gating** *(this repo)* | **Authorization** | **what the agent was allowed to do** |
| 5 · Attested Inference | Computation | **which model actually ran** |

Parts 1–3 are **observational** — they prove what happened *after the fact*. Part 4 is the series' first **enforcement** primitive: it proves what the agent **could not** do, *before* it happened.

The parts share conventions so a single mental model and verifier toolchain spans them all — same curve and signature format, same append-only hash-chain pattern, same enclave-sealed-key + attestation story, same `eigen.*` telemetry namespace. They don't need to talk to each other at runtime; the coherence is by design.

---

## How it works

```
┌──────────────────────── EigenCompute TEE (Intel TDX) ─────────────────────────┐
│                                                                               │
│   real LLM agent ──tool call──▶  Policy Gate  ──ALLOW──▶  real tool runs       │
│   (Claude)                       (in-process)            (web/fs/db/http)      │
│                                       │ every call                             │
│                                       ▼                                        │
│                              signed PolicyDecision                             │
│                                       │                                        │
│                                       ▼                                        │
│                           append-only, hash-chained                           │
│                           decision log (PostgreSQL on the encrypted volume)    │
│                                                                               │
│   policy.yaml ──sha256──▶ TDX attestation measurement                          │
│   secp256k1 signing key (sealed to /data, never leaves the enclave)            │
└───────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼  external verifier (no trust in the server)
                   checks attestation + every signature + the hash chain
```

The gate is an **in-process interceptor**, not a sidecar: the agent runtime physically cannot dispatch a tool without passing through `gate.evaluate()`. For each call the gate:

1. matches the tool against the policy (first match wins, else **deny-by-default**);
2. evaluates the rule's constraints (path allow/block-lists, domains, HTTP methods, SQL-statement allowlists, file sizes, human-in-the-loop);
3. checks rate limits;
4. builds a `PolicyDecision`, **signs it** (secp256k1 over the canonical envelope), and **persists it to the hash-chained log before acting on the verdict** — so a DENY record exists before the error is raised, and an ALLOW record before the tool runs.

### The decision envelope

```ts
interface PolicyDecision {
  decisionId: string;        // UUIDv4
  toolName: string;
  toolArgsHash: string;      // sha256(canonical JSON args)
  policyHash: string;        // "sha256:..." of the sealed policy
  verdict: "ALLOW" | "DENY";
  reasonCode: string;        // PATH_VIOLATION, SQL_VIOLATION, HITL_REQUIRED, ...
  constraintDetails: string; // human-readable
  timestamp: number;
  sessionId: string;
  agentId: string;
  sequenceNumber: number;    // monotonic per session — gaps are detectable
  prevDecisionHash: string;  // hash chain to the previous decision
  signature: string;         // compact secp256k1 r‖s, hex
}
```

Crypto matches the rest of the series: **secp256k1**, compact 64-byte signatures, Ethereum-style key address, **RFC 8785** canonicalization so any independent implementation hashes identical bytes.

---

## The real agent and its tools

A real **Claude** model (via the Vercel AI SDK) is given the gated tool set; it decides what to call, and **every call is authorized by the gate before it runs**. On a DENY the model receives a structured denial and adapts. The tools are real — there are no money-moving tools, just consequential actions a gate should govern:

| Tool | What it really does | How the policy gates it |
|------|--------------------|--------------------------|
| `web_search` | live web search (Tavily) | rate-limited, blocked domains |
| `file_read` / `file_write` | real fs in a workspace sandbox | path allow/block-lists, size cap |
| `file_delete` | real file deletion (destructive) | **requires human-in-the-loop approval** |
| `http_request` | real outbound HTTP | method + domain allowlist, body size cap |
| `db_query` | **real SQL against the audit database** | `allowed_sql: [SELECT]` — `DROP`/`DELETE` are denied |
| `shell_exec` | real shell (present to be blocked) | explicitly **DENY** |

The `db_query` tool is a nice demonstration: the agent can read its *own* tamper-proof decision log (`SELECT verdict, count(*) FROM policy_decisions ...`) but is blocked from deleting it (`SQL_VIOLATION`).

---

## Policy format

Declarative YAML, loaded and hashed at boot. A non-cryptographer can read it.

```yaml
version: "1.0"
agent_id: "research-agent-prod"
defaults:
  verdict: DENY                       # deny-by-default: anything unlisted is blocked
rules:
  - tool: "web_search"
    verdict: ALLOW
    constraints:
      max_calls_per_minute: 30
      blocked_domains: ["*.onion", "*.xxx"]

  - tool: "file_write"
    verdict: ALLOW
    constraints:
      allowed_paths: ["/workspace/src/**", "/workspace/output/**"]
      blocked_paths: ["/etc/**", "/usr/**", "/bin/**"]
      max_file_size_bytes: 10485760

  - tool: "db_query"
    verdict: ALLOW
    constraints:
      allowed_sql: ["SELECT"]         # read-only: DROP / DELETE / UPDATE / INSERT denied
      max_rows: 100

  - tool: "file_delete"
    verdict: ALLOW
    constraints:
      allowed_paths: ["/workspace/output/**"]
      require_hitl: true              # destructive — always needs human approval

  - tool: "shell_exec"
    verdict: DENY                     # explicitly blocked

rate_limits:
  global_max_calls_per_minute: 100
```

See [`policies/demo-policy.yaml`](policies/demo-policy.yaml) and [`policies/strict-policy.yaml`](policies/strict-policy.yaml).

---

## Quickstart

```bash
npm install
npm test            # 16 unit tests: constraints, chain integrity, tamper + gap + concurrency
npm run demo        # three scenarios end-to-end, printed to the terminal
```

The demo runs in-memory (no Postgres needed) and prints:

- **Scenario A** — legitimate `web_search` + `file_write` + `db_query` → **ALLOW**
- **Scenario B** — prompt injection (`file_read /etc/passwd`, `shell_exec`, exfil POST, `DROP TABLE …`) → **DENY**, each persisted before the error
- **Scenario C** — a `file_delete` denied for `HITL_REQUIRED`, then **ALLOW**ed after human approval
- **Verification** — re-verifies every signature + hash link, then flips a `DENY`→`ALLOW` and shows the chain break

### Run the gate + dashboard + a real agent locally

```bash
# build the dashboard once
npm --prefix demo-ui install && npm --prefix demo-ui run build

# boot the gate (serves API + dashboard on :8080; in-memory log locally)
# put ANTHROPIC_API_KEY + TAVILY_API_KEY in .env to enable the live agent
node --env-file=.env --import tsx src/index.ts

# drive a real agent
curl -s -X POST localhost:8080/agent/run -H 'content-type: application/json' \
  -d '{"prompt":"Find EigenLayer'\''s TVL and save a summary to /workspace/output/tvl.md"}'

# independent audit over HTTP
npm run verify -- http://localhost:8080
```

---

## API

**Verification (auditor-facing, no trust required):**

| Endpoint | Returns |
|---|---|
| `GET /gate/attestation` | TDX attestation incl. `policyHash`, `teePublicKey`, `teeAddress`, `kmsKeyFingerprint`, `mode` |
| `GET /gate/policy` | the exact policy bytes whose hash is in the attestation |
| `GET /gate/decisions?session_id=…` | decision envelopes |
| `GET /gate/verify-chain?session_id=…` | `{ valid, chainLength, allowCount, denyCount, gaps, brokenAt, errors }` |
| `POST /gate/verify-decision` | `{ signatureValid, policyHashMatch, hashChainValid }` |

**Agent + demo (to drive the gate):**

| Endpoint | Does |
|---|---|
| `POST /agent/run` `{ prompt }` | runs a real Claude agent whose tool calls are all gated |
| `GET /agent/catalog` | model, tool list, example prompts |
| `POST /demo/scenario/:id` | run canned scenario `a` / `b` / `c` |
| `POST /demo/tamper-preview` | non-destructive: flip a decision, show verification fail |

Verification is **stateless and client-side** ([`src/crypto/verify.ts`](src/crypto/verify.ts)) — an auditor recomputes the signed digest, checks the secp256k1 signature against the attested key, re-links the hash chain, and looks for sequence/timestamp anomalies.

---

## Sealing the policy into the attestation

```bash
npm run seal -- --policy policies/demo-policy.yaml
# → Policy hash: sha256:0de78b83...   (pinned into the image as POLICY_HASH)
```

At build time the hash is baked into the image (`--build-arg POLICY_HASH=…`). The entrypoint **fails closed** if the policy on disk no longer matches the sealed hash, and the running gate serves both the policy bytes and the hash so a verifier can confirm `sha256(GET /gate/policy) == attestation.policyHash`.

---

## Deploy on EigenCompute

PostgreSQL is co-located in the image so the decision log lives on the enclave's encrypted `/data` volume and never leaves the TEE.

```bash
export REGISTRY=docker.io/youruser
./scripts/deploy.sh   # seals policy → builds linux/amd64 (gate + UI + Postgres) → pushes → ecloud deploy
```

Then confirm the live attestation reports `mode: tee` with a real KMS fingerprint, and that the served policy hashes to the attested value:

```bash
curl https://<app-ip>:8080/gate/attestation
```

Locally you can run the full TEE-shaped image with `docker compose up --build`.

---

## Threat model (summary)

| Threat | Mitigation |
|---|---|
| Prompt injection triggers an unauthorized call | Gate intercepts before dispatch; model output never reaches a tool without passing it |
| Operator disables the gate | Gate is compiled into the TEE image; removing it changes the image measurement → attestation |
| Operator swaps in a permissive policy | Policy hash is sealed into the attestation measurement |
| Agent suppresses a DENY record | DENY envelope is persisted **before** the error is raised, synchronously inside the gate |
| Drop / reorder / replay log entries | Monotonic `sequenceNumber` + `prevDecisionHash` chain; gaps and breaks are detectable |
| Parallel tool calls forking the chain | Decision creation is serialized by an in-gate mutex (covered by a concurrency test) |

**Not** protected against: a malicious goal achieved through individually-permitted calls (policy is per-call, not intent-aware), side-channel exfiltration via permitted calls, or a misconfigured (overly permissive) policy faithfully enforced. Model-level trust is Part 5's job (Attested Inference).

---

## Project layout

```
src/
  gate/        engine (signing + hash chain + mutex), parser, constraints, rate-limiter, seal CLI, types
  log/         append-only hash-chained log, Mem + Pg stores, schema.sql
  agent/       real Claude agent runner (every tool call gated)
  tools/       real tool implementations (web/fs/db/http)
  mcp/         transport interceptor + gated MCP server
  crypto/      secp256k1 signer (sealed key), RFC 8785 canonicalize, client verifier
  tee/         attestation (binds code + policy + key)
  api/         Express verification + agent + demo routes
  telemetry/   signed OTel spans (eigen.policy.* / eigen.sig.*)
  demo/        canned scenarios, adversarial cases, external verifier
demo-ui/       React + Vite dashboard (served by the gate on the same port)
policies/      demo + strict policies
```

## Tech stack

Node 20 · TypeScript · `@noble/curves` (secp256k1) · `@noble/hashes` · `canonicalize` (RFC 8785) · `js-yaml` · `minimatch` · `@modelcontextprotocol/sdk` · Vercel AI SDK + `@ai-sdk/anthropic` (Claude) · Tavily · `express` · PostgreSQL 16 · `@opentelemetry/api` · React + Vite · Intel TDX via EigenCompute.

---

*Part 4 of the EigenCloud Agent Observability series. Built by [@zeeshan8281](https://github.com/zeeshan8281).*
