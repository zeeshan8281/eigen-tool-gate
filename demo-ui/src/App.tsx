import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import eigenIcon from "./assets/brand/eigen-icon.svg";
import type {
  AgentCatalog,
  AgentRunResponse,
  Attestation,
  Catalog,
  PolicyDecision,
  TamperPreview,
  VerifyChainResponse,
} from "./types";
import { Card, CopyButton, Panel, truncMid, VerdictChip } from "./ui";

const POLL_MS = 2500;

export default function App() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [attest, setAttest] = useState<Attestation | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [agentCatalog, setAgentCatalog] = useState<AgentCatalog | null>(null);
  const [policy, setPolicy] = useState<string>("");
  const [decisions, setDecisions] = useState<PolicyDecision[]>([]);
  const [chain, setChain] = useState<VerifyChainResponse | null>(null);
  const [tamper, setTamper] = useState<TamperPreview | null>(null);

  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [tampering, setTampering] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  // ---- bootstrap: session + static config -------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const h = await api.health();
        if (cancelled) return;
        setSessionId(h.sessionId);
        setOnline(true);
      } catch {
        if (!cancelled) setOnline(false);
      }
      // best-effort static fetches (independent)
      api.attestation().then((a) => !cancelled && setAttest(a)).catch(() => {});
      api.catalog().then((c) => !cancelled && setCatalog(c)).catch(() => {});
      api
        .agentCatalog()
        .then((c) => !cancelled && setAgentCatalog(c))
        .catch(() => {});
      api.policy().then((p) => !cancelled && setPolicy(p)).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- polling: decisions + verify-chain --------------------------------
  const refresh = useCallback(async (sid: string) => {
    try {
      const [d, c] = await Promise.all([
        api.decisions(sid),
        api.verifyChain(sid),
      ]);
      setDecisions(d.decisions ?? []);
      setChain(c);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let stop = false;
    const tick = () => !stop && refresh(sessionId);
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [sessionId, refresh]);

  // ---- actions ----------------------------------------------------------
  const runScenario = async (id: "a" | "b" | "c") => {
    if (runningScenario) return;
    setRunningScenario(id);
    setTamper(null);
    try {
      await api.runScenario(id);
    } catch {
      /* surfaced via offline state */
    } finally {
      if (sessionId) await refresh(sessionId);
      setRunningScenario(null);
    }
  };

  const reverify = async () => {
    if (!sessionId) return;
    setVerifying(true);
    try {
      const c = await api.verifyChain(sessionId);
      setChain(c);
      setOnline(true);
    } catch {
      setOnline(false);
    } finally {
      setVerifying(false);
    }
  };

  const simulateTamper = async () => {
    setTampering(true);
    try {
      const t = await api.tamperPreview();
      setTamper(t);
    } catch {
      /* ignore */
    } finally {
      setTampering(false);
    }
  };

  const attestUrl = useMemo(() => {
    if (attest?.verifyUrl && attest?.eigenComputeDeploymentId) {
      return `${attest.verifyUrl.replace(/\/$/, "")}/app/${attest.eigenComputeDeploymentId}`;
    }
    return null;
  }, [attest]);

  const teeMode = attest?.mode === "tee";

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1180px] px-5 pb-20 pt-6 sm:px-8">
      <Header
        teeMode={teeMode}
        hasAttest={!!attest}
        online={online}
      />

      <main className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-5">
          <AttestationPanel attest={attest} attestUrl={attestUrl} />

          <LiveAgentPanel
            catalog={agentCatalog}
            onAfterRun={() => sessionId && refresh(sessionId)}
          />

          <ScenarioPanel
            catalog={catalog}
            running={runningScenario}
            onRun={runScenario}
          />

          <DecisionFeed decisions={decisions} online={online} />
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-5">
          <VerificationPanel
            chain={chain}
            verifying={verifying}
            onReverify={reverify}
          />

          <TamperPanel
            tamper={tamper}
            tampering={tampering}
            onSimulate={simulateTamper}
          />

          <PolicyViewer
            policy={policy}
            open={policyOpen}
            onToggle={() => setPolicyOpen((v) => !v)}
            policyHash={attest?.policyHash}
          />
        </div>
      </main>

      <footer className="mt-10 border-t border-white/10 pt-5 text-[11px] text-ink-dim">
        Verified Tool Gating · EigenCompute TEE policy gate · every decision is
        hash-chained and signed inside the enclave.
      </footer>
    </div>
  );
}

/* ===================================================================== */
/* Header                                                                */
/* ===================================================================== */
function Header({
  teeMode,
  hasAttest,
  online,
}: {
  teeMode: boolean;
  hasAttest: boolean;
  online: boolean | null;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3.5">
        <div className="flex h-11 w-11 items-center justify-center rounded border border-white/10 bg-gradient-to-br from-eigen-indigo to-eigen-indigo-2 text-eigen-accent-soft shadow-[0_0_30px_-8px_rgba(99,102,241,0.6)]">
          <img src={eigenIcon} alt="Eigen" className="h-5 w-5 text-eigen-accent-soft" />
        </div>
        <div>
          <h1 className="text-[19px] font-semibold leading-tight tracking-tight text-ink">
            Verified Tool Gating
          </h1>
          <p className="text-[12px] text-ink-soft">
            Part 4 · Verifiable pre-action policy enforcement inside an
            EigenCompute TEE
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <ConnDot online={online} />
        {hasAttest ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
              teeMode
                ? "border-pass/40 bg-pass/10 text-pass"
                : "border-warn/40 bg-warn/10 text-warn"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${teeMode ? "bg-pass" : "bg-warn"}`}
            />
            {teeMode ? "TEE" : "DEV"}
          </span>
        ) : (
          <span className="rounded border border-white/10 px-2.5 py-1 text-[11px] text-ink-dim shimmer">
            …
          </span>
        )}
      </div>
    </header>
  );
}

function ConnDot({ online }: { online: boolean | null }) {
  if (online === null)
    return <span className="text-[11px] text-ink-dim">connecting…</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-dim">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          online ? "bg-pass live-dot" : "bg-deny"
        }`}
      />
      {online ? "live" : "reconnecting…"}
    </span>
  );
}

/* ===================================================================== */
/* Attestation                                                           */
/* ===================================================================== */
function AttestationPanel({
  attest,
  attestUrl,
}: {
  attest: Attestation | null;
  attestUrl: string | null;
}) {
  return (
    <Panel
      title="Attestation"
      desc="Cryptographic identity of the enclave enforcing the policy."
      right={
        attestUrl ? (
          <a
            href={attestUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded border border-eigen-accent/40 bg-eigen-accent/10 px-2.5 py-1 text-[11px] font-medium text-eigen-accent-soft transition hover:bg-eigen-accent/20"
          >
            View attestation ↗
          </a>
        ) : undefined
      }
    >
      {!attest ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[58px] rounded border border-white/10 bg-surface-2/60 shimmer"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Card label="TEE address">
            <span className="font-mono text-[12px]">
              {truncMid(attest.teeAddress, 10, 8)}
            </span>
          </Card>
          <Card label="Policy hash">
            <span className="inline-flex items-center font-mono text-[12px]">
              {truncMid(attest.policyHash, 8, 6)}
              <CopyButton value={attest.policyHash} />
            </span>
          </Card>
          <Card label="Image digest">
            <span className="inline-flex items-center font-mono text-[12px]">
              {truncMid(attest.imageDigest, 8, 6)}
              <CopyButton value={attest.imageDigest} />
            </span>
          </Card>
          <Card label="App ID">
            <span className="font-mono text-[12px]">
              {truncMid(attest.eigenComputeDeploymentId, 8, 6)}
            </span>
          </Card>
          <Card label="KMS fingerprint">
            <span className="font-mono text-[12px]">
              {truncMid(attest.kmsKeyFingerprint, 8, 6)}
            </span>
          </Card>
          <Card label="Platform">
            <span className="text-[12px]">{attest.platform ?? "—"}</span>
          </Card>
        </div>
      )}
    </Panel>
  );
}

/* ===================================================================== */
/* Live Agent                                                            */
/* ===================================================================== */
function LiveAgentPanel({
  catalog,
  onAfterRun,
}: {
  catalog: AgentCatalog | null;
  onAfterRun: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [filled, setFilled] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill the prompt with the first example once the catalog loads.
  useEffect(() => {
    if (!filled && catalog?.examples?.length) {
      setPrompt(catalog.examples[0]);
      setFilled(true);
    }
  }, [catalog, filled]);

  const llmReady = catalog?.llmConfigured === true;
  const canRun = llmReady && !running && prompt.trim().length > 0;

  const run = async () => {
    if (!canRun) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.agentRun(prompt.trim());
      setResult(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg.includes("503")
          ? "Agent unavailable (503) — the LLM may not be configured."
          : `Agent run failed — ${msg}`,
      );
    } finally {
      setRunning(false);
      // The agent's tool calls landed as new signed decisions in the same
      // chain — refresh the live feed + verification panel.
      onAfterRun();
    }
  };

  return (
    <Panel
      title="Run a real agent"
      desc="A real Claude model decides which tools to call. Every call is authorized by the policy gate before it runs."
      right={
        catalog?.model ? (
          <span className="shrink-0 rounded-sm border border-eigen-accent/30 bg-eigen-accent/10 px-2 py-0.5 font-mono text-[10px] text-eigen-accent-soft">
            {catalog.model}
          </span>
        ) : undefined
      }
    >
      {/* example chips */}
      {!!catalog?.examples?.length && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {catalog.examples.map((ex, i) => (
            <button
              key={i}
              type="button"
              disabled={running}
              onClick={() => setPrompt(ex)}
              className="max-w-full truncate rounded-sm border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-ink-soft transition hover:border-eigen-accent/50 hover:text-eigen-accent-soft disabled:cursor-wait disabled:opacity-60"
              title={ex}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={running}
        rows={3}
        placeholder="Ask the agent to do something…"
        className="w-full resize-y rounded border border-white/10 bg-black/40 px-3 py-2.5 font-sans text-[13px] text-ink outline-none transition placeholder:text-ink-dim focus:border-eigen-accent/60 disabled:opacity-60"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          onClick={run}
          disabled={!canRun}
          className="inline-flex items-center gap-2 rounded border border-eigen-accent/50 bg-eigen-accent/15 px-4 py-2 text-[13px] font-semibold text-eigen-accent-soft transition hover:bg-eigen-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-[2px] border-eigen-accent-soft/40 border-t-eigen-accent-soft" />
          )}
          {running ? "Running agent… (up to 60s)" : "Run agent"}
        </button>

        {!llmReady && catalog && (
          <span className="text-[11px] text-ink-dim">
            LLM not configured in this deployment
          </span>
        )}
      </div>

      {error && (
        <div className="row-in mt-3 rounded border border-deny/50 bg-deny/10 px-3 py-2 text-[12px] text-deny">
          {error}
        </div>
      )}

      {result && (
        <div className="row-in mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-soft">
            <span className="rounded-sm border border-white/10 bg-surface-2/60 px-2 py-0.5 font-mono">
              {result.model}
            </span>
            <span className="rounded-sm border border-white/10 bg-surface-2/60 px-2 py-0.5 font-mono">
              {result.stepCount} step{result.stepCount === 1 ? "" : "s"}
            </span>
            <span className="font-mono">
              {result.toolCalls.length} tool call
              {result.toolCalls.length === 1 ? "" : "s"}
            </span>
          </div>

          {result.toolCalls.length > 0 && (
            <div className="space-y-1.5">
              {result.toolCalls.map((c, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded border border-white/10 bg-surface-2/50 px-2.5 py-2"
                >
                  <VerdictChip verdict={c.verdict} />
                  <span className="font-mono text-[12px] text-ink">
                    {c.tool}
                  </span>
                  {c.verdict === "DENY" && c.reasonCode && (
                    <span className="rounded-sm bg-deny/15 px-1.5 py-0.5 font-mono text-[10px] text-deny">
                      {c.reasonCode}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-dim">
              Agent answer
            </div>
            <div className="whitespace-pre-wrap rounded border border-white/10 bg-black/40 px-3.5 py-3 text-[13px] leading-relaxed text-ink">
              {result.finalText || "—"}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ===================================================================== */
/* Scenario runner                                                       */
/* ===================================================================== */
const SCENARIO_META: Record<
  string,
  { tag: string; accent: string }
> = {
  a: { tag: "A", accent: "from-pass/20 to-pass/5 border-pass/30" },
  b: { tag: "B", accent: "from-deny/20 to-deny/5 border-deny/30" },
  c: { tag: "C", accent: "from-eigen-accent/20 to-eigen-accent/5 border-eigen-accent/30" },
};

function ScenarioPanel({
  catalog,
  running,
  onRun,
}: {
  catalog: Catalog | null;
  running: string | null;
  onRun: (id: "a" | "b" | "c") => void;
}) {
  const scenarios = catalog?.scenarios ?? [
    { id: "a", title: "Legitimate research", verdictHint: "ALLOW" },
    { id: "b", title: "Prompt injection", verdictHint: "DENY" },
    { id: "c", title: "Spending + HITL", verdictHint: "MIXED" },
  ];

  return (
    <Panel
      title="Scenario runner"
      desc="Drive the agent through a pre-built sequence; each tool call is gated, signed, and chained."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {scenarios.slice(0, 3).map((s) => {
          const meta = SCENARIO_META[s.id] ?? SCENARIO_META.a;
          const busy = running === s.id;
          const disabled = !!running;
          return (
            <button
              key={s.id}
              onClick={() => onRun(s.id as "a" | "b" | "c")}
              disabled={disabled}
              className={`group relative overflow-hidden rounded border bg-gradient-to-br ${meta.accent} p-3.5 text-left transition disabled:opacity-60 ${
                disabled ? "cursor-wait" : "hover:brightness-125"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex h-6 w-6 items-center justify-center rounded-sm border border-white/15 bg-black/30 font-mono text-[12px] font-semibold text-ink">
                  {meta.tag}
                </span>
                {s.verdictHint && (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-ink-soft">
                    {s.verdictHint}
                  </span>
                )}
              </div>
              <div className="mt-3 text-[13px] font-medium leading-snug text-ink">
                {s.title}
              </div>
              <div className="mt-2 text-[11px] text-ink-soft">
                {busy ? "running…" : "run scenario →"}
              </div>
              {busy && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-eigen-accent-soft/70 shimmer" />
              )}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

/* ===================================================================== */
/* Live decision feed                                                    */
/* ===================================================================== */
function DecisionFeed({
  decisions,
  online,
}: {
  decisions: PolicyDecision[];
  online: boolean | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(0);

  const ordered = useMemo(
    () => [...decisions].sort((a, b) => a.sequenceNumber - b.sequenceNumber),
    [decisions],
  );

  useEffect(() => {
    if (ordered.length > prevLen.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevLen.current = ordered.length;
  }, [ordered.length]);

  return (
    <Panel
      title="Live decision feed"
      desc="Signed, hash-chained policy decisions — newest at the bottom."
      right={
        <span className="rounded-sm border border-white/10 px-2 py-0.5 font-mono text-[11px] text-ink-soft">
          {ordered.length} decisions
        </span>
      }
    >
      <div
        ref={scrollRef}
        className="max-h-[360px] min-h-[140px] space-y-1.5 overflow-y-auto pr-1"
      >
        {ordered.length === 0 ? (
          <div className="flex h-[140px] items-center justify-center text-[12px] text-ink-dim">
            {online === false
              ? "connecting…"
              : "No decisions yet — run a scenario above."}
          </div>
        ) : (
          ordered.map((d) => <DecisionRow key={d.decisionId} d={d} />)
        )}
      </div>
    </Panel>
  );
}

function DecisionRow({ d }: { d: PolicyDecision }) {
  return (
    <div className="row-in flex items-start gap-2.5 rounded border border-white/10 bg-surface-2/50 px-2.5 py-2 transition hover:border-white/20">
      <span className="mt-0.5 w-7 shrink-0 text-right font-mono text-[11px] text-ink-dim">
        #{d.sequenceNumber}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <VerdictChip verdict={d.verdict} />
          <span className="truncate font-mono text-[12px] text-ink">
            {d.toolName}
          </span>
          {d.reasonCode && (
            <span className="rounded-sm bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">
              {d.reasonCode}
            </span>
          )}
        </div>
        {d.constraintDetails && (
          <div className="mt-1 truncate text-[11px] text-ink-dim">
            {d.constraintDetails}
          </div>
        )}
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-[10px] text-pass">🔒 signed</span>
          <span className="font-mono text-[10px] text-ink-dim">
            {truncMid(d.signature, 10, 8)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ===================================================================== */
/* Verification                                                          */
/* ===================================================================== */
function VerificationPanel({
  chain,
  verifying,
  onReverify,
}: {
  chain: VerifyChainResponse | null;
  verifying: boolean;
  onReverify: () => void;
}) {
  const valid = chain?.valid === true;
  const has = !!chain;

  return (
    <Panel
      title="Chain verification"
      desc="Re-checks every signature and prevHash link across the session."
      right={
        <button
          onClick={onReverify}
          disabled={verifying}
          className="shrink-0 rounded border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-ink transition hover:border-eigen-accent/50 hover:text-eigen-accent-soft disabled:cursor-wait disabled:opacity-60"
        >
          {verifying ? "verifying…" : "Re-verify"}
        </button>
      }
    >
      <div
        className={`rounded border p-4 text-center ${
          !has
            ? "border-white/10 bg-surface-2/60"
            : valid
              ? "border-pass/40 bg-pass/10"
              : "border-deny/50 bg-deny/10"
        }`}
      >
        <div
          className={`text-[22px] font-bold tracking-tight ${
            !has ? "text-ink-dim" : valid ? "text-pass" : "text-deny"
          }`}
        >
          {!has ? "—" : valid ? "CHAIN VALID ✓" : "BROKEN ✗"}
        </div>
        <div className="mt-1 text-[11px] text-ink-soft">
          {!has
            ? "awaiting verification"
            : valid
              ? "all signatures + hash links intact"
              : `broken at sequence #${chain?.brokenAt ?? "?"}`}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <Stat label="Total" value={chain?.chainLength ?? 0} />
        <Stat label="Allow" value={chain?.allowCount ?? 0} tone="pass" />
        <Stat label="Deny" value={chain?.denyCount ?? 0} tone="deny" />
      </div>

      {(chain?.gaps?.length || chain?.brokenAt != null) && (
        <div className="mt-3 space-y-1 rounded border border-deny/30 bg-deny/5 p-2.5 text-[11px]">
          {chain?.gaps && chain.gaps.length > 0 && (
            <div className="text-deny">
              Sequence gaps: {chain.gaps.join(", ")}
            </div>
          )}
          {chain?.brokenAt != null && (
            <div className="text-deny">Broken at: #{chain.brokenAt}</div>
          )}
          {chain?.errors?.map((e, i) => (
            <div key={i} className="text-ink-soft">
              {e}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "pass" | "deny";
}) {
  const color =
    tone === "pass" ? "text-pass" : tone === "deny" ? "text-deny" : "text-ink";
  return (
    <div className="rounded border border-white/10 bg-surface-2/60 px-2 py-2 text-center">
      <div className={`font-mono text-[18px] font-semibold ${color}`}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-ink-dim">
        {label}
      </div>
    </div>
  );
}

/* ===================================================================== */
/* Tamper demo                                                           */
/* ===================================================================== */
function TamperPanel({
  tamper,
  tampering,
  onSimulate,
}: {
  tamper: TamperPreview | null;
  tampering: boolean;
  onSimulate: () => void;
}) {
  return (
    <Panel
      title="Tamper demo"
      desc="Flip one decision and watch verification reject the forged chain."
    >
      <button
        onClick={onSimulate}
        disabled={tampering}
        className="w-full rounded border border-deny/50 bg-deny/15 px-3 py-2.5 text-[13px] font-semibold text-deny transition hover:bg-deny/25 disabled:cursor-wait disabled:opacity-60"
      >
        {tampering ? "simulating…" : "⚠ Simulate tampering"}
      </button>

      {tamper && (
        <div className="row-in mt-3 rounded border border-deny/50 bg-deny/10 p-3.5">
          <div className="text-[13px] font-semibold text-deny">
            Forged decision #{tamper.tamperedSequence}:{" "}
            <span className="font-mono">
              {tamper.flippedFrom} → {tamper.flippedTo}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[12px]">
            <span className="rounded-sm bg-pass/15 px-1.5 py-0.5 text-pass">
              before: {tamper.before.valid ? "VALID ✓" : "broken"}
            </span>
            <span className="text-ink-dim">→</span>
            <span className="rounded-sm bg-deny/20 px-1.5 py-0.5 font-semibold text-deny">
              after: {tamper.after.valid ? "valid" : "FAILS ✗"}
            </span>
          </div>
          <div className="mt-2.5 rounded-sm border border-deny/30 bg-black/30 px-2.5 py-2 font-mono text-[11px] text-deny">
            Chain verification now FAILS at #{tamper.after.brokenAt ?? "?"}:{" "}
            {tamper.after.error}
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ===================================================================== */
/* Policy viewer                                                         */
/* ===================================================================== */
function PolicyViewer({
  policy,
  open,
  onToggle,
  policyHash,
}: {
  policy: string;
  open: boolean;
  onToggle: () => void;
  policyHash?: string;
}) {
  return (
    <Panel
      title="Policy"
      desc="The exact YAML the enclave is enforcing — hashed into every decision."
      right={
        policyHash ? (
          <span className="font-mono text-[10px] text-ink-dim">
            {truncMid(policyHash, 6, 6)}
          </span>
        ) : undefined
      }
    >
      <button
        onClick={onToggle}
        className="mb-2 inline-flex items-center gap-1.5 text-[12px] text-eigen-accent-soft transition hover:text-eigen-accent"
      >
        <span
          className={`transition-transform ${open ? "rotate-90" : ""}`}
        >
          ▸
        </span>
        {open ? "Hide policy" : "Show policy"}
      </button>
      {open && (
        <pre className="max-h-[300px] overflow-auto rounded border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-ink-soft">
          {policy || "# policy unavailable"}
        </pre>
      )}
    </Panel>
  );
}
